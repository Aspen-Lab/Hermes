import type { SourceId } from "@/lib/sources/types";
import type {
  ScoringProfile,
  ScoreWeights,
  ScoredItem,
} from "@/lib/scoring/types";
import type { FeedControls, SearchBrief } from "./profile-compiler";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";

export interface TavilySearchConnector {
  enabled?: boolean;
  apiKey?: string;
}

export interface SearchConnectors {
  tavily?: TavilySearchConnector;
}

export interface FeedRequest extends ScoringProfile {
  sources?: SourceId[];
  perSourceLimit?: number;
  topN?: number;
  weights?: ScoreWeights;
  controls?: FeedControls;
  aiTier?: 0 | 1 | 2;
  searchConnectors?: SearchConnectors;
  llmOverride?: ProviderOverrideConfig;
  /**
   * Advisor / PI affiliation discovery. When present, the pipeline pulls the
   * citation neighborhood of the advisor's seed works (recent papers citing
   * them) into the candidate pool as fresh external discovery.
   */
  affiliation?: { authorId: string; seedWorkIds?: string[] };
  /**
   * Paper IDs the caller has already shown to this user recently. The
   * pipeline filters these out AFTER scoring/reranking so a user opening
   * Hermes twice in a day (or two days in a row) doesn't see the same
   * papers repeated. The live feed populates this from a localStorage-backed
   * "recently shown" map; the cron digest populates it from
   * briefing_deliveries.
   */
  excludeIds?: string[];
}

export interface FeedMeta {
  fetched: Partial<Record<SourceId, number>>;
  errors: Partial<Record<SourceId, string>>;
  beforeDedup: number;
  afterDedup: number;
  returned: number;
  latencyMs: number;
  generatedAt: string;
  searchBrief?: SearchBrief;
  aiTierUsed?: 0 | 1 | 2;
  llmProviderUsed?: ProviderOverrideConfig["provider"] | "default" | null;
  connectorStats?: {
    tavily?: {
      results: number;
      queryBoosts: number;
    };
  };
}

export interface FeedResponse {
  items: ScoredItem[];
  meta: FeedMeta;
}
