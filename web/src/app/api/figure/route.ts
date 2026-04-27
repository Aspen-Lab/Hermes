// GET /api/figure?id=<itemId>&url=<originUrl>
//
// Lazy figure resolver — hit per-card after feed loads. CDN-cached for
// 24h so the same paper id only triggers an upstream fetch at most once
// per user-day across all readers.

import { NextResponse, type NextRequest } from "next/server";
import { extractFigure } from "@/lib/figures/extract";

export const dynamic = "force-dynamic";
export const revalidate = 86_400;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const url = req.nextUrl.searchParams.get("url") ?? undefined;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const result = await extractFigure({ itemId: id, url });

  return NextResponse.json(result, {
    headers: {
      // Edge-cache for 24h, allow stale for a week while a refresh runs.
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
