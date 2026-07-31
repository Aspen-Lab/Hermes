import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import {
  buildEventEnrichmentPrompt,
  parseEventEnrichment,
} from "@/lib/opportunities/enrichment";
import type { Event } from "@/types";
import { protectAiRequest } from "@/lib/security/ai-request";

export const dynamic = "force-dynamic";

interface EventReportRequest {
  event: Event;
  contextHint?: string;
  llmOverride?: ProviderOverrideConfig;
}

const EVENT_REPORT_SYSTEM = [
  "You are Peer, a careful event research assistant.",
  "Judge only from the supplied event data and user-declared context.",
  "Never invent an attendee, organisation, speaker, talk, or deadline.",
  "Return only valid JSON.",
].join(" ");

export async function POST(req: NextRequest) {
  let body: EventReportRequest;
  try {
    body = (await req.json()) as EventReportRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event?.id || !body.event.name) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  const provider = resolveProvider(body.llmOverride ?? null);
  if (!provider?.generateJsonText) {
    return NextResponse.json(
      { enrichment: null, noLlm: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const denied = await protectAiRequest("event-report", 20);
  if (denied) return denied;

  try {
    const raw = await provider.generateJsonText({
      systemPrompt: EVENT_REPORT_SYSTEM,
      userPrompt: buildEventEnrichmentPrompt(body.event, body.contextHint ?? ""),
      tier: "large",
      maxTokens: 1600,
    });
    return NextResponse.json(
      { enrichment: parseEventEnrichment(raw, body.event), noLlm: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { enrichment: null, noLlm: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
