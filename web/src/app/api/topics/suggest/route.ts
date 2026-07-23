// GET /api/topics/suggest?q=...
// Disambiguates a typed topic against OpenAlex's concept graph so the user can
// turn an ambiguous acronym ("LCO") into a precise canonical term
// ("Lithium cobalt oxide") with a one-line description. Free, no key.

import { NextResponse, type NextRequest } from "next/server";
import { sourceFetch } from "@/lib/sources/_fetch";

const MAILTO = process.env.OPENALEX_EMAIL ?? "peer@example.com";

interface OpenAlexConcept {
  display_name: string;
  hint?: string | null;
  works_count?: number;
}

export interface TopicSuggestion {
  name: string;
  hint?: string;
  worksCount: number;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const params = new URLSearchParams({ q, mailto: MAILTO });
    const res = await sourceFetch(
      `https://api.openalex.org/autocomplete/concepts?${params}`,
      { timeoutMs: 5000, revalidate: 86_400 },
    );
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    const data = (await res.json()) as { results?: OpenAlexConcept[] };
    const suggestions: TopicSuggestion[] = (data.results ?? [])
      // Skip obscure concepts so we only nudge toward well-established terms.
      .filter((c) => (c.works_count ?? 0) > 50 && c.display_name)
      .slice(0, 3)
      .map((c) => ({
        name: c.display_name,
        hint: (c.hint ?? "").trim() || undefined,
        worksCount: c.works_count ?? 0,
      }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
