import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import {
  openAlexWorkToRawItem,
  type OpenAlexWork,
} from "@/lib/utils/openalex";
import { sourceFetch } from "./_fetch";

const OPENALEX_API = "https://api.openalex.org/works";
const MAILTO = process.env.OPENALEX_EMAIL ?? "hermes@example.com";
const MAX_QUERIES = 3;

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const { topics = [], queries = [], venues, limit = 30 } = query;
  const searchQueries = buildSearchQueries(topics, queries);
  if (searchQueries.length === 0) return [];

  const perQuery = Math.max(5, Math.ceil(Math.min(limit, 50) / searchQueries.length));

  const results = await Promise.allSettled(
    searchQueries.map((searchTerm) =>
      fetchOne(searchTerm, perQuery, venues, query.timeWindow),
    ),
  );

  const all: RawItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return uniqueById(all).slice(0, limit);
}

async function fetchOne(
  searchTerm: string,
  perQuery: number,
  venues: string[] | undefined,
  timeWindow: SourceQuery["timeWindow"],
): Promise<RawItem[]> {
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
    const cleanVenues = venues
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && !/[,|:]/.test(v));
    if (cleanVenues.length > 0) {
      filters.push(
        `primary_location.source.display_name.search:${cleanVenues.join("|")}`,
      );
    }
  }
  const fromDate = publicationStartDate(timeWindow);
  if (fromDate) filters.push(`from_publication_date:${fromDate}`);
  if (filters.length > 0) params.append("filter", filters.join(","));

  const url = `${OPENALEX_API}?${params}`;
  try {
    const res = await sourceFetch(url, { timeoutMs: 6000, revalidate: 300 });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[openalex] non-ok ${res.status} for search="${searchTerm}" — ${body.slice(0, 180)}`,
      );
      return [];
    }
    const data = await res.json();
    const works: OpenAlexWork[] = data.results || [];
    return works.map(openAlexWorkToRawItem);
  } catch (err) {
    console.error("[openalex] fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
}

function buildSearchQueries(topics: string[], queries: string[]): string[] {
  const source = queries.length > 0 ? queries : topics;
  return Array.from(
    new Set(
      source
        .map(sanitizeSearchTerm)
        .filter((q) => q.length >= 3),
    ),
  ).slice(0, MAX_QUERIES);
}

// OpenAlex's search parser rejects some punctuation and unbalanced quotes
// with HTTP 400. Strip the dangerous chars and collapse whitespace so each
// query is a clean phrase before we optionally wrap it in quotes.
function sanitizeSearchTerm(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/["“”‘’]/g, "")
    .replace(/[!?{}()\[\]\\^~*]/g, " ")
    .replace(/[:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteImportantTerms(searchTerm: string): string {
  if (/\bOR\b/i.test(searchTerm)) return searchTerm;
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
