import { createAdminClient } from "@/lib/supabase/admin";
import { profileRowToProfile } from "@/app/api/profile/route";
import { runJobsPipeline } from "@/lib/jobs/pipeline";
import { runEventsPipeline } from "@/lib/events/pipeline";
import { fetchPaperById } from "@/lib/papers/fetch-by-id";
import { rawItemToPaper } from "@/lib/feed/mapper";
import type { JobSourceId } from "@/lib/jobs/types";
import type { EventSourceId } from "@/lib/events/types";
import { eventToForecastItem, jobToForecastItem, paperToForecastItem, type ForecastItem } from "../types";

export interface GetOpportunityInput {
  id: string;
}

export interface OpportunityNotFound {
  found: false;
  id: string;
}

export type GetOpportunityResult = ForecastItem | OpportunityNotFound;

// `${source}:${stableId}` — confirmed in web/src/lib/jobs/types.ts line 26
// and web/src/lib/events/types.ts line 23.
const JOB_SOURCE_IDS: readonly JobSourceId[] = [
  "remotive",
  "arbeitnow",
  "himalayas",
  "adzuna",
  "usajobs",
  "jsearch",
  "jobweb",
];
const EVENT_SOURCE_IDS: readonly EventSourceId[] = [
  "ccfddl",
  "confstech",
  "researchseminars",
  "eventweb",
];
// RULING 6 — the only paper prefixes get_daily_forecast's papers lane can
// ever hand back this milestone, so this is also the only family
// get_opportunity needs to resolve for now. `fetchPaperById` (verified by
// reading its body) only has branches for these two; other prefixes are a
// real, disclosed gap (semantic_scholar/dblp/pubmed/web/hn) — never
// fabricate a paper for them, return structured not-found instead.
const RESOLVABLE_PAPER_PREFIXES = new Set(["arxiv", "openalex"]);

function notFound(id: string): OpportunityNotFound {
  return { found: false, id };
}

async function resolveProfileForPipelines(userId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;
  return profileRowToProfile(row as Parameters<typeof profileRowToProfile>[0]);
}

async function resolveFromPool(
  userId: string,
  kind: "job" | "event",
  id: string,
): Promise<GetOpportunityResult> {
  const profile = await resolveProfileForPipelines(userId);
  const topics = profile?.researchTopics ?? [];
  // No topics, no pipeline call, no fabricated match — same discipline as
  // get_daily_forecast's own short-circuit.
  if (topics.length === 0) return notFound(id);

  // Re-runs the same pipeline get_daily_forecast would, with the same
  // profile-derived request — the daily pool cache
  // (derivePoolCacheKey/getOrBuildCachedPool) makes a same-day repeat call
  // for this user a cache hit, not new fetch work.
  if (kind === "job") {
    const response = await runJobsPipeline({
      topics,
      careerStage: profile?.careerStage,
      industryVsAcademia: profile?.industryVsAcademia,
      locationPreferences: profile?.locationPreferences,
      authorisedCountries: profile?.authorisedCountries,
      aiTier: 0,
    });
    // Search the FULL scored pool (up to MAX_OPPORTUNITY_POOL_ITEMS), not
    // `.items` — `.items` is score-floor-filtered and topN-sliced, so a
    // shown-but-lower-ranked forecast item could be missing from it.
    const match = response.pool.find((job) => job.id === id);
    return match ? jobToForecastItem(match) : notFound(id);
  }

  const response = await runEventsPipeline({
    topics,
    careerStage: profile?.careerStage,
    industryVsAcademia: profile?.industryVsAcademia,
    locationPreferences: profile?.locationPreferences,
    aiTier: 0,
  });
  const match = response.pool.find((event) => event.id === id);
  return match ? eventToForecastItem(match) : notFound(id);
}

async function resolvePaper(id: string): Promise<GetOpportunityResult> {
  const raw = await fetchPaperById(id);
  if (!raw) return notFound(id);
  const paper = rawItemToPaper(raw, {
    relevanceReason: "Pulled from today's Peer Daily Forecast.",
  });
  return paperToForecastItem(paper);
}

/**
 * One item's full detail, in the *same* per-type shape as a
 * get_daily_forecast row (reuses the same mappers — never a second shape).
 * Structured not-found (`{ found: false, id }`) for anything unresolvable:
 * a stale/rotated pool id, or a paper source `fetchPaperById` can't reach
 * yet. Never a partial guess — RULING 4's standard applies here too.
 */
export async function getOpportunity(
  userId: string,
  input: GetOpportunityInput,
): Promise<GetOpportunityResult> {
  const { id } = input;
  const prefix = id.split(":")[0];

  if (JOB_SOURCE_IDS.includes(prefix as JobSourceId)) {
    return resolveFromPool(userId, "job", id);
  }
  if (EVENT_SOURCE_IDS.includes(prefix as EventSourceId)) {
    return resolveFromPool(userId, "event", id);
  }
  if (RESOLVABLE_PAPER_PREFIXES.has(prefix)) {
    return resolvePaper(id);
  }
  // Covers semantic_scholar:/dblp:/pubmed:/web:/hn: (real, disclosed gap)
  // and any unrecognized prefix.
  return notFound(id);
}
