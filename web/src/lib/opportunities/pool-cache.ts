import { createHash } from "node:crypto";
import type { CareerStage } from "@/types";
import type { ScoredEventItem } from "@/lib/events/types";
import type { ScoredJobItem } from "@/lib/jobs/types";
import { canonicalize } from "@/lib/scoring/term-expand";

export type OpportunitySurface = "events" | "jobs";
export type OpportunityFormat = "in-person" | "online" | "hybrid";

export interface OpportunityFacetCounts {
  location: Record<string, number>;
  month: Record<string, number>;
  format: Record<OpportunityFormat, number>;
}

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

export interface PoolCacheKeyInput {
  surface: OpportunitySurface;
  requiredTopics: string[];
  exploreTopics?: string[];
  careerStage?: CareerStage;
  locationPreferences?: string[];
  now?: Date;
}

const CACHE_KEY_VERSION = 1;

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
