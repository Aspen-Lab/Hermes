// Tier-0 scorer for job candidates. Reuses the paper pipeline's primitives
// (keyword gate, TF-IDF, recency, preference ledger) and adds three
// job-specific signals: career-stage fit, academia/industry direction fit,
// and location fit. Fully useful with no model keys, per the repo invariant.

import { scoreKeyword } from "@/lib/scoring/keyword";
import { buildIndex, scoreTfidf } from "@/lib/scoring/tfidf";
import { scoreRecency } from "@/lib/scoring/recency";
import {
  buildPreferenceDocumentFrequency,
  prepareLedger,
  scorePreferenceMatch,
} from "@/lib/preferences/ledger";
import { locationFit, toScoringItem } from "@/lib/opportunities/shared";
import type { RawItem } from "@/lib/sources/types";
import type {
  CareerStage,
  IndustryAcademiaPreference,
  PreferenceLedger,
} from "@/types";
import type { JobSourceId, RawJobItem, ScoredJobItem } from "./types";

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

const WEIGHTS = {
  keyword: 0.26,
  tfidf: 0.15,
  career: 0.2,
  industry: 0.1,
  location: 0.1,
  recency: 0.12,
  source: 0.07,
};

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

const INTERN_RE = /\b(intern(ship)?|phd student|student researcher|working student)\b/i;
const PHD_POSITION_RE = /\b(phd (position|candidate|fellowship)|doctoral)\b/i;
const POSTDOC_RE = /\b(post[- ]?doc(toral)?|research fellow)\b/i;
const RESEARCH_SCIENTIST_RE = /\b(research (scientist|engineer)|applied scientist|member of technical staff|researcher)\b/i;
const FACULTY_RE = /\b(professor|faculty|lecturer|tenure[- ]track)\b/i;
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
  const isAcademic = ACADEMIC_RE.test(text) || item.source === "jobweb";
  const isBigTech = BIG_TECH_RE.test(item.company) || BIG_TECH_RE.test(item.title);
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

// ── Combined score ───────────────────────────────────────────────

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
  if (item.isRemote) parts.push("remote-friendly");
  if (parts.length === 0) parts.push("Related to your research area");
  const sentence = parts.join(" · ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function scoreJobs(
  items: RawJobItem[],
  profile: JobScoringProfile,
  now = Date.now(),
): ScoredJobItem[] {
  if (items.length === 0) return [];

  // Facades let the paper-scoring primitives (keyword/TF-IDF/ledger) run
  // unchanged over job candidates.
  const facades = new Map<string, RawItem>(
    items.map((item) => [
      item.id,
      toScoringItem({
        id: item.id,
        title: item.title,
        text: `${item.company}\n${item.description}`,
        tags: item.tags,
        publishedAt: item.postedAt,
        url: item.url,
        preferenceSignals: item.preferenceSignals,
      }),
    ]),
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

  // Gate topics: research topics plus methods — a posting matching either is
  // plausibly relevant; matching neither is dropped when topics are set.
  const gateTopics = [...profile.topics, ...(profile.methods ?? [])];
  const softTopics = profile.softTopics ?? [];

  const scored: ScoredJobItem[] = [];
  for (const item of items) {
    // Web-discovered postings came from a topic-targeted search query, so the
    // search engine already filtered for relevance. Keyless board sources
    // (remotive/arbeitnow/himalayas) return their whole catalog, so they still
    // need the strict exact-phrase gate below.
    const searchPrefiltered = item.source === "jobweb";
    const facade = facades.get(item.id)!;
    const kw = scoreKeyword(facade, gateTopics);
    // Research topics are precise ("solid state battery") but postings use
    // field-level wording ("battery R&D scientist"), so the exact-phrase gate
    // would wrongly drop relevant web hits — enforce it on board sources only.
    if (!searchPrefiltered && gateTopics.length > 0 && kw.score === 0) continue;

    const softKw = scoreKeyword(facade, softTopics);
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
    const score = clamp01(base * preference.penalty + softBonus + preference.boost);

    scored.push({
      ...item,
      score,
      matchedKeywords: kw.matched,
      matchReason: reasonFor(item, kw.matched, career, profile.careerStage),
    });
  }

  return scored.sort((a, b) => b.score - a.score);
}
