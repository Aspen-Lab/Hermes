import type { Paper, UserProfile } from "@/types";
import { cleanDisplayText } from "@/lib/text/clean";
import { reviewPaperLabel } from "@/lib/papers/report";

const WORDS_PER_MINUTE = 220;
const MAX_TAGS = 8;

const FORMAT_TERMS = [
  "article",
  "journal article",
  "preprint",
  "review",
  "survey",
  "conference paper",
  "proceedings",
];

const METHOD_PATTERNS = [
  /\bmodel(s|ing)?\b/i,
  /\breasoning\b/i,
  /\brag\b/i,
  /\bretrieval\b/i,
  /\bembedding(s)?\b/i,
  /\bbenchmark(s)?\b/i,
  /\bdataset(s)?\b/i,
  /\bevaluation\b/i,
  /\bexperiment(s|al)?\b/i,
  /\bsimulation(s)?\b/i,
  /\btrial\b/i,
  /\binterview(s)?\b/i,
  /\bsurvey\b/i,
  /\bcohort\b/i,
  /\bassay\b/i,
  /\bmicroscopy\b/i,
  /\bspectroscopy\b/i,
  /\boptimization\b/i,
  /\bframework\b/i,
  /\barchitecture\b/i,
  /\bpipeline\b/i,
];

export type SurfaceTone = "accent" | "plain" | "muted";

export interface SurfaceCell {
  label: string;
  title: string;
  body?: string;
  tone?: SurfaceTone;
}

export interface SurfaceKeywordGroup {
  label: string;
  title: string;
  items: string[];
  empty: string;
}

export interface SurfaceFlowStep {
  label: string;
  title: string;
  body: string;
  state: "present" | "thin";
}

export interface PaperThinkingSurfaceModel {
  title: string;
  subtitle: string;
  badge: string;
  matchLabel: string;
  readTimeLabel: string;
  publishedLabel: string;
  primaryUrl: string;
  primaryLabel: string;
  secondaryLinks: { label: string; href: string }[];
  scan: SurfaceCell[];
  proposal: SurfaceCell;
  result: SurfaceCell;
  methodGroups: SurfaceKeywordGroup[];
  fit: SurfaceCell[];
  flow: SurfaceFlowStep[];
  sourceFacts: SurfaceCell[];
  tags: string[];
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = cleanDisplayText(raw).replace(/\s+/g, " ").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function sentenceList(text?: string, limit = 4): string[] {
  return cleanDisplayText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 18)
    .slice(0, limit);
}

function compact(text: string | undefined, max = 190): string {
  const value = cleanDisplayText(text);
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim().replace(/[,:;.\s-]+$/, "")}.`;
}

function firstSentence(text: string | undefined, fallback: string): string {
  return compact(sentenceList(text, 1)[0] ?? text ?? fallback);
}

function includesTerm(haystack: string, needle: string): boolean {
  const term = needle.trim().toLowerCase();
  if (term.length < 3) return false;
  return haystack.includes(term);
}

function profileMatches(
  profile: UserProfile,
  haystack: string,
): {
  topics: string[];
  soft: string[];
  methods: string[];
} {
  return {
    topics: unique(profile.researchTopics.filter((term) => includesTerm(haystack, term))),
    soft: unique((profile.softTopics ?? []).filter((term) => includesTerm(haystack, term))),
    methods: unique(profile.preferredMethods.filter((term) => includesTerm(haystack, term))),
  };
}

function keywordGroups(
  paper: Paper,
  profile: UserProfile,
): SurfaceKeywordGroup[] {
  const haystack = [
    paper.title,
    paper.summaryIntro,
    paper.summaryResultDiscussion,
    paper.relevanceReason,
    paper.summaryExperimentKeywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const formatSet = new Set(FORMAT_TERMS.map((term) => term.toLowerCase()));
  const profileMethodSet = new Set(
    profile.preferredMethods.map((term) => term.toLowerCase()),
  );

  const method: string[] = [];
  const format: string[] = [];
  const topic: string[] = [];

  for (const keyword of unique(paper.summaryExperimentKeywords)) {
    const lower = keyword.toLowerCase();
    if (formatSet.has(lower)) {
      format.push(keyword);
      continue;
    }
    if (
      profileMethodSet.has(lower) ||
      METHOD_PATTERNS.some((pattern) => pattern.test(keyword))
    ) {
      method.push(keyword);
      continue;
    }
    topic.push(keyword);
  }

  const inferredMethods = profile.preferredMethods.filter((term) =>
    includesTerm(haystack, term),
  );

  return [
    {
      label: "Method",
      title: "How it appears to work",
      items: unique([...method, ...inferredMethods]).slice(0, MAX_TAGS),
      empty: "No concrete method signal in current metadata.",
    },
    {
      label: "Topic",
      title: "What domain it occupies",
      items: unique(topic).slice(0, MAX_TAGS),
      empty: "No topic keywords shipped with this item.",
    },
    {
      label: "Format",
      title: "What kind of source it is",
      items: unique([
        ...format,
        reviewPaperLabel(paper) ?? "",
        paper.linkArxiv ? "Preprint" : "",
        paper.linkCode ? "Code-linked" : "",
      ]).slice(0, MAX_TAGS),
      empty: "Source type is not explicit.",
    },
  ];
}

function wordCount(...parts: (string | undefined)[]): number {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function readTimeMinutes(paper: Paper): number {
  const words = wordCount(
    paper.summaryIntro,
    paper.summaryResultDiscussion,
    paper.relevanceReason,
  );
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

function formatPublishedDate(d: string | undefined, nowMs: number): string {
  if (!d) return "Unknown";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffDays = Math.floor((nowMs - date.getTime()) / 86_400_000);
  if (diffDays < 1) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 14) return `${diffDays}d ago`;
  if (diffDays < 60) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function matchLabel(score?: number): string {
  if (score == null) return "Unscored";
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function sourceKind(paper: Paper): string {
  if (paper.linkArxiv) return "arXiv";
  if (paper.linkPaper) return paper.venue || "Publisher";
  return "Search";
}

function decisionCell(paper: Paper): SurfaceCell {
  const score = paper.relevanceScore ?? 0;
  if (paper.linkCode) {
    return {
      label: "Action",
      title: "Inspect code path",
      body: "Code is available, so this can move from reading to validation.",
      tone: "accent",
    };
  }
  if (score >= 0.72) {
    return {
      label: "Action",
      title: "Read source text",
      body: "High match. Open the source if the result signal answers your current question.",
      tone: "accent",
    };
  }
  return {
    label: "Action",
    title: "Skim, then decide",
    body: "Use this surface to decide whether it deserves full-paper time.",
    tone: "plain",
  };
}

function sourceUrl(paper: Paper): string {
  const q = encodeURIComponent(paper.title);
  return paper.linkArxiv ?? paper.linkPaper ?? `https://arxiv.org/search/?query=${q}`;
}

function sourceLabel(paper: Paper): string {
  if (paper.linkArxiv) return "Read on arXiv";
  if (paper.linkPaper) return `Read on ${paper.venue || "source"}`;
  return "Search arXiv";
}

function buildSecondaryLinks(paper: Paper): { label: string; href: string }[] {
  const q = encodeURIComponent(paper.title);
  return [
    paper.linkPaper && paper.linkPaper !== paper.linkArxiv
      ? { label: "Publisher", href: paper.linkPaper }
      : null,
    { label: "Scholar", href: paper.linkScholar ?? `https://scholar.google.com/scholar?q=${q}` },
    { label: paper.linkCode ? "Code" : "Search code", href: paper.linkCode ?? `https://github.com/search?q=${q}&type=repositories` },
  ].filter((link): link is { label: string; href: string } => Boolean(link));
}

export function buildPaperCitationKey(paper: Paper): string {
  const year = paper.publishedDate
    ? new Date(paper.publishedDate).getFullYear()
    : new Date().getFullYear();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const firstAuthor =
    (paper.authors[0] ?? "unknown")
      .split(/\s+/)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z]/g, "") || "unknown";
  const firstWord =
    paper.title
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/[^a-z]/g, "") || "paper";
  return `${firstAuthor}${safeYear}${firstWord}`;
}

export function buildPaperBibTeX(paper: Paper): string {
  const year = paper.publishedDate
    ? new Date(paper.publishedDate).getFullYear()
    : new Date().getFullYear();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const venue = paper.venue || "Unknown venue";
  const url = paper.linkArxiv ?? paper.linkPaper;
  return `@article{${buildPaperCitationKey(paper)},
  title={${paper.title}},
  author={${paper.authors.join(" and ")}},
  journal={${venue}},
  year={${safeYear}}${url ? `,\n  url={${url}}` : ""}
}`;
}

export function buildPaperThinkingSurface(
  paper: Paper,
  profile: UserProfile,
  nowMs = Date.now(),
): PaperThinkingSurfaceModel {
  const haystack = [
    paper.title,
    paper.summaryIntro,
    paper.summaryResultDiscussion,
    paper.relevanceReason,
    paper.summaryExperimentKeywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const matches = profileMatches(profile, haystack);
  const proposalBody = firstSentence(
    paper.summaryIntro,
    `${paper.title} matched your Peer profile.`,
  );
  const resultBody = firstSentence(
    paper.summaryResultDiscussion || paper.relevanceReason,
    "No separate result sentence is available in the current metadata.",
  );
  const fitBody = compact(paper.relevanceReason, 180);
  const methodCount = keywordGroups(paper, profile)[0].items.length;
  const allMatches = unique([...matches.topics, ...matches.soft, ...matches.methods]);
  const q = encodeURIComponent(paper.title);

  return {
    title: paper.title,
    subtitle: paper.authors.slice(0, 4).join(", ") +
      (paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : ""),
    badge: reviewPaperLabel(paper) ?? sourceKind(paper),
    matchLabel: matchLabel(paper.relevanceScore),
    readTimeLabel: `${readTimeMinutes(paper)} min`,
    publishedLabel: formatPublishedDate(paper.publishedDate, nowMs),
    primaryUrl: sourceUrl(paper),
    primaryLabel: sourceLabel(paper),
    secondaryLinks: buildSecondaryLinks(paper),
    scan: [
      {
        label: "What",
        title: sourceKind(paper),
        body: proposalBody,
        tone: "plain",
      },
      {
        label: "Why",
        title: allMatches.length > 0 ? `${allMatches.length} profile hits` : "Reason-based match",
        body: fitBody || "Peer ranked this from the available profile and paper metadata.",
        tone: allMatches.length > 0 ? "accent" : "plain",
      },
      {
        label: "Method",
        title: methodCount > 0 ? `${methodCount} method signals` : "Method thin",
        body: methodCount > 0
          ? "Method-like terms are present in the title, abstract, or keywords."
          : "The current metadata does not expose a concrete method list.",
        tone: methodCount > 0 ? "plain" : "muted",
      },
      decisionCell(paper),
    ],
    proposal: {
      label: "Proposal",
      title: "Claimed scope",
      body: proposalBody,
      tone: "plain",
    },
    result: {
      label: "Result",
      title: paper.summaryResultDiscussion ? "Observed signal" : "Result thin",
      body: resultBody,
      tone: paper.summaryResultDiscussion ? "plain" : "muted",
    },
    methodGroups: keywordGroups(paper, profile),
    fit: [
      {
        label: "Required",
        title: matches.topics.length > 0 ? matches.topics.join(", ") : "No direct topic hit",
        body: matches.topics.length > 0
          ? "Matches explicit research topics in your profile."
          : "No exact topic substring match; ranking likely came from broader text similarity.",
        tone: matches.topics.length > 0 ? "accent" : "muted",
      },
      {
        label: "Methods",
        title: matches.methods.length > 0 ? matches.methods.join(", ") : "No method hit",
        body: matches.methods.length > 0
          ? "Matches methods you declared as useful."
          : "Method overlap is not explicit in current metadata.",
        tone: matches.methods.length > 0 ? "accent" : "muted",
      },
      {
        label: "Fit note",
        title: paper.relevanceScore == null ? "Unscored" : matchLabel(paper.relevanceScore),
        body: fitBody || "No relevance note is available for this item.",
        tone: "plain",
      },
    ],
    flow: [
      {
        label: "01",
        title: "Metadata",
        body: `${sourceKind(paper)} / ${paper.venue || "unknown venue"}`,
        state: paper.venue ? "present" : "thin",
      },
      {
        label: "02",
        title: "Abstract",
        body: paper.summaryIntro ? "Available" : "Missing",
        state: paper.summaryIntro ? "present" : "thin",
      },
      {
        label: "03",
        title: "Result",
        body: paper.summaryResultDiscussion ? "Available" : "Using relevance note",
        state: paper.summaryResultDiscussion ? "present" : "thin",
      },
      {
        label: "04",
        title: "Fit",
        body: allMatches.length > 0 ? allMatches.slice(0, 3).join(", ") : "Reason only",
        state: paper.relevanceReason ? "present" : "thin",
      },
      {
        label: "05",
        title: "Source",
        body: paper.linkArxiv || paper.linkPaper ? "Open path" : "Search path",
        state: paper.linkArxiv || paper.linkPaper ? "present" : "thin",
      },
    ],
    sourceFacts: [
      {
        label: "Journal",
        title: paper.venue || "Unknown",
        body: paper.source,
      },
      {
        label: "Date",
        title: formatPublishedDate(paper.publishedDate, nowMs),
        body: paper.publishedDate
          ? new Date(paper.publishedDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "No publication date in metadata.",
      },
      {
        label: "Authors",
        title: `${paper.authors.length}`,
        body: paper.authors.slice(0, 6).join(", "),
      },
      {
        label: "Code",
        title: paper.linkCode ? "Available" : "Not linked",
        body: paper.linkCode ?? `Search GitHub for "${paper.title.slice(0, 70)}"`,
        tone: paper.linkCode ? "accent" : "muted",
      },
    ],
    tags: unique([
      ...allMatches,
      ...paper.summaryExperimentKeywords,
      paper.doi ? `DOI ${paper.doi}` : "",
      paper.linkArxiv ? "arXiv" : "",
      paper.linkScholar ? "Scholar" : `Scholar search ${q ? "ready" : ""}`,
    ]).slice(0, 12),
  };
}
