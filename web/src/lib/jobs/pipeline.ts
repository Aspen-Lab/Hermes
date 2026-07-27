// The jobs feed pipeline — a parallel implementation of the paper pipeline's
// five stages (sources → dedup → Tier-0 scoring → selection → mapping) for
// job postings. Tier 0 works with zero keys (remotive/arbeitnow/himalayas);
// keyed sources and LLM query generation enable themselves via env/BYOK.

import { withSourceTimeout } from "@/lib/opportunities/shared";
import { enrichJobCandidates } from "@/lib/opportunities/enrich";
import {
  derivePoolCacheKey,
  getOrBuildCachedPool,
  isCachedJobPool,
  localCalendarDate,
  type OpportunityFacetCounts,
  type PoolCache,
} from "@/lib/opportunities/pool-cache";
import { getDefaultOpportunityPoolCache } from "@/lib/opportunities/pool-cache-runtime";
import {
  countOpportunityFacets,
  DEFAULT_OPPORTUNITY_TOP_N,
  filterOpportunitiesByFacets,
  hasActiveOpportunityFacets,
  MAX_OPPORTUNITY_POOL_ITEMS,
} from "@/lib/opportunities/facets";
import { generateSearchQueries, templateJobQueries } from "@/lib/opportunities/query-gen";
import { jobSources } from "./sources";
import { dedupJobs } from "./dedup";
import { MIN_SCORE, scoreJobs } from "./scoring";
import type { JobScoringProfile } from "./scoring";
import { scoredJobToJob } from "./mapper";
import type {
  JobsFeedRequest,
  JobsFeedResponse,
  JobsQuery,
  JobSourceId,
  RawJobItem,
  ScoredJobItem,
} from "./types";

const DEFAULT_PER_SOURCE_LIMIT = 60;

export interface JobsPipelineOptions {
  /** Enabled only by the once-daily cache-miss build in Phase 2. */
  enrichDetails?: boolean;
}

export interface DailyJobPoolOptions {
  cache?: PoolCache;
  now?: Date;
}

export interface BuiltJobPool {
  items: ScoredJobItem[];
  facetCounts: OpportunityFacetCounts;
  fetched: Partial<Record<JobSourceId, number>>;
  errors: Partial<Record<JobSourceId, string>>;
  beforeDedup: number;
  afterDedup: number;
  startedAt: number;
  generatedAt: string;
  localDate: string;
  cacheHit: boolean;
}

export async function scoreJobPoolCandidates(
  deduped: RawJobItem[],
  scoringProfile: JobScoringProfile,
  now: number,
  options: JobsPipelineOptions = {},
): Promise<ScoredJobItem[]> {
  let scored = scoreJobs(deduped, scoringProfile, now, {
    applyFloor: false,
  });
  if (!options.enrichDetails || scored.length === 0) return scored;

  // The first score pass supplies relevance-gate survivors and an initial
  // order. Detail fetches are capped at 40, then the complete deduped corpus
  // is scored again so enriched location affects ranking.
  const enriched = await enrichJobCandidates(scored);
  const enrichedById = new Map(enriched.map((item) => [item.id, item]));
  scored = scoreJobs(
    deduped.map((item) => enrichedById.get(item.id) ?? item),
    scoringProfile,
    now,
    { applyFloor: false },
  );
  return scored;
}

async function buildJobPool(
  req: JobsFeedRequest,
  options: JobsPipelineOptions,
  now = new Date(),
  startedAt = Date.now(),
): Promise<BuiltJobPool> {
  const queryProfile = {
    topics: req.topics,
    softTopics: req.softTopics,
    careerStage: req.careerStage,
    industryVsAcademia: req.industryVsAcademia,
    locationPreferences: req.locationPreferences,
    currentProject: req.currentProject,
  };
  // LLM-refined queries when a provider is available (Tier 2 / BYOK);
  // template queries otherwise. Never throws.
  const queries =
    (req.aiTier ?? 1) >= 2
      ? await generateSearchQueries("jobs", queryProfile, req.llmOverride)
      : templateJobQueries(queryProfile);

  const query: JobsQuery = {
    topics: req.topics,
    queries,
    locations: req.locationPreferences ?? [],
    careerStage: req.careerStage,
    industryPreference: req.industryVsAcademia,
    limit: req.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT,
    webSearch: req.searchConnectors?.tavily?.enabled
      ? { tavilyApiKey: req.searchConnectors.tavily.apiKey }
      : undefined,
    apiKeys: req.apiKeys,
  };

  const active = jobSources.filter((source) => source.enabled(query));
  const results = await Promise.allSettled(
    active.map((source) => withSourceTimeout(source.id, source.fetch(query))),
  );

  const fetched: Partial<Record<JobSourceId, number>> = {};
  const errors: Partial<Record<JobSourceId, string>> = {};
  const allItems: RawJobItem[] = [];
  results.forEach((result, i) => {
    const sourceId = active[i].id;
    if (result.status === "fulfilled") {
      fetched[sourceId] = result.value.length;
      allItems.push(...result.value);
    } else {
      errors[sourceId] = String(result.reason);
      fetched[sourceId] = 0;
    }
  });

  const beforeDedup = allItems.length;
  const deduped = dedupJobs(allItems);
  const scoringProfile = {
    topics: req.topics,
    softTopics: req.softTopics,
    methods: req.methods,
    seedTexts: req.seedTexts,
    preferenceLedger: req.preferenceLedger,
    careerStage: req.careerStage,
    industryPreference: req.industryVsAcademia,
    locations: req.locationPreferences,
  };
  const scoredItems = await scoreJobPoolCandidates(
    deduped,
    scoringProfile,
    now.getTime(),
    options,
  );
  const items = scoredItems.slice(0, MAX_OPPORTUNITY_POOL_ITEMS);

  return {
    items,
    facetCounts: countOpportunityFacets("jobs", items),
    fetched,
    errors,
    beforeDedup,
    afterDedup: deduped.length,
    startedAt,
    generatedAt: now.toISOString(),
    localDate: localCalendarDate(now),
    cacheHit: false,
  };
}

/** Read or build the complete scored/enriched pool for this local day. */
export async function buildDailyJobPool(
  req: JobsFeedRequest,
  options: DailyJobPoolOptions = {},
): Promise<BuiltJobPool> {
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const cache = options.cache ?? getDefaultOpportunityPoolCache();
  const key = derivePoolCacheKey({
    surface: "jobs",
    requiredTopics: req.topics,
    exploreTopics: req.softTopics,
    careerStage: req.careerStage,
    locationPreferences: req.locationPreferences,
    now,
  });
  let fresh: BuiltJobPool | undefined;

  const loaded = await getOrBuildCachedPool(
    cache,
    key,
    isCachedJobPool,
    async () => {
      fresh = await buildJobPool(
        req,
        { enrichDetails: true },
        now,
        startedAt,
      );
      return {
        surface: "jobs",
        items: fresh.items,
        facetCounts: fresh.facetCounts,
        generatedAt: fresh.generatedAt,
        localDate: fresh.localDate,
      };
    },
  );

  if (fresh && !loaded.cacheHit) return fresh;

  return {
    items: loaded.pool.items,
    facetCounts: loaded.pool.facetCounts,
    fetched: {},
    errors: {},
    beforeDedup: loaded.pool.items.length,
    afterDedup: loaded.pool.items.length,
    startedAt,
    generatedAt: loaded.pool.generatedAt,
    localDate: loaded.pool.localDate,
    cacheHit: true,
  };
}

export async function runJobsPipeline(
  req: JobsFeedRequest,
  options: DailyJobPoolOptions = {},
): Promise<JobsFeedResponse> {
  const topN = req.topN ?? DEFAULT_OPPORTUNITY_TOP_N;
  const pool = await buildDailyJobPool(req, options);
  const scored = pool.items;
  const facetFiltered = filterOpportunitiesByFacets(
    "jobs",
    scored,
    req.facets,
  );
  const beforeScoreFloor = facetFiltered.length;
  const aboveScoreFloor = hasActiveOpportunityFacets(req.facets)
    ? facetFiltered
    : facetFiltered.filter((item) => item.score >= MIN_SCORE);
  const afterScoreFloor = aboveScoreFloor.length;

  const excludeIds =
    req.excludeIds && req.excludeIds.length > 0 ? new Set(req.excludeIds) : null;
  const fresh = excludeIds
    ? aboveScoreFloor.filter((item) => !excludeIds.has(item.id))
    : aboveScoreFloor;
  const returned = fresh.slice(0, topN);
  const mappedPool = scored.map(scoredJobToJob);

  return {
    items: returned.map(scoredJobToJob),
    pool: mappedPool,
    facetCounts: pool.facetCounts,
    meta: {
      fetched: pool.fetched,
      errors: pool.errors,
      beforeDedup: pool.beforeDedup,
      afterDedup: pool.afterDedup,
      beforeScoreFloor,
      afterScoreFloor,
      returned: returned.length,
      latencyMs: Date.now() - pool.startedAt,
      generatedAt: pool.generatedAt,
    },
  };
}
