import { NextRequest, NextResponse } from "next/server";
import { runFeedPipeline } from "@/lib/feed/pipeline";
import type { FeedRequest } from "@/lib/feed/types";
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
  const valid: SourceId[] = ["openalex", "arxiv", "hn"];
  const out = input.filter((s): s is SourceId =>
    valid.includes(s as SourceId),
  );
  return out.length > 0 ? out : undefined;
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

  const methods = cleanStringArray(body.methods);
  const venues = cleanStringArray(body.venues);
  const seedTexts = cleanStringArray(body.seedTexts);

  const result = await runFeedPipeline({
    topics,
    methods: methods.length > 0 ? methods : undefined,
    venues: venues.length > 0 ? venues : undefined,
    seedTexts: seedTexts.length > 0 ? seedTexts : undefined,
    sources: parseSources(body.sources),
    perSourceLimit: body.perSourceLimit,
    topN: body.topN,
    weights: body.weights,
    sourceWeights: body.sourceWeights,
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
