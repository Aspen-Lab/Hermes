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
import {
  buildPreferenceDocumentFrequency,
  prepareLedger,
  scorePreferenceMatch,
} from "@/lib/preferences/ledger";

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

function topicMatchesItem(item: RawItem, topic: string): boolean {
  const needle = normalizePhrase(topic);
  if (!needle) return false;
  const haystack = [item.title, item.abstract ?? "", (item.tags ?? []).join(" ")]
    .join(" ").toLowerCase();
  return haystack.includes(needle);
}

function isProtectedRequiredTopic(topic: string, requiredTopics: string[]): boolean {
  const needle = normalizePhrase(topic);
  if (!needle) return false;
  return requiredTopics.some((requiredTopic) => {
    const required = normalizePhrase(requiredTopic);
    return Boolean(
      required &&
        (needle === required ||
          needle.includes(required) ||
          required.includes(needle)),
    );
  });
}

function negativePenalty(item: RawItem, negativeTopics: string[]): number {
  if (negativeTopics.length === 0) return 1;
  const hit = negativeTopics.some((t) => topicMatchesItem(item, t));
  return hit ? 0.15 : 1;
}

function legacyDislikePenalty(
  item: RawItem,
  legacyNegativeTopics: string[],
  requiredTopics: string[],
): number {
  if (legacyNegativeTopics.length === 0) return 1;
  const hit = legacyNegativeTopics.some((t) => {
    if (isProtectedRequiredTopic(t, requiredTopics)) return false;
    return topicMatchesItem(item, t);
  });
  return hit ? 0.65 : 1;
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
  const preferenceDocumentFrequency = buildPreferenceDocumentFrequency(items);
  // Clean + index the ledger once for the whole batch (was re-cleaned + scanned
  // per item before).
  const preparedLedger = prepareLedger(profile.preferenceLedger);

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
    const policyPenalty = negativePenalty(item, profile.negativeTopics ?? []);
    const legacyPenalty = legacyDislikePenalty(
      item,
      profile.legacyNegativeTopics ?? [],
      mustTopics,
    );
    const preference = scorePreferenceMatch(
      item,
      preparedLedger,
      mustTopics,
      {
        now,
        documentFrequency: preferenceDocumentFrequency,
        corpusSize: items.length,
      },
    );
    // Soft topics add up to +0.18 bonus so papers the user is curious about
    // float above equal-relevance papers that lack those terms.
    const softBonus = softTopics.length > 0 ? softKw.score * 0.18 : 0;
    const base = w.keyword * kw.score + w.tfidf * tf + w.recency * rc + w.source * sr;
    const combined = clamp01(
      base * policyPenalty * legacyPenalty * preference.penalty +
        softBonus +
        preference.boost,
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
