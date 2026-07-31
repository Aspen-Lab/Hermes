import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import type { JobEnrichment } from "@/lib/opportunities/enrichment";
import type { Job } from "@/types";

export const dynamic = "force-dynamic";

interface JobReportRequest {
  job: Job;
  contextHint?: string;
  llmOverride?: ProviderOverrideConfig;
}

const JOB_REPORT_SYSTEM = [
  "You are Peer, a careful career research assistant.",
  "Judge only from the supplied job data and user-declared context.",
  "Keep facts from the posting separate from inferred judgments.",
  "Return only valid JSON.",
].join(" ");

function buildJobPrompt(body: JobReportRequest): string {
  return JSON.stringify({
    task: "Add concise, personalized judgment to this job report.",
    userContext: body.contextHint ?? "",
    job: body.job,
    outputSchema: {
      competitiveness: { verdict: "string", reasoning: "string" },
      sponsorshipRead: { likelihood: "string", basis: "string" },
      roleSummary: ["sentence 1", "sentence 2", "sentence 3"],
      emphasise: ["application point", "application point"],
    },
  });
}

function parseJsonObject(text: string): JobEnrichment | null {
  const candidates = [
    text.trim(),
    text.replace(/^```json\s*/i, "").replace(/```\s*$/g, "").trim(),
  ];
  const match = text.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JobEnrichment;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: JobReportRequest;
  try {
    body = (await req.json()) as JobReportRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.job?.id || !body.job.roleTitle) {
    return NextResponse.json({ error: "job is required" }, { status: 400 });
  }

  const provider = resolveProvider(body.llmOverride ?? null);
  if (!provider?.generateJsonText) {
    return NextResponse.json(
      { enrichment: null, noLlm: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const raw = await provider.generateJsonText({
      systemPrompt: JOB_REPORT_SYSTEM,
      userPrompt: buildJobPrompt(body),
      tier: "large",
      maxTokens: 1200,
    });
    return NextResponse.json(
      { enrichment: parseJsonObject(raw), noLlm: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { enrichment: null, noLlm: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
