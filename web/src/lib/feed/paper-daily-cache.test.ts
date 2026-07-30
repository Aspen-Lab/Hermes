import { afterEach, describe, expect, it, vi } from "vitest";
import { runFeedPipeline } from "./pipeline";
import { bySourceId, webSearch } from "@/lib/sources";
import type { RawItem } from "@/lib/sources/types";
import type { CachedPool, PoolCache } from "@/lib/opportunities/pool-cache";

class MemoryPoolCache implements PoolCache {
  readonly values = new Map<string, CachedPool>();

  async get(key: string): Promise<CachedPool | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, pool: CachedPool): Promise<void> {
    this.values.set(key, pool);
  }
}

const academicPaper: RawItem = {
  id: "openalex:daily-paper",
  source: "openalex",
  title: "Solid-State Battery Electrolytes for High Energy Cells",
  authors: ["A. Researcher"],
  abstract:
    "Solid-state battery electrolyte design improves electrochemical stability.",
  url: "https://openalex.org/W123",
  publishedAt: "2026-07-20",
  venue: "Journal of Battery Research",
  tags: ["solid-state battery", "electrolyte"],
  metadata: {},
};

const originalAcademicFetch = bySourceId.openalex.fetch;
const originalWebFetch = webSearch.fetch;

afterEach(() => {
  bySourceId.openalex.fetch = originalAcademicFetch;
  webSearch.fetch = originalWebFetch;
});

describe("paper daily web-discovery cache", () => {
  it("reuses Tavily discovery while free academic sources stay live", async () => {
    const academicFetch = vi.fn(async () => [academicPaper]);
    const searchFetch = vi.fn(async () => [
      {
        ...academicPaper,
        id: "web:https://arxiv.org/abs/2607.12345",
        source: "web" as const,
        title: "New Solid-State Electrolytes for High Energy Batteries",
        url: "https://arxiv.org/abs/2607.12345",
      },
    ]);
    bySourceId.openalex.fetch = academicFetch;
    webSearch.fetch = searchFetch;
    const cache = new MemoryPoolCache();
    const request = {
      topics: ["solid-state battery"],
      sources: ["openalex" as const],
      aiTier: 1 as const,
      searchConnectors: {
        tavily: { enabled: true, apiKey: "test-key" },
      },
    };
    const now = new Date(2026, 6, 29, 9, 0);

    const first = await runFeedPipeline(request, { cache, now });
    const second = await runFeedPipeline(request, { cache, now });

    expect(first.items).not.toHaveLength(0);
    expect(second.items).not.toHaveLength(0);
    expect(academicFetch).toHaveBeenCalledTimes(2);
    expect(searchFetch).toHaveBeenCalledOnce();
    expect(cache.values).toHaveLength(1);
    expect(second.meta.connectorStats?.tavily).toEqual(
      first.meta.connectorStats?.tavily,
    );
  });
});
