import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import type { EventEnrichment } from "@/lib/opportunities/enrichment";
import type { Event } from "@/types";

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

function buildEventPrompt(body: EventReportRequest): string {
  return JSON.stringify({
    task: "Add concise, personalized judgment to this event report.",
    userContext: body.contextHint ?? "",
    event: body.event,
    outputSchema: {
      judgedAttendees: [{ name: "exact supplied name", worthIt: true, why: "string" }],
      talkSummaries: [{ title: "exact supplied activity title", about: "string" }],
      dayPlan: [{ day: "string", items: ["string"] }],
      posterFit: { fits: true, reasoning: "string" },
    },
  });
}

function parseJsonObject(text: string): EventEnrichment | null {
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
        return parsed as EventEnrichment;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

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

  try {
    const raw = await provider.generateJsonText({
      systemPrompt: EVENT_REPORT_SYSTEM,
      userPrompt: buildEventPrompt(body),
      tier: "large",
      maxTokens: 1600,
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
