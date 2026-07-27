import { createHash } from "node:crypto";
import type {
  CareerStage,
  OpportunityFacetCounts,
} from "@/types";
import type { ScoredEventItem } from "@/lib/events/types";
import type { ScoredJobItem } from "@/lib/jobs/types";
import { canonicalize } from "@/lib/scoring/term-expand";

export type OpportunitySurface = "events" | "jobs";
export type { OpportunityFacetCounts, OpportunityFormat } from "@/types";

interface CachedPoolBase {
  generatedAt: string;
  localDate: string;
  facetCounts: OpportunityFacetCounts;
}

export interface CachedEventPool extends CachedPoolBase {
  surface: "events";
  items: ScoredEventItem[];
}

export interface CachedJobPool extends CachedPoolBase {
  surface: "jobs";
  items: ScoredJobItem[];
}

/** Scored and enriched daily data, never raw source results or a top-N slice. */
export type CachedPool = CachedEventPool | CachedJobPool;

export interface PoolCache {
  get(key: string): Promise<CachedPool | null>;
  set(key: string, pool: CachedPool): Promise<void>;
}

export interface DailyPoolLoad<TPool extends CachedPool> {
  pool: TPool;
  /** True for a persisted hit or an in-process request coalesced onto a build. */
  cacheHit: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCachedPool(value: unknown): value is CachedPool {
  if (!isRecord(value)) return false;
  if (value.surface !== "events" && value.surface !== "jobs") return false;
  if (!Array.isArray(value.items)) return false;
  if (typeof value.generatedAt !== "string") return false;
  if (typeof value.localDate !== "string") return false;
  return isRecord(value.facetCounts);
}

export function isCachedEventPool(pool: CachedPool): pool is CachedEventPool {
  return pool.surface === "events";
}

export function isCachedJobPool(pool: CachedPool): pool is CachedJobPool {
  return pool.surface === "jobs";
}

export function emptyOpportunityFacetCounts(): OpportunityFacetCounts {
  return {
    location: {},
    month: {},
    format: { "in-person": 0, online: 0, hybrid: 0 },
  };
}

export interface PoolCacheKeyInput {
  surface: OpportunitySurface;
  requiredTopics: string[];
  exploreTopics?: string[];
  careerStage?: CareerStage;
  locationPreferences?: string[];
  now?: Date;
}

// Bump whenever the durable pool payload semantics change. v2 adds the
// 200-item cap and real whole-pool facet counts.
const CACHE_KEY_VERSION = 2;

function normalizeSet(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map(canonicalize)
        .filter(Boolean),
    ),
  ).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function localCalendarDate(now = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function derivePoolCacheKey(input: PoolCacheKeyInput): string {
  const date = localCalendarDate(input.now);
  const signature = JSON.stringify({
    version: CACHE_KEY_VERSION,
    surface: input.surface,
    requiredTopics: normalizeSet(input.requiredTopics),
    exploreTopics: normalizeSet(input.exploreTopics),
    careerStage: input.careerStage?.trim() ?? "",
    locationPreferences: normalizeSet(input.locationPreferences),
    date,
  });
  const digest = createHash("sha256").update(signature).digest("hex").slice(0, 32);
  return `peer-pool-v${CACHE_KEY_VERSION}-${input.surface}-${date}-${digest}`;
}

const inFlightByCache = new WeakMap<
  PoolCache,
  Map<string, Promise<CachedPool>>
>();

/**
 * Read-through daily-pool cache with per-process single-flight protection.
 * Cache failures degrade to a fresh build; they never block Tier 0.
 */
export async function getOrBuildCachedPool<TPool extends CachedPool>(
  cache: PoolCache,
  key: string,
  accepts: (pool: CachedPool) => pool is TPool,
  build: () => Promise<TPool>,
): Promise<DailyPoolLoad<TPool>> {
  let inFlight = inFlightByCache.get(cache);
  if (!inFlight) {
    inFlight = new Map<string, Promise<CachedPool>>();
    inFlightByCache.set(cache, inFlight);
  }

  const existing = inFlight.get(key);
  if (existing) {
    const pool = await existing;
    if (accepts(pool)) return { pool, cacheHit: true };
  }

  let builtFresh = false;
  const pending = (async (): Promise<TPool> => {
    try {
      const cached = await cache.get(key);
      if (cached && accepts(cached)) return cached;
    } catch {
      // A cache outage is a miss, not a feed outage.
    }

    builtFresh = true;
    const pool = await build();
    try {
      await cache.set(key, pool);
    } catch {
      // Returning a fresh pool is more important than persisting it.
    }
    return pool;
  })();
  inFlight.set(key, pending);

  try {
    return { pool: await pending, cacheHit: !builtFresh };
  } finally {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  }
}
