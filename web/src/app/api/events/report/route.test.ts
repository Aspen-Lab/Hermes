import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultProfile, type Event } from "@/types";

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

const event: Event = {
  id: "event:1",
  name: "Solid-State Battery Summit",
  type: "conference",
  date: "2026-09-10",
  location: "Chicago, IL",
  isOnline: false,
  shortDescription: "A research conference on solid-state batteries.",
  relevanceReason: "Matches solid-state battery research.",
  activities: ["Interface stability session"],
  organisations: [{ name: "Volta Lab", descriptor: "Exhibitor" }],
};

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/events/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/events/report", () => {
  it("makes no page fetch or model call when no provider resolves", async () => {
    mocks.resolveProvider.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        event: {
          ...event,
          shortDescription: "A professional gathering.",
          activities: ["tutorial", "panel", "keynote"],
          organisations: [],
          people: [],
          linkOfficial: "https://events.example.com/summit",
        },
        contextHint: "Topics: batteries",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enrichment: null, noLlm: true });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the model after provider resolution when generic labels have no page", async () => {
    const generateJsonText = vi.fn();
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(
      request({
        event: {
          ...event,
          shortDescription: "A professional gathering.",
          activities: ["tutorial", "panel", "keynote"],
          organisations: [],
        },
        contextHint: "Topics: batteries",
      }),
    );

    expect(await response.json()).toEqual({ enrichment: null, noLlm: true });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(null);
    expect(generateJsonText).not.toHaveBeenCalled();
  });

  it("reads the page when Tier 0 found only generic session types", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("{}");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        "<main><p>Programme: Interface Stability in Solid-State Cells.</p></main>",
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        event: {
          ...event,
          shortDescription: "A professional gathering.",
          activities: ["tutorial", "panel", "keynote"],
          organisations: [],
          linkOfficial: "https://events.example.com/summit",
        },
        contextHint: "Topics: batteries",
      }),
    );

    expect(await response.json()).toEqual({ enrichment: {}, noLlm: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    const modelRequest = generateJsonText.mock.calls[0][0] as {
      userPrompt: string;
    };
    expect(JSON.parse(modelRequest.userPrompt)).toMatchObject({
      fetchedPageText:
        "Programme: Interface Stability in Solid-State Cells.",
    });
  });

  it("makes zero client network requests when the user has no provider", async () => {
    const requestReport = vi.fn();

    const result = await loadConfiguredOpportunityEnrichment(
      defaultProfile,
      "event:no-provider",
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
      posterFit: { fits: true, reasoning: "The supplied scope overlaps." },
    });

    const result = await loadConfiguredOpportunityEnrichment(
      defaultProfile,
      "event:local-default",
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
      posterFit: {
        fits: true,
        reasoning: "The call overlaps with the declared interface work.",
      },
    };
    const generateJsonText = vi.fn().mockResolvedValue(JSON.stringify(enrichment));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const llmOverride = { provider: "gemini", apiKey: "test-key" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://events.example.com/summit") {
        return new Response(
          `<main><p>Landing page details.</p>` +
            `<a href="/summit/programme">Full programme</a></main>`,
          { status: 200 },
        );
      }
      return new Response(
        `<main><p>Interface Stability in Solid-State Cells</p>` +
          `<a href="/summit/programme/day-two">Programme day two</a></main>`,
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        event: {
          ...event,
          shortDescription: "A professional gathering.",
          activities: ["tutorial", "panel", "keynote"],
          organisations: [],
          people: [],
          linkOfficial: "https://events.example.com/summit",
        },
        contextHint: "Topics: batteries",
        llmOverride,
      }),
    );

    expect(await response.json()).toEqual({ enrichment, noLlm: false });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(llmOverride);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://events.example.com/summit",
      "https://events.example.com/summit/programme",
    ]);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "large", maxTokens: 2000 }),
    );
    const modelRequest = generateJsonText.mock.calls[0][0] as {
      userPrompt: string;
    };
    const prompt = JSON.parse(modelRequest.userPrompt) as {
      fetchedPageText?: string;
    };
    expect(prompt.fetchedPageText).toContain("Landing page details.");
    expect(prompt.fetchedPageText).toContain(
      "Interface Stability in Solid-State Cells",
    );
    expect(mocks.resolveProvider.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    );
  });

  it("returns null enrichment when the provider output is unparseable", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("not json");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(request({ event }));

    expect(await response.json()).toEqual({ enrichment: null, noLlm: false });
    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });

  it("reopens the same cached report without a second provider call", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        posterFit: { fits: true, reasoning: "The supplied scope overlaps." },
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const storage = new MemoryStorage();
    const profile = {
      ...defaultProfile,
      feedAiProvider: "gemini" as const,
      feedAiApiKey: "test-key",
    };
    const requestReport = vi.fn(async (llmOverride) => {
      const response = await POST(request({ event, llmOverride }));
      const result = (await response.json()) as { enrichment: unknown | null };
      return result.enrichment;
    });
    const load = () =>
      loadConfiguredOpportunityEnrichment(
        profile,
        "event:route-cache",
        requestReport,
        Date.UTC(2026, 6, 31),
        storage,
      );

    await load();
    await load();

    expect(requestReport).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });
});
