// The events feed pipeline — parallel to the paper and jobs pipelines:
// sources → dedup → Tier-0 scoring → selection → mapping. The curated
// sources (ccfddl, confs.tech, researchseminars) are keyless; eventweb adds
// profile-driven web discovery for non-CS disciplines when a search key is
// available, with LLM-refined queries when a provider resolves.

import { withSourceTimeout } from "@/lib/opportunities/shared";
import {
  generateSearchQueries,
  templateEventQueries,
} from "@/lib/opportunities/query-gen";
import { eventSources } from "./sources";
import { dedupEvents } from "./dedup";
import { scoreEvents } from "./scoring";
import { scoredEventToEvent } from "./mapper";
import type {
  EventsFeedRequest,
  EventsFeedResponse,
  EventsQuery,
  EventSourceId,
  RawEventItem,
} from "./types";

const DEFAULT_TOP_N = 5;
const DEFAULT_PER_SOURCE_LIMIT = 80;

export async function runEventsPipeline(
  req: EventsFeedRequest,
): Promise<EventsFeedResponse> {
  const startedAt = Date.now();
  const topN = req.topN ?? DEFAULT_TOP_N;

  const queryProfile = {
    topics: req.topics,
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

  const scored = scoreEvents(deduped, {
    topics: req.topics,
    softTopics: req.softTopics,
    methods: req.methods,
    seedTexts: req.seedTexts,
    preferenceLedger: req.preferenceLedger,
    locations: req.locationPreferences,
  });

  const excludeIds =
    req.excludeIds && req.excludeIds.length > 0 ? new Set(req.excludeIds) : null;
  const fresh = excludeIds
    ? scored.filter((item) => !excludeIds.has(item.id))
    : scored;
  const returned = fresh.slice(0, topN);

  return {
    items: returned.map((item) => scoredEventToEvent(item, req.locationPreferences)),
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
