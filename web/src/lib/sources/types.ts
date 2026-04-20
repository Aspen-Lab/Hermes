export type SourceId = "openalex" | "arxiv" | "hn";

export interface SourceQuery {
  topics: string[];
  methods?: string[];
  venues?: string[];
  limit?: number;
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
    arxivCategory?: string;
    hnScore?: number;
    hnComments?: number;
  };
}

export interface SourceAdapter {
  id: SourceId;
  fetch(query: SourceQuery): Promise<RawItem[]>;
}
