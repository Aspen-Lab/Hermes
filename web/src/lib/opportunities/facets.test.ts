import { afterEach, describe, expect, it } from "vitest";
import { runEventsPipeline } from "@/lib/events/pipeline";
import { eventSources } from "@/lib/events/sources";
import type {
  EventSourceAdapter,
  RawEventItem,
} from "@/lib/events/types";
import type { CachedPool, PoolCache } from "./pool-cache";
import {
  countOpportunityFacets,
  DEFAULT_OPPORTUNITY_TOP_N,
  MAX_OPPORTUNITY_POOL_ITEMS,
  opportunityFormat,
} from "./facets";

class MemoryPoolCache implements PoolCache {
  readonly values = new Map<string, CachedPool>();

  async get(key: string): Promise<CachedPool | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, pool: CachedPool): Promise<void> {
    this.values.set(key, pool);
  }
}

const originalEventSources = [...eventSources];

afterEach(() => {
  eventSources.splice(0, eventSources.length, ...originalEventSources);
});

describe("opportunity facet counting", () => {
  it("counts city before country, calendar month, and event format", () => {
    const counts = countOpportunityFacets("events", [
      {
        location: "Chicago, IL + Virtual",
        place: { city: "Chicago", country: "United States" },
        startDate: "2026-09-10",
        isOnline: true,
      },
      {
        location: "chicago",
        place: { city: "chicago", country: "United States" },
        startDate: "2026-09-28T12:00:00Z",
        isOnline: false,
      },
      {
        location: "Online",
        place: { country: "Germany" },
        startDate: "October 5, 2026",
        isOnline: true,
      },
      {
        location: "Online",
        startDate: "2026-10-18",
        isOnline: true,
      },
      {
        location: "See event page",
        startDate: "",
        isOnline: false,
      },
    ]);

    expect(counts.location).toEqual({ Chicago: 2, Germany: 1 });
    expect(counts.month).toEqual({ "2026-09": 2, "2026-10": 2 });
    expect(counts.format).toEqual({
      "in-person": 2,
      online: 1,
      hybrid: 2,
    });
  });

  it("treats remote jobs as online unless the posting says hybrid", () => {
    expect(
      opportunityFormat("jobs", {
        location: "Remote — United States",
        place: { country: "United States" },
        isRemote: true,
      }),
    ).toBe("online");
    expect(
      opportunityFormat("jobs", {
        location: "Hybrid in Chicago",
        place: { city: "Chicago" },
        isRemote: false,
      }),
    ).toBe("hybrid");
  });
});

describe("opportunity feed facet contract", () => {
  it("returns a capped full pool whose counts ignore the displayed slice", async () => {
    const candidates: RawEventItem[] = Array.from(
      { length: MAX_OPPORTUNITY_POOL_ITEMS + 1 },
      (_, index) => {
        const inChicago = index % 2 === 0;
        return {
          id: `eventweb:facet-${index}`,
          source: "eventweb",
          name: `Solid-State Battery Summit code${String(index).padStart(3, "0")}`,
          type: "conference",
          startDate: "2026-09-10",
          location: inChicago ? "Chicago, IL + Virtual" : "Berlin, Germany",
          place: inChicago
            ? { city: "Chicago", region: "IL", country: "United States" }
            : { country: "Germany" },
          isOnline: inChicago,
          description:
            "Solid-state battery electrochemistry research conference.",
          // Detail enrichment deliberately skips this host, keeping the test
          // deterministic and network-free.
          url: `https://10times.com/facet-${index}`,
          tags: ["solid-state battery"],
        };
      },
    );
    const source: EventSourceAdapter = {
      id: "eventweb",
      enabled: () => true,
      fetch: async () => candidates,
    };
    eventSources.splice(0, eventSources.length, source);

    const response = await runEventsPipeline(
      {
        topics: ["solid-state battery"],
        aiTier: 0,
      },
      {
        cache: new MemoryPoolCache(),
        now: new Date(2026, 6, 27, 12, 0, 0),
      },
    );

    expect(response.items).toHaveLength(DEFAULT_OPPORTUNITY_TOP_N);
    expect(response.pool).toHaveLength(MAX_OPPORTUNITY_POOL_ITEMS);
    expect(response.facetCounts).toEqual({
      location: { Chicago: 100, Germany: 100 },
      month: { "2026-09": MAX_OPPORTUNITY_POOL_ITEMS },
      format: { "in-person": 100, online: 0, hybrid: 100 },
    });
    expect(response.meta.beforeScoreFloor).toBe(MAX_OPPORTUNITY_POOL_ITEMS);
  });
});
