import type { SearchBrief } from "@/lib/feed/profile-compiler";
import type { PreferenceConcept } from "@/types";

export type SourceId =
  | "openalex"
  | "arxiv"
  | "semantic_scholar"
  | "dblp"
  | "pubmed"
  | "web"
  | "hn";

// RULING 75 — `gemini` joins the union. Vertex Gemini with Google Search
// grounding is the replacement search engine while the quota-capped APIs are
// suspended; `sources/gemini-search.ts` is the adapter and owns the resolution
// order all three surfaces share.
export type WebSearchProvider = "auto" | "brave" | "tavily" | "gemini";

export interface SourceQuery {
  topics: string[];
  queries?: string[];
  methods?: string[];
  venues?: string[];
  avoid?: string[];
  timeWindow?: SearchBrief["timeWindow"];
  limit?: number;
  webSearch?: {
    provider?: WebSearchProvider;
    tavilyApiKey?: string;
    includeDomains?: string[];
    excludeDomains?: string[];
  };
}

export interface RawItem {
  id: string;
  source: SourceId;
  title: string;
  authors: string[];
  abstract?: string;
  url: string;
  publishedAt: string;
  venue?: string;
  tags?: string[];
  metadata: {
    citationCount?: number;
    doi?: string;
    semanticScholarId?: string;
    arxivCategory?: string;
    hnScore?: number;
    hnComments?: number;
    workType?: string;
    isOpenAccess?: boolean;
    preferenceSignals?: PreferenceConcept[];
  };
}

export interface SourceAdapter {
  id: SourceId;
  fetch(query: SourceQuery): Promise<RawItem[]>;
}
