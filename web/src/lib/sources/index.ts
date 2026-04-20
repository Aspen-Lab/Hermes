import { openalex } from "./openalex";
import { arxiv } from "./arxiv";
import { hn } from "./hn";
import type { SourceAdapter, SourceId } from "./types";

export * from "./types";
export { openalex, arxiv, hn };

export const sources: SourceAdapter[] = [openalex, arxiv, hn];

export const bySourceId: Record<SourceId, SourceAdapter> = {
  openalex,
  arxiv,
  hn,
};
