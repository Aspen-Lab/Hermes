import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import {
  buildJobEnrichmentPrompt,
  parseJobEnrichment,
} from "@/lib/opportunities/enrichment";
import type { Job } from "@/types";
import { protectAiRequest } from "@/lib/security/ai-request";

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

  const denied = await protectAiRequest("job-report", 20);
  if (denied) return denied;

  try {
    const raw = await provider.generateJsonText({
      systemPrompt: JOB_REPORT_SYSTEM,
      userPrompt: buildJobEnrichmentPrompt(body.job, body.contextHint ?? ""),
      tier: "large",
      maxTokens: 1200,
    });
    return NextResponse.json(
      { enrichment: parseJobEnrichment(raw, body.job), noLlm: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { enrichment: null, noLlm: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
