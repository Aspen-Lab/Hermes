import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import {
  buildFallbackPaperReport,
  improvePaperReportFit,
  isPaperReviewLike,
  sanitizePaperReport,
  type PaperReport,
  type PaperReportRequest,
} from "@/lib/papers/report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function buildPrompt({ paper, contextHint }: PaperReportRequest): string {
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
      ? "Create a structured Hermes paper report for a REVIEW or SURVEY paper. Do not invent numbers. Map the body sections of the review into reviewContents.sections with their headings and 1-2 sentence summaries. Never say that user context is missing."
      : "Create a structured Hermes paper report from the available paper metadata. Do not invent numbers. If the abstract does not contain a result, say what is known from the abstract. Never say that user context is missing; if userContext is sparse, infer a useful fit from the paper title, venue, abstract, and keywords.",
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
        summary: "2-3 plain-English sentences describing the paper's proposal or scope.",
        methods: ["short method/topic/scope phrases"],
      },
      ...secondSection,
      whyItFitsYou: {
        summary: "2 sentences explaining why this paper fits the user's current profile/context.",
        keywords: ["keywords from paper that overlap with user interests"],
      },
    },
  });
}

export async function POST(req: NextRequest) {
  let body: PaperReportRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.paper?.id || !body.paper.title) {
    return NextResponse.json({ error: "paper is required" }, { status: 400 });
  }

  const fallback = buildFallbackPaperReport(body.paper, body.contextHint);
  const provider = resolveProvider();
  if (!provider?.generateJsonText) {
    return NextResponse.json(fallback);
  }

  try {
    const raw = await provider.generateJsonText({
      systemPrompt: [
        "You are Hermes, a careful research assistant.",
        "Write concise paper reports for researchers.",
      "Use only the supplied title, abstract, result text, keywords, and user context.",
      "Do not fabricate experimental values, claims, or figures.",
      "Do not mention missing user context, missing profile data, or that the paper was pulled from search.",
      "Return only valid JSON.",
      ].join(" "),
      userPrompt: buildPrompt(body),
      maxTokens: 1800,
    });
    const parsed = parseJsonObject(raw);
    if (!parsed) return NextResponse.json(fallback);
    return NextResponse.json(
      improvePaperReportFit(
        sanitizePaperReport(parsed),
        body.paper,
        body.contextHint,
      ),
    );
  } catch (err) {
    console.error("[papers/report] generation failed:", err);
    return NextResponse.json(fallback);
  }
}
