import { NextRequest, NextResponse } from "next/server";
import { runEventsPipeline } from "@/lib/events/pipeline";
import type { EventsFeedRequest } from "@/lib/events/types";
import { cleanPreferenceLedger } from "@/lib/preferences/ledger";
import { careerStages, industryPreferences } from "@/types";
import type { CareerStage, IndustryAcademiaPreference } from "@/types";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import type { SearchConnectors } from "@/lib/feed/types";
import { parseOpportunityFacetSelection } from "@/lib/opportunities/facets";
import {
  entitledAiTier,
  requireEntitledAiRequest,
} from "@/lib/security/ai-request";

const CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function cleanStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0);
}

function cleanOptionalString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0
    ? input.trim()
    : undefined;
}

function parseCareerStage(input: unknown): CareerStage | undefined {
  return typeof input === "string" && careerStages.includes(input as CareerStage)
    ? (input as CareerStage)
    : undefined;
}

function parseIndustryPreference(
  input: unknown,
): IndustryAcademiaPreference | undefined {
  return typeof input === "string" &&
    industryPreferences.includes(input as IndustryAcademiaPreference)
    ? (input as IndustryAcademiaPreference)
    : undefined;
}

function parseAiTier(input: unknown): 0 | 1 | 2 | undefined {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return undefined;
  if (n >= 2) return 2;
  if (n <= 0) return 0;
  return 1;
}

function parseSearchConnectors(input: unknown): SearchConnectors | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const tavilyRaw = raw.tavily;
  let tavily: SearchConnectors["tavily"];
  if (tavilyRaw && typeof tavilyRaw === "object") {
    const value = tavilyRaw as Record<string, unknown>;
    const enabled = typeof value.enabled === "boolean" ? value.enabled : undefined;
    const apiKey = cleanOptionalString(value.apiKey);
    if (enabled !== undefined || apiKey !== undefined) tavily = { enabled, apiKey };
  }
  // RULING 75 — the gemini connector carries no key (the credential is the
  // server's own Vertex project) and only ever expresses an OPT-OUT.
  const geminiRaw = raw.gemini;
  let gemini: SearchConnectors["gemini"];
  if (geminiRaw && typeof geminiRaw === "object") {
    const enabled = (geminiRaw as Record<string, unknown>).enabled;
    if (typeof enabled === "boolean") gemini = { enabled };
  }
  if (!tavily && !gemini) return undefined;
  return { ...(tavily ? { tavily } : {}), ...(gemini ? { gemini } : {}) };
}

function parseLlmOverride(input: unknown): ProviderOverrideConfig | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  const provider = cleanOptionalString(value.provider);
  const apiKey = cleanOptionalString(value.apiKey);
  const model = cleanOptionalString(value.model);
  if (!provider || !apiKey) return undefined;
  if (!["openai", "gemini", "anthropic", "qwen", "deepseek"].includes(provider)) {
    return undefined;
  }
  return {
    provider: provider as ProviderOverrideConfig["provider"],
    apiKey,
    model,
  };
}

function parseExcludeIds(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out = input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return out.length > 0 ? out.slice(0, 800) : undefined;
}

function parseTopN(input: unknown): number | undefined {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(1, Math.min(20, Math.floor(n)));
}

export async function POST(req: NextRequest) {
  let body: Partial<EventsFeedRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topics = cleanStringArray(body.topics);
  if (topics.length === 0) {
    return NextResponse.json(
      { error: "topics array is required and must contain at least one string" },
      { status: 400 },
    );
  }

  const softTopics = cleanStringArray(body.softTopics);
  const methods = cleanStringArray(body.methods);
  const seedTexts = cleanStringArray(body.seedTexts);
  const locationPreferences = cleanStringArray(body.locationPreferences);
  const preferenceLedger = cleanPreferenceLedger(body.preferenceLedger);
  const requestedAiTier = parseAiTier(body.aiTier) ?? 0;
  const llmOverride = parseLlmOverride(body.llmOverride);
  // ABC-freemium 1-06 · R-SEC-2, R-SEC-3 — **the entitlement is resolved BEFORE
  // the provider, and it is what caps the tier.** The old line here downgraded
  // because *no provider resolved*, which stops being a defence the moment
  // R-KEY-1 makes one always resolve; this downgrades because the caller is
  // *not entitled*, which no request body can change.
  //
  // `allowAnonymous` keeps R-ENT-4's "signed-out users get tier-0 behaviour
  // everywhere ... unchanged": a stranger still gets a feed built from free
  // structured sources, and `entitledAiTier` caps them at 0 so they reach
  // neither a provider nor the system search key.
  const gate = await requireEntitledAiRequest("event-feed", 60, {
    allowAnonymous: true,
  });
  if (gate instanceof NextResponse) return gate;
  const { entitlement } = gate;
  const aiTier = entitledAiTier(requestedAiTier, entitlement);
  //
  // **The route no longer resolves a provider itself.** It only ever did so to
  // decide the downgrade, and R-SEC-3 replaces that predicate with the
  // entitlement above; the value was never passed on, because the pipeline
  // resolves its own provider where it needs one. Deleting the call removes a
  // redundant provider construction per feed request and leaves exactly one
  // reason a tier can drop. The pipeline's own degrade paths are unchanged —
  // `query-gen.ts` returns template queries and `tier2-rerank.ts` returns the
  // input order when no provider resolves.

  const result = await runEventsPipeline({
    topics,
    softTopics: softTopics.length > 0 ? softTopics : undefined,
    methods: methods.length > 0 ? methods : undefined,
    seedTexts: seedTexts.length > 0 ? seedTexts : undefined,
    preferenceLedger:
      Object.keys(preferenceLedger).length > 0 ? preferenceLedger : undefined,
    careerStage: parseCareerStage(body.careerStage),
    industryVsAcademia: parseIndustryPreference(body.industryVsAcademia),
    locationPreferences:
      locationPreferences.length > 0 ? locationPreferences : undefined,
    currentProject: cleanOptionalString(body.currentProject),
    topN: parseTopN(body.topN),
    excludeIds: parseExcludeIds(body.excludeIds),
    facets: parseOpportunityFacetSelection(body.facets),
    aiTier,
    searchConnectors: parseSearchConnectors(body.searchConnectors),
    llmOverride,
     // ABC-freemium 1-05 — the operator's Tavily key, gated on the
    // entitlement the guard above resolved. Never parsed from the body.
    systemSearchAllowed: entitlement.systemSearchAllowed,
    userId: entitlement.userId,
  });

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
