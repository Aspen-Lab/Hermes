import { bySourceId } from "@/lib/sources";
import type { SourceId, RawItem } from "@/lib/sources/types";
import { scoreItems } from "@/lib/scoring";
import { dedupItems } from "./dedup";
import type { FeedRequest, FeedResponse } from "./types";

const ALL_SOURCES: SourceId[] = ["openalex", "arxiv", "hn"];

export async function runFeedPipeline(
  req: FeedRequest,
): Promise<FeedResponse> {
  const startedAt = Date.now();
  const sources = req.sources ?? ALL_SOURCES;
  const perSourceLimit = req.perSourceLimit ?? 30;
  const topN = req.topN ?? 30;

  const fetchResults = await Promise.allSettled(
    sources.map((s) =>
      bySourceId[s].fetch({
        topics: req.topics,
        methods: req.methods,
        venues: req.venues,
        limit: perSourceLimit,
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
  const deduped = dedupItems(allItems);
  const afterDedup = deduped.length;

  const scored = scoreItems(
    deduped,
    {
      topics: req.topics,
      methods: req.methods,
      venues: req.venues,
      seedTexts: req.seedTexts,
      sourceWeights: req.sourceWeights,
    },
    req.weights,
  );

  const returned = scored.slice(0, topN);

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
    },
  };
}
