import { openalex } from "./openalex";
import { arxiv } from "./arxiv";
import { semanticScholar } from "./semantic-scholar";
import { dblp } from "./dblp";
import { pubmed } from "./pubmed";
import { webSearch } from "./web-search";
import { hn } from "./hn";
import type { SourceAdapter, SourceId } from "./types";

export * from "./types";
export { openalex, arxiv, semanticScholar, dblp, pubmed, webSearch, hn };

export const sources: SourceAdapter[] = [
  openalex,
  arxiv,
  semanticScholar,
  dblp,
  pubmed,
  webSearch,
  hn,
];

export const bySourceId: Record<SourceId, SourceAdapter> = {
  openalex,
  arxiv,
  semantic_scholar: semanticScholar,
  dblp,
  pubmed,
  web: webSearch,
  hn,
};
