import { afterEach, describe, expect, it } from "vitest";
import { runEventsPipeline } from "@/lib/events/pipeline";
import { eventSources } from "@/lib/events/sources";
import { MIN_SCORE } from "@/lib/events/scoring";
import type {
  EventSourceAdapter,
  RawEventItem,
  ScoredEventItem,
} from "@/lib/events/types";
import { runJobsPipeline } from "@/lib/jobs/pipeline";
import { MIN_SCORE as JOB_MIN_SCORE } from "@/lib/jobs/scoring";
import type { ScoredJobItem } from "@/lib/jobs/types";
import type { Job } from "@/types";
import {
  derivePoolCacheKey,
  type CachedPool,
  type PoolCache,
} from "./pool-cache";
import {
  countJobFacets,
  countOpportunityFacets,
  DEFAULT_JOB_FACET_SELECTION,
  DEFAULT_OPPORTUNITY_TOP_N,
  filterJobsByFacets,
  filterOpportunitiesByFacets,
  MAX_OPPORTUNITY_POOL_ITEMS,
  opportunityFormat,
  parseOpportunityFacetSelection,
} from "./facets";

const FACET_JOBS: Job[] = [
  {
    id: "intern-chicago",
    roleTitle: "Battery Research Intern",
    companyOrLab: "Peer Lab",
    location: "Chicago, IL",
    place: { city: "Chicago", country: "United States" },
    isRemote: false,
    keyRequirements: [],
    matchReason: "Match",
    postedDate: "2026-07-29T12:00:00.000Z",
    roleKind: "internship",
    visa: { state: "sponsors", country: "United States" },
  },
  {
    id: "staff-berlin",
    roleTitle: "Battery Scientist",
    companyOrLab: "Peer Lab",
    location: "Berlin, Germany",
    place: { city: "Berlin", country: "Germany" },
    isRemote: false,
    keyRequirements: [],
    matchReason: "Match",
    postedDate: "2026-07-20T12:00:00.000Z",
    roleKind: "staff",
    visa: { state: "wont-sponsor", country: "Germany" },
  },
  {
    id: "postdoc-remote",
    roleTitle: "Electrochemistry Postdoc",
    companyOrLab: "Peer Lab",
    location: "Remote",
    isRemote: true,
    keyRequirements: [],
    matchReason: "Match",
    postedDate: "2026-06-01T12:00:00.000Z",
    roleKind: "postdoc",
  },
];

describe("job opportunity facets", () => {
  const nowMs = new Date("2026-07-30T12:00:00.000Z").getTime();

  it("narrows the pool by role kind", () => {
    expect(
      filterJobsByFacets(FACET_JOBS, {
        ...DEFAULT_JOB_FACET_SELECTION,
        roleKinds: ["internship"],
      }).map((job) => job.id),
    ).toEqual(["intern-chicago"]);
  });

  it("narrows the pool by visa state", () => {
    expect(
      filterJobsByFacets(FACET_JOBS, {
        ...DEFAULT_JOB_FACET_SELECTION,
        visaStates: ["wont-sponsor"],
      }).map((job) => job.id),
    ).toEqual(["staff-berlin"]);
  });

  it("keeps the pool when an only-location has zero results today", () => {
    expect(
      filterJobsByFacets(FACET_JOBS, {
        ...DEFAULT_JOB_FACET_SELECTION,
        locations: ["Tokyo"],
        locationMode: "only",
      }),
    ).toEqual(FACET_JOBS);
  });

  it("counts internships separately and counts both city and country", () => {
    const counts = countJobFacets(FACET_JOBS, nowMs);

    expect(counts.roleKinds.internship).toBe(1);
    expect(counts.locations).toMatchObject({
      Chicago: 1,
      "United States": 1,
      Berlin: 1,
      Germany: 1,
    });
    expect(counts.when).toEqual({
      any: 3,
      "24h": 1,
      "7d": 1,
      "30d": 2,
    });
  });

  it("uses authorised countries as a safe default with an override", () => {
    const selection = { ...DEFAULT_JOB_FACET_SELECTION };

    expect(
      filterJobsByFacets(FACET_JOBS, selection, {
        authorisedCountries: [],
      }),
    ).toEqual(FACET_JOBS);
    expect(
      filterJobsByFacets(FACET_JOBS, selection, {
        authorisedCountries: ["United States"],
      }).map((job) => job.id),
    ).toEqual(["intern-chicago", "postdoc-remote"]);
    expect(
      filterJobsByFacets(
        FACET_JOBS,
        { ...selection, includeVisaMismatch: true },
        { authorisedCountries: ["United States"] },
      ),
    ).toEqual(FACET_JOBS);

    const visaCountryOnly = {
      ...FACET_JOBS[1],
      id: "staff-visa-country-only",
      place: undefined,
      location: "Remote",
    };
    expect(
      filterJobsByFacets([visaCountryOnly], selection, {
        authorisedCountries: ["United States"],
      }),
    ).toEqual([]);
  });
});

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

  it("sanitizes selections and lets hybrid events match online and city", () => {
    expect(
      parseOpportunityFacetSelection({
        location: [" Chicago ", "chicago", 42],
        month: ["2026-09"],
        format: ["online", "invalid"],
      }),
    ).toEqual({
      location: ["Chicago"],
      month: ["2026-09"],
      format: ["online"],
    });

    const hybrid = {
      location: "Chicago, IL + Virtual",
      place: { city: "Chicago", region: "IL" },
      date: "2026-09-10",
      isOnline: true,
    };
    expect(
      filterOpportunitiesByFacets("events", [hybrid], {
        location: ["Chicago"],
        month: ["2026-09"],
        format: ["online"],
      }),
    ).toEqual([hybrid]);
    expect(
      filterOpportunitiesByFacets("events", [hybrid], {
        location: ["Berlin"],
        format: ["online"],
      }),
    ).toEqual([]);
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

  it("bypasses MIN_SCORE for an explicit facet without filtering the pool", async () => {
    const cache = new MemoryPoolCache();
    const testNow = new Date(2026, 6, 27, 12, 0, 0);
    const lowScoreItem: ScoredEventItem = {
      id: "eventweb:below-floor-chicago",
      source: "eventweb",
      name: "Battery Community Meetup",
      type: "meetup",
      startDate: "2026-09-20",
      location: "Chicago, IL",
      place: { city: "Chicago", region: "IL", country: "United States" },
      isOnline: false,
      description: "A small battery community meetup.",
      url: "https://10times.com/below-floor-chicago",
      tags: ["battery"],
      score: MIN_SCORE - 0.1,
      matchedKeywords: ["battery"],
      relevanceReason: "Matches the selected Chicago facet",
    };
    const key = derivePoolCacheKey({
      surface: "events",
      requiredTopics: [],
      now: testNow,
    });
    await cache.set(key, {
      surface: "events",
      items: [lowScoreItem],
      facetCounts: countOpportunityFacets("events", [lowScoreItem]),
      generatedAt: testNow.toISOString(),
      localDate: "2026-07-27",
    });

    const unfiltered = await runEventsPipeline(
      { topics: [], aiTier: 0 },
      { cache, now: testNow },
    );
    const filtered = await runEventsPipeline(
      {
        topics: [],
        facets: { location: ["Chicago"] },
        aiTier: 0,
      },
      { cache, now: testNow },
    );

    expect(unfiltered.items).toHaveLength(0);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].relevanceScore).toBeLessThan(MIN_SCORE);
    expect(filtered.pool).toHaveLength(1);
    expect(filtered.facetCounts.location).toEqual({ Chicago: 1 });
    expect(filtered.meta.beforeScoreFloor).toBe(1);
    expect(filtered.meta.afterScoreFloor).toBe(1);
  });

  it("applies the same explicit-facet floor bypass to jobs", async () => {
    const cache = new MemoryPoolCache();
    const testNow = new Date(2026, 6, 27, 12, 0, 0);
    const lowScoreItem: ScoredJobItem = {
      id: "jobweb:below-floor-berlin",
      source: "jobweb",
      title: "Senior Staff Lab Assistant",
      company: "Example Corp",
      location: "Berlin, Germany",
      place: { city: "Berlin", country: "Germany" },
      isRemote: false,
      description: "Assist a battery research team.",
      url: "https://10times.com/below-floor-berlin-job",
      postedAt: "2026-01-01",
      tags: [],
      score: JOB_MIN_SCORE - 0.1,
      matchedKeywords: ["battery"],
      matchReason: "Matches the selected Berlin facet",
    };
    const key = derivePoolCacheKey({
      surface: "jobs",
      requiredTopics: [],
      careerStage: "PhD Year 2",
      now: testNow,
    });
    await cache.set(key, {
      surface: "jobs",
      items: [lowScoreItem],
      facetCounts: countOpportunityFacets("jobs", [lowScoreItem]),
      generatedAt: testNow.toISOString(),
      localDate: "2026-07-27",
    });

    const unfiltered = await runJobsPipeline(
      {
        topics: [],
        careerStage: "PhD Year 2",
        industryVsAcademia: "academia",
        aiTier: 0,
      },
      { cache, now: testNow },
    );
    const filtered = await runJobsPipeline(
      {
        topics: [],
        careerStage: "PhD Year 2",
        industryVsAcademia: "academia",
        facets: { location: ["Berlin"] },
        aiTier: 0,
      },
      { cache, now: testNow },
    );

    expect(unfiltered.items).toHaveLength(0);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].relevanceScore).toBeLessThan(JOB_MIN_SCORE);
    expect(filtered.pool).toHaveLength(1);
    expect(filtered.facetCounts.location).toEqual({ Berlin: 1 });
  });
});
