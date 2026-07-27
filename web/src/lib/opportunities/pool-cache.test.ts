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
    expect(first).toMatch(
      /^peer-pool-v1-events-2026-07-27-[a-f0-9]{32}$/,
    );
  });

  it("changes for every profile dimension, surface, and local date", () => {
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
        now: new Date(2026, 6, 28, 0, 1, 0),
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
