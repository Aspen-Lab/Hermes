import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import {
  reconstructAbstract,
  normalizeOpenAlexId,
} from "@/lib/utils/openalex";

const OPENALEX_API = "https://api.openalex.org/works";

interface OpenAlexAuthorship {
  author_position?: string;
  author: { display_name: string };
}

interface OpenAlexConcept {
  display_name: string;
  level: number;
}

interface OpenAlexWork {
  id: string;
  title: string | null;
  publication_date: string | null;
  authorships: OpenAlexAuthorship[];
  primary_location: {
    source?: { display_name: string } | null;
  } | null;
  abstract_inverted_index: Record<string, number[]> | null;
  cited_by_count: number;
  doi: string | null;
  concepts?: OpenAlexConcept[];
}

const MAILTO = process.env.OPENALEX_EMAIL ?? "hermes@example.com";

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const { topics = [], venues, limit = 30 } = query;
  if (topics.length === 0) return [];

  const searchTerm = topics.map((t) => `"${t}"`).join(" OR ");
  const params = new URLSearchParams({
    search: searchTerm,
    per_page: String(Math.min(limit, 50)),
    select:
      "id,title,publication_date,authorships,primary_location,abstract_inverted_index,cited_by_count,doi,concepts",
    sort: "relevance_score:desc",
    mailto: MAILTO,
  });

  if (venues && venues.length > 0) {
    params.append(
      "filter",
      `primary_location.source.display_name.search:${venues.join("|")}`,
    );
  }

  try {
    const res = await fetch(`${OPENALEX_API}?${params}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error("[openalex] non-ok response:", res.status);
      return [];
    }
    const data = await res.json();
    const works: OpenAlexWork[] = data.results || [];

    return works.map((w) => {
      const abstract = reconstructAbstract(w.abstract_inverted_index);
      const doi = w.doi ?? undefined;
      const tags = (w.concepts ?? [])
        .filter((c) => c.level >= 1 && c.level <= 3)
        .map((c) => c.display_name);
      return {
        id: normalizeOpenAlexId(w.id),
        source: "openalex",
        title: w.title || "",
        authors: w.authorships
          .map((a) => a.author?.display_name)
          .filter((n): n is string => Boolean(n)),
        abstract: abstract || undefined,
        url: doi
          ? `https://doi.org/${doi.replace("https://doi.org/", "")}`
          : w.id,
        publishedAt: w.publication_date || "",
        venue: w.primary_location?.source?.display_name,
        tags: tags.length > 0 ? tags : undefined,
        metadata: {
          citationCount: w.cited_by_count,
          doi,
        },
      };
    });
  } catch (err) {
    console.error("[openalex] fetch error:", err);
    return [];
  }
}

export const openalex: SourceAdapter = {
  id: "openalex",
  fetch: fetchImpl,
};
