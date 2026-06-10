// Two-pass deep report generator.
//
// Pass 1 (small model — Haiku / gpt-mini / gemini-flash / qwen-turbo):
//   COMPRESS — read the long paper body, return tightly-relevant sentences
//   (novelty claims, key results, method highlights, comparisons to prior
//   work). This trims a 30k-token paper into ~1.5k tokens of signal.
//
// Pass 2 (large model — Sonnet / gpt / gemini-pro / qwen-max):
//   EXTRACT — using the compressed signal + abstract + metadata, produce
//   the structured PaperReport with grounded evidence and explicit novelty
//   per result.
//
// For short papers (< ~10k chars body), Pass 1 is skipped and the raw text
// is sent directly to Pass 2 to save the extra round-trip.

import type { Paper } from "@/types";
import type { DigestProvider } from "@/lib/llm/providers/types";
import {
  buildFallbackPaperReport,
  improvePaperReportFit,
  isPaperReviewLike,
  sanitizePaperReport,
  type PaperReport,
  type PaperReportDepth,
} from "./report";
import type { ExtractedDocument } from "./html-text";

const PASS1_TRIGGER_CHARS = 10_000;
const PASS1_MAX_INPUT_CHARS = 60_000;
const PASS2_MAX_INPUT_CHARS = 24_000;

interface CompressedSignal {
  noveltyClaims: string[];
  keyResults: string[];
  methodHighlights: string[];
  priorWorkComparisons: string[];
}

interface BuildDeepReportArgs {
  paper: Paper;
  contextHint?: string;
  doc: ExtractedDocument;
  provider: DigestProvider;
}

function totalBodyChars(doc: ExtractedDocument): number {
  return doc.sections.reduce((sum, section) => sum + section.text.length, 0);
}

function sectionsByCanonical(doc: ExtractedDocument): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of doc.sections) {
    out[section.canonical] = (out[section.canonical] ?? "") + " " + section.text;
  }
  return out;
}

function safeJson(text: string): Record<string, unknown> | null {
  const candidates = [
    text.trim(),
    text.replace(/^```json\s*/i, "").replace(/```\s*$/g, "").trim(),
  ];
  const blockMatch = text.match(/\{[\s\S]*\}/);
  if (blockMatch) candidates.push(blockMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

function clampStringArray(value: unknown, max = 8, maxLen = 360): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length >= 12)
    .slice(0, max)
    .map((v) => (v.length > maxLen ? v.slice(0, maxLen) : v));
}

function parseCompressedSignal(text: string): CompressedSignal {
  const json = safeJson(text);
  if (!json) {
    return {
      noveltyClaims: [],
      keyResults: [],
      methodHighlights: [],
      priorWorkComparisons: [],
    };
  }
  return {
    noveltyClaims: clampStringArray(json.noveltyClaims, 6),
    keyResults: clampStringArray(json.keyResults, 6),
    methodHighlights: clampStringArray(json.methodHighlights, 6),
    priorWorkComparisons: clampStringArray(json.priorWorkComparisons, 6),
  };
}

function buildPass1Prompt(paper: Paper, doc: ExtractedDocument): string {
  const buckets = sectionsByCanonical(doc);
  const intro = buckets.introduction ?? buckets.abstract ?? "";
  const methods = buckets.methods ?? "";
  const results = buckets.results ?? "";
  const discussion = buckets.discussion ?? "";

  const clip = (text: string, n: number) =>
    text.length > n ? text.slice(0, n) : text;

  return JSON.stringify({
    task:
      "Extract sentences from this paper's body that carry SIGNAL — what is novel, what was found, what was used, and what differs from prior work. Use only sentences that appear in the supplied text; do not paraphrase. Quote each sentence exactly as written.",
    paper: {
      title: paper.title,
      venue: paper.venue,
    },
    sections: {
      introduction: clip(intro, 12_000),
      methods: clip(methods, 14_000),
      results: clip(results, 14_000),
      discussion: clip(discussion, 14_000),
    },
    outputSchema: {
      noveltyClaims: ["sentences from the paper that state what is new about this work — typically appear in intro and discussion (max 6)"],
      keyResults: ["sentences stating concrete results, numbers, or measurements — typically in results/discussion (max 6)"],
      methodHighlights: ["sentences naming the specific experiments, instruments, datasets, controls, ablations, measurements, simulations, or evaluation protocols used (max 6)"],
      priorWorkComparisons: ["sentences that explicitly contrast this work with prior approaches (max 6)"],
    },
    rules: [
      "Return ONLY valid JSON.",
      "Each item must be a verbatim sentence from the supplied text.",
      "Skip generic background sentences; only include sentences that show contribution, finding, method, or comparison.",
    ],
  });
}

const PASS1_SYSTEM = [
  "You are Peer, a careful research assistant.",
  "Your job: read a paper's body sections and extract verbatim signal sentences.",
  "Do not paraphrase. Do not invent. Return only valid JSON.",
].join(" ");

async function runPass1(
  paper: Paper,
  doc: ExtractedDocument,
  provider: DigestProvider,
): Promise<CompressedSignal> {
  if (!provider.generateJsonText) {
    return {
      noveltyClaims: [],
      keyResults: [],
      methodHighlights: [],
      priorWorkComparisons: [],
    };
  }
  const prompt = buildPass1Prompt(paper, doc);
  const clipped = prompt.length > PASS1_MAX_INPUT_CHARS
    ? prompt.slice(0, PASS1_MAX_INPUT_CHARS)
    : prompt;
  const raw = await provider.generateJsonText({
    systemPrompt: PASS1_SYSTEM,
    userPrompt: clipped,
    maxTokens: 1800,
    tier: "small",
  });
  return parseCompressedSignal(raw);
}

function buildPass2Prompt(args: {
  paper: Paper;
  contextHint?: string;
  doc: ExtractedDocument;
  signal: CompressedSignal | null;
  isReview: boolean;
}): string {
  const { paper, contextHint, doc, signal, isReview } = args;
  const buckets = sectionsByCanonical(doc);

  // Decide what body context to feed: compressed signal when available, else
  // trimmed raw sections.
  const bodyPayload: Record<string, unknown> = signal
    ? {
        noveltyClaims: signal.noveltyClaims,
        keyResults: signal.keyResults,
        methodHighlights: signal.methodHighlights,
        priorWorkComparisons: signal.priorWorkComparisons,
      }
    : {
        introduction: (buckets.introduction ?? buckets.abstract ?? "").slice(0, 6000),
        methods: (buckets.methods ?? "").slice(0, 6000),
        results: (buckets.results ?? "").slice(0, 6000),
        discussion: (buckets.discussion ?? "").slice(0, 6000),
      };

  const figureCaptions = doc.figureCaptions.slice(0, 8).map((cap) => ({
    label: cap.label,
    caption: cap.caption.slice(0, 300),
  }));

  const secondSection = isReview
    ? {
        reviewContents: {
          sections: [
            {
              heading: "exact section title from the paper body",
              summary: "1-2 sentences summarising the key point of that section",
            },
          ],
          _note: "List 4-8 major body sections of this review/survey, using actual section names from the body when present.",
        },
      }
    : {
        resultsAndSignificance: {
          summary: "2-3 sentences explaining the headline result and why it matters.",
          keyResults: [
            {
              title: "short label",
              detail: "one concrete result sentence grounded in the supplied body text",
              evidence: "verbatim sentence (or close paraphrase) from the supplied body text that supports `detail`",
              novelty: "one sentence explaining what specifically is new about THIS result vs prior work",
              figureIndex: "integer 1-5 — leave 1 if uncertain; figure binding runs separately later",
            },
          ],
        },
      };

  return JSON.stringify({
    task: isReview
      ? "Create a structured Peer deep paper report for a REVIEW or SURVEY. List the body sections in reviewContents.sections, using actual section names from the paper. Do not invent."
      : "Create a structured Peer DEEP paper report. Use the supplied paper body (or compressed signal). Every key result must include a verbatim `evidence` sentence and a `novelty` line explaining what is new about THIS result compared to prior approaches. Do not fabricate numbers; if a number is not in the supplied body, omit it.",
    userContext: contextHint || "",
    paper: {
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      venue: paper.venue,
      abstract: paper.summaryIntro,
    },
    body: bodyPayload,
    figureCaptions,
    outputSchema: {
      whatItProposes: {
        summary: "2-3 sentences describing the proposal/scope in plain English. Do not include the method list here.",
        methods: [
          "3-6 concrete method sentences naming the actual experiment, instrument, dataset, control, ablation, measurement, simulation, or evaluation protocol used. Do not use generic topic tags.",
        ],
        novelty: [
          "exactly one concise sentence explaining what is new about this paper vs prior work; do not repeat this in methods",
        ],
      },
      ...secondSection,
      whyItFitsYou: {
        reasons: [
          "One specific reason per item (max 2 sentences). Tie to user context where possible. Never vague.",
        ],
        keywords: ["paper keywords that overlap with user interests"],
      },
    },
  });
}

const PASS2_SYSTEM = [
  "You are Peer, a careful research assistant.",
  "Write a structured deep paper report grounded in the supplied body text.",
  "Every claim must be traceable to a supplied sentence — quote in `evidence` when present.",
  "Be specific: name the actual technique, finding, or comparison rather than generic phrases.",
  "Keep proposal, method, and novelty separate: proposal says what the paper tries to do; methods say what experiments or evaluations were actually used; novelty is exactly one concise sentence.",
  "Do not fabricate numbers, citations, or experimental details.",
  "Do not mention missing user context.",
  "Return only valid JSON.",
].join(" ");

async function runPass2(args: {
  paper: Paper;
  contextHint?: string;
  doc: ExtractedDocument;
  signal: CompressedSignal | null;
  provider: DigestProvider;
}): Promise<PaperReport | null> {
  if (!args.provider.generateJsonText) return null;

  const isReview = isPaperReviewLike(args.paper);
  const prompt = buildPass2Prompt({
    paper: args.paper,
    contextHint: args.contextHint,
    doc: args.doc,
    signal: args.signal,
    isReview,
  });
  const clipped = prompt.length > PASS2_MAX_INPUT_CHARS
    ? prompt.slice(0, PASS2_MAX_INPUT_CHARS)
    : prompt;
  const raw = await args.provider.generateJsonText({
    systemPrompt: PASS2_SYSTEM,
    userPrompt: clipped,
    maxTokens: 2400,
    tier: "large",
  });
  const parsed = safeJson(raw);
  if (!parsed) return null;
  return sanitizePaperReport(parsed as Partial<PaperReport>);
}

/**
 * Produce a deep, body-grounded paper report. Returns null on any LLM failure
 * so the caller can fall back to the abstract-only path.
 */
export async function generateDeepReport(
  args: BuildDeepReportArgs,
): Promise<PaperReport | null> {
  const { paper, contextHint, doc, provider } = args;
  if (!provider.generateJsonText) return null;
  if (doc.sections.length === 0) return null;

  try {
    const bodyChars = totalBodyChars(doc);
    const signal =
      bodyChars > PASS1_TRIGGER_CHARS
        ? await runPass1(paper, doc, provider)
        : null;

    const report = await runPass2({
      paper,
      contextHint,
      doc,
      signal,
      provider,
    });
    if (!report) return null;

    const improved = improvePaperReportFit(report, paper, contextHint);
    return {
      ...improved,
      depth: "deep" as PaperReportDepth,
      sourceKind: doc.source,
    };
  } catch (err) {
    console.error("[papers/deep-report] generation failed:", err);
    return null;
  }
}

/** Heuristic budget guard so callers can refuse to deep-read silly-long inputs. */
export function isWithinDeepReportBudget(doc: ExtractedDocument): boolean {
  return totalBodyChars(doc) > 800;
}

/** Build a fallback report tagged with paywall notice for UI banner display. */
export function buildPaywalledFallback(
  paper: Paper,
  contextHint: string | undefined,
  notice: string,
): PaperReport {
  const base = buildFallbackPaperReport(paper, contextHint);
  return {
    ...base,
    depth: "abstract" as PaperReportDepth,
    paywallNotice: notice,
  };
}
