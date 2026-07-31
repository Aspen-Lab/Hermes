import { bySourceId } from "@/lib/sources";
import type { SourceId, RawItem } from "@/lib/sources/types";
import { scoreItems } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring/types";
import { dedupItems } from "./dedup";
import { applyTier1Rerank } from "./rerank";
import { applyTier2Rerank } from "./tier2-rerank";
import { briefToSeedTexts, compileSearchBrief } from "./profile-compiler";
import type { FeedRequest, FeedResponse } from "./types";
import {
  canRunTavilyDiscovery,
  runTavilyDiscovery,
  type TavilyDiscoveryResult,
} from "./tavily-discovery";
import { fetchCitationNeighborhood } from "@/lib/affiliation/openalex";
import {
  derivePoolCacheKey,
  getOrBuildCachedPool,
  isCachedPaperDiscovery,
  localCalendarDate,
  type PoolCache,
} from "@/lib/opportunities/pool-cache";
import { getDefaultOpportunityPoolCache } from "@/lib/opportunities/pool-cache-runtime";

const ACADEMIC_PAPER_SOURCES: SourceId[] = [
  "openalex",
  "semantic_scholar",
  "arxiv",
  "dblp",
  "pubmed",
];

const NON_PAPER_CONTEXT_SOURCES: SourceId[] = ["hn", "web"];

function defaultSources(): SourceId[] {
  return ACADEMIC_PAPER_SOURCES;
}

function shouldIncludeNonPaperResults(req: FeedRequest): boolean {
  return Boolean(
    req.sources?.some((source) => NON_PAPER_CONTEXT_SOURCES.includes(source)),
  );
}

export interface FeedPipelineOptions {
  cache?: PoolCache;
  now?: Date;
}

async function runDailyTavilyDiscovery(
  req: FeedRequest,
  brief: ReturnType<typeof compileSearchBrief>,
  options: FeedPipelineOptions,
): Promise<TavilyDiscoveryResult> {
  const now = options.now ?? new Date();
  const cache = options.cache ?? getDefaultOpportunityPoolCache();
  const key = derivePoolCacheKey({
    surface: "papers",
    requiredTopics: req.topics,
    exploreTopics: req.softTopics,
    now,
  });
  const loaded = await getOrBuildCachedPool(
    cache,
    key,
    isCachedPaperDiscovery,
    async () => {
      const discovery = await runTavilyDiscovery(req, brief);
      return {
        surface: "papers",
        queryBoosts: discovery.queryBoosts,
        resultCount: discovery.resultCount,
        generatedAt: now.toISOString(),
        localDate: localCalendarDate(now),
      };
    },
  );

  return {
    queryBoosts: loaded.pool.queryBoosts,
    resultCount: loaded.pool.resultCount,
  };
}

export async function runFeedPipeline(
  req: FeedRequest,
  options: FeedPipelineOptions = {},
): Promise<FeedResponse> {
  const startedAt = Date.now();
  const sources = req.sources ?? defaultSources();
  const brief = compileSearchBrief(req);
  const perSourceLimit = req.perSourceLimit ?? 60;
  const topN = req.topN ?? brief.controls.paperCount;
  const requestedTier = req.aiTier ?? feedTierFromEnv();
  const includeNonPaperResults = shouldIncludeNonPaperResults(req);

  // Tavily discovery used to gate source fetch on its boost queries, but
  // that added a serial 1-2s before sources even started. Run both in
  // parallel — sources use the base generated queries, Tavily only feeds
  // connectorStats. Boost re-injection can come back as a 2nd wave if we
  // need it for relevance.
  const tavilyPromise: Promise<TavilyDiscoveryResult> =
    requestedTier >= 1 && canRunTavilyDiscovery(req)
      ? runDailyTavilyDiscovery(req, brief, options).catch(() => ({
          queryBoosts: [],
          resultCount: 0,
        }))
      : Promise.resolve({ queryBoosts: [], resultCount: 0 });

  const fetchPromise = Promise.allSettled(
    sources.map((s) =>
      withSourceTimeout(
        s,
        bySourceId[s].fetch({
          topics: req.topics,
          queries: brief.generatedQueries,
          methods: req.methods,
          venues: req.venues,
          avoid: brief.avoid,
          timeWindow: brief.timeWindow,
          limit: perSourceLimit,
          webSearch:
            s === "web" && req.searchConnectors?.tavily?.enabled
              ? {
                  provider: "tavily",
                  tavilyApiKey: req.searchConnectors.tavily.apiKey,
                }
              : undefined,
        }),
      ),
    ),
  );

  // Advisor citation-neighborhood discovery, in parallel with the sources.
  // Always degrades to [] on any error (the helper is fully guarded).
  if (req.affiliation?.authorId) {
    console.log(
      `[affiliation] feed request includes advisor ${req.affiliation.authorId}, ${req.affiliation.seedWorkIds?.length ?? 0} seed work ids`,
    );
  }
  const affiliationPromise: Promise<RawItem[]> =
    req.affiliation?.authorId && (req.affiliation.seedWorkIds?.length ?? 0) > 0
      ? fetchCitationNeighborhood(req.affiliation.seedWorkIds!).catch(() => [])
      : Promise.resolve([]);

  const [tavilyDiscovery, fetchResults, affiliationItems] = await Promise.all([
    tavilyPromise,
    fetchPromise,
    affiliationPromise,
  ]);

  const fetched: Partial<Record<SourceId, number>> = {};
  const errors: Partial<Record<SourceId, string>> = {};
  const allItems: RawItem[] = [];

  fetchResults.forEach((result, i) => {
    const sourceId = sources[i];
    if (result.status === "fulfilled") {
      fetched[sourceId] = result.value.length;
      allItems.push(...result.value);
    } else {
      errors[sourceId] = String(result.reason);
      fetched[sourceId] = 0;
    }
  });

  // Merge advisor neighborhood papers into the candidate pool. They're OpenAlex
  // works, so they flow through dedup + scoring like any other source, and the
  // advisor seed-text bias (passed in seedTexts) floats the relevant ones up.
  if (affiliationItems.length > 0) {
    console.log(`[affiliation] +${affiliationItems.length} citation-neighborhood candidates merged`);
    allItems.push(...affiliationItems);
  }

  const beforeDedup = allItems.length;
  const paperItems = includeNonPaperResults
    ? allItems
    : allItems.filter((item) => ACADEMIC_PAPER_SOURCES.includes(item.source));
  const deduped = dedupItems(paperItems);
  const afterDedup = deduped.length;

  const seedTexts = briefToSeedTexts(req, brief);
  const userNegativeTopics = req.negativeTopics ?? [];
  const policyAvoidTopics = brief.avoid.filter(
    (topic) => !userNegativeTopics.includes(topic),
  );
  const scored = scoreItems(
    deduped,
    {
      topics: req.topics,
      methods: req.methods,
      venues: req.venues,
      seedTexts,
      preferenceLedger: req.preferenceLedger,
      negativeTopics: policyAvoidTopics,
      legacyNegativeTopics: userNegativeTopics,
      sourceWeights: req.sourceWeights,
    },
    req.weights,
  );

  const tier1Ranked = requestedTier >= 1 ? applyTier1Rerank(scored, brief) : scored;
  const ranked = requestedTier >= 2
    ? await applyTier2Rerank(tier1Ranked, brief, req.llmOverride)
    : tier1Ranked;
  // Preferred-journal boost: applied LAST (after every rerank) so a paper
  // published in one of the user's preferred journals reliably floats up,
  // while an exceptionally strong non-journal match can still outrank it.
  const journalRanked = applyJournalBoost(ranked, req.venues ?? []);
  // Don't show items the caller already showed this user recently. Run
  // AFTER ranking so the score reflects the full candidate pool, but BEFORE
  // slicing so we still return `topN` fresh items.
  const excludeIds = req.excludeIds && req.excludeIds.length > 0
    ? new Set(req.excludeIds)
    : null;
  const fresh = excludeIds
    ? journalRanked.filter((item) => !excludeIds.has(item.id))
    : journalRanked;
  const returned = fresh.slice(0, topN);

  return {
    items: returned,
    meta: {
      fetched,
      errors,
      beforeDedup,
      afterDedup,
      returned: returned.length,
      latencyMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      searchBrief: brief,
      aiTierUsed: requestedTier,
      llmProviderUsed:
        requestedTier >= 2
          ? (req.llmOverride?.provider ?? "default")
          : null,
      connectorStats:
        req.searchConnectors?.tavily?.enabled
          ? {
              tavily: {
                results: tavilyDiscovery.resultCount,
                queryBoosts: tavilyDiscovery.queryBoosts.length,
              },
            }
          : undefined,
    },
  };
}

// Hard wall on a single source's fetch. Internal per-call timeouts (6s)
// usually catch hung requests, but with up to 3 parallel queries inside a
// source the worst case can still be ~6s — this guarantees one slow source
// never drags Promise.allSettled past 8s on the critical path.
async function withSourceTimeout<T>(
  sourceId: string,
  promise: Promise<T>,
): Promise<T> {
  const TIMEOUT_MS = 8000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[${sourceId}] source-timeout after ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Papers from a preferred journal get +1/3 of their own relevance score.
const JOURNAL_BOOST_FACTOR = 4 / 3;

function normalizeVenue(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.\-_/&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Multiply the relevance score of items whose venue matches one of the user's
// preferred journals. Clamped to 1.0 to keep the 0–1 score contract; across the
// normal score range this still lets a much stronger non-journal match win.
function applyJournalBoost(items: ScoredItem[], journals: string[]): ScoredItem[] {
  const needles = journals.map(normalizeVenue).filter(Boolean);
  if (needles.length === 0) return items;

  let changed = false;
  const boosted = items.map((item) => {
    const venue = normalizeVenue(item.venue ?? "");
    if (!venue) return item;
    const isPreferred = needles.some(
      (n) => venue.includes(n) || n.includes(venue),
    );
    if (!isPreferred) return item;
    changed = true;
    const score = Math.min(1, item.score * JOURNAL_BOOST_FACTOR);
    return {
      ...item,
      score,
      scoreBreakdown: { ...item.scoreBreakdown, combined: score },
    };
  });

  // Only re-sort if at least one item actually moved.
  return changed ? boosted.sort((a, b) => b.score - a.score) : items;
}

function feedTierFromEnv(): 0 | 1 | 2 {
  const raw = Number(process.env.PEER_FEED_AI_TIER ?? "0");
  if (raw >= 2) return 2;
  if (raw <= 0) return 0;
  return 1;
}
