import { NextRequest, NextResponse } from "next/server";

const OPENALEX_API = "https://api.openalex.org/works";

interface OpenAlexAuthor {
  author_position: string;
  author: { display_name: string };
}

interface OpenAlexWork {
  id: string;
  title: string;
  publication_date: string | null;
  authorships: OpenAlexAuthor[];
  primary_location: {
    source?: { display_name: string } | null;
  } | null;
  abstract_inverted_index: Record<string, number[]> | null;
  cited_by_count: number;
  doi: string | null;
}

function reconstructAbstract(index: Record<string, number[]> | null): string {
  if (!index) return "";
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map(([, w]) => w).join(" ");
}

function normalizeId(openalexId: string): string {
  // "https://openalex.org/W3151130473" → "openalex:W3151130473"
  return "openalex:" + openalexId.split("/").pop();
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const perPage = Math.min(
    parseInt(req.nextUrl.searchParams.get("per_page") || "20", 10),
    50
  );

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const params = new URLSearchParams({
    search: q,
    page: String(page),
    per_page: String(perPage),
    select:
      "id,title,publication_date,authorships,primary_location,abstract_inverted_index,cited_by_count,doi",
    sort: "relevance_score:desc",
    "mailto": "hermes@example.com",
  });

  const res = await fetch(`${OPENALEX_API}?${params}`, {
    next: { revalidate: 300 }, // cache 5 min
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "OpenAlex API error", status: res.status },
      { status: 502 }
    );
  }

  const data = await res.json();
  const works: OpenAlexWork[] = data.results || [];

  const papers = works.map((w) => ({
    id: normalizeId(w.id),
    title: w.title || "",
    authors: w.authorships
      .map((a) => a.author.display_name)
      .filter(Boolean),
    abstract: reconstructAbstract(w.abstract_inverted_index),
    venue: w.primary_location?.source?.display_name || "",
    publishedDate: w.publication_date || null,
    citationCount: w.cited_by_count || 0,
    doi: w.doi || null,
    url: w.doi
      ? `https://doi.org/${w.doi.replace("https://doi.org/", "")}`
      : w.id,
    source: "openalex" as const,
  }));

  return NextResponse.json({
    results: papers,
    total: data.meta?.count || 0,
    page,
    perPage,
  });
}
