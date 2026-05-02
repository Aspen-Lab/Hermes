import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import { cleanDisplayText, cleanDisplayTextOrUndefined } from "@/lib/text/clean";

const DBLP_API = "https://dblp.org/search/publ/api";

interface DblpAuthor {
  text?: string;
}

interface DblpHit {
  "@id"?: string;
  info?: {
    authors?: {
      author?: DblpAuthor | DblpAuthor[];
    };
    title?: string;
    venue?: string;
    year?: string;
    type?: string;
    doi?: string;
    ee?: string;
    url?: string;
  };
}

interface DblpResponse {
  result?: {
    hits?: {
      hit?: DblpHit | DblpHit[];
    };
  };
}

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const searchQueries = buildSearchQueries(query);
  if (searchQueries.length === 0) return [];

  const limit = query.limit ?? 30;
  const perQuery = Math.max(5, Math.ceil(Math.min(limit, 40) / searchQueries.length));
  const all: RawItem[] = [];

  for (const searchQuery of searchQueries) {
    const params = new URLSearchParams({
      q: searchQuery,
      format: "json",
      h: String(perQuery),
    });

    try {
      const res = await fetch(`${DBLP_API}?${params}`, {
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 900 },
      });
      if (!res.ok) {
        console.error("[dblp] non-ok response:", res.status);
        continue;
      }
      const data = (await res.json()) as DblpResponse;
      all.push(
        ...toArray(data.result?.hits?.hit)
          .map(hitToRawItem)
          .filter((item): item is RawItem => item !== null),
      );
    } catch (err) {
      console.error("[dblp] fetch error:", err);
    }
  }

  return uniqueById(all).slice(0, limit);
}

function hitToRawItem(hit: DblpHit): RawItem | null {
  const info = hit.info;
  const title = cleanDisplayText(info?.title);
  if (!info || !title) return null;

  const doi = cleanDisplayTextOrUndefined(info.doi);
  const url = cleanDisplayTextOrUndefined(info.ee) || cleanDisplayTextOrUndefined(info.url);
  const year = parseInt(info.year ?? "", 10);
  const id = hit["@id"] || info.url || doi || title;

  return {
    id: `dblp:${id}`,
    source: "dblp",
    title,
    authors: toArray(info.authors?.author)
      .map((author) => cleanDisplayText(author.text))
      .filter(Boolean),
    url: url || (doi ? `https://doi.org/${doi}` : "https://dblp.org"),
    publishedAt: Number.isFinite(year) ? `${year}-01-01` : "",
    venue: cleanDisplayTextOrUndefined(info.venue),
    tags: [info.type, info.venue].map(cleanDisplayText).filter(Boolean),
    metadata: {
      doi,
      workType: cleanDisplayTextOrUndefined(info.type),
    },
  };
}

function buildSearchQueries(query: SourceQuery): string[] {
  const source = query.queries?.length ? query.queries : query.topics;
  return Array.from(new Set(source.map((q) => q.trim()).filter(Boolean))).slice(0, 4);
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueById(items: RawItem[]): RawItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const dblp: SourceAdapter = {
  id: "dblp",
  fetch: fetchImpl,
};
