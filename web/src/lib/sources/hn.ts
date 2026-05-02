import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import { cleanDisplayText, cleanDisplayTextOrUndefined } from "@/lib/text/clean";

const HN_API = "https://hn.algolia.com/api/v1/search";
const MIN_POINTS = 30;

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
  _tags?: string[];
  story_text?: string | null;
}

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const { topics = [], queries = [], limit = 30 } = query;
  const searchQueries = buildSearchQueries(topics, queries);
  if (searchQueries.length === 0) return [];

  const perQuery = Math.max(5, Math.ceil(Math.min(limit, 50) / searchQueries.length));
  const all: RawItem[] = [];

  for (const searchQuery of searchQueries) {
    const params = new URLSearchParams({
      query: searchQuery,
      tags: "story,front_page",
      hitsPerPage: String(perQuery),
    });

    try {
      const res = await fetch(`${HN_API}?${params}`, {
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        console.error("[hn] non-ok response:", res.status);
        continue;
      }
      const data: { hits?: HNHit[] } = await res.json();
      all.push(
        ...(data.hits || [])
          .filter((h) => (h.points ?? 0) >= MIN_POINTS && h.title)
          .map((h) => ({
            id: `hn:${h.objectID}`,
            source: "hn" as const,
            title: cleanDisplayText(h.title),
            authors: [cleanDisplayText(h.author)].filter(Boolean),
            abstract: cleanDisplayTextOrUndefined(h.story_text),
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            publishedAt: h.created_at,
            venue: "Hacker News",
            tags: h._tags,
            metadata: {
              hnScore: h.points,
              hnComments: h.num_comments,
            },
          })),
      );
    } catch (err) {
      console.error("[hn] fetch error:", err);
    }
  }

  return uniqueById(all).slice(0, limit);
}

function buildSearchQueries(topics: string[], queries: string[]): string[] {
  const source = queries.length > 0 ? queries : topics;
  return Array.from(new Set(source.map((q) => q.trim()).filter(Boolean))).slice(0, 4);
}

function uniqueById(items: RawItem[]): RawItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const hn: SourceAdapter = {
  id: "hn",
  fetch: fetchImpl,
};
