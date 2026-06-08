// GET /api/affiliation/resolve?name=...&institution=...
// Resolves an advisor name (+ optional institution) to a single best OpenAlex
// author for the user to confirm. Returns { author } or { author: null }.

import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthor } from "@/lib/affiliation/openalex";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const institution = request.nextUrl.searchParams.get("institution")?.trim() ?? "";

  if (name.length < 2) {
    return NextResponse.json({ author: null });
  }

  const author = await resolveAuthor(name, institution || undefined);
  console.log(
    `[affiliation] resolve "${name}" @ "${institution}" -> ${author ? `${author.authorId} (${author.label})` : "no match"}`,
  );
  return NextResponse.json({ author });
}
