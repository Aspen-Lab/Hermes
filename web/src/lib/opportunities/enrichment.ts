import type { UserAiProvider, UserProfile } from "@/types";

export interface JobEnrichment {
  competitiveness?: {
    verdict: string;
    reasoning: string;
  };
  sponsorshipRead?: {
    likelihood: string;
    basis: string;
  };
  roleSummary?: string[];
  emphasise?: string[];
}

export interface EventEnrichment {
  judgedAttendees?: Array<{
    name: string;
    worthIt: boolean;
    why: string;
  }>;
  talkSummaries?: Array<{
    title: string;
    about: string;
  }>;
  dayPlan?: Array<{
    day: string;
    items: string[];
  }>;
  posterFit?: {
    fits: boolean;
    reasoning: string;
  };
}

type EnrichmentProfile = Pick<
  UserProfile,
  | "researchTopics"
  | "preferredMethods"
  | "careerStage"
  | "currentProject"
  | "currentChallenges"
  | "authorisedCountries"
>;

export type OpportunityEnrichmentKind = "job" | "event";

export interface EnrichmentCacheResult<T> {
  hit: boolean;
  enrichment: T | null;
}

interface CachedEnrichment {
  enrichment: unknown | null;
  savedAt: number;
}

type EnrichmentCache = Record<string, CachedEnrichment>;

const ENRICHMENT_CACHE_STORAGE_KEY = "peer-opportunity-report-cache-v1";
const ENRICHMENT_CACHE_MAX_ENTRIES = 80;
export const ENRICHMENT_SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ENRICHMENT_FAILURE_TTL_MS = 6 * 60 * 60 * 1000;

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function cleanList(values: readonly string[]): string[] {
  return values.flatMap((value) => {
    const cleaned = clean(value);
    return cleaned ? [cleaned] : [];
  });
}

/** Build the user-declared context that is safe to send to report prompts. */
export function buildEnrichmentContext(profile: EnrichmentProfile): string {
  const lines = [
    `Career stage: ${clean(profile.careerStage) ?? "Not declared"}`,
    cleanList(profile.researchTopics).length > 0
      ? `Topics: ${cleanList(profile.researchTopics).join(", ")}`
      : undefined,
    cleanList(profile.preferredMethods).length > 0
      ? `Methods: ${cleanList(profile.preferredMethods).join(", ")}`
      : undefined,
    clean(profile.currentProject)
      ? `Current project: ${clean(profile.currentProject)}`
      : undefined,
    clean(profile.currentChallenges)
      ? `Current challenges: ${clean(profile.currentChallenges)}`
      : undefined,
    cleanList(profile.authorisedCountries).length > 0
      ? `Can work without sponsorship in: ${cleanList(profile.authorisedCountries).join(", ")}`
      : undefined,
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function opportunityEnrichmentCacheKey(
  kind: OpportunityEnrichmentKind,
  itemId: string,
  contextHint: string,
  providerId: UserAiProvider,
): string {
  return `${kind}:${shortHash(itemId)}:${shortHash(contextHint)}:${providerId}`;
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readCache(storage: Storage | undefined): EnrichmentCache {
  if (!storage) return {};
  try {
    const raw = storage.getItem(ENRICHMENT_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as EnrichmentCache)
      : {};
  } catch {
    return {};
  }
}

export function readCachedOpportunityEnrichment<T>(
  cacheKey: string,
  nowMs = Date.now(),
  storage: Storage | undefined = browserStorage(),
): EnrichmentCacheResult<T> {
  if (!cacheKey) return { hit: false, enrichment: null };
  const entry = readCache(storage)[cacheKey];
  if (!entry || typeof entry.savedAt !== "number") {
    return { hit: false, enrichment: null };
  }
  const ttl =
    entry.enrichment === null
      ? ENRICHMENT_FAILURE_TTL_MS
      : ENRICHMENT_SUCCESS_TTL_MS;
  if (nowMs - entry.savedAt >= ttl || nowMs < entry.savedAt) {
    return { hit: false, enrichment: null };
  }
  return { hit: true, enrichment: entry.enrichment as T | null };
}

export function writeCachedOpportunityEnrichment<T>(
  cacheKey: string,
  enrichment: T | null,
  nowMs = Date.now(),
  storage: Storage | undefined = browserStorage(),
): void {
  if (!cacheKey || !storage) return;
  try {
    const cache = readCache(storage);
    cache[cacheKey] = { enrichment, savedAt: nowMs };
    const pruned = Object.fromEntries(
      Object.entries(cache)
        .sort((left, right) => right[1].savedAt - left[1].savedAt)
        .slice(0, ENRICHMENT_CACHE_MAX_ENTRIES),
    );
    storage.setItem(ENRICHMENT_CACHE_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Cache failure must never make a Tier 0 report unreadable.
  }
}
