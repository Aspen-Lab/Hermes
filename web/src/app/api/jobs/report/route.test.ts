import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultProfile, type Job } from "@/types";

const mocks = vi.hoisted(() => ({
  resolveProvider: vi.fn(),
}));

vi.mock("@/lib/llm/providers/registry", () => ({
  resolveProvider: mocks.resolveProvider,
}));

import { POST } from "./route";
import { loadConfiguredOpportunityEnrichment } from "@/lib/opportunities/enrichment";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const job: Job = {
  id: "job:1",
  roleTitle: "Battery Research Scientist",
  companyOrLab: "Volta Lab",
  location: "Chicago, IL",
  isRemote: false,
  keyRequirements: ["Electrochemistry", "PhD"],
  matchReason: "Matches solid-state battery research.",
  visa: { state: "not-stated", country: "United States" },
};

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/jobs/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ownedPage(url: string, content: string): string {
  return `<article><a href="${new URL(url).pathname}">Selected posting</a>${content}</article>`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/jobs/report", () => {
  it("makes no page fetch or model call when no provider resolves", async () => {
    mocks.resolveProvider.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        job: { ...job, linkPosting: "https://jobs.example.com/role" },
        contextHint: "Topics: batteries",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      enrichment: null,
      noLlm: true,
      sourceReadStatus: "not-requested",
    });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes zero client network requests when the user has no provider", async () => {
    const requestReport = vi.fn();

    const result = await loadConfiguredOpportunityEnrichment(
      defaultProfile,
      "job:no-provider",
      requestReport,
      Date.UTC(2026, 6, 31),
      new MemoryStorage(),
    );

    expect(result).toBeNull();
    expect(requestReport).not.toHaveBeenCalled();
  });

  it("lets local development resolve the default server Vertex provider", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const requestReport = vi.fn().mockResolvedValue({
      competitiveness: { verdict: "Strong", reasoning: "Methods align." },
    });

    const result = await loadConfiguredOpportunityEnrichment(
      defaultProfile,
      "job:local-default",
      requestReport,
      Date.UTC(2026, 6, 31),
      new MemoryStorage(),
    );

    expect(result).not.toBeNull();
    expect(requestReport).toHaveBeenCalledTimes(1);
    expect(requestReport).toHaveBeenCalledWith(undefined);
  });

  it("uses one large-tier call and returns parsed enrichment", async () => {
    const enrichment = {
      specificRequirements: ["A PhD in electrochemistry is required."],
      specificDuties: ["Design and run solid-state interface experiments."],
      competitiveness: {
        verdict: "Strong match",
        reasoning: "The declared methods match the posting.",
      },
    };
    const generateJsonText = vi.fn().mockResolvedValue(JSON.stringify(enrichment));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const llmOverride = { provider: "gemini", apiKey: "test-key" };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        ownedPage("https://jobs.example.com/role", `<p>A PhD in electrochemistry is required.</p>` +
          `<p>Design and run solid-state interface experiments.</p>` +
          `<a href="/role/schedule">Schedule</a>`),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        job: { ...job, linkPosting: "https://jobs.example.com/role" },
        contextHint: "Topics: batteries",
        llmOverride,
      }),
    );

    expect(await response.json()).toEqual({
      enrichment,
      noLlm: false,
      sourceReadStatus: "read",
    });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(llmOverride);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://jobs.example.com/role",
    ]);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "large", maxTokens: 1600 }),
    );
    const modelRequest = generateJsonText.mock.calls[0][0] as {
      userPrompt: string;
    };
    const prompt = JSON.parse(modelRequest.userPrompt) as {
      fetchedPageText?: string;
    };
    expect(prompt.fetchedPageText).toContain(
      "Design and run solid-state interface experiments.",
    );
    expect(mocks.resolveProvider.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    );
  });

  it("keeps a successful page read distinct from unparseable model output", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("not json");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(ownedPage("https://jobs.example.com/readable-role", "<p>Readable source posting details.</p>"), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        job: { ...job, linkPosting: "https://jobs.example.com/readable-role" },
      }),
    );

    expect(await response.json()).toEqual({
      enrichment: null,
      noLlm: false,
      sourceReadStatus: "read",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });

  it("reopens within the cache TTL with zero fetches and zero model calls", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        competitiveness: { verdict: "Strong", reasoning: "Methods align." },
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn(async () =>
      new Response(ownedPage("https://jobs.example.com/cached-role", "<p>Source posting details.</p>"), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const storage = new MemoryStorage();
    const profile = {
      ...defaultProfile,
      feedAiProvider: "gemini" as const,
      feedAiApiKey: "test-key",
    };
    const requestReport = vi.fn(async (llmOverride) => {
      const response = await POST(
        request({
          job: {
            ...job,
            linkPosting: "https://jobs.example.com/cached-role",
          },
          llmOverride,
        }),
      );
      const result = (await response.json()) as {
        enrichment: unknown | null;
        sourceReadStatus: "read" | "failed" | "not-requested";
      };
      return {
        enrichment: result.enrichment,
        sourceReadStatus: result.sourceReadStatus,
      };
    });
    const load = () =>
      loadConfiguredOpportunityEnrichment(
        profile,
        "job:route-cache",
        requestReport,
        Date.UTC(2026, 6, 31),
        storage,
      );

    const first = await load();

    expect(first).toMatchObject({ sourceReadStatus: "read" });
    expect(requestReport).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledTimes(1);

    requestReport.mockClear();
    fetchMock.mockClear();
    generateJsonText.mockClear();

    const second = await load();

    expect(second).toEqual(first);
    expect(requestReport).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generateJsonText).not.toHaveBeenCalled();
  });
});
