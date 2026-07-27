import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDailyEventPool,
  runEventsPipeline,
} from "@/lib/events/pipeline";
import { eventSources } from "@/lib/events/sources";
import type { EventSourceAdapter, RawEventItem } from "@/lib/events/types";
import { buildDailyJobPool } from "@/lib/jobs/pipeline";
import { jobSources } from "@/lib/jobs/sources";
import type { JobSourceAdapter, RawJobItem } from "@/lib/jobs/types";
import type { CachedPool, PoolCache } from "./pool-cache";

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
    expect(Array.from(cache.values.values())[0]?.items).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstBuild);
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
