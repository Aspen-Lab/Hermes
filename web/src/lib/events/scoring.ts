// Tier-0 scorer for event candidates. Reuses the paper pipeline's primitives
// (keyword gate, TF-IDF, preference ledger) and adds event-specific signals:
// deadline/date urgency, venue rank, and location fit. No model keys needed.

import { scoreKeyword } from "@/lib/scoring/keyword";
import { buildIndex, scoreTfidf } from "@/lib/scoring/tfidf";
import {
  buildPreferenceDocumentFrequency,
  conceptsFromRawItem,
  facetPreferenceReason,
  materiallyChangedByFacetPreference,
  normalizePreferenceConcepts,
  opportunityFacetPreferenceConcepts,
  prepareLedger,
  scorePreferenceMatch,
} from "@/lib/preferences/ledger";
import {
  isOwnerNameTopicCollision,
  locationFit,
  passesRequiredGate,
  toScoringItem,
} from "@/lib/opportunities/shared";
import { OPPORTUNITY_MIN_SCORE } from "@/lib/opportunities/facets";
import { dateClaimEndMs } from "@/lib/format";
import type { RawItem } from "@/lib/sources/types";
import type { EventType, PreferenceLedger } from "@/types";
import type { EventSourceId, RawEventItem, ScoredEventItem } from "./types";

export interface EventScoringProfile {
  topics: string[];
  softTopics?: string[];
  methods?: string[];
  seedTexts?: string[];
  preferenceLedger?: PreferenceLedger;
  locations?: string[];
}

interface FacetRankedEventItem extends ScoredEventItem {
  scoreWithoutFacetPreference: number;
  facetPreferenceLabels: string[];
}

const WEIGHTS = {
  keyword: 0.45,
  tfidf: 0.2,
  urgency: 0.12,
  rank: 0.08,
  location: 0.05,
  source: 0.1,
};

export const MIN_SCORE = OPPORTUNITY_MIN_SCORE;

const SOURCE_WEIGHTS: Record<EventSourceId, number> = {
  ccfddl: 1.0,
  researchseminars: 0.9,
  confstech: 0.75,
  eventweb: 0.8,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * 0–1 urgency: how timely it is to surface this event today. Submission
 * deadlines dominate (a CFP closing in 2–6 weeks is peak "act now"); events
 * without an open deadline score by how soon they start (registration/attend
 * planning). Events fully in the past should have been dropped upstream.
 */
export function scoreUrgency(item: RawEventItem, now = Date.now()): number {
  const scores: number[] = [];
  if (item.deadline) {
    const days = (Date.parse(item.deadline) - now) / DAY_MS;
    if (days >= 0) {
      // 0 days → 1.0, 120+ days → 0.3.
      scores.push(Math.max(0.3, 1 - days / 170));
    }
  }
  if (item.startDate) {
    const days = (Date.parse(item.startDate) - now) / DAY_MS;
    if (days >= 0) {
      // Starting within ~2 months is planning-relevant; a year out is not.
      scores.push(Math.max(0.15, 0.9 - days / 200));
    }
  }
  if (scores.length === 0) return 0.35;
  return clamp01(Math.max(...scores));
}

/** 0–1 prestige from CCF/CORE rank strings ("CCF A · CORE A*"). */
export function scoreRank(rank: string | undefined): number {
  if (!rank) return 0.6;
  if (/A\*/.test(rank) || /\bA\b/.test(rank)) return 1;
  if (/\bB\b/.test(rank)) return 0.8;
  if (/\bC\b/.test(rank)) return 0.65;
  return 0.6;
}

/**
 * B2-08 / Ruling 12. Plate 03's "Why Peer sent this to you" reads as one
 * flowing sentence, same as the job report's twin. Ordinary sentence
 * conjunction instead of a " · " join — one clause stands alone, two join
 * with "and", three or more become an Oxford-comma list ending "and <last>".
 * No trailing punctuation: the render layer appends the facet-preference
 * clause and closes the sentence itself.
 */
function joinReasonClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function reasonFor(item: RawEventItem, matched: string[], now: number): string {
  const parts: string[] = [];
  if (matched.length > 0) {
    parts.push(`Covers your ${matched.slice(0, 3).join(", ")} focus`);
  }
  if (item.deadline) {
    const days = Math.max(0, Math.round((Date.parse(item.deadline) - now) / DAY_MS));
    parts.push(days <= 45 ? `submission deadline in ${days} days` : "CFP open");
  } else if (item.startDate) {
    const days = Math.round((Date.parse(item.startDate) - now) / DAY_MS);
    if (days >= 0 && days <= 60) parts.push(`starts in ${days} days`);
  }
  if (item.rank) parts.push(item.rank);
  if (parts.length === 0) {
    parts.push(
      item.source === "eventweb" ? "Matched by web search" : "Meets your event filters",
    );
  }
  const sentence = joinReasonClauses(parts);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Keep the daily 10 from becoming ten conferences (or ten seminars): cap
 * each event type at `cap` while preserving score order.
 */
export function diversifyByType<TItem extends ScoredEventItem>(
  items: TItem[],
  cap = 5,
): TItem[] {
  const counts = new Map<EventType, number>();
  const kept: TItem[] = [];
  const overflow: TItem[] = [];
  for (const item of items) {
    const count = counts.get(item.type) ?? 0;
    if (count < cap) {
      counts.set(item.type, count + 1);
      kept.push(item);
    } else {
      overflow.push(item);
    }
  }
  return [...kept, ...overflow];
}

export function scoreEvents(
  items: RawEventItem[],
  profile: EventScoringProfile,
  now = Date.now(),
  options: { applyFloor?: boolean } = {},
): ScoredEventItem[] {
  if (items.length === 0) return [];

  const facades = new Map<string, RawItem>(
    items.map((item) => {
      const facade = toScoringItem({
        id: item.id,
        title: item.name,
        text: item.description,
        summary: item.description.slice(0, 300),
        tags: item.tags,
        publishedAt: item.startDate,
        url: item.url,
        preferenceSignals: item.preferenceSignals,
      });
      facade.metadata.preferenceSignals = normalizePreferenceConcepts([
        ...opportunityFacetPreferenceConcepts("events", item),
        ...conceptsFromRawItem(facade),
      ]);
      return [item.id, facade] as const;
    }),
  );
  const facadeList = Array.from(facades.values());
  const index = buildIndex(facadeList);
  const profileText = [
    ...profile.topics,
    ...(profile.methods ?? []),
    ...(profile.seedTexts ?? []),
  ].join(" ");
  const preparedLedger = prepareLedger(profile.preferenceLedger);
  const documentFrequency = buildPreferenceDocumentFrequency(facadeList);

  const rankingTopics = [...profile.topics, ...(profile.methods ?? [])];
  const softTopics = profile.softTopics ?? [];

  const scored: FacetRankedEventItem[] = [];
  for (const item of items) {
    const isWebDiscovered = item.source === "eventweb";

    // Skip events that are entirely over. Web items often carry no parseable
    // date (shown as "date TBA"); trust the dated-future search query rather
    // than dropping them.
    // A23-02 / Ruling 62b. `dateClaimEndMs`, not `Date.parse`: a
    // month-granularity start ("2026-08") is only over when its MONTH is over,
    // and reading it as a day-level date would drop a live August row on
    // 1 August. Identical to `Date.parse` for every day-level value.
    const startMs = item.startDate ? dateClaimEndMs(item.startDate) : NaN;
    const deadlineMs = item.deadline ? Date.parse(item.deadline) : NaN;
    const endMs = item.endDate ? dateClaimEndMs(item.endDate) : startMs;
    const hasParsedDate =
      Number.isFinite(endMs) || Number.isFinite(deadlineMs);
    const hasFuture =
      (Number.isFinite(endMs) && endMs >= now) ||
      (Number.isFinite(deadlineMs) && deadlineMs >= now);
    if (hasParsedDate && !hasFuture) continue;
    if (!hasParsedDate && !isWebDiscovered) continue;

    const facade = facades.get(item.id)!;
    const requiredScoped = scoreKeyword(facade, profile.topics, {
      scope: "titleAndSummary",
    });
    const requiredAnywhere = scoreKeyword(facade, profile.topics);
    if (!passesRequiredGate(profile.topics, requiredScoped, requiredAnywhere)) {
      continue;
    }
    // Ruling 57b (round 21, item 5): the gate opened only because the
    // ORGANISER'S OWN NAME contains a topic word. Ships on this surface
    // DESIGNED BUT ORGANICALLY UNWITNESSED — round 21 A's event-side count was
    // 1 instance, 0 admitted, and no event pull has ever caught this shape.
    // Round 22 A's line.
    if (
      isOwnerNameTopicCollision(
        {
          ownerName: item.organisations?.[0]?.name,
          title: item.name,
          description: item.description,
        },
        profile.topics,
      )
    ) {
      continue;
    }

    const kw = scoreKeyword(facade, rankingTopics, {
      scope: "titleAndSummary",
    });
    const requiredMatches =
      requiredScoped.matched.length > 0
        ? requiredScoped.matched
        : requiredAnywhere.matched;
    const reasonMatches = Array.from(
      new Set([...requiredMatches, ...kw.matched]),
    );

    const softKw = scoreKeyword(facade, softTopics, {
      scope: "titleAndSummary",
    });
    const tf = clamp01(scoreTfidf(item.id, profileText, index));
    const urgency = scoreUrgency(item, now);
    const rank = scoreRank(item.rank);
    const location = locationFit(item.location, item.isOnline, profile.locations ?? []);
    const source = SOURCE_WEIGHTS[item.source] ?? 0.7;
    const preference = scorePreferenceMatch(facade, preparedLedger, profile.topics, {
      now,
      documentFrequency,
      corpusSize: facadeList.length,
      targetKind: "event",
    });

    const base =
      WEIGHTS.keyword * kw.score +
      WEIGHTS.tfidf * tf +
      WEIGHTS.urgency * urgency +
      WEIGHTS.rank * rank +
      WEIGHTS.location * location +
      WEIGHTS.source * source;
    const softBonus = softTopics.length > 0 ? softKw.score * 0.12 : 0;
    const scoreWithoutFacetPreference = clamp01(
      base * preference.penalty +
        softBonus +
        preference.boost -
        preference.facetBoost,
    );
    const score = clamp01(base * preference.penalty + softBonus + preference.boost);

    scored.push({
      ...item,
      score,
      scoreWithoutFacetPreference,
      facetPreferenceLabels: preference.matchedFacetPositive,
      matchedKeywords: reasonMatches,
      relevanceReason: reasonFor(item, reasonMatches, now),
    });
  }

  const baselineRanked = diversifyByType(
    [...scored].sort(
      (left, right) =>
        right.scoreWithoutFacetPreference -
        left.scoreWithoutFacetPreference,
    ),
  );
  const baselineIndexById = new Map(
    baselineRanked.map((item, index) => [item.id, index]),
  );
  const rankedWithContext = diversifyByType(
    [...scored].sort((left, right) => right.score - left.score),
  );
  const ranked: ScoredEventItem[] = rankedWithContext.map(
    (
      {
        scoreWithoutFacetPreference,
        facetPreferenceLabels,
        ...item
      },
      finalIndex,
    ) => {
      const baselineIndex = baselineIndexById.get(item.id) ?? -1;
      const explanation =
        item.score > scoreWithoutFacetPreference &&
        materiallyChangedByFacetPreference(baselineIndex, finalIndex)
          ? facetPreferenceReason(facetPreferenceLabels)
          : undefined;
      return {
        ...item,
        facetPreferenceReason: explanation,
      };
    },
  );
  return options.applyFloor === false
    ? ranked
    : ranked.filter((item) => item.score >= MIN_SCORE);
}
