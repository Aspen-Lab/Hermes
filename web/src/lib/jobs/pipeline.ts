// The jobs feed pipeline — a parallel implementation of the paper pipeline's
// five stages (sources → dedup → Tier-0 scoring → selection → mapping) for
// job postings. Tier 0 works with zero keys (remotive/arbeitnow/himalayas);
// keyed sources and LLM query generation enable themselves via env/BYOK.

import { withSourceTimeout } from "@/lib/opportunities/shared";
import { generateSearchQueries, templateJobQueries } from "@/lib/opportunities/query-gen";
import { jobSources } from "./sources";
import { dedupJobs } from "./dedup";
import { scoreJobs } from "./scoring";
import { scoredJobToJob } from "./mapper";
import type {
  JobsFeedRequest,
  JobsFeedResponse,
  JobsQuery,
  JobSourceId,
  RawJobItem,
} from "./types";

const DEFAULT_TOP_N = 5;
const DEFAULT_PER_SOURCE_LIMIT = 60;

export async function runJobsPipeline(
  req: JobsFeedRequest,
): Promise<JobsFeedResponse> {
  const startedAt = Date.now();
  const topN = req.topN ?? DEFAULT_TOP_N;

  const queryProfile = {
    topics: req.topics,
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

  const scored = scoreJobs(deduped, {
    topics: req.topics,
    softTopics: req.softTopics,
    methods: req.methods,
    seedTexts: req.seedTexts,
    preferenceLedger: req.preferenceLedger,
    careerStage: req.careerStage,
    industryPreference: req.industryVsAcademia,
    locations: req.locationPreferences,
  });

  const excludeIds =
    req.excludeIds && req.excludeIds.length > 0 ? new Set(req.excludeIds) : null;
  const fresh = excludeIds
    ? scored.filter((item) => !excludeIds.has(item.id))
    : scored;
  const returned = fresh.slice(0, topN);

  return {
    items: returned.map(scoredJobToJob),
    meta: {
      fetched,
      errors,
      beforeDedup,
      afterDedup: deduped.length,
      returned: returned.length,
      latencyMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    },
  };
}
