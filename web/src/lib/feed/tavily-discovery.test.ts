import { afterEach, describe, expect, it, vi } from "vitest";

// Phase 3 round 6 C, ITEM 3 (Ruling 120e/122e item 3/123d/123g item 3). No
// test file existed for this module before this item (confirmed absent —
// matches Phase 3 round 5 B, Deliverable 4's own blast-radius finding). Only
// the network boundary (`webSearch.fetch`) is stood in for; every function
// under test here — `canRunTavilyDiscovery`, `canRunGeminiDiscovery`,
// `runTavilyDiscovery`'s own dispatch logic — is the real, shipped code.
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sources", () => ({
  webSearch: { id: "web", fetch: fetchMock },
}));

import { compileSearchBrief } from "./profile-compiler";
import { canRunGeminiDiscovery, runTavilyDiscovery } from "./tavily-discovery";
import type { FeedRequest } from "./types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

function req(searchConnectors?: FeedRequest["searchConnectors"]): FeedRequest {
  return { topics: ["solid-state battery electrolytes"], searchConnectors };
}

// New gate, mirrors `geminiWebSearchOptions`'s own opt-out shape byte-for-byte
// (Phase 3 round 5 B, Deliverable 4; `sources/gemini-search.ts:230-235` is
// the named precedent). Corpus mirrors that function's own shipped test
// block (`gemini-search.test.ts:676-700`) so the two stay comparable.
describe("canRunGeminiDiscovery (Phase 3 round 6 C, ITEM 3)", () => {
  it("is true under the exact Phase 3 profile: gemini available, Tavily disabled", () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    expect(
      canRunGeminiDiscovery(
        req({ tavily: { enabled: false }, gemini: { enabled: true } }),
      ),
    ).toBe(true);
  });

  it("defaults to available (no explicit opt-out) when Vertex is present", () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    expect(canRunGeminiDiscovery(req(undefined))).toBe(true);
    expect(canRunGeminiDiscovery(req({}))).toBe(true);
  });

  it("respects an explicit gemini opt-out even when Vertex is available", () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    expect(canRunGeminiDiscovery(req({ gemini: { enabled: false } }))).toBe(false);
  });

  it("is false when Vertex is genuinely absent, whatever the connector says — a real capability check, not a rubber stamp", () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "");
    expect(canRunGeminiDiscovery(req({ gemini: { enabled: true } }))).toBe(false);
  });
});

// `runTavilyDiscovery`'s dispatch, mirrors `feed/pipeline.ts:118-123`'s own
// `paperWebSearch` ternary order exactly — Tavily checked first, gemini only
// in the fallback. Failure direction binding (Ruling 123d): a miss falls to
// the status quo (`{queryBoosts: [], resultCount: 0}`), never an invented
// result.
describe("runTavilyDiscovery dispatch (Phase 3 round 6 C, ITEM 3)", () => {
  it("requests the gemini provider under the exact Phase 3 profile", async () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    fetchMock.mockResolvedValue([]);
    const r = req({ tavily: { enabled: false }, gemini: { enabled: true } });

    await runTavilyDiscovery(r, compileSearchBrief(r));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const query = fetchMock.mock.calls[0][0];
    expect(query.webSearch).toEqual({ provider: "gemini" });
  });

  it("still prefers Tavily when both are available — dispatch order unchanged from today", async () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    fetchMock.mockResolvedValue([]);
    const r = req({
      tavily: { enabled: true, apiKey: "test-tavily-key" },
      gemini: { enabled: true },
    });

    await runTavilyDiscovery(r, compileSearchBrief(r));

    const query = fetchMock.mock.calls[0][0];
    expect(query.webSearch.provider).toBe("tavily");
    expect(query.webSearch.tavilyApiKey).toBe("test-tavily-key");
    expect(query.webSearch.includeDomains).toBeDefined();
  });

  it("returns the status-quo empty result and never calls fetch when neither provider is available", async () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "");
    const r = req({ tavily: { enabled: false } });

    const result = await runTavilyDiscovery(r, compileSearchBrief(r));

    expect(result).toEqual({ queryBoosts: [], resultCount: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The one place B's own blast-radius note flagged a careless port would
  // crash rather than degrade: `req.searchConnectors.tavily` is genuinely
  // absent when gemini is the active branch, so the non-null assertion that
  // reads it must be conditional on `useTavily`, not unconditional.
  it("does not throw when the tavily connector is genuinely absent and gemini is the active branch", async () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    fetchMock.mockResolvedValue([]);
    const r: FeedRequest = {
      topics: ["battery"],
      searchConnectors: { gemini: { enabled: true } },
    };

    await expect(runTavilyDiscovery(r, compileSearchBrief(r))).resolves.not.toThrow();
    const query = fetchMock.mock.calls[0][0];
    expect(query.webSearch).toEqual({ provider: "gemini" });
  });

  // Return-shape contract (B's own Deliverable 4 point 2): unchanged —
  // `isAcademicLead`/`buildQueryBoosts` are provider-agnostic and operate on
  // the returned `RawItem[]` only, so gemini's raw results are filtered and
  // scored exactly like Tavily's always were.
  it("computes queryBoosts/resultCount from gemini's raw results the same way as Tavily's — return shape unchanged", async () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "probe-project");
    fetchMock.mockResolvedValue([
      {
        id: "web:1",
        source: "web",
        title:
          "Fundamentals of Electrolytes for Solid-State Batteries: A Comprehensive Review",
        authors: [],
        url: "https://arxiv.org/abs/1234.5678",
        publishedAt: "",
        metadata: {},
      },
      {
        id: "web:2",
        source: "web",
        title: "Home",
        authors: [],
        url: "https://example.com/",
        metadata: {},
        publishedAt: "",
      },
    ]);
    const r = req({ tavily: { enabled: false }, gemini: { enabled: true } });

    const result = await runTavilyDiscovery(r, compileSearchBrief(r));

    // Only the arxiv.org row is on an academic host; the non-academic
    // example.com row is filtered out exactly as it would be from Tavily.
    expect(result.resultCount).toBe(1);
    expect(result.queryBoosts).toContain(
      "Fundamentals of Electrolytes for Solid-State Batteries: A Comprehensive Review",
    );
  });
});
