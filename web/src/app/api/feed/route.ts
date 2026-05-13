import { NextRequest, NextResponse } from "next/server";
import { runFeedPipeline } from "@/lib/feed/pipeline";
import type { FeedRequest, SearchConnectors } from "@/lib/feed/types";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import type { SourceId } from "@/lib/sources/types";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
};

function cleanStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0);
}

function parseSources(input: unknown): SourceId[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const valid: SourceId[] = [
    "openalex",
    "semantic_scholar",
    "arxiv",
    "dblp",
    "pubmed",
    "web",
    "hn",
  ];
  const out = input.filter((s): s is SourceId =>
    valid.includes(s as SourceId),
  );
  return out.length > 0 ? out : undefined;
}

function parseAiTier(input: unknown): 0 | 1 | 2 | undefined {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return undefined;
  if (n >= 2) return 2;
  if (n <= 0) return 0;
  return 1;
}

function cleanOptionalString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0
    ? input.trim()
    : undefined;
}

function parseSearchConnectors(input: unknown): SearchConnectors | undefined {
  if (!input || typeof input !== "object") return undefined;
  const maybeObject = input as Record<string, unknown>;
  const tavilyRaw =
    maybeObject.tavily && typeof maybeObject.tavily === "object"
      ? (maybeObject.tavily as Record<string, unknown>)
      : null;
  if (!tavilyRaw) return undefined;

  const enabled =
    typeof tavilyRaw.enabled === "boolean" ? tavilyRaw.enabled : undefined;
  const apiKey = cleanOptionalString(tavilyRaw.apiKey);
  if (enabled === undefined && apiKey === undefined) return undefined;

  return {
    tavily: {
      enabled,
      apiKey,
    },
  };
}

function parseLlmOverride(input: unknown): ProviderOverrideConfig | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  const provider = cleanOptionalString(value.provider);
  const apiKey = cleanOptionalString(value.apiKey);
  const model = cleanOptionalString(value.model);

  if (!provider || !apiKey) return undefined;
  if (!["openai", "gemini", "anthropic", "qwen"].includes(provider)) return undefined;

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
  // Cap to a reasonable size so a runaway client can't ship a huge payload.
  // 800 covers ~14 days of daily 10-paper digests with a wide margin.
  return out.length > 0 ? out.slice(0, 800) : undefined;
}

export async function POST(req: NextRequest) {
  let body: Partial<FeedRequest>;
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
  const venues = cleanStringArray(body.venues);
  const seedTexts = cleanStringArray(body.seedTexts);
  const negativeTopics = cleanStringArray(body.negativeTopics);

  const result = await runFeedPipeline({
    topics,
    softTopics: softTopics.length > 0 ? softTopics : undefined,
    methods: methods.length > 0 ? methods : undefined,
    venues: venues.length > 0 ? venues : undefined,
    seedTexts: seedTexts.length > 0 ? seedTexts : undefined,
    negativeTopics: negativeTopics.length > 0 ? negativeTopics : undefined,
    sources: parseSources(body.sources),
    perSourceLimit: body.perSourceLimit,
    topN: body.topN,
    weights: body.weights,
    sourceWeights: body.sourceWeights,
    controls: body.controls,
    aiTier: parseAiTier(body.aiTier),
    searchConnectors: parseSearchConnectors(body.searchConnectors),
    llmOverride: parseLlmOverride(body.llmOverride),
    excludeIds: parseExcludeIds(body.excludeIds),
  });

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}

export async function GET(req: NextRequest) {
  const topics = (req.nextUrl.searchParams.get("topics") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (topics.length === 0) {
    return NextResponse.json(
      { error: "topics query param required (comma-separated)" },
      { status: 400 },
    );
  }

  const methods = (req.nextUrl.searchParams.get("methods") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const sources = parseSources(
    (req.nextUrl.searchParams.get("sources") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const topN = parseInt(req.nextUrl.searchParams.get("topN") || "30", 10);

  const result = await runFeedPipeline({
    topics,
    methods: methods.length > 0 ? methods : undefined,
    sources,
    topN: Number.isFinite(topN) ? topN : 30,
  });

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
