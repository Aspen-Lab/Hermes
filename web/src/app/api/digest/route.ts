import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm/providers/registry";
import type { PaperLite } from "@/lib/llm/providers/types";

interface DigestRequest {
  papers: PaperLite[];
  contextHint?: string;
}

interface DigestResponse {
  bullets: { paperId: string; text: string }[];
  perPaper: Record<string, {
    headlineFinding?: string;
    keyNumbers?: { value: string; label: string }[];
  }>;
  noLlm?: boolean;
}

function emptyResponse(noLlm = false): DigestResponse {
  return { bullets: [], perPaper: {}, noLlm };
}

export async function POST(req: NextRequest) {
  let body: DigestRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.papers) || body.papers.length === 0) {
    return NextResponse.json(emptyResponse());
  }

  const provider = resolveProvider();
  if (!provider) {
    // No provider configured — graceful Tier 0 fallback.
    return NextResponse.json(emptyResponse(true));
  }

  try {
    const result = await provider.generateDigest({
      papers: body.papers,
      contextHint: body.contextHint,
    });
    console.log(`[digest] ${provider.id} OK — bullets: ${result.bullets.length}, papers extracted: ${Object.keys(result.perPaper).length}`);
    return NextResponse.json({
      bullets: result.bullets,
      perPaper: result.perPaper,
    } satisfies DigestResponse);
  } catch (err) {
    console.error(`[digest] ${provider.id} error:`, err);
    // Degrade gracefully to Tier 0 on any LLM error.
    return NextResponse.json(emptyResponse());
  }
}
