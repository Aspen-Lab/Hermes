import type { SourceAdapter, SourceQuery, RawItem } from "./types";

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
  const { topics = [], limit = 30 } = query;
  if (topics.length === 0) return [];

  const params = new URLSearchParams({
    query: topics.join(" "),
    tags: "story,front_page",
    hitsPerPage: String(Math.min(limit, 50)),
  });

  try {
    const res = await fetch(`${HN_API}?${params}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error("[hn] non-ok response:", res.status);
      return [];
    }
    const data: { hits?: HNHit[] } = await res.json();
    return (data.hits || [])
      .filter((h) => (h.points ?? 0) >= MIN_POINTS && h.title)
      .map((h) => ({
        id: `hn:${h.objectID}`,
        source: "hn" as const,
        title: h.title || "",
        authors: [h.author],
        abstract: h.story_text || undefined,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        publishedAt: h.created_at,
        venue: "Hacker News",
        tags: h._tags,
        metadata: {
          hnScore: h.points,
          hnComments: h.num_comments,
        },
      }));
  } catch (err) {
    console.error("[hn] fetch error:", err);
    return [];
  }
}

export const hn: SourceAdapter = {
  id: "hn",
  fetch: fetchImpl,
};
