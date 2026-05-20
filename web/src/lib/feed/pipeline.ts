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

  // Tavily discovery used to gate source fetch on its boost queries, but
  // that added a serial 1-2s before sources even started. Run both in
  // parallel — sources use the base generated queries, Tavily only feeds
  // connectorStats. Boost re-injection can come back as a 2nd wave if we
  // need it for relevance.
  const tavilyPromise: Promise<{ queryBoosts: string[]; resultCount: number }> =
    requestedTier >= 1
      ? runTavilyDiscovery(req, brief).catch(() => ({
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

  const [tavilyDiscovery, fetchResults] = await Promise.all([
    tavilyPromise,
    fetchPromise,
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

function feedTierFromEnv(): 0 | 1 | 2 {
  const raw = Number(process.env.HERMES_FEED_AI_TIER ?? "1");
  if (raw >= 2) return 2;
  if (raw <= 0) return 0;
  return 1;
}
