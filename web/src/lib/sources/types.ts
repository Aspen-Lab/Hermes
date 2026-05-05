import type { SearchBrief } from "@/lib/feed/profile-compiler";

export type SourceId =
  | "openalex"
  | "arxiv"
  | "semantic_scholar"
  | "dblp"
  | "pubmed"
  | "web"
  | "hn";

export type WebSearchProvider = "auto" | "brave" | "tavily";

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
  };
}

export interface SourceAdapter {
  id: SourceId;
  fetch(query: SourceQuery): Promise<RawItem[]>;
}
