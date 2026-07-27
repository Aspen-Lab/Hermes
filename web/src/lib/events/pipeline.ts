// The events feed pipeline — parallel to the paper and jobs pipelines:
// sources → dedup → Tier-0 scoring → selection → mapping. The curated
// sources (ccfddl, confs.tech, researchseminars) are keyless; eventweb adds
// profile-driven web discovery for non-CS disciplines when a search key is
// available, with LLM-refined queries when a provider resolves.

import { withSourceTimeout } from "@/lib/opportunities/shared";
import { enrichEventCandidates } from "@/lib/opportunities/enrich";
import {
  derivePoolCacheKey,
  getOrBuildCachedPool,
  isCachedEventPool,
  localCalendarDate,
  type OpportunityFacetCounts,
  type PoolCache,
} from "@/lib/opportunities/pool-cache";
import { getDefaultOpportunityPoolCache } from "@/lib/opportunities/pool-cache-runtime";
import {
  countOpportunityFacets,
  MAX_OPPORTUNITY_POOL_ITEMS,
} from "@/lib/opportunities/facets";
import {
  generateSearchQueries,
  templateEventQueries,
} from "@/lib/opportunities/query-gen";
import { eventSources } from "./sources";
import { dedupEvents } from "./dedup";
import { MIN_SCORE, scoreEvents } from "./scoring";
import type { EventScoringProfile } from "./scoring";
import { scoredEventToEvent } from "./mapper";
import type {
  EventsFeedRequest,
  EventsFeedResponse,
  EventsQuery,
  EventSourceId,
  RawEventItem,
  ScoredEventItem,
} from "./types";

const DEFAULT_TOP_N = 5;
const DEFAULT_PER_SOURCE_LIMIT = 80;

export interface EventsPipelineOptions {
  /**
   * Detail fetching belongs to the once-daily pool build, never the ordinary
   * request path. Phase 2 enables this only on a cache miss.
   */
  enrichDetails?: boolean;
}

export interface DailyEventPoolOptions {
  cache?: PoolCache;
  now?: Date;
}

export interface BuiltEventPool {
  items: ScoredEventItem[];
  facetCounts: OpportunityFacetCounts;
  fetched: Partial<Record<EventSourceId, number>>;
  errors: Partial<Record<EventSourceId, string>>;
  beforeDedup: number;
  afterDedup: number;
  startedAt: number;
  generatedAt: string;
  localDate: string;
  cacheHit: boolean;
}

export async function scoreEventPoolCandidates(
  deduped: RawEventItem[],
  scoringProfile: EventScoringProfile,
  now: number,
  options: EventsPipelineOptions = {},
): Promise<ScoredEventItem[]> {
  let scored = scoreEvents(deduped, scoringProfile, now, {
    applyFloor: false,
  });

  if (!options.enrichDetails || scored.length === 0) return scored;

  // `scored` already contains only candidates that passed the required-topic
  // gate and expiry checks. Enrich at most the top 40 of those survivors,
  // merge them back by id, then score the full deduped corpus again so dates
  // and locations affect ranking without changing the TF-IDF corpus.
  const enriched = await enrichEventCandidates(scored);
  const enrichedById = new Map(enriched.map((item) => [item.id, item]));
  scored = scoreEvents(
    deduped.map((item) => enrichedById.get(item.id) ?? item),
    scoringProfile,
    now,
    { applyFloor: false },
  );
  return scored;
}

async function buildEventPool(
  req: EventsFeedRequest,
  options: EventsPipelineOptions,
  now = new Date(),
  startedAt = Date.now(),
): Promise<BuiltEventPool> {
  const queryProfile = {
    topics: req.topics,
    softTopics: req.softTopics,
    careerStage: req.careerStage,
    industryVsAcademia: req.industryVsAcademia,
    locationPreferences: req.locationPreferences,
    currentProject: req.currentProject,
  };
  const queries =
    (req.aiTier ?? 1) >= 2
      ? await generateSearchQueries("events", queryProfile, req.llmOverride)
      : templateEventQueries(queryProfile);

  const query: EventsQuery = {
    topics: req.topics,
    queries,
    limit: req.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT,
    webSearch: req.searchConnectors?.tavily?.enabled
      ? { tavilyApiKey: req.searchConnectors.tavily.apiKey }
      : undefined,
  };

  const active = eventSources.filter((source) => source.enabled(query));
  const results = await Promise.allSettled(
    active.map((source) => withSourceTimeout(source.id, source.fetch(query))),
  );

  const fetched: Partial<Record<EventSourceId, number>> = {};
  const errors: Partial<Record<EventSourceId, string>> = {};
  const allItems: RawEventItem[] = [];
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
  const deduped = dedupEvents(allItems);
  const scoringProfile = {
    topics: req.topics,
    softTopics: req.softTopics,
    methods: req.methods,
    seedTexts: req.seedTexts,
    preferenceLedger: req.preferenceLedger,
    locations: req.locationPreferences,
  };
  const scoredItems = await scoreEventPoolCandidates(
    deduped,
    scoringProfile,
    now.getTime(),
    options,
  );
  const items = scoredItems.slice(0, MAX_OPPORTUNITY_POOL_ITEMS);

  return {
    items,
    facetCounts: countOpportunityFacets("events", items),
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
export async function buildDailyEventPool(
  req: EventsFeedRequest,
  options: DailyEventPoolOptions = {},
): Promise<BuiltEventPool> {
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const cache = options.cache ?? getDefaultOpportunityPoolCache();
  const key = derivePoolCacheKey({
    surface: "events",
    requiredTopics: req.topics,
    exploreTopics: req.softTopics,
    careerStage: req.careerStage,
    locationPreferences: req.locationPreferences,
    now,
  });
  let fresh: BuiltEventPool | undefined;

  const loaded = await getOrBuildCachedPool(
    cache,
    key,
    isCachedEventPool,
    async () => {
      fresh = await buildEventPool(
        req,
        { enrichDetails: true },
        now,
        startedAt,
      );
      return {
        surface: "events",
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
    // Source diagnostics are not part of the durable pool. On a hit, report
    // the retained pool size without pretending that sources ran again.
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

export async function runEventsPipeline(
  req: EventsFeedRequest,
  options: DailyEventPoolOptions = {},
): Promise<EventsFeedResponse> {
  const topN = req.topN ?? DEFAULT_TOP_N;
  const pool = await buildDailyEventPool(req, options);
  const scored = pool.items;
  const beforeScoreFloor = scored.length;
  const aboveScoreFloor = scored.filter((item) => item.score >= MIN_SCORE);
  const afterScoreFloor = aboveScoreFloor.length;

  const excludeIds =
    req.excludeIds && req.excludeIds.length > 0 ? new Set(req.excludeIds) : null;
  const fresh = excludeIds
    ? aboveScoreFloor.filter((item) => !excludeIds.has(item.id))
    : aboveScoreFloor;
  const returned = fresh.slice(0, topN);
  const mappedPool = scored.map(scoredEventToEvent);

  return {
    items: returned.map(scoredEventToEvent),
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
