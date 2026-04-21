import { NextResponse } from "next/server";
import { fetchPaperById } from "@/lib/papers/fetch-by-id";
import { rawItemToPaper } from "@/lib/feed/mapper";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const raw = await fetchPaperById(decodedId);
  if (!raw) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }
  const paper = rawItemToPaper(raw, {
    relevanceReason:
      "Pulled from your search. Summary below is the paper's own abstract.",
  });
  return NextResponse.json(paper, { headers: CACHE_HEADERS });
}
