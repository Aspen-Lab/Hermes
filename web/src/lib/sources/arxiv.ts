import { XMLParser } from "fast-xml-parser";
import type { SourceAdapter, SourceQuery, RawItem } from "./types";

const ARXIV_API = "https://export.arxiv.org/api/query";

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

function cleanWhitespace(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.trim().replace(/\s+/g, " ");
}

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const { topics = [], limit = 30 } = query;
  if (topics.length === 0) return [];

  const params = new URLSearchParams({
    search_query: buildQuery(query),
    start: "0",
    max_results: String(Math.min(limit, 50)),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  try {
    const res = await fetch(`${ARXIV_API}?${params}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
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

    return entries.map((e) => {
      const arxivId = extractArxivId(e.id);
      const authors = asArray(e.author).map((a) => a.name);
      const categories = asArray(e.category).map((c) => c["@_term"]);
      const links = asArray(e.link);
      const absLink =
        links.find((l) => l["@_rel"] === "alternate")?.["@_href"] ?? e.id;
      return {
        id: `arxiv:${arxivId}`,
        source: "arxiv",
        title: cleanWhitespace(e.title) || "",
        authors,
        abstract: cleanWhitespace(e.summary),
        url: absLink,
        publishedAt: e.published,
        venue: "arXiv",
        tags: categories.length > 0 ? categories : undefined,
        metadata: {
          arxivCategory: e["arxiv:primary_category"]?.["@_term"],
        },
      };
    });
  } catch (err) {
    console.error("[arxiv] fetch error:", err);
    return [];
  }
}

export const arxiv: SourceAdapter = {
  id: "arxiv",
  fetch: fetchImpl,
};
