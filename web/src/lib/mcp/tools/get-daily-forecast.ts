import { createAdminClient } from "@/lib/supabase/admin";
import { profileRowToProfile } from "@/app/api/profile/route";
import { runFeedPipeline } from "@/lib/feed/pipeline";
import { runJobsPipeline } from "@/lib/jobs/pipeline";
import { runEventsPipeline } from "@/lib/events/pipeline";
import { scoredItemToPaper } from "@/lib/feed/mapper";
import { localCalendarDate } from "@/lib/local-calendar-date";
import type { SourceId } from "@/lib/sources/types";
import {
  eventToForecastItem,
  jobToForecastItem,
  paperToForecastItem,
  type DailyForecastResult,
  type ForecastItem,
  type ForecastItemType,
} from "../types";

export interface GetDailyForecastInput {
  type?: ForecastItemType;
  limit?: number;
}

const DEFAULT_LIMIT = 9;
export const MAX_LIMIT = 30;

// RULING 6 (docs/handoff/MULTIAGENT-mcp-app.md §1g) -- M1's papers lane is
// arxiv + openalex only, temporary, re-decided at M4. This keeps
// get_opportunity from ever dead-ending on a forecast item this same tool
// just showed: fetchPaperById has no semantic_scholar/dblp/pubmed by-id
// lookup yet, so a forecast item from one of those sources couldn't be
// opened -- never show an item you can't open.
const PAPERS_LANE_SOURCES: SourceId[] = ["arxiv", "openalex"];

function clampLimit(input: number | undefined): number {
  if (input === undefined || !Number.isFinite(input)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(input)));
}

function emptyForecast(now: Date): DailyForecastResult {
  return {
    date: localCalendarDate(now),
    generatedAt: now.toISOString(),
    counts: { jobs: 0, papers: 0, events: 0, total: 0, shown: 0 },
    items: [],
  };
}

/**
 * Server-side "what does this user's Peer Daily Forecast look like today,"
 * mirroring web/src/app/page.tsx's own `briefingItems` merge (papers + jobs
 * + events, sorted by relevanceScore descending) -- computed directly from
 * the pipeline functions rather than the app's own HTTP routes, since there
 * is no browser session here to call them from.
 *
 * Tier-0 by construction (1-11): every pipeline call below passes
 * `aiTier: 0` explicitly, so this tool never reaches for an LLM provider
 * key -- there is no code path here that would need one.
 */
export async function getDailyForecast(
  userId: string,
  input: GetDailyForecastInput = {},
): Promise<DailyForecastResult> {
  const now = new Date();
  const limit = clampLimit(input.limit);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) return emptyForecast(now);

  const profile = profileRowToProfile(
    row as Parameters<typeof profileRowToProfile>[0],
  );
  const topics = profile.researchTopics ?? [];

  // Mirrors web/src/store/feed.ts's own early-return
  // (activeSurfaceTopics(...).topics.length === 0): no topics, no pipeline
  // calls, no fabricated forecast -- an empty forecast is honest here, a
  // guessed one would not be.
  if (topics.length === 0) return emptyForecast(now);

  const wantsType = (t: ForecastItemType) => !input.type || input.type === t;

  const [papersResult, jobsResult, eventsResult] = await Promise.allSettled([
    wantsType("paper")
      ? runFeedPipeline({
          topics,
          sources: PAPERS_LANE_SOURCES,
          topN: limit,
          aiTier: 0,
        })
      : Promise.resolve(null),
    wantsType("job")
      ? runJobsPipeline({
          topics,
          careerStage: profile.careerStage,
          industryVsAcademia: profile.industryVsAcademia,
          locationPreferences: profile.locationPreferences,
          authorisedCountries: profile.authorisedCountries,
          topN: limit,
          aiTier: 0,
        })
      : Promise.resolve(null),
    wantsType("event")
      ? runEventsPipeline({
          topics,
          careerStage: profile.careerStage,
          industryVsAcademia: profile.industryVsAcademia,
          locationPreferences: profile.locationPreferences,
          topN: limit,
          aiTier: 0,
        })
      : Promise.resolve(null),
  ]);

  // Promise.allSettled, not Promise.all: one lane's failure (a source
  // timeout, a transient fetch error) must never blank the other two --
  // mirrors web/src/store/feed.ts's three-lane pattern.
  const papers: ForecastItem[] =
    papersResult.status === "fulfilled" && papersResult.value
      ? papersResult.value.items.map(scoredItemToPaper).map(paperToForecastItem)
      : [];
  const jobs: ForecastItem[] =
    jobsResult.status === "fulfilled" && jobsResult.value
      ? jobsResult.value.items.map(jobToForecastItem)
      : [];
  const events: ForecastItem[] =
    eventsResult.status === "fulfilled" && eventsResult.value
      ? eventsResult.value.items.map(eventToForecastItem)
      : [];

  // Exact match for web/src/app/page.tsx's briefingItems merge: concat then
  // sort by relevance descending.
  const merged = [...papers, ...jobs, ...events].sort(
    (a, b) => (b.relevance ?? 0) - (a.relevance ?? 0),
  );
  const shown = merged.slice(0, limit);

  return {
    date: localCalendarDate(now),
    generatedAt: now.toISOString(),
    counts: {
      // jobs/papers/events/total reflect the full merged candidate pool
      // this call actually fetched (each lane independently capped at
      // `limit` via its own topN) -- NOT re-capped to the final `shown`
      // slice below. That's what makes `total` a meaningful ">= shown"
      // number instead of trivially always equal to it, echoing how Peer
      // web's own dashboard totalItems sums per-surface counts
      // (web/src/app/page.tsx). Not spelled out verbatim in B's contract
      // table -- documented here so A can sanity-check the read next round.
      jobs: jobs.length,
      papers: papers.length,
      events: events.length,
      total: merged.length,
      shown: shown.length,
    },
    items: shown,
  };
}
