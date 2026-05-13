import { bySourceId } from "@/lib/sources";
import type { SourceId, RawItem } from "@/lib/sources/types";
import { scoreItems } from "@/lib/scoring";
import { dedupItems } from "./dedup";
import { applyTier1Rerank } from "./rerank";
import { applyTier2Rerank } from "./tier2-rerank";
import { briefToSeedTexts, compileSearchBrief } from "./profile-compiler";
import type { FeedRequest, FeedResponse } from "./types";
import { runTavilyDiscovery } from "./tavily-discovery";

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

export async function runFeedPipeline(
  req: FeedRequest,
): Promise<FeedResponse> {
  const startedAt = Date.now();
  const sources = req.sources ?? defaultSources();
  const brief = compileSearchBrief(req);
  const perSourceLimit = req.perSourceLimit ?? 60;
  const topN = req.topN ?? brief.controls.paperCount;
  const requestedTier = req.aiTier ?? feedTierFromEnv();
  const includeNonPaperResults = shouldIncludeNonPaperResults(req);
  const tavilyDiscovery = requestedTier >= 1
    ? await runTavilyDiscovery(req, brief)
    : { queryBoosts: [], resultCount: 0 };
  const retrievalQueries = mergeRetrievalQueries(
    brief.generatedQueries,
    tavilyDiscovery.queryBoosts,
  );

  const fetchResults = await Promise.allSettled(
    sources.map((s) =>
      bySourceId[s].fetch({
        topics: req.topics,
        queries: retrievalQueries,
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
  );

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

  const beforeDedup = allItems.length;
  const paperItems = includeNonPaperResults
    ? allItems
    : allItems.filter((item) => ACADEMIC_PAPER_SOURCES.includes(item.source));
  const deduped = dedupItems(paperItems);
  const afterDedup = deduped.length;

  const seedTexts = briefToSeedTexts(req, brief);
  const scored = scoreItems(
    deduped,
    {
      topics: req.topics,
      methods: req.methods,
      venues: req.venues,
      seedTexts,
      negativeTopics: [...(req.negativeTopics ?? []), ...brief.avoid],
      sourceWeights: req.sourceWeights,
    },
    req.weights,
  );

  const tier1Ranked = requestedTier >= 1 ? applyTier1Rerank(scored, brief) : scored;
  const ranked = requestedTier >= 2
    ? await applyTier2Rerank(tier1Ranked, brief, req.llmOverride)
    : tier1Ranked;
  // Don't show items the caller already showed this user recently. Run
  // AFTER ranking so the score reflects the full candidate pool, but BEFORE
  // slicing so we still return `topN` fresh items.
  const excludeIds = req.excludeIds && req.excludeIds.length > 0
    ? new Set(req.excludeIds)
    : null;
  const fresh = excludeIds
    ? ranked.filter((item) => !excludeIds.has(item.id))
    : ranked;
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

function mergeRetrievalQueries(baseQueries: string[], boostedQueries: string[]): string[] {
  return Array.from(
    new Set(
      [...boostedQueries, ...baseQueries]
        .map((query) => query.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function feedTierFromEnv(): 0 | 1 | 2 {
  const raw = Number(process.env.HERMES_FEED_AI_TIER ?? "1");
  if (raw >= 2) return 2;
  if (raw <= 0) return 0;
  return 1;
}
