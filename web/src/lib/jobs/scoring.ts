// Tier-0 scorer for job candidates. Reuses the paper pipeline's primitives
// (keyword gate, TF-IDF, recency, preference ledger) and adds three
// job-specific signals: career-stage fit, academia/industry direction fit,
// and location fit. Fully useful with no model keys, per the repo invariant.

import { scoreKeyword } from "@/lib/scoring/keyword";
import { buildIndex, scoreTfidf } from "@/lib/scoring/tfidf";
import { scoreRecency } from "@/lib/scoring/recency";
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
import { rendersRemoteClaim } from "./remote-claim";
import type { RawItem } from "@/lib/sources/types";
import type {
  CareerStage,
  IndustryAcademiaPreference,
  PreferenceLedger,
} from "@/types";
import type { JobSourceId, RawJobItem, ScoredJobItem } from "./types";
import {
  FACULTY_RE,
  INTERN_RE,
  PHD_POSITION_RE,
  POSTDOC_RE,
  RESEARCH_SCIENTIST_RE,
} from "./role-kind";

export interface JobScoringProfile {
  topics: string[];
  softTopics?: string[];
  methods?: string[];
  seedTexts?: string[];
  preferenceLedger?: PreferenceLedger;
  careerStage?: CareerStage;
  industryPreference?: IndustryAcademiaPreference;
  locations?: string[];
}

interface FacetRankedJobItem extends ScoredJobItem {
  scoreWithoutFacetPreference: number;
  facetPreferenceLabels: string[];
}

const WEIGHTS = {
  keyword: 0.4,
  tfidf: 0.15,
  career: 0.15,
  industry: 0.08,
  location: 0.07,
  recency: 0.08,
  source: 0.07,
};

export const MIN_SCORE = OPPORTUNITY_MIN_SCORE;

const SOURCE_WEIGHTS: Record<JobSourceId, number> = {
  usajobs: 0.85,
  adzuna: 0.9,
  jsearch: 0.95,
  remotive: 0.85,
  himalayas: 0.85,
  arbeitnow: 0.7,
  jobweb: 0.75,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ── Career-stage fit ─────────────────────────────────────────────

const SENIOR_RE = /\b(senior|staff|principal|lead|director|head of|manager|vp)\b/i;

type StageBand = "earlyPhd" | "latePhd" | "postdoc" | "scientist";

export function stageBand(stage: CareerStage | undefined): StageBand {
  switch (stage) {
    case "PhD Year 1":
    case "PhD Year 2":
    case "PhD Year 3":
      return "earlyPhd";
    case "PhD Year 4":
    case "PhD Year 5":
    case "PhD Year 6":
      return "latePhd";
    case "Postdoc":
      return "postdoc";
    case "Research Scientist":
      return "scientist";
    default:
      return "latePhd";
  }
}

/**
 * 0–1: how appropriate this posting's seniority is for the user's stage,
 * judged from the title (strong) and description (weak fallback).
 */
export function scoreCareerFit(item: RawJobItem, stage: CareerStage | undefined): number {
  const band = stageBand(stage);
  const title = item.title;
  const isIntern = INTERN_RE.test(title);
  const isPhdPosition = PHD_POSITION_RE.test(title);
  const isPostdoc = POSTDOC_RE.test(title);
  const isScientist = RESEARCH_SCIENTIST_RE.test(title);
  const isFaculty = FACULTY_RE.test(title);
  const isSenior = SENIOR_RE.test(title);

  switch (band) {
    case "earlyPhd":
      if (isIntern) return 1;
      if (isPhdPosition) return 0.9;
      if (isSenior || isFaculty) return 0.1;
      if (isScientist || isPostdoc) return 0.35;
      return 0.5;
    case "latePhd":
      if (isIntern) return 0.9;
      if (isScientist && !isSenior) return 0.95;
      if (isPostdoc) return 0.9;
      if (isSenior || isFaculty) return 0.2;
      return 0.55;
    case "postdoc":
      if (isPostdoc) return 1;
      if (isFaculty) return 0.9;
      if (isScientist && !isSenior) return 0.9;
      if (isIntern || isPhdPosition) return 0.15;
      if (isSenior) return 0.5;
      return 0.55;
    case "scientist":
      if (isScientist) return isSenior ? 1 : 0.9;
      if (isFaculty) return 0.8;
      if (isSenior) return 0.75;
      if (isIntern || isPhdPosition) return 0.1;
      if (isPostdoc) return 0.4;
      return 0.5;
  }
}

// ── Academia / industry direction fit ────────────────────────────

const ACADEMIC_RE = /\b(universit(y|ies)|college|institute|academy|professor|faculty|postdoc|lecturer|phd|doctoral|national lab(oratory)?|research council|max planck|cnrs|riken)\b/i;
const BIG_TECH_RE = /\b(google|deepmind|meta|apple|microsoft|amazon|aws|nvidia|openai|anthropic|ibm|intel|samsung|bytedance|tencent|alibaba|baidu|huawei|netflix|adobe|salesforce|oracle|qualcomm|tesla)\b/i;
const STARTUP_RE = /\b(startup|start-up|seed[- ]stage|series [ab]|early[- ]stage|founding)\b/i;

export function scoreIndustryFit(
  item: RawJobItem,
  preference: IndustryAcademiaPreference | undefined,
): number {
  const text = `${item.title} ${item.company} ${item.description.slice(0, 400)}`;
  const isAcademic = ACADEMIC_RE.test(text);
  const isBigTech = BIG_TECH_RE.test(item.company ?? "") || BIG_TECH_RE.test(item.title);
  const isStartup = STARTUP_RE.test(text);

  switch (preference) {
    case "academia":
      return isAcademic ? 1 : 0.3;
    case "industry":
      return isAcademic ? 0.35 : 1;
    case "startups":
      if (isStartup) return 1;
      if (isAcademic) return 0.3;
      return isBigTech ? 0.45 : 0.8;
    case "bigTech":
      if (isBigTech) return 1;
      if (isAcademic) return 0.35;
      return 0.6;
    case "both":
    default:
      return 1;
  }
}

// ── Staleness ────────────────────────────────────────────────────

/** Postings older than this are assumed filled or withdrawn. */
const MAX_POSTING_AGE_DAYS = 270;
const DAY_MS = 24 * 60 * 60 * 1000;

// "Summer 2025 Internship", "Fall 2024 Co-op" — a season+year in the title is
// the posting's own statement of which cycle it belongs to.
const SEASON_YEAR_RE =
  /\b(?:spring|summer|fall|autumn|winter)\s+(20\d{2})\b/gi;

// A bare leading year is the other common way postings label their cycle:
// "2025 Battery Research Scientist Graduate Intern" was still being surfaced
// in mid-2026 because only season+year was recognised.
const LEADING_YEAR_RE = /^\s*(20\d{2})\b/;

/**
 * True when a posting is too old to be actionable. Two independent signals:
 * an explicit `postedAt` older than MAX_POSTING_AGE_DAYS, or a season+year
 * label in the title naming a cycle that has already passed.
 *
 * The events pipeline has always dropped finished events; jobs had no
 * equivalent, which surfaced a "Summer 2025 Internship" in mid-2026.
 */
/**
 * A23-04 / Ruling 62c. A WordPress-style DATE PERMALINK: three fully-bounded
 * components, `/<yyyy>/<mm>/<dd>/`. Nothing looser will do, and B verified both
 * near-misses against real rows in this corpus: `/2026/summer-internships` and
 * `/jobs/2026/molten-salt` are genuine postings and must NOT match.
 */
const DATE_PERMALINK_RE =
  /\/(?:19|20)\d{2}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\//;

/**
 * A23-04 / Ruling 62c. TRUE when the row is not a job posting at all: a blog
 * post that a search provider offered as a vacancy. `grad.wisc.edu`'s
 * `/2025/11/13/phd-student-internship-opportunities-at-thermo-fisher-scientific`
 * is a university news item about somebody else's internships, and it reached
 * the pool with `Thermo Fisher Scientific` printed as its employer.
 *
 * IT IS A CONJUNCTION, AND NEITHER HALF MAY SHIP ALONE — B measured both.
 * The URL clause has ZERO counter-examples in 96 offered rows, which means it
 * also has zero controls, and Ruling 55c raised the bar for exactly that shape.
 * The page clause on its own drops `careerservices.upenn.edu`, a real Oak Ridge
 * vacancy that Ruling 34a names. Together, each is the other's control.
 *
 * IT CAN ONLY EVER REMOVE A ROW. It changes no rendered value, invents no card
 * shape, and turns no silence into a value. A miss — an unfetched page, an
 * article that declares nothing, a permalink one component short — falls to
 * ADMISSION, which is exactly what ships today.
 */
export function isNonJobArticle(item: RawJobItem): boolean {
  if (item.fetchedPageKind !== "article") return false;
  try {
    return DATE_PERMALINK_RE.test(new URL(item.url).pathname);
  } catch {
    return false;
  }
}

export function isExpiredPosting(item: RawJobItem, now = Date.now()): boolean {
  if (item.postedAt) {
    const posted = Date.parse(item.postedAt);
    if (Number.isFinite(posted) && now - posted > MAX_POSTING_AGE_DAYS * DAY_MS) {
      return true;
    }
  }

  const currentYear = new Date(now).getUTCFullYear();
  const labelledYears = [...item.title.matchAll(SEASON_YEAR_RE)].map((m) =>
    Number(m[1]),
  );
  const leadingYear = item.title.match(LEADING_YEAR_RE)?.[1];
  if (leadingYear) labelledYears.push(Number(leadingYear));
  if (labelledYears.length > 0 && labelledYears.every((y) => y < currentYear)) {
    return true;
  }

  return false;
}

// ── Combined score ───────────────────────────────────────────────

/**
 * B2-08 / Ruling 12. Plate 02's "Why Peer sent this to you" reads as one
 * flowing sentence; joining these clauses with " · " produced a paragraph of
 * dot-separated fragments instead of prose. Ordinary sentence conjunction —
 * one clause stands alone, two join with "and", three or more become an
 * Oxford-comma list ending "and <last>". No trailing punctuation here: the
 * render layer appends a further clause (the facet-preference reason) and
 * closes the sentence itself.
 */
function joinReasonClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function reasonFor(
  item: RawJobItem,
  matched: string[],
  careerFit: number,
  stage: CareerStage | undefined,
): string {
  const parts: string[] = [];
  if (matched.length > 0) {
    parts.push(`Matches your ${matched.slice(0, 3).join(", ")} focus`);
  }
  if (careerFit >= 0.85 && stage) parts.push(`fits a ${stage} profile`);
  // A25-01 / RULING 68b. **THIS LINE READ `if (item.isRemote)`.** A22-03(b)
  // drew the render boundary at `mapper.ts` — a `jobweb` row's `isRemote` comes
  // from a search snippet that can belong to a NEIGHBOURING posting — but the
  // reason line is assembled HERE, at scoring time, from the raw flag, so the
  // claim reached the reader anyway. Measured live by round 25 A on
  // `lensa.com`: the report's "Why Peer sent this to you" read
  // `… and remote-friendly` on a posting whose own provider title says
  // `job in Albuquerque`, while the same page's location and work-mode
  // surfaces correctly showed no `Remote` at all — 5 of 5, byte-identical.
  // The predicate is now shared with `mapper.ts` rather than re-derived.
  //
  // **NO SCORE MOVES, AND THAT IS STRUCTURAL, NOT HOPEFUL:** `score` is
  // finished before `reasonFor` is called, and nothing reads the returned
  // string back. `locationFit(item.location, item.isRemote, …)` below is
  // A22-03(b)'s DELIBERATE raw reader and is untouched.
  if (rendersRemoteClaim(item)) parts.push("remote-friendly");
  if (parts.length === 0) {
    parts.push(
      item.source === "jobweb" ? "Matched by web search" : "Meets your job filters",
    );
  }
  const sentence = joinReasonClauses(parts);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function scoreJobs(
  items: RawJobItem[],
  profile: JobScoringProfile,
  now = Date.now(),
  options: { applyFloor?: boolean } = {},
): ScoredJobItem[] {
  if (items.length === 0) return [];

  // Facades let the paper-scoring primitives (keyword/TF-IDF/ledger) run
  // unchanged over job candidates.
  const facades = new Map<string, RawItem>(
    items.map((item) => {
      const facade = toScoringItem({
        id: item.id,
        title: item.title,
        text: `${item.company}\n${item.description}`,
        summary: `${item.title} ${item.description.slice(0, 300)}`,
        tags: item.tags,
        publishedAt: item.postedAt,
        url: item.url,
        preferenceSignals: item.preferenceSignals,
      });
      facade.metadata.preferenceSignals = normalizePreferenceConcepts([
        ...opportunityFacetPreferenceConcepts("jobs", item),
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

  const scored: FacetRankedJobItem[] = [];
  for (const item of items) {
    const facade = facades.get(item.id)!;
    // Drop postings that have clearly aged out. A posting the user cannot
    // apply to is worse than no posting: it burns a slot and reads as staleness.
    if (isExpiredPosting(item, now)) continue;
    // A23-04 / Ruling 62c. Beside the expiry drop, and post-enrichment for the
    // same reason: the page-kind signal only exists once a page has been read.
    if (isNonJobArticle(item)) continue;

    const requiredScoped = scoreKeyword(facade, profile.topics, {
      scope: "titleAndSummary",
    });
    const requiredAnywhere = scoreKeyword(facade, profile.topics);
    if (!passesRequiredGate(profile.topics, requiredScoped, requiredAnywhere)) {
      continue;
    }
    // Ruling 57b (round 21, item 5): the gate opened only because the
    // EMPLOYER'S OWN NAME contains a topic word. See the guard's own comment.
    if (
      isOwnerNameTopicCollision(
        {
          ownerName: item.company,
          title: item.title,
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
    const career = scoreCareerFit(item, profile.careerStage);
    const industry = scoreIndustryFit(item, profile.industryPreference);
    const location = locationFit(item.location, item.isRemote, profile.locations ?? []);
    const recency = clamp01(scoreRecency(item.postedAt ?? "", now));
    const source = SOURCE_WEIGHTS[item.source] ?? 0.7;
    const preference = scorePreferenceMatch(facade, preparedLedger, profile.topics, {
      now,
      documentFrequency,
      corpusSize: facadeList.length,
      targetKind: "job",
    });

    const base =
      WEIGHTS.keyword * kw.score +
      WEIGHTS.tfidf * tf +
      WEIGHTS.career * career +
      WEIGHTS.industry * industry +
      WEIGHTS.location * location +
      WEIGHTS.recency * recency +
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
      matchReason: reasonFor(
        item,
        reasonMatches,
        career,
        profile.careerStage,
      ),
    });
  }

  const baselineIndexById = new Map(
    [...scored]
      .sort(
        (left, right) =>
          right.scoreWithoutFacetPreference -
          left.scoreWithoutFacetPreference,
      )
      .map((item, index) => [item.id, index]),
  );
  const ranked: ScoredJobItem[] = [...scored]
    .sort((left, right) => right.score - left.score)
    .map(
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
