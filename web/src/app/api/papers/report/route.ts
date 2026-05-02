import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import {
  buildFallbackPaperReport,
  improvePaperReportFit,
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
  return JSON.stringify({
    task: "Create a structured Hermes paper report from the available paper metadata. Do not invent numbers. If the abstract does not contain a result, say what is known from the abstract. Never say that user context is missing; if userContext is sparse, infer a useful fit from the paper title, venue, abstract, and keywords.",
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
        summary: "2-3 plain-English sentences describing the paper's proposal or method.",
        methods: ["short method/material/dataset phrases"],
      },
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
