import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import {
  buildFallbackPaperReport,
  improvePaperReportFit,
  isPaperReviewLike,
  sanitizePaperReport,
  type PaperReport,
  type PaperReportRequest,
} from "@/lib/papers/report";
import { generateDeepReport, buildPaywalledFallback } from "@/lib/papers/deep-report";
import { bindFiguresToReport } from "@/lib/papers/figure-binding";
import { getFullText } from "@/lib/papers/full-text";
import { getFigurePool } from "@/lib/figures/extract";
import type { ReportStreamEvent } from "@/lib/papers/report-stream";

export const dynamic = "force-dynamic";
// Deep reports (full-text fetch + two model passes + figure binding) have been
// observed to run ~85-100s; the old 90s ceiling silently killed the slowest
// ones and downgraded them to an abstract-only report. Give real headroom.
export const maxDuration = 180;

// ── Request shape ────────────────────────────────────────────────────

interface ExtendedRequest extends PaperReportRequest {
  /** When true, attempt full-text deep reading. Requires `llmOverride` with key. */
  deepReport?: boolean;
  llmOverride?: ProviderOverrideConfig;
  /** Opt into the NDJSON response when setting an Accept header is impractical. */
  stream?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseJsonObject(text: string): Partial<PaperReport> | null {
  const candidates = [
    text.trim(),
    text.replace(/^```json\s*/i, "").replace(/```\s*$/g, "").trim(),
  ];
  const match = text.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Partial<PaperReport>;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function buildShallowPrompt({ paper, contextHint }: PaperReportRequest): string {
  const isReview = isPaperReviewLike(paper);
  const secondSection = isReview
    ? {
        reviewContents: {
          sections: [
            {
              heading: "exact section title from the paper body",
              summary: "1-2 sentences summarising the key point of that section",
            },
          ],
          _note: "List each major body section of this review/survey paper. Use the actual section headings where known; otherwise infer plausible section titles from the abstract. Aim for 4-8 sections. Do NOT include abstract or conclusion as separate sections.",
        },
      }
    : {
        resultsAndSignificance: {
          summary: "2-3 sentences explaining the key result and why it matters, especially for the user's interests.",
          keyResults: [
            {
              title: "short result label",
              detail: "one concrete result sentence grounded in the abstract",
              figureIndex: "integer from 1 to 5. Use 1 for the first result figure, 2 for the next.",
            },
          ],
        },
      };

  return JSON.stringify({
    task: isReview
      ? "Create a structured Peer paper report for a REVIEW or SURVEY paper. Do not invent numbers. Map the body sections of the review into reviewContents.sections with their headings and 1-2 sentence summaries. Never say that user context is missing."
      : "Create a structured Peer paper report from the available paper metadata. Do not invent numbers. If the abstract does not contain a result, say what is known from the abstract. Never say that user context is missing; if userContext is sparse, infer a useful fit from the paper title, venue, abstract, and keywords.",
    userContext: contextHint || "",
    paper: {
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      venue: paper.venue,
      abstract: paper.summaryIntro,
      resultDiscussion: paper.summaryResultDiscussion,
      relevanceReason: paper.relevanceReason,
      keywords: paper.summaryExperimentKeywords,
    },
    outputSchema: {
      whatItProposes: {
        summary: "2-3 plain-English sentences describing the paper's proposal or scope. Do not include the method list here.",
        methods: [
          "Concrete method or experiment sentences from the abstract/result text. Name actual experiments, datasets, instruments, measurements, simulations, or evaluations when present. If the abstract does not specify the method, say that directly.",
        ],
        novelty: [
          "exactly one concise sentence explaining what is new about this paper vs prior work, based only on the supplied metadata",
        ],
      },
      ...secondSection,
      whyItFitsYou: {
        reasons: [
          "One specific reason per item, max 2 sentences. Mention the concrete method, topic, finding, or venue that ties to the user's context. Aim for 2-4 items. Never be vague ('this is relevant') — always name the specific link.",
        ],
        keywords: ["keywords from paper that overlap with user interests"],
      },
    },
  });
}

const SHALLOW_SYSTEM = [
  "You are Peer, a careful research assistant.",
  "Write concise paper reports for researchers.",
  "Use only the supplied title, abstract, result text, keywords, and user context.",
  "Keep proposal, method, and novelty separate: proposal says what the paper tries to do; methods say what experiments or evaluations were actually used; novelty is exactly one concise sentence.",
  "Do not fabricate experimental values, claims, or figures.",
  "Do not mention missing user context, missing profile data, or that the paper was pulled from search.",
  "Return only valid JSON.",
].join(" ");

async function generateShallowReport(
  body: PaperReportRequest,
  override?: ProviderOverrideConfig,
): Promise<PaperReport> {
  const provider = resolveProvider(override ?? null);
  const fallback = buildFallbackPaperReport(body.paper, body.contextHint);
  if (!provider?.generateJsonText) {
    return { ...fallback, depth: "fallback" };
  }
  try {
    const raw = await provider.generateJsonText({
      systemPrompt: SHALLOW_SYSTEM,
      userPrompt: buildShallowPrompt(body),
      maxTokens: 1800,
    });
    const parsed = parseJsonObject(raw);
    if (!parsed) return { ...fallback, depth: "abstract" };
    return improvePaperReportFit(
      { ...sanitizePaperReport(parsed), depth: "abstract" },
      body.paper,
      body.contextHint,
    );
  } catch (err) {
    console.error("[papers/report] shallow generation failed:", err);
    return { ...fallback, depth: "fallback" };
  }
}

// ── Identifier extraction ────────────────────────────────────────────

function arxivIdFromPaper(paper: PaperReportRequest["paper"]): string | null {
  if (paper.id?.startsWith("arxiv:")) return paper.id.slice("arxiv:".length);
  return null;
}

function openAlexIdFromPaper(paper: PaperReportRequest["paper"]): string | null {
  if (paper.id?.startsWith("openalex:")) return paper.id.slice("openalex:".length);
  return null;
}

function bestPaperUrl(paper: PaperReportRequest["paper"]): string | null {
  return paper.linkPaper ?? paper.linkArxiv ?? null;
}

function streamReport(body: ExtendedRequest): Response {
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: ReportStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The reader may have disconnected while report generation ran.
        }
      };
      const finish = (report: PaperReport) => {
        send({ type: "report", report });
        send({ type: "stage", stage: "done", label: "Report ready", pct: 100 });
        close();
      };

      try {
        const provider = resolveProvider(body.llmOverride ?? null);
        if (!provider?.generateJsonText) {
          send({ type: "mode", aiMode: "tier0" });
          send({
            type: "stage",
            stage: "done",
            label: "Basic report ready",
            pct: 100,
          });
          close();
          return;
        }

        const aiMode = body.deepReport ? "tier2" : "tier1";
        send({ type: "mode", aiMode });

        if (aiMode === "tier1") {
          // The shallow path has exactly one real step (the model call), so
          // emit one honest low-anchor stage. Firing a second stage at 75%
          // immediately would slam the bar most of the way across before any
          // work happened, then strand it there. The client eases it forward
          // from here while the call is in flight.
          send({
            type: "stage",
            stage: "writing",
            label: "Writing the report",
            pct: 20,
          });
          finish(await generateShallowReport(body, body.llmOverride));
          return;
        }

        send({
          type: "stage",
          stage: "source",
          label: "Finding the paper",
          pct: 10,
        });
        const fullText = await getFullText({
          paperId: body.paper.id,
          url: bestPaperUrl(body.paper),
          doi: body.paper.doi ?? null,
          arxivId: arxivIdFromPaper(body.paper),
          openAlexId: openAlexIdFromPaper(body.paper),
        });

        if (fullText.status === "paywalled" && fullText.reason) {
          send({
            type: "stage",
            stage: "writing",
            label: "Writing the report",
            pct: 75,
          });
          const shallow = await generateShallowReport(body, body.llmOverride);
          const tagged: PaperReport = {
            ...shallow,
            paywallNotice: fullText.reason,
            depth: shallow.depth ?? "abstract",
          };
          finish(
            shallow.noLlm
              ? buildPaywalledFallback(
                  body.paper,
                  body.contextHint,
                  fullText.reason,
                )
              : tagged,
          );
          return;
        }

        if (fullText.status !== "ok" || !fullText.doc) {
          send({
            type: "stage",
            stage: "writing",
            label: "Writing the report",
            pct: 75,
          });
          const shallow = await generateShallowReport(body, body.llmOverride);
          finish({
            ...shallow,
            paywallNotice:
              fullText.reason ??
              "Peer could not find a legal full-text source for this paper. Showing an abstract-only report instead.",
          });
          return;
        }

        send({
          type: "stage",
          stage: "reading",
          label: "Reading it",
          pct: 35,
        });
        const figurePoolPromise = getFigurePool({
          itemId: body.paper.id,
          url: bestPaperUrl(body.paper) ?? undefined,
          doi: body.paper.doi ?? undefined,
          paperTitle: body.paper.title,
        }).catch((err) => {
          console.warn("[papers/report] figure pool fetch failed:", err);
          return null;
        });

        send({
          type: "stage",
          stage: "writing",
          label: "Writing the report",
          pct: 75,
        });
        const deep = await generateDeepReport({
          paper: body.paper,
          contextHint: body.contextHint,
          doc: fullText.doc,
          provider,
        });

        if (!deep) {
          const shallow = await generateShallowReport(body, body.llmOverride);
          finish({
            ...shallow,
            paywallNotice:
              "Peer downloaded the paper but the deep-read step failed. Showing an abstract-only report instead.",
          });
          return;
        }

        send({
          type: "stage",
          stage: "figures",
          label: "Adding figures",
          pct: 92,
        });
        const figurePool = await figurePoolPromise;
        const bound = await bindFiguresToReport({
          paper: { title: body.paper.title },
          report: deep,
          captions: fullText.doc.figureCaptions,
          provider,
          figurePool,
        });

        finish(bound);
      } catch (err) {
        console.error("[papers/report] streaming flow failed:", err);
        try {
          send({
            type: "error",
            message: "Peer could not finish the report stream.",
          });
        } catch {
          // The reader may have disconnected; there is nothing left to send.
        }
        close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}

// ── POST handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ExtendedRequest;
  try {
    body = (await req.json()) as ExtendedRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.paper?.id || !body.paper.title) {
    return NextResponse.json({ error: "paper is required" }, { status: 400 });
  }

  const wantsStream =
    req.headers.get("accept")?.includes("application/x-ndjson") === true ||
    body.stream === true;
  if (wantsStream) {
    return streamReport(body);
  }

  // ── Deep path ────────────────────────────────────────────────────
  // Runs when the client asks for deep reading AND a provider is available
  // — either via a user-supplied override (Tier 2 BYOK) OR via the site's
  // own configured default (Vertex Gemini / Anthropic / OpenAI / Qwen).
  // Without ANY provider, fall through to the shallow path.
  if (body.deepReport) {
    const provider = resolveProvider(body.llmOverride ?? null);
    if (!provider?.generateJsonText) {
      // No provider available — site has no default and user didn't supply
      // a key. Fall back to deterministic shallow report.
      return NextResponse.json(await generateShallowReport(body, body.llmOverride));
    }

    try {
      const fullText = await getFullText({
        paperId: body.paper.id,
        url: bestPaperUrl(body.paper),
        doi: body.paper.doi ?? null,
        arxivId: arxivIdFromPaper(body.paper),
        openAlexId: openAlexIdFromPaper(body.paper),
      });

      if (fullText.status === "paywalled" && fullText.reason) {
        // Try the LLM-backed shallow path first; on LLM failure
        // buildPaywalledFallback gives a deterministic abstract-only report.
        const shallow = await generateShallowReport(body, body.llmOverride);
        const tagged: PaperReport = {
          ...shallow,
          paywallNotice: fullText.reason,
          depth: shallow.depth ?? "abstract",
        };
        return NextResponse.json(
          shallow.noLlm
            ? buildPaywalledFallback(body.paper, body.contextHint, fullText.reason)
            : tagged,
        );
      }

      if (fullText.status !== "ok" || !fullText.doc) {
        const shallow = await generateShallowReport(body, body.llmOverride);
        return NextResponse.json({
          ...shallow,
          paywallNotice:
            fullText.reason ??
            "Peer could not find a legal full-text source for this paper. Showing an abstract-only report instead.",
        });
      }

      // The deep report and the figure pool are independent — both derive from
      // the already-fetched full-text doc / paper metadata — so fetch the
      // figure pool concurrently with report generation instead of after it.
      // (captions come from the same fetched doc; the pool supplies the actual
      // high-quality image URLs — PDF-rendered when available, HTML otherwise.)
      const [deep, figurePool] = await Promise.all([
        generateDeepReport({
          paper: body.paper,
          contextHint: body.contextHint,
          doc: fullText.doc,
          provider,
        }),
        getFigurePool({
          itemId: body.paper.id,
          url: bestPaperUrl(body.paper) ?? undefined,
          doi: body.paper.doi ?? undefined,
          paperTitle: body.paper.title,
        }).catch((err) => {
          console.warn("[papers/report] figure pool fetch failed:", err);
          return null;
        }),
      ]);

      if (!deep) {
        const shallow = await generateShallowReport(body, body.llmOverride);
        return NextResponse.json({
          ...shallow,
          paywallNotice:
            "Peer downloaded the paper but the deep-read step failed. Showing an abstract-only report instead.",
        });
      }

      const bound = await bindFiguresToReport({
        paper: { title: body.paper.title },
        report: deep,
        captions: fullText.doc.figureCaptions,
        provider,
        figurePool,
      });

      return NextResponse.json(bound);
    } catch (err) {
      console.error("[papers/report] deep flow failed:", err);
      return NextResponse.json(await generateShallowReport(body, body.llmOverride));
    }
  }

  // ── Shallow path (default) ──────────────────────────────────────
  return NextResponse.json(await generateShallowReport(body, body.llmOverride));
}
