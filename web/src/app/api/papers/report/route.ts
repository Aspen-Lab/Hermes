import { NextRequest, NextResponse } from "next/server";
import {
  hasUsableProviderOverride,
  resolveProvider,
} from "@/lib/llm/providers/registry";
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
import { requireEntitledAiRequest } from "@/lib/security/ai-request";
import { entitledContext } from "@/lib/security/entitled-context";
import type { Entitlement } from "@/lib/entitlement/types";
import {
  consumeDeepReport,
  type DeepReportDecision,
} from "@/lib/usage/deep-report-quota";

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

/**
 * ABC-freemium 1-03/1-06 — who this route's model calls are being made for.
 * Threaded from the single entitlement check in `POST` so every
 * `resolveProvider` on this route meters against the right user, without any of
 * them re-reading a session.
 */
interface ReportUsageCtx {
  /**
   * ABC-freemium 3-02 — the **entitlement itself**, not a copied user id. It is
   * the only thing an `EntitledContext` can be minted from, so carrying it is
   * what lets every acquisition on this route prove a check ran.
   */
  entitlement: Entitlement;
  path: string;
}

/**
 * ABC-freemium 3-02 · R-SEC-2 — mint the branded context for one acquisition.
 *
 * **`ctx` is required here and at both helpers below.** It used to be
 * `ctx?: ReportUsageCtx` with a `?? "paper-report"` fallback, which pushed the
 * optionality Ruling 7 point 3 closes at `resolveProvider` one level deeper into
 * this file — the argument was compile-checked at the chokepoint and still
 * omittable here. `byok` stays per-call because the override differs between
 * the shallow helper's own parameter and the route body's.
 */
function providerCtx(
  ctx: ReportUsageCtx,
  override: ProviderOverrideConfig | null | undefined,
) {
  return entitledContext(
    ctx.entitlement,
    ctx.path,
    hasUsableProviderOverride(override ?? null),
  );
}

async function generateShallowReport(
  body: PaperReportRequest,
  override: ProviderOverrideConfig | undefined,
  ctx: ReportUsageCtx,
): Promise<PaperReport> {
  const provider = resolveProvider(override ?? null, providerCtx(ctx, override));
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

/**
 * ABC-freemium 3-03 · R-QUOTA-1 · R-QUOTA-3 · Ruling 9 points 1-2.
 *
 * **`quotaDecision` is a required parameter, and that is the fix.** It used to
 * take no quota argument at all because the branch that calls it returned
 * *above* the route's only counter, so a streamed deep report — which is what
 * the app always sends — was never counted and never charged the paid daily
 * breaker. The decision is now made once, above the transport branch, and
 * handed in. **There is deliberately no `consumeDeepReport` call inside this
 * function**: two call sites is how a route double-counts.
 */
function streamReport(
  body: ExtendedRequest,
  ctx: ReportUsageCtx,
  quotaDecision: DeepReportDecision,
): Response {
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
        // ABC-freemium 3-03 — the refusal goes out FIRST, before `mode`, so it
        // survives even the tier-0 stream below (which the reader stops reading
        // at the mode event). What follows is the ordinary degraded stream, the
        // same shape a reader with allowance left would get on a shallow read.
        if (quotaDecision.quota) {
          send({ type: "quota", quota: quotaDecision.quota });
        }

        const provider = resolveProvider(
          body.llmOverride ?? null,
          providerCtx(ctx, body.llmOverride),
        );
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

        // ABC-freemium 3-03 — a refused deep read degrades to the shallow
        // path, which is exactly what the non-streamed branch below does: it
        // nulls the provider on refusal and falls through to
        // `generateShallowReport`. Same behaviour, same depth, now on both
        // transports. **Shallow is R-QUOTA-3's real exemption and stays
        // uncounted** — the decision above is only taken when `deepReport` is
        // set, so this line cannot charge a shallow reader.
        const aiMode =
          body.deepReport && quotaDecision.allowed ? "tier2" : "tier1";
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
          finish(await generateShallowReport(body, body.llmOverride, ctx));
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
          const shallow = await generateShallowReport(body, body.llmOverride, ctx);
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
          const shallow = await generateShallowReport(body, body.llmOverride, ctx);
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
          const shallow = await generateShallowReport(body, body.llmOverride, ctx);
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

  // ABC-freemium 1-06 · R-SEC-2 — **one entitlement check, before every
  // `resolveProvider` on this route.** It used to run only when a provider had
  // already resolved, which made it a check on configuration rather than on the
  // caller. It is unconditional now, so a signed-out caller gets the shared 401
  // rather than a deterministic report built by an unauthenticated request.
  const gate = await requireEntitledAiRequest("paper-report", 20);
  if (gate instanceof NextResponse) return gate;
  const ctx: ReportUsageCtx = {
    entitlement: gate.entitlement,
    path: "paper-report",
  };

  // ABC-freemium 1-20 · 3-03 · R-QUOTA-1, D4, Ruling 9 points 1-2 —
  // **the counter runs above the transport branch, so both transports pass it.**
  //
  // This used to sit inside the deep branch BELOW the streaming early return,
  // and the comment there claimed the streaming path was one of R-QUOTA-3's
  // exempt cases. **That was wrong, and it was the expensive kind of wrong:**
  // the client always streams (`lib/papers/report-stream.ts` sends
  // `Accept: application/x-ndjson` on every request) and the stream honours
  // `deepReport` by running tier 2 and fetching full text. So every real deep
  // papers report skipped the monthly allowance and never charged D4's 200/day
  // paid breaker. Ruling 9 point 1: **streaming is a transport; R-QUOTA-3's
  // exemption is a DEPTH.** A streamed `deepReport: true` request is a deep
  // report and counts exactly as the non-streamed one does.
  //
  // The exemption that survives is the real one: a shallow (abstract-only)
  // request never reaches `consumeDeepReport`, on either transport, because the
  // decision below is gated on `body.deepReport`. Note "shallow" is not "no
  // LLM" — `generateShallowReport` calls the model when one is available, so it
  // is **metered by 1-03 and uncounted by 1-20**, which are different things and
  // easy to conflate.
  //
  // **Exactly one `consumeDeepReport` call site**, here. `streamReport` takes
  // the decision as an argument and never makes its own: two call sites is how
  // a route double-counts.
  const quotaDecision: DeepReportDecision = body.deepReport
    ? await consumeDeepReport(gate.entitlement)
    : { allowed: true };

  const wantsStream =
    req.headers.get("accept")?.includes("application/x-ndjson") === true ||
    body.stream === true;
  if (wantsStream) {
    return streamReport(body, ctx, quotaDecision);
  }

  // ── Deep path ────────────────────────────────────────────────────
  // Runs when the client asks for deep reading and a provider is available:
  // user BYOK in deployments, or the explicit developer provider in local dev.
  // Without a provider, fall through to the deterministic shallow path.
  if (body.deepReport) {
    const provider = quotaDecision.allowed
      ? resolveProvider(
          body.llmOverride ?? null,
          providerCtx(ctx, body.llmOverride),
        )
      : null;
    if (!provider?.generateJsonText) {
      // No budget, no user key, no local provider: the deterministic report —
      // the SAME call this route already made — plus the quota signal.
      const shallow = await generateShallowReport(body, body.llmOverride, ctx);
      return NextResponse.json(
        quotaDecision.quota
          ? { ...shallow, quota: quotaDecision.quota }
          : shallow,
      );
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
        const shallow = await generateShallowReport(body, body.llmOverride, ctx);
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
        const shallow = await generateShallowReport(body, body.llmOverride, ctx);
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
        const shallow = await generateShallowReport(body, body.llmOverride, ctx);
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
      return NextResponse.json(await generateShallowReport(body, body.llmOverride, ctx));
    }
  }

  // ── Shallow path (default) ──────────────────────────────────────
  return NextResponse.json(await generateShallowReport(body, body.llmOverride, ctx));
}
