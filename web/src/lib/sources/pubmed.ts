import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import { cleanDisplayText, cleanDisplayTextOrUndefined } from "@/lib/text/clean";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

interface PubMedSearchResponse {
  esearchresult?: {
    idlist?: string[];
  };
}

interface PubMedSummaryAuthor {
  name?: string;
}

interface PubMedArticleId {
  idtype?: string;
  value?: string;
}

interface PubMedSummary {
  uid?: string;
  pubdate?: string;
  epubdate?: string;
  sortpubdate?: string;
  source?: string;
  fulljournalname?: string;
  title?: string;
  authors?: PubMedSummaryAuthor[];
  pubtype?: string[];
  articleids?: PubMedArticleId[];
}

interface PubMedSummaryResponse {
  result?: {
    uids?: string[];
    [uid: string]: PubMedSummary | string[] | undefined;
  };
}

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const searchQueries = buildSearchQueries(query);
  if (searchQueries.length === 0) return [];

  const limit = query.limit ?? 30;
  const perQuery = Math.max(5, Math.ceil(Math.min(limit, 40) / searchQueries.length));
  const all: RawItem[] = [];

  for (const searchQuery of searchQueries) {
    try {
      const ids = await searchIds(searchQuery, perQuery, query.timeWindow);
      if (ids.length === 0) continue;
      all.push(...(await fetchSummaries(ids)));
    } catch (err) {
      console.error("[pubmed] fetch error:", err);
    }
  }

  return uniqueById(all).slice(0, limit);
}

async function searchIds(
  searchQuery: string,
  limit: number,
  timeWindow: SourceQuery["timeWindow"],
): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(limit),
    sort: "pub date",
    term: dateScopedQuery(searchQuery, timeWindow),
  });

  const res = await fetch(`${EUTILS}/esearch.fcgi?${params}`, {
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    console.error("[pubmed] search non-ok response:", res.status);
    return [];
  }
  const data = (await res.json()) as PubMedSearchResponse;
  return data.esearchresult?.idlist ?? [];
}

async function fetchSummaries(ids: string[]): Promise<RawItem[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    id: ids.join(","),
  });

  const res = await fetch(`${EUTILS}/esummary.fcgi?${params}`, {
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    console.error("[pubmed] summary non-ok response:", res.status);
    return [];
  }

  const data = (await res.json()) as PubMedSummaryResponse;
  const uids = data.result?.uids ?? [];
  return uids
    .map((uid) => {
      const summary = data.result?.[uid];
      return summary && !Array.isArray(summary)
        ? summaryToRawItem(summary)
        : null;
    })
    .filter((item): item is RawItem => item !== null);
}

function summaryToRawItem(summary: PubMedSummary): RawItem | null {
  const uid = summary.uid;
  const title = cleanDisplayText(summary.title);
  if (!uid || !title) return null;

  const doi = findDoi(summary.articleids);
  const venue = cleanDisplayTextOrUndefined(summary.fulljournalname || summary.source);

  return {
    id: `pubmed:${uid}`,
    source: "pubmed",
    title,
    authors: (summary.authors ?? [])
      .map((author) => cleanDisplayText(author.name))
      .filter(Boolean),
    url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    publishedAt: parsePubMedDate(summary.epubdate || summary.sortpubdate || summary.pubdate),
    venue,
    tags: (summary.pubtype ?? []).map(cleanDisplayText).filter(Boolean),
    metadata: {
      doi,
      workType: summary.pubtype?.[0],
    },
  };
}

function findDoi(ids: PubMedArticleId[] | undefined): string | undefined {
  return ids?.find((id) => id.idtype?.toLowerCase() === "doi")?.value;
}

function buildSearchQueries(query: SourceQuery): string[] {
  const source = query.queries?.length ? query.queries : query.topics;
  return Array.from(new Set(source.map((q) => q.trim()).filter(Boolean))).slice(0, 3);
}

function dateScopedQuery(searchQuery: string, timeWindow: SourceQuery["timeWindow"]): string {
  if (!timeWindow) return searchQuery;
  const days = timeWindow === "today" ? 2 : timeWindow === "week" ? 14 : 45;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const date = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;
  return `(${searchQuery}) AND ("${date}"[Date - Publication] : "3000/12/31"[Date - Publication])`;
}

function parsePubMedDate(value: string | undefined): string {
  if (!value) return "";
  const normalized = value.replace(/\//g, "-");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const year = value.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return "";
  const monthName = value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i)?.[0];
  const month = monthName ? monthNumber(monthName) : "01";
  const day = value.match(/\b\d{1,2}\b(?!\d)/)?.[0] ?? "01";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function monthNumber(name: string): string {
  const i = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(name.toLowerCase());
  return String(Math.max(0, i) + 1).padStart(2, "0");
}

function uniqueById(items: RawItem[]): RawItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const pubmed: SourceAdapter = {
  id: "pubmed",
  fetch: fetchImpl,
};
