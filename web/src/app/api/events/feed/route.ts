import { NextRequest, NextResponse } from "next/server";
import { runEventsPipeline } from "@/lib/events/pipeline";
import type { EventsFeedRequest } from "@/lib/events/types";
import { cleanPreferenceLedger } from "@/lib/preferences/ledger";
import { careerStages, industryPreferences } from "@/types";
import type { CareerStage, IndustryAcademiaPreference } from "@/types";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import type { SearchConnectors } from "@/lib/feed/types";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
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
  const tavilyRaw = (input as Record<string, unknown>).tavily;
  if (!tavilyRaw || typeof tavilyRaw !== "object") return undefined;
  const tavily = tavilyRaw as Record<string, unknown>;
  const enabled = typeof tavily.enabled === "boolean" ? tavily.enabled : undefined;
  const apiKey = cleanOptionalString(tavily.apiKey);
  if (enabled === undefined && apiKey === undefined) return undefined;
  return { tavily: { enabled, apiKey } };
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
    aiTier: parseAiTier(body.aiTier),
    searchConnectors: parseSearchConnectors(body.searchConnectors),
    llmOverride: parseLlmOverride(body.llmOverride),
  });

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
