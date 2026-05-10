import type { Paper } from "@/types";
import { cleanDisplayText } from "@/lib/text/clean";

export interface PaperReportKeyResult {
  title: string;
  detail: string;
  figureIndex: number;
}

export interface PaperReportReviewSection {
  heading: string;
  summary: string;
}

export interface PaperReport {
  whatItProposes: {
    summary: string;
    methods: string[];
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
    summary: string;
    keywords: string[];
  };
  noLlm?: boolean;
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
  return `${paper.title} is an academic paper from ${paper.venue || "the literature"} that matched your Hermes profile. Open the paper link for the full source text.`;
}

function fallbackMethods(paper: Paper): string[] {
  const keywords = paper.summaryExperimentKeywords.filter(Boolean).slice(0, 4);
  if (keywords.length > 0) return keywords;
  return ["Method details are not explicit in the available abstract."];
}

function fallbackKeywords(paper: Paper): string[] {
  return Array.from(
    new Set([
      ...paper.summaryExperimentKeywords,
      ...paper.title.split(/\s+/).filter((word) => word.length > 5).slice(0, 4),
    ]),
  ).slice(0, 8);
}

function isWeakFitText(text?: string): boolean {
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

function summarizeContext(contextHint?: string): string {
  return cleanDisplayText(contextHint)
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .replace(/[,:;]\s*$/, "");
}

function buildFitSummary(paper: Paper, contextHint?: string): string {
  const keywords = fallbackKeywords(paper).slice(0, 3);
  const keywordText = keywords.length > 0 ? keywords.join(", ") : paper.title;
  const context = summarizeContext(contextHint);
  if (context) {
    return `This paper fits your profile because it connects to your stated focus on ${context}. Its closest matching signals are ${keywordText}, making it useful for deciding whether the method, result, or background should influence your current research direction.`;
  }
  return `This paper fits the current research brief because it centers on ${keywordText}${paper.venue ? ` and appears in ${paper.venue}` : ""}. It is worth reviewing for the method, evidence, and research direction it adds to this topic.`;
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
        detail: "Hermes could not extract a specific result sentence from the available metadata. Use the linked paper for the full results section.",
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
        summary: "Hermes could not extract section-level details from the available metadata. Open the paper link for the full contents.",
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
  const fitSummary = isWeakFitText(paper.relevanceReason)
    ? buildFitSummary(paper, contextHint)
    : paper.relevanceReason;
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
      summary: fitSummary,
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
  if (!isWeakFitText(report.whyItFitsYou.summary)) return report;
  return {
    ...report,
    whyItFitsYou: {
      ...report.whyItFitsYou,
      summary: buildFitSummary(paper, contextHint),
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
        }))
        .filter((result) => result.detail)
        .slice(0, 4)
    : fallback.resultsAndSignificance.keyResults;

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

  return {
    whatItProposes: {
      summary: cleanDisplayText(report.whatItProposes?.summary) || fallback.whatItProposes.summary,
      methods,
    },
    resultsAndSignificance: {
      summary: cleanDisplayText(report.resultsAndSignificance?.summary) || fallback.resultsAndSignificance.summary,
      keyResults,
    },
    reviewContents: reviewSections ? { sections: reviewSections } : undefined,
    whyItFitsYou: {
      summary: cleanDisplayText(report.whyItFitsYou?.summary) || fallback.whyItFitsYou.summary,
      keywords,
    },
    noLlm: report.noLlm,
  };
}
