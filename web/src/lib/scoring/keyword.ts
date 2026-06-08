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

// Does `needle` appear in `haystack` as a real match (not embedded in another
// word)? Short tokens/acronyms (≤4 chars, single word like "LCO") require a
// whole-word match so they don't match inside "falcon" or "balcony". Longer
// terms keep substring matching so plurals/morphology still match
// (e.g. "cathode" → "cathodes", "battery" → "batteries").
function matchesTopic(haystack: string, needle: string): boolean {
  const isShortToken = needle.length <= 4 && !needle.includes(" ");
  if (!isShortToken) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    // Unicode-aware boundaries: not preceded/followed by a letter or digit.
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
    return re.test(haystack);
  } catch {
    return haystack.includes(needle);
  }
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
    if (matchesTopic(haystack, needle)) matched.push(topic);
  }
  return {
    score: matched.length / topics.length,
    matched,
  };
}
