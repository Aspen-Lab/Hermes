import type { RawItem } from "@/lib/sources/types";
import { normalizePhrase } from "./tokenize";

export interface KeywordResult {
  score: number;
  matched: string[];
}

function itemText(item: RawItem): string {
  return [item.title, item.abstract ?? "", (item.tags ?? []).join(" ")]
    .join(" ")
    .toLowerCase();
}

export function scoreKeyword(
  item: RawItem,
  topics: string[],
): KeywordResult {
  if (topics.length === 0) return { score: 0, matched: [] };
  const haystack = itemText(item);
  const matched: string[] = [];
  for (const topic of topics) {
    const needle = normalizePhrase(topic);
    if (!needle) continue;
    if (haystack.includes(needle)) matched.push(topic);
  }
  return {
    score: matched.length / topics.length,
    matched,
  };
}
