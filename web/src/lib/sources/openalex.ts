import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import {
  openAlexWorkToRawItem,
  type OpenAlexWork,
} from "@/lib/utils/openalex";

const OPENALEX_API = "https://api.openalex.org/works";

const MAILTO = process.env.OPENALEX_EMAIL ?? "hermes@example.com";

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const { topics = [], queries = [], venues, limit = 30 } = query;
  const searchQueries = buildSearchQueries(topics, queries);
  if (searchQueries.length === 0) return [];

  const perQuery = Math.max(5, Math.ceil(Math.min(limit, 50) / searchQueries.length));
  const all: RawItem[] = [];

  for (const searchTerm of searchQueries) {
    const params = new URLSearchParams({
      search: quoteImportantTerms(searchTerm),
      per_page: String(perQuery),
      select:
        "id,title,publication_date,authorships,primary_location,best_oa_location,open_access,abstract_inverted_index,cited_by_count,doi,concepts,type_crossref",
      sort: "relevance_score:desc",
      mailto: MAILTO,
    });

    const filters: string[] = [];
    if (venues && venues.length > 0) {
      filters.push(`primary_location.source.display_name.search:${venues.join("|")}`);
    }
    const fromDate = publicationStartDate(query.timeWindow);
    if (fromDate) filters.push(`from_publication_date:${fromDate}`);
    if (filters.length > 0) params.append("filter", filters.join(","));

    try {
      const res = await fetch(`${OPENALEX_API}?${params}`, {
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        console.error("[openalex] non-ok response:", res.status);
        continue;
      }
      const data = await res.json();
      const works: OpenAlexWork[] = data.results || [];
      all.push(...works.map(openAlexWorkToRawItem));
    } catch (err) {
      console.error("[openalex] fetch error:", err);
    }
  }

  return uniqueById(all).slice(0, limit);
}

function buildSearchQueries(topics: string[], queries: string[]): string[] {
  const source = queries.length > 0 ? queries : topics;
  return Array.from(new Set(source.map((q) => q.trim()).filter(Boolean))).slice(0, 6);
}

function quoteImportantTerms(searchTerm: string): string {
  if (/\bOR\b|"/i.test(searchTerm)) return searchTerm;
  const parts = searchTerm.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return searchTerm;
  if (parts.length <= 5) return `"${searchTerm}"`;
  return searchTerm;
}

function publicationStartDate(window: SourceQuery["timeWindow"]): string | null {
  if (!window) return null;
  const now = new Date();
  const days = window === "today" ? 2 : window === "week" ? 14 : 45;
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

function uniqueById(items: RawItem[]): RawItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const openalex: SourceAdapter = {
  id: "openalex",
  fetch: fetchImpl,
};
