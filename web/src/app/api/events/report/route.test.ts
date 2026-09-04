import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultProfile, type Event } from "@/types";

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
    expect(await response.json()).toEqual({
      enrichment: null,
      noLlm: true,
      sourceReadStatus: "not-requested",
    });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ byok: false, path: "event-report" }),
    );
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

    expect(await response.json()).toEqual({
      enrichment: null,
      noLlm: true,
      sourceReadStatus: "failed",
    });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ byok: false, path: "event-report" }),
    );
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

    expect(await response.json()).toEqual({
      enrichment: {},
      noLlm: false,
      sourceReadStatus: "read",
    });
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

  it("sends only trusted complete report evidence to the provider prompt", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("{}");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "<main><p>Programme evidence.</p></main>", { status: 200 },
    )));
    const reportEvent = {
      ...event,
      activities: ["workshop"],
      organisations: [{ name: "Volta Lab", descriptor: "Exhibitor" }],
      linkOfficial: "https://events.example.com/summit",
    };

    await POST(request({ event: { ...reportEvent, shortDescription: "Search snippet only." } }));
    let prompt = JSON.parse((generateJsonText.mock.calls[0][0] as { userPrompt: string }).userPrompt) as {
      event: Record<string, unknown>;
    };
    expect(prompt.event.shortDescription).toBeUndefined();

    generateJsonText.mockClear();
    await POST(request({ event: {
      ...reportEvent,
      reportSummary: { text: "Trusted source sentence.", authority: "source-record" },
    } }));
    prompt = JSON.parse((generateJsonText.mock.calls[0][0] as { userPrompt: string }).userPrompt) as {
      event: Record<string, unknown>;
    };
    expect(prompt.event.shortDescription).toBe("Trusted source sentence.");
  });

  it("keeps marked heading evidence inside the single 40,000-character source cap", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("{}");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const paragraphs = Array.from(
      { length: 180 },
      (_, index) => `<p>Detail ${index} ${"evidence ".repeat(35)}</p>`,
    ).join("");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `<main><h3>Interface Stability in Solid-State Cells</h3>${paragraphs}</main>`,
          { status: 200 },
        ),
      ),
    );

    await POST(
      request({
        event: {
          ...event,
          linkOfficial: "https://events.example.com/large-programme",
        },
      }),
    );

    const prompt = JSON.parse(
      (generateJsonText.mock.calls[0][0] as { userPrompt: string }).userPrompt,
    ) as { fetchedPageText: string };
    expect(prompt.fetchedPageText.length).toBeLessThanOrEqual(40_000);
    expect(prompt.fetchedPageText).toContain(
      "[PROGRAMME HEADING LEVEL 3] Interface Stability in Solid-State Cells",
    );
    expect(prompt).not.toHaveProperty("programmeHeadingCandidates");
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
      posterFit: { fits: true, points: ["The supplied scope overlaps.", "Second point."] },
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
      talkSummaries: [
        {
          title: "Interface Stability in Solid-State Cells",
          about: "A session on solid-state interfaces.",
        },
      ],
      posterFit: {
        fits: true,
        points: ["The call overlaps with the declared interface work.", "Second point."],
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
        `<main><h3>Interface Stability in Solid-State Cells</h3>` +
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

    expect(await response.json()).toEqual({
      enrichment,
      noLlm: false,
      sourceReadStatus: "read",
    });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(
      llmOverride,
      expect.objectContaining({ byok: true, path: "event-report" }),
    );
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
    expect(prompt.fetchedPageText).toContain(
      "[PROGRAMME HEADING LEVEL 3] Interface Stability in Solid-State Cells",
    );
    expect(prompt).not.toHaveProperty("programmeHeadingCandidates");
    expect(mocks.resolveProvider.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    );
  });

  it("returns null enrichment when the provider output is unparseable", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("not json");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(request({ event }));

    expect(await response.json()).toEqual({
      enrichment: null,
      noLlm: false,
      sourceReadStatus: "failed",
    });
    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });

  it("reports a failed programme read while retaining usable landing text", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("{}");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "https://events.example.com/partial-summit") {
        return new Response(
          `<main><p>Readable landing details.</p>` +
            `<a href="/partial-summit/programme">Full programme</a></main>`,
          { status: 200 },
        );
      }
      return new Response("<main>Please enable JavaScript.</main>", {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        event: {
          ...event,
          linkOfficial: "https://events.example.com/partial-summit",
        },
      }),
    );

    expect(await response.json()).toEqual({
      enrichment: {},
      noLlm: false,
      sourceReadStatus: "failed",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    const modelRequest = generateJsonText.mock.calls[0][0] as {
      userPrompt: string;
    };
    const prompt = JSON.parse(modelRequest.userPrompt) as {
      fetchedPageText?: string;
    };
    expect(prompt.fetchedPageText).toContain("Readable landing details.");
    expect(prompt.fetchedPageText).not.toContain("enable JavaScript");
  });

  it("reopens within the cache TTL with zero fetches and zero model calls", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        posterFit: { fits: true, points: ["The supplied scope overlaps.", "Second point."] },
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "https://events.example.com/cached-summit") {
        return new Response(
          `<main><p>Landing page details.</p>` +
            `<a href="/cached-summit/programme">Full programme</a></main>`,
          { status: 200 },
        );
      }
      return new Response(
        "<main><p>Interface Stability in Solid-State Cells</p></main>",
        { status: 200 },
      );
    });
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
          event: {
            ...event,
            linkOfficial: "https://events.example.com/cached-summit",
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
        "event:route-cache",
        requestReport,
        Date.UTC(2026, 6, 31),
        storage,
      );

    const first = await load();

    expect(first).toMatchObject({ sourceReadStatus: "read" });
    expect(requestReport).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
