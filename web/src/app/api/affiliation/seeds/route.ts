// GET /api/affiliation/seeds?authorId=...&project=...
// Recomputes the advisor discovery seeds (recent, project-relevant works). The
// client calls this at most monthly and caches the result on the profile.

import { NextResponse, type NextRequest } from "next/server";
import { fetchAdvisorSeeds } from "@/lib/affiliation/openalex";

export async function GET(request: NextRequest) {
  const authorId = request.nextUrl.searchParams.get("authorId")?.trim() ?? "";
  const project = request.nextUrl.searchParams.get("project")?.trim() ?? "";

  if (!/^A\d+/.test(authorId)) {
    return NextResponse.json({ workIds: [], texts: [] });
  }

  const seeds = await fetchAdvisorSeeds(authorId, project);
  console.log(
    `[affiliation] seeds authorId=${authorId} -> ${seeds.texts.length} seed papers (${seeds.workIds.join(", ")})`,
  );
  return NextResponse.json(seeds);
}
