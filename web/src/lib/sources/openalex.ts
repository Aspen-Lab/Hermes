import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import {
  openAlexWorkToRawItem,
  type OpenAlexWork,
} from "@/lib/utils/openalex";

const OPENALEX_API = "https://api.openalex.org/works";

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
    return works.map(openAlexWorkToRawItem);
  } catch (err) {
    console.error("[openalex] fetch error:", err);
    return [];
  }
}

export const openalex: SourceAdapter = {
  id: "openalex",
  fetch: fetchImpl,
};
