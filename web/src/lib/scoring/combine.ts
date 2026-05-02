import type { RawItem } from "@/lib/sources/types";
import type {
  ScoringProfile,
  ScoreWeights,
  ScoredItem,
  ScoreBreakdown,
} from "./types";
import { DEFAULT_WEIGHTS } from "./types";
import { scoreKeyword } from "./keyword";
import { buildIndex, scoreTfidf } from "./tfidf";
import { scoreRecency } from "./recency";
import { scoreSource } from "./source-weight";
import { generateReason } from "./reason";
import { shouldPushReviewPaper } from "./review-policy";
import { normalizePhrase } from "./tokenize";

function profileText(profile: ScoringProfile): string {
  return [
    ...profile.topics,
    ...(profile.methods ?? []),
    ...(profile.venues ?? []),
    ...(profile.seedTexts ?? []),
  ].join(" ");
}

function normalizeWeights(w: ScoreWeights): ScoreWeights {
  const sum = w.keyword + w.tfidf + w.recency + w.source;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  return {
    keyword: w.keyword / sum,
    tfidf: w.tfidf / sum,
    recency: w.recency / sum,
    source: w.source / sum,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function negativePenalty(item: RawItem, negativeTopics: string[]): number {
  if (negativeTopics.length === 0) return 1;
  const haystack = [item.title, item.abstract ?? "", (item.tags ?? []).join(" ")]
    .join(" ").toLowerCase();
  const hit = negativeTopics.some((t) => {
    const needle = normalizePhrase(t);
    return needle && haystack.includes(needle);
  });
  return hit ? 0.15 : 1;
}

export function scoreItems(
  items: RawItem[],
  profile: ScoringProfile,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  now = Date.now(),
): ScoredItem[] {
  if (items.length === 0) return [];
  const w = normalizeWeights(weights);
  const index = buildIndex(items);
  const pText = profileText(profile);

  const mustTopics = profile.topics;
  const softTopics = profile.softTopics ?? [];

  const scored: ScoredItem[] = [];
  for (const item of items) {
    const kw = scoreKeyword(item, mustTopics);
    // Hard gate: if required topics are set, the item must match at least one.
    if (mustTopics.length > 0 && kw.score === 0) continue;

    const softKw = scoreKeyword(item, softTopics);
    const tf = clamp01(scoreTfidf(item.id, pText, index));
    const rc = clamp01(scoreRecency(item.publishedAt, now));
    const sr = clamp01(scoreSource(item.source, profile.sourceWeights));
    const penalty = negativePenalty(item, profile.negativeTopics ?? []);
    // Soft topics add up to +0.18 bonus so papers the user is curious about
    // float above equal-relevance papers that lack those terms.
    const softBonus = softTopics.length > 0 ? softKw.score * 0.18 : 0;
    const combined = clamp01(
      (w.keyword * kw.score + w.tfidf * tf + w.recency * rc + w.source * sr) * penalty + softBonus,
    );
    const breakdown: ScoreBreakdown = {
      keyword: kw.score,
      tfidf: tf,
      recency: rc,
      source: sr,
      combined,
    };
    scored.push({
      ...item,
      score: combined,
      scoreBreakdown: breakdown,
      matchedKeywords: kw.matched,
      relevanceReason: generateReason(item, kw.matched, breakdown),
    });
  }

  return scored
    .filter((item) => shouldPushReviewPaper(item, profile.seedTexts))
    .sort((a, b) => b.score - a.score);
}
