import type { RawItem } from "@/lib/sources/types";
import { canonicalize, termMatches, termSpecificity } from "./term-expand";

export interface KeywordResult {
  score: number;
  matched: string[];
}

type KeywordScope = "all" | "titleAndSummary";
type GateMetadata = RawItem["metadata"] & { gateText?: string };

function itemText(item: RawItem, scope: KeywordScope): string {
  const gateText = (item.metadata as GateMetadata).gateText ?? "";
  return canonicalize(
    [
      item.title,
      scope === "titleAndSummary" ? gateText : item.abstract ?? "",
      (item.tags ?? []).join(" "),
    ].join(" "),
  );
}

export function scoreKeyword(
  item: RawItem,
  topics: string[],
  opts: { scope?: KeywordScope } = {},
): KeywordResult {
  if (topics.length === 0) return { score: 0, matched: [] };
  const haystack = itemText(item, opts.scope ?? "all");
  const matched: string[] = [];
  const seen = new Set<string>();
  let raw = 0;
  for (const topic of topics) {
    const canonicalTopic = canonicalize(topic);
    if (!canonicalTopic || seen.has(canonicalTopic)) continue;
    seen.add(canonicalTopic);
    if (termMatches(haystack, canonicalTopic)) {
      matched.push(topic);
      raw += termSpecificity(canonicalTopic);
    }
  }
  return {
    score: Math.min(1, raw / 1.5),
    matched,
  };
}
