import { XMLParser } from "fast-xml-parser";
import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import { cleanDisplayText, cleanDisplayTextOrUndefined } from "@/lib/text/clean";
import { sourceFetch } from "./_fetch";

const ARXIV_API = "https://export.arxiv.org/api/query";
const MAX_QUERIES = 3;

interface ArxivLink {
  "@_href": string;
  "@_rel"?: string;
  "@_type"?: string;
}

interface ArxivCategory {
  "@_term": string;
}

interface ArxivEntry {
  id: string;
  published: string;
  updated?: string;
  title: string;
  summary: string;
  author: { name: string } | { name: string }[];
  category?: ArxivCategory | ArxivCategory[];
  "arxiv:primary_category"?: ArxivCategory;
  link?: ArxivLink | ArxivLink[];
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function buildQuery(query: SourceQuery): string {
  const { topics = [], methods = [] } = query;
  const topicExpr = topics.map((t) => `all:"${t}"`).join(" OR ");
  if (methods.length === 0) return `(${topicExpr})`;
  const methodExpr = methods.map((m) => `all:"${m}"`).join(" OR ");
  return `(${topicExpr}) AND (${methodExpr})`;
}

function extractArxivId(fullId: string): string {
  const match = fullId.match(/abs\/([^v]+)/);
  return match ? match[1] : fullId.split("/").pop() || fullId;
}

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const { topics = [], queries = [], limit = 30 } = query;
  const searchQueries = buildSearchQueries(topics, queries);
  if (searchQueries.length === 0) return [];

  const perQuery = Math.max(5, Math.ceil(Math.min(limit, 50) / searchQueries.length));

  const results = await Promise.allSettled(
    searchQueries.map((searchQuery) => fetchOne(query, searchQuery, perQuery)),
  );

  const all: RawItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return uniqueById(all).slice(0, limit);
}

async function fetchOne(
  query: SourceQuery,
  searchQuery: string,
  perQuery: number,
): Promise<RawItem[]> {
  const params = new URLSearchParams({
    search_query: buildQuery({ ...query, topics: [searchQuery] }),
    start: "0",
    max_results: String(perQuery),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  try {
    const res = await sourceFetch(`${ARXIV_API}?${params}`, {
      timeoutMs: 6000,
      revalidate: 300,
    });
    if (!res.ok) {
      console.error("[arxiv] non-ok response:", res.status);
      return [];
    }
    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(xml);
    const entries: ArxivEntry[] = asArray(parsed?.feed?.entry);

    return entries.map((e): RawItem => {
      const arxivId = extractArxivId(e.id);
      const authors = asArray(e.author).map((a) => cleanDisplayText(a.name)).filter(Boolean);
      const categories = asArray(e.category).map((c) => cleanDisplayText(c["@_term"])).filter(Boolean);
      const links = asArray(e.link);
      const absLink =
        links.find((l) => l["@_rel"] === "alternate")?.["@_href"] ?? e.id;
      return {
        id: `arxiv:${arxivId}`,
        source: "arxiv",
        title: cleanDisplayText(e.title),
        authors,
        abstract: cleanDisplayTextOrUndefined(e.summary),
        url: absLink,
        publishedAt: e.published,
        venue: "arXiv",
        tags: categories.length > 0 ? categories : undefined,
        metadata: {
          arxivCategory: cleanDisplayTextOrUndefined(e["arxiv:primary_category"]?.["@_term"]),
        },
      };
    });
  } catch (err) {
    console.error("[arxiv] fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
}

function buildSearchQueries(topics: string[], queries: string[]): string[] {
  const source = queries.length > 0 ? queries : topics;
  return Array.from(new Set(source.map((q) => q.trim()).filter(Boolean))).slice(0, MAX_QUERIES);
}

function uniqueById(items: RawItem[]): RawItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const arxiv: SourceAdapter = {
  id: "arxiv",
  fetch: fetchImpl,
};
