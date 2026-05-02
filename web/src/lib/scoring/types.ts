import type { RawItem, SourceId } from "@/lib/sources/types";

export interface ScoringProfile {
  topics: string[];
  /** Bonus-only topics: matching papers score higher but non-matching still appear. */
  softTopics?: string[];
  methods?: string[];
  venues?: string[];
  seedTexts?: string[];
  negativeTopics?: string[];
  sourceWeights?: Partial<Record<SourceId, number>>;
}

export interface ScoreWeights {
  keyword: number;
  tfidf: number;
  recency: number;
  source: number;
}

export interface ScoreBreakdown {
  keyword: number;
  tfidf: number;
  recency: number;
  source: number;
  combined: number;
}

export interface ScoredItem extends RawItem {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  matchedKeywords: string[];
  relevanceReason: string;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  keyword: 0.35,
  tfidf: 0.3,
  source: 0.15,
  recency: 0.2,
};

export const DEFAULT_SOURCE_WEIGHTS: Record<SourceId, number> = {
  openalex: 1.0,
  semantic_scholar: 1.0,
  dblp: 0.95,
  pubmed: 1.0,
  arxiv: 0.9,
  web: 0.7,
  hn: 0.75,
};
