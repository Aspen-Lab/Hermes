import type {
  CareerStage,
  IndustryAcademiaPreference,
  Job,
  PreferenceConcept,
  PreferenceLedger,
} from "@/types";
import type { SearchConnectors } from "@/lib/feed/types";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";

export type JobSourceId =
  | "remotive"
  | "arbeitnow"
  | "himalayas"
  | "adzuna"
  | "usajobs"
  | "jsearch"
  | "jobweb";

/** Normalized shape every job source adapter emits. */
export interface RawJobItem {
  /** `${source}:${stableId}` */
  id: string;
  source: JobSourceId;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  /** Plain text (HTML stripped), truncated. */
  description: string;
  url: string;
  postedAt?: string;
  employmentType?: string;
  tags: string[];
  preferenceSignals?: PreferenceConcept[];
}

export interface JobsQuery {
  topics: string[];
  /** Search strings for API-backed sources, built from profile + stage. */
  queries: string[];
  locations: string[];
  careerStage?: CareerStage;
  industryPreference?: IndustryAcademiaPreference;
  limit: number;
  webSearch?: {
    tavilyApiKey?: string;
  };
}

export interface JobSourceAdapter {
  id: JobSourceId;
  /** False when required env keys are missing — the adapter is skipped. */
  enabled(query: JobsQuery): boolean;
  fetch(query: JobsQuery): Promise<RawJobItem[]>;
}

export interface JobsFeedRequest {
  topics: string[];
  softTopics?: string[];
  methods?: string[];
  seedTexts?: string[];
  preferenceLedger?: PreferenceLedger;
  careerStage?: CareerStage;
  industryVsAcademia?: IndustryAcademiaPreference;
  locationPreferences?: string[];
  currentProject?: string;
  topN?: number;
  perSourceLimit?: number;
  excludeIds?: string[];
  aiTier?: 0 | 1 | 2;
  searchConnectors?: SearchConnectors;
  llmOverride?: ProviderOverrideConfig;
}

export interface JobsFeedMeta {
  fetched: Partial<Record<JobSourceId, number>>;
  errors: Partial<Record<JobSourceId, string>>;
  beforeDedup: number;
  afterDedup: number;
  returned: number;
  latencyMs: number;
  generatedAt: string;
}

export interface JobsFeedResponse {
  items: Job[];
  meta: JobsFeedMeta;
}

/** Internal: a raw job with its Tier-0 score attached. */
export interface ScoredJobItem extends RawJobItem {
  score: number;
  matchedKeywords: string[];
  matchReason: string;
}
