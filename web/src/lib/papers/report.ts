import type { Paper } from "@/types";
import { cleanDisplayText } from "@/lib/text/clean";

export interface PaperReportKeyResult {
  title: string;
  detail: string;
  figureIndex: number;
  /**
   * Deep-report only: paper-grounded evidence sentence pulled from the body
   * (results/discussion). Used so the reader can see the receipts behind the
   * `detail` claim.
   */
  evidence?: string;
  /** Deep-report only: what makes this result novel vs prior work. */
  novelty?: string;
  /**
   * Deep-report only: figure label this result should reference (e.g.
   * "Figure 3"), chosen by post-report figure binding. Null/absent when no
   * good figure match was found — UI shows no figure in that case.
   */
  figureLabel?: string | null;
  /**
   * Deep-report only: directly bound image URL chosen by figure-binding from
   * the candidate pool. When set, the UI renders this image directly without
   * a second `/api/figure` round-trip. May be a `data:image/...;base64,...`
   * URL (PDF-extracted) or a normal HTTP URL.
   */
  figureImageUrl?: string | null;
  /** Deep-report only: caption that goes with `figureImageUrl`. */
  figureCaption?: string | null;
  /** Deep-report only: source label for the bound figure. */
  figureSource?: string | null;
}

export interface PaperReportReviewSection {
  heading: string;
  summary: string;
}

/** Report-generation depth used for the current response. */
export type PaperReportDepth = "deep" | "abstract" | "fallback";

export interface PaperReport {
  whatItProposes: {
    summary: string;
    /**
     * Concrete experimental / computational methods used by the paper.
     * These should be more specific than topic tags.
     */
    methods: string[];
    /** Deep-report only: one concise sentence naming the paper's novelty. */
    novelty?: string[];
    /**
     * Deep-report only: figure label promoted to the proposal/novelty area.
     * Used when a figure is reused by multiple result cards, or when the
     * proposal itself has a strong figure match.
     */
    figureLabel?: string | null;
    /** Deep-report only: directly bound image URL for the proposal section. */
    figureImageUrl?: string | null;
    figureCaption?: string | null;
    figureSource?: string | null;
  };
  resultsAndSignificance: {
    summary: string;
    keyResults: PaperReportKeyResult[];
  };
  /** Populated instead of resultsAndSignificance for review/survey papers. */
  reviewContents?: {
    sections: PaperReportReviewSection[];
  };
  whyItFitsYou: {
    /** Each item is one concise reason (≤2 sentences) why this paper was recommended. */
    reasons: string[];
    keywords: string[];
  };
  noLlm?: boolean;
  /** Which depth was used to produce this report. */
  depth?: PaperReportDepth;
  /** Set when deep was requested but failed (paywall / no PDF / no HTML). */
  paywallNotice?: string;
  /** Set on deep success: which source served the full text. */
  sourceKind?: string;
}

const REVIEW_PATTERNS = [
  /\breview\b/i,
  /\bsurvey\b/i,
  /\boverview\b/i,
  /\btutorial\b/i,
  /\bperspective\b/i,
  /\broadmap\b/i,
  /\bmeta-analysis\b/i,
  /\bminireview\b/i,
  /\bliterature review\b/i,
  /\bsystematic review\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
];

export function isPaperReviewLike(paper: Paper): boolean {
  const haystack = [paper.title, paper.summaryIntro, ...paper.summaryExperimentKeywords]
    .filter(Boolean)
    .join(" ");
  return REVIEW_PATTERNS.some((p) => p.test(haystack));
}

/** Returns the display label for a review/survey paper, or null for regular papers. */
export function reviewPaperLabel(paper: Paper): "Review" | "Survey" | null {
  if (!isPaperReviewLike(paper)) return null;
  const haystack = [paper.title, paper.summaryIntro].filter(Boolean).join(" ");
  return /\bsurvey\b/i.test(haystack) ? "Survey" : "Review";
}

export interface PaperReportRequest {
  paper: Paper;
  contextHint?: string;
}

function splitSentences(text: string, limit = 5): string[] {
  return cleanDisplayText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20)
    .slice(0, limit);
}

function fallbackSummary(paper: Paper): string {
  const sentences = splitSentences(
    [paper.summaryIntro, paper.summaryResultDiscussion].join(" "),
    3,
  );
  if (sentences.length > 0) return sentences.join(" ");
  return `${paper.title} is an academic paper from ${paper.venue || "the literature"} that matched your Peer profile. Open the paper link for the full source text.`;
}

function fallbackMethods(paper: Paper): string[] {
  const keywords = paper.summaryExperimentKeywords.filter(Boolean).slice(0, 4);
  if (keywords.length > 0) return keywords;
  return ["Method details are not explicit in the available abstract."];
}

function toOneSentence(text: string, maxLen = 220): string {
  const cleaned = cleanDisplayText(text);
  if (!cleaned) return "";
  const sentence = cleaned.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? cleaned;
  if (sentence.length <= maxLen) return sentence;
  return `${sentence.slice(0, maxLen - 1).trim().replace(/[,:;.-]+$/, "")}.`;
}

function normalizeNovelty(
  rawNovelty: unknown,
  keyResults: PaperReportKeyResult[],
): string[] | undefined {
  const direct =
    Array.isArray(rawNovelty)
      ? rawNovelty
      : typeof rawNovelty === "string"
        ? [rawNovelty]
        : [];
  const fallbackFromResults = keyResults
    .map((result) => result.novelty)
    .filter((value): value is string => Boolean(value));
  const novelty = [...direct, ...fallbackFromResults]
    .map(cleanDisplayText)
    .filter(Boolean)
    .map((line) => toOneSentence(line))
    .filter(Boolean)
    .slice(0, 1);
  return novelty.length > 0 ? novelty : undefined;
}

function fallbackKeywords(paper: Paper): string[] {
  return Array.from(
    new Set([
      ...paper.summaryExperimentKeywords,
      ...paper.title.split(/\s+/).filter((word) => word.length > 5).slice(0, 4),
    ]),
  ).slice(0, 8);
}

function isWeakReason(text?: string): boolean {
  const value = cleanDisplayText(text).toLowerCase();
  return (
    !value ||
    /no specific (user )?context/.test(value) ||
    /context was not provided/.test(value) ||
    /pulled from your search/.test(value) ||
    /search query/.test(value) ||
    /could not determine/.test(value)
  );
}

function isWeakReasons(reasons: string[]): boolean {
  return reasons.length === 0 || reasons.every(isWeakReason);
}

function summarizeContext(contextHint?: string): string {
  return cleanDisplayText(contextHint)
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .replace(/[,:;]\s*$/, "");
}

function buildFitReasons(paper: Paper, contextHint?: string): string[] {
  const keywords = fallbackKeywords(paper).slice(0, 3);
  const keywordText = keywords.length > 0 ? keywords.join(", ") : paper.title;
  const context = summarizeContext(contextHint);
  const reasons: string[] = [];
  if (context) {
    reasons.push(`Connects to your stated focus on ${context}.`);
  }
  reasons.push(
    `Centers on ${keywordText}${paper.venue ? `, published in ${paper.venue}` : ""}.`,
  );
  if (!context && paper.relevanceReason && !isWeakReason(paper.relevanceReason)) {
    reasons.push(paper.relevanceReason.slice(0, 180).replace(/[,:;]\s*$/, "") + (paper.relevanceReason.length > 180 ? "…" : ""));
  }
  return reasons;
}

function fallbackKeyResults(paper: Paper): PaperReportKeyResult[] {
  const sentences = splitSentences(
    paper.summaryResultDiscussion || paper.summaryIntro || paper.relevanceReason,
    3,
  );
  if (sentences.length === 0) {
    return [
      {
        title: "Main result",
        detail: "Peer could not extract a specific result sentence from the available metadata. Use the linked paper for the full results section.",
        figureIndex: 1,
      },
    ];
  }
  return sentences.slice(0, 3).map((sentence, index) => ({
    title: index === 0 ? "Main result" : `Key result ${index + 1}`,
    detail: sentence,
    figureIndex: index + 1,
  }));
}

function fallbackReviewSections(paper: Paper): PaperReportReviewSection[] {
  const sentences = splitSentences(
    paper.summaryIntro || paper.summaryResultDiscussion || paper.relevanceReason,
    5,
  );
  if (sentences.length === 0) {
    return [
      {
        heading: "Overview",
        summary: "Peer could not extract section-level details from the available metadata. Open the paper link for the full contents.",
      },
    ];
  }
  return sentences.slice(0, 5).map((sentence, index) => ({
    heading: index === 0 ? "Overview" : `Section ${index + 1}`,
    summary: sentence,
  }));
}

export function buildFallbackPaperReport(
  paper: Paper,
  contextHint?: string,
): PaperReport {
  const summary = fallbackSummary(paper);
  const keywords = fallbackKeywords(paper);
  const fitReasons = isWeakReason(paper.relevanceReason)
    ? buildFitReasons(paper, contextHint)
    : [paper.relevanceReason];
  const isReview = isPaperReviewLike(paper);

  return {
    whatItProposes: {
      summary,
      methods: fallbackMethods(paper),
    },
    resultsAndSignificance: isReview
      ? { summary: "", keyResults: [] }
      : { summary: paper.relevanceReason || summary, keyResults: fallbackKeyResults(paper) },
    reviewContents: isReview
      ? { sections: fallbackReviewSections(paper) }
      : undefined,
    whyItFitsYou: {
      reasons: fitReasons,
      keywords,
    },
    noLlm: true,
  };
}

export function improvePaperReportFit(
  report: PaperReport,
  paper: Paper,
  contextHint?: string,
): PaperReport {
  if (!isWeakReasons(report.whyItFitsYou.reasons)) return report;
  return {
    ...report,
    whyItFitsYou: {
      ...report.whyItFitsYou,
      reasons: buildFitReasons(paper, contextHint),
      keywords:
        report.whyItFitsYou.keywords.length > 0
          ? report.whyItFitsYou.keywords
          : fallbackKeywords(paper),
    },
  };
}

export function sanitizePaperReport(report: Partial<PaperReport>): PaperReport {
  const fallback = buildFallbackPaperReport({
    id: "fallback",
    title: "Untitled paper",
    authors: [],
    relevanceReason: "",
    venue: "",
    source: "other",
    summaryIntro: "",
    summaryExperimentKeywords: [],
    summaryResultDiscussion: "",
    isSaved: false,
  });

  const methods = Array.isArray(report.whatItProposes?.methods)
    ? report.whatItProposes.methods.map(cleanDisplayText).filter(Boolean).slice(0, 6)
    : fallback.whatItProposes.methods;

  const keyResults = Array.isArray(report.resultsAndSignificance?.keyResults)
    ? report.resultsAndSignificance.keyResults
        .map((result, index) => ({
          title: cleanDisplayText(result.title) || `Key result ${index + 1}`,
          detail: cleanDisplayText(result.detail),
          figureIndex: Number.isFinite(result.figureIndex)
            ? Math.max(1, Math.min(5, Math.round(result.figureIndex)))
            : index + 1,
          evidence: result.evidence ? cleanDisplayText(result.evidence) : undefined,
          novelty: result.novelty ? cleanDisplayText(result.novelty) : undefined,
          figureLabel:
            typeof result.figureLabel === "string"
              ? cleanDisplayText(result.figureLabel) || null
              : result.figureLabel === null
                ? null
                : undefined,
          // figureImageUrl is allowed to be a data: URL (potentially long),
          // so don't run it through cleanDisplayText (which collapses
          // whitespace and could mangle base64).
          figureImageUrl:
            typeof result.figureImageUrl === "string" && result.figureImageUrl.trim()
              ? result.figureImageUrl
              : result.figureImageUrl === null
                ? null
                : undefined,
          figureCaption: result.figureCaption
            ? cleanDisplayText(result.figureCaption)
            : undefined,
          figureSource: result.figureSource
            ? cleanDisplayText(result.figureSource)
            : undefined,
        }))
        .filter((result) => result.detail)
        .slice(0, 4)
    : fallback.resultsAndSignificance.keyResults;

  const reasons = Array.isArray(report.whyItFitsYou?.reasons)
    ? report.whyItFitsYou.reasons.map(cleanDisplayText).filter(Boolean).slice(0, 6)
    : fallback.whyItFitsYou.reasons;

  const keywords = Array.isArray(report.whyItFitsYou?.keywords)
    ? report.whyItFitsYou.keywords.map(cleanDisplayText).filter(Boolean).slice(0, 10)
    : [];

  const reviewSections = Array.isArray(report.reviewContents?.sections)
    ? report.reviewContents.sections
        .map((s) => ({
          heading: cleanDisplayText(s.heading),
          summary: cleanDisplayText(s.summary),
        }))
        .filter((s) => s.heading && s.summary)
        .slice(0, 10)
    : undefined;

  const novelty = normalizeNovelty(
    (report.whatItProposes as { novelty?: unknown } | undefined)?.novelty,
    keyResults,
  );

  const proposalFigureLabel =
    typeof report.whatItProposes?.figureLabel === "string"
      ? cleanDisplayText(report.whatItProposes.figureLabel) || null
      : report.whatItProposes?.figureLabel === null
        ? null
        : undefined;
  const proposalFigureImageUrl =
    typeof report.whatItProposes?.figureImageUrl === "string" &&
    report.whatItProposes.figureImageUrl.trim()
      ? report.whatItProposes.figureImageUrl
      : report.whatItProposes?.figureImageUrl === null
        ? null
        : undefined;

  return {
    whatItProposes: {
      summary: cleanDisplayText(report.whatItProposes?.summary) || fallback.whatItProposes.summary,
      methods,
      novelty,
      figureLabel: proposalFigureLabel,
      figureImageUrl: proposalFigureImageUrl,
      figureCaption: report.whatItProposes?.figureCaption
        ? cleanDisplayText(report.whatItProposes.figureCaption)
        : undefined,
      figureSource: report.whatItProposes?.figureSource
        ? cleanDisplayText(report.whatItProposes.figureSource)
        : undefined,
    },
    resultsAndSignificance: {
      summary: cleanDisplayText(report.resultsAndSignificance?.summary) || fallback.resultsAndSignificance.summary,
      keyResults,
    },
    reviewContents: reviewSections ? { sections: reviewSections } : undefined,
    whyItFitsYou: {
      reasons,
      keywords,
    },
    noLlm: report.noLlm,
    depth: report.depth,
    paywallNotice: report.paywallNotice
      ? cleanDisplayText(report.paywallNotice)
      : undefined,
    sourceKind: report.sourceKind
      ? cleanDisplayText(report.sourceKind)
      : undefined,
  };
}
