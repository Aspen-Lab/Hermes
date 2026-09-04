import { describe, expect, it } from "vitest";
import {
  derivePoolCacheKey,
  localCalendarDate,
  type CachedPool,
  type PoolCache,
  type PoolCacheKeyInput,
} from "./pool-cache";

const base: PoolCacheKeyInput = {
  surface: "events",
  requiredTopics: ["solid-state batteries", "electrochemistry"],
  exploreTopics: ["cathode materials"],
  careerStage: "PhD Year 4",
  locationPreferences: ["Chicago", "Online"],
  now: new Date(2026, 6, 27, 12, 0, 0),
};

describe("daily opportunity pool cache key", () => {
  it("is deterministic, order-insensitive, and file-safe", () => {
    const first = derivePoolCacheKey(base);
    const reordered = derivePoolCacheKey({
      ...base,
      requiredTopics: [" Electrochemistry ", "SOLID-STATE BATTERIES"],
      exploreTopics: ["  Cathode Materials"],
      locationPreferences: ["online", "chicago"],
    });

    expect(reordered).toBe(first);
    // ABC-freemium 1-17 · R-POOL-1 — REWRITTEN, NOT DELETED. The prefix moves
    // from `v5` and a local DATE to `v6` and a local ISO WEEK on this surface.
    // 2026-07-27 is a Monday, so it opens 2026-W31.
    expect(first).toMatch(/^peer-pool-v6-events-2026-W31-[a-f0-9]{32}$/);
  });

  it("keeps papers on a DAILY key while jobs and events go weekly", () => {
    // ABC-freemium 1-17 — the case that catches an over-broad edit. D3 keeps
    // papers daily because they run on free academic sources.
    const monday = new Date(2026, 6, 27, 12, 0, 0);
    expect(
      derivePoolCacheKey({ ...base, surface: "papers", now: monday }),
    ).toMatch(/^peer-pool-v6-papers-2026-07-27-[a-f0-9]{32}$/);
    expect(derivePoolCacheKey({ ...base, surface: "jobs", now: monday })).toMatch(
      /^peer-pool-v6-jobs-2026-W31-[a-f0-9]{32}$/,
    );
  });

  it("gives two days in the same ISO week the SAME jobs and events key", () => {
    // The whole point of the item: a rebuild once a week, not once a night.
    const monday = new Date(2026, 6, 27, 12, 0, 0);
    const thursday = new Date(2026, 6, 30, 12, 0, 0);

    for (const surface of ["events", "jobs"] as const) {
      expect(derivePoolCacheKey({ ...base, surface, now: thursday })).toBe(
        derivePoolCacheKey({ ...base, surface, now: monday }),
      );
    }
    // ...and papers still change nightly, which is what makes the assertion
    // above a statement about the fork rather than about the whole function.
    expect(
      derivePoolCacheKey({ ...base, surface: "papers", now: thursday }),
    ).not.toBe(
      derivePoolCacheKey({ ...base, surface: "papers", now: monday }),
    );
  });

  it("changes across a Monday boundary", () => {
    const sunday = new Date(2026, 7, 2, 23, 59, 0);
    const monday = new Date(2026, 7, 3, 0, 1, 0);

    expect(derivePoolCacheKey({ ...base, now: monday })).not.toBe(
      derivePoolCacheKey({ ...base, now: sunday }),
    );
  });

  it("no longer produces a v5-shaped key", () => {
    // The bump is not cosmetic: a v5 daily key and a v6 weekly key would
    // otherwise collide in the shared `opportunity_pools` table.
    for (const surface of ["papers", "events", "jobs"] as const) {
      expect(derivePoolCacheKey({ ...base, surface })).toMatch(/^peer-pool-v6-/);
    }
  });

  it("ignores aiTier on surfaces that never send it", () => {
    // `aiTier` exists for the papers pool, whose Tier-2 entry carries an LLM
    // ranking a Tier-0 entry does not. Events and jobs pass it as undefined,
    // and an undefined field must not perturb their keys.
    expect(derivePoolCacheKey({ ...base, aiTier: undefined })).toBe(
      derivePoolCacheKey(base),
    );
  });

  it("gives each papers AI tier its own pool", () => {
    const papers: PoolCacheKeyInput = { ...base, surface: "papers" };
    const keys = [
      derivePoolCacheKey({ ...papers, aiTier: 0 }),
      derivePoolCacheKey({ ...papers, aiTier: 1 }),
      derivePoolCacheKey({ ...papers, aiTier: 2 }),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("changes for every profile dimension, surface, and period", () => {
    const keys = [
      derivePoolCacheKey(base),
      derivePoolCacheKey({
        ...base,
        requiredTopics: [...base.requiredTopics, "solid electrolyte"],
      }),
      derivePoolCacheKey({
        ...base,
        exploreTopics: ["anode materials"],
      }),
      derivePoolCacheKey({
        ...base,
        careerStage: "Postdoc",
      }),
      derivePoolCacheKey({
        ...base,
        locationPreferences: ["Berlin"],
      }),
      derivePoolCacheKey({
        ...base,
        surface: "jobs",
      }),
      derivePoolCacheKey({
        ...base,
        // ABC-freemium 1-17 — was "the next day", which no longer moves an
        // events key. The period is a week now, so the case steps a week.
        now: new Date(2026, 7, 3, 0, 1, 0),
      }),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses the host's local calendar date rather than UTC slicing", () => {
    const lateLocal = new Date(2026, 6, 27, 23, 59, 0);
    expect(localCalendarDate(lateLocal)).toBe("2026-07-27");
  });
});

// Compile-time contract guard: adapters may vary, but every implementation
// stores the complete discriminated CachedPool payload.
class TestCache implements PoolCache {
  value: CachedPool | null = null;

  async get(): Promise<CachedPool | null> {
    return this.value;
  }

  async set(_key: string, pool: CachedPool): Promise<void> {
    this.value = pool;
  }
}

void TestCache;
