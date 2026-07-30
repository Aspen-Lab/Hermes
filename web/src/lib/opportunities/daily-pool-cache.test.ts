import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDailyEventPool,
  runEventsPipeline,
} from "@/lib/events/pipeline";
import { eventSources } from "@/lib/events/sources";
import type {
  EventsFeedRequest,
  EventSourceAdapter,
  RawEventItem,
} from "@/lib/events/types";
import {
  buildDailyJobPool,
  runJobsPipeline,
} from "@/lib/jobs/pipeline";
import { jobSources } from "@/lib/jobs/sources";
import type { JobSourceAdapter, RawJobItem } from "@/lib/jobs/types";
import { applyOpportunityFacetPreferenceSignal } from "@/lib/preferences/ledger";
import { opportunityRequestBody } from "@/store/feed";
import { defaultProfile, type UserProfile } from "@/types";
import {
  derivePoolCacheKey,
  type CachedPool,
  type PoolCache,
} from "./pool-cache";

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
const originalJobSources = [...jobSources];
const now = new Date(2026, 6, 27, 12, 0, 0);

const eventItem: RawEventItem = {
  id: "eventweb:daily-cache-event",
  source: "eventweb",
  name: "Solid-State Battery Research Summit",
  type: "conference",
  startDate: "2026-09-10",
  location: "Chicago, IL",
  place: { city: "Chicago", region: "IL", country: "United States" },
  isOnline: false,
  description:
    "Solid-state battery research, electrochemistry, and cathode materials.",
  // This host is intentionally skipped by detail enrichment, keeping the
  // counting fetch spy scoped to the source-network call.
  url: "https://10times.com/daily-cache-event",
  tags: ["solid-state battery", "electrochemistry"],
};

const jobItem: RawJobItem = {
  id: "jobweb:daily-cache-job",
  source: "jobweb",
  title: "Solid-State Battery Research Scientist",
  company: "Example Energy",
  location: "Chicago, IL",
  place: { city: "Chicago", region: "IL", country: "United States" },
  isRemote: false,
  description:
    "Lead solid-state battery research and electrochemistry experiments.",
  url: "https://example.test/jobs/solid-state-battery",
  postedAt: "2026-07-20",
  visa: {
    state: "wont-sponsor",
    evidence: "Applicants must already be authorised to work in the US.",
    country: "US",
  },
  tags: ["solid-state battery", "electrochemistry"],
};

afterEach(() => {
  eventSources.splice(0, eventSources.length, ...originalEventSources);
  jobSources.splice(0, jobSources.length, ...originalJobSources);
  vi.unstubAllGlobals();
});

describe("daily opportunity pool wiring", () => {
  it("does zero network work on a same-day event-pool hit", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const source: EventSourceAdapter = {
      id: "eventweb",
      enabled: () => true,
      fetch: async () => {
        await fetch("https://network.test/events");
        return [eventItem];
      },
    };
    eventSources.splice(0, eventSources.length, source);
    const cache = new MemoryPoolCache();
    const request = {
      topics: ["solid-state battery"],
      softTopics: ["electrochemistry"],
      aiTier: 0 as const,
    };

    const first = await buildDailyEventPool(request, { cache, now });
    const callsAfterFirstBuild = fetchSpy.mock.calls.length;
    const second = await buildDailyEventPool(
      { ...request, topN: 1, excludeIds: [eventItem.id] },
      { cache, now },
    );

    expect(first.cacheHit).toBe(false);
    expect(first.items).toHaveLength(1);
    expect(callsAfterFirstBuild).toBeGreaterThan(0);
    expect(second.cacheHit).toBe(true);
    expect(second.items).toEqual(first.items);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstBuild);

    const visible = await runEventsPipeline(request, { cache, now });
    const displayed = await runEventsPipeline(
      { ...request, excludeIds: [eventItem.id] },
      { cache, now },
    );
    expect(visible.items).toHaveLength(1);
    expect(displayed.items).toHaveLength(0);
    const cachedEventPool = Array.from(cache.values.values())[0];
    expect(cachedEventPool?.surface).toBe("events");
    expect(
      cachedEventPool?.surface === "events" ? cachedEventPool.items : [],
    ).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstBuild);
  });

  it("keeps today's event cache key and search count after a pending topic edit", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const source: EventSourceAdapter = {
      id: "eventweb",
      enabled: () => true,
      fetch: async () => {
        await fetch("https://network.test/events");
        return [eventItem];
      },
    };
    eventSources.splice(0, eventSources.length, source);
    const cache = new MemoryPoolCache();
    const profile: UserProfile = {
      ...defaultProfile,
      researchTopics: ["pending-paper"],
      eventRequiredTopics: ["pending-event"],
      eventExploreTopics: ["pending-event-explore"],
      careerStage: "Postdoc",
      locationPreferences: ["Pending location"],
      activeSearchInputs: {
        papers: { required: ["paper"], explore: [] },
        events: {
          required: ["solid-state battery"],
          explore: ["electrochemistry"],
        },
        jobs: { required: ["battery scientist"], explore: [] },
        careerStage: "Research Scientist",
        locationPreferences: ["Chicago"],
        promotedOn: "2026-07-27",
      },
    };
    const firstRequest = opportunityRequestBody(
      profile,
      "events",
      [],
    ) as unknown as EventsFeedRequest;

    const first = await buildDailyEventPool(firstRequest, { cache, now });
    const callsAfterFirstBuild = fetchSpy.mock.calls.length;
    const firstKey = derivePoolCacheKey({
      surface: "events",
      requiredTopics: firstRequest.topics,
      exploreTopics: firstRequest.softTopics,
      careerStage: firstRequest.careerStage,
      locationPreferences: firstRequest.locationPreferences,
      now,
    });
    const editedPending: UserProfile = {
      ...profile,
      researchTopics: ["edited-pending-paper"],
      eventRequiredTopics: ["edited-pending-event"],
      eventExploreTopics: ["edited-pending-event-explore"],
      careerStage: "PhD Year 1",
      locationPreferences: ["Edited pending location"],
    };
    const secondRequest = opportunityRequestBody(
      editedPending,
      "events",
      [],
    ) as unknown as EventsFeedRequest;

    const second = await buildDailyEventPool(secondRequest, { cache, now });
    const secondKey = derivePoolCacheKey({
      surface: "events",
      requiredTopics: secondRequest.topics,
      exploreTopics: secondRequest.softTopics,
      careerStage: secondRequest.careerStage,
      locationPreferences: secondRequest.locationPreferences,
      now,
    });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(secondKey).toBe(firstKey);
    expect(Array.from(cache.values.keys())).toEqual([firstKey]);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstBuild);
  });

  it("reorders a same-day event cache locally from a Chicago facet signal", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const berlinEvent: RawEventItem = {
      ...eventItem,
      id: "eventweb:daily-cache-berlin",
      name: "Solid-State Battery Research Forum Berlin",
      startDate: "2026-09-09",
      location: "Berlin, Germany",
      place: { city: "Berlin", country: "Germany" },
      url: "https://10times.com/daily-cache-berlin",
    };
    const chicagoEvent: RawEventItem = {
      ...eventItem,
      id: "eventweb:daily-cache-chicago",
      name: "Solid-State Battery Research Forum Chicago",
      startDate: "2026-09-10",
      url: "https://10times.com/daily-cache-chicago",
    };
    const sourceFetch = vi.fn(async () => {
      await fetch("https://network.test/events");
      return [berlinEvent, chicagoEvent];
    });
    const source: EventSourceAdapter = {
      id: "eventweb",
      enabled: () => true,
      fetch: sourceFetch,
    };
    eventSources.splice(0, eventSources.length, source);
    const cache = new MemoryPoolCache();
    const request = {
      topics: ["solid-state battery"],
      aiTier: 0 as const,
    };

    const neutral = await runEventsPipeline(request, { cache, now });
    const callsAfterBuild = fetchSpy.mock.calls.length;
    const chicagoLedger = applyOpportunityFacetPreferenceSignal(
      undefined,
      "location",
      "Chicago",
      { origin: "event", at: now.toISOString() },
    );
    const personalized = await runEventsPipeline(
      { ...request, preferenceLedger: chicagoLedger },
      { cache, now },
    );

    expect(neutral.pool.map(({ id }) => id)).toEqual([
      berlinEvent.id,
      chicagoEvent.id,
    ]);
    expect(personalized.pool.map(({ id }) => id)).toEqual([
      chicagoEvent.id,
      berlinEvent.id,
    ]);
    const cachedEventPool = Array.from(cache.values.values())[0];
    expect(cachedEventPool?.surface).toBe("events");
    expect(
      cachedEventPool?.surface === "events"
        ? cachedEventPool.items.map(({ id }) => id)
        : [],
    ).toEqual([berlinEvent.id, chicagoEvent.id]);
    expect(sourceFetch).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterBuild);
  });

  it("does zero network work on a same-day job-pool hit", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const source: JobSourceAdapter = {
      id: "jobweb",
      enabled: () => true,
      fetch: async () => {
        await fetch("https://network.test/jobs");
        return [jobItem];
      },
    };
    jobSources.splice(0, jobSources.length, source);
    const cache = new MemoryPoolCache();
    const request = {
      topics: ["solid-state battery"],
      careerStage: "Research Scientist" as const,
      aiTier: 0 as const,
    };

    const first = await buildDailyJobPool(request, { cache, now });
    const callsAfterFirstBuild = fetchSpy.mock.calls.length;
    const second = await buildDailyJobPool(
      { ...request, topN: 1, excludeIds: [jobItem.id] },
      { cache, now },
    );

    expect(first.cacheHit).toBe(false);
    expect(first.items).toHaveLength(1);
    expect(callsAfterFirstBuild).toBeGreaterThan(0);
    expect(second.cacheHit).toBe(true);
    expect(second.items).toEqual(first.items);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstBuild);
  });

  it("applies work rights after a same-day cache hit without mutating the pool", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const source: JobSourceAdapter = {
      id: "jobweb",
      enabled: () => true,
      fetch: async () => {
        await fetch("https://network.test/jobs");
        return [jobItem];
      },
    };
    jobSources.splice(0, jobSources.length, source);
    const cache = new MemoryPoolCache();
    const request = {
      topics: ["solid-state battery"],
      careerStage: "Research Scientist" as const,
      aiTier: 0 as const,
    };

    const first = await runJobsPipeline(request, { cache, now });
    const callsAfterFirstBuild = fetchSpy.mock.calls.length;
    const authorised = await runJobsPipeline(
      { ...request, authorisedCountries: ["United States"] },
      { cache, now },
    );

    expect(first.pool[0]?.visa).toEqual(jobItem.visa);
    expect(authorised.pool[0]?.visa).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstBuild);
    expect(cache.values).toHaveLength(1);
    const cachedPool = Array.from(cache.values.values())[0];
    expect(cachedPool?.surface).toBe("jobs");
    expect(
      cachedPool?.surface === "jobs" ? cachedPool.items[0]?.visa : undefined,
    ).toEqual(jobItem.visa);
  });

  it("single-flights concurrent same-key misses", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const source: EventSourceAdapter = {
      id: "eventweb",
      enabled: () => true,
      fetch: async () => {
        await fetch("https://network.test/events");
        return [eventItem];
      },
    };
    eventSources.splice(0, eventSources.length, source);
    const cache = new MemoryPoolCache();
    const request = {
      topics: ["solid-state battery"],
      aiTier: 0 as const,
    };

    const [first, second] = await Promise.all([
      buildDailyEventPool(request, { cache, now }),
      buildDailyEventPool(request, { cache, now }),
    ]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect([first.cacheHit, second.cacheHit].sort()).toEqual([false, true]);
    expect(first.items).toEqual(second.items);
  });
});
