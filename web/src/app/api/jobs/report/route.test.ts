import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultProfile, type Job } from "@/types";

const mocks = vi.hoisted(() => ({
  resolveProvider: vi.fn(),
}));

// ABC-freemium 1-06 — the routes now ask the registry whether the request
// carries a usable BYOK override, so the metering wrapper can attribute the
// call. The mock must export it or the module has a hole where a real function
// used to be.
vi.mock("@/lib/llm/providers/registry", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/llm/providers/registry")>();
  return { ...actual, resolveProvider: mocks.resolveProvider };
});

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

// A22-03(b) / Ruling 60d (round 22 C): the deep report now inherits the
// minimum-substance floor — an `owned` verdict alone no longer proves the block
// contains a posting BODY, so a block thinner than two publishable sentences is
// not handed to the model as evidence and the read reports "failed". Every
// caller below that means "a page the model could legitimately read" therefore
// gets a second sentence. The cases that mean the opposite pass their own
// deliberately-thin content and are commented where they do.
const SECOND_SENTENCE =
  "<p>Applicants join the electrochemistry group for a full research term.</p>";

function ownedPage(url: string, content: string): string {
  return `<article><a href="${new URL(url).pathname}">Selected posting</a>${content}${SECOND_SENTENCE}</article>`;
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
    expect(mocks.resolveProvider).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ byok: false, path: "job-report" }),
    );
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
    expect(mocks.resolveProvider).toHaveBeenCalledWith(
      llmOverride,
      expect.objectContaining({ byok: true, path: "job-report" }),
    );
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

  it("makes one fetch but never prompts the model with an unproven sibling listing", async () => {
    const foreignMarker = "Foreign-only hiring detail.";
    const generateJsonText = vi.fn().mockResolvedValue(JSON.stringify({
      competitiveness: { verdict: "Unknown", reasoning: "Insufficient owned evidence." },
    }));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      `<main><article><h2>Different role</h2><p>${foreignMarker}</p></article></main>`,
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({
      job: { ...job, linkPosting: "https://jobs.example.com/selected" },
    }));

    expect((await response.json()).sourceReadStatus).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    const modelRequest = generateJsonText.mock.calls[0][0] as { userPrompt: string };
    expect(modelRequest.userPrompt).not.toContain(foreignMarker);
  });

  // A22-03(b) / Ruling 60d (round 22 C): the deep report's own uniquely-red
  // case for the minimum-substance floor. This block is OWNED — it carries the
  // exact self-link the resolver demands — and it is still not evidence,
  // because it is nothing but that witness. B measured the shipped resolver
  // certifying blocks of 8, 9, 48, 74 and 83 characters as owned.
  it("does not prompt the model with an owned block that carries no posting body", async () => {
    const thinContent = "<p>Careers</p>";
    const generateJsonText = vi.fn().mockResolvedValue(JSON.stringify({
      competitiveness: { verdict: "Unknown", reasoning: "Insufficient owned evidence." },
    }));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      `<article><a href="/thin-role">Selected posting</a>${thinContent}</article>`,
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({
      job: { ...job, linkPosting: "https://jobs.example.com/thin-role" },
    }));

    expect((await response.json()).sourceReadStatus).toBe("failed");
    const modelRequest = generateJsonText.mock.calls[0][0] as { userPrompt: string };
    expect(modelRequest.userPrompt).not.toContain("Careers");
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
