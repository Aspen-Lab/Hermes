import type { SourceAdapter, SourceQuery, RawItem } from "./types";
import { cleanDisplayText, cleanDisplayTextOrUndefined } from "@/lib/text/clean";

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  profile?: {
    name?: string;
  };
}

interface BraveResponse {
  web?: {
    results?: BraveResult[];
  };
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

async function fetchImpl(query: SourceQuery): Promise<RawItem[]> {
  const searchQueries = buildSearchQueries(query);
  if (searchQueries.length === 0) return [];

  const limit = query.limit ?? 20;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const requestTavilyKey = query.webSearch?.tavilyApiKey?.trim();
  const tavilyKey = requestTavilyKey || process.env.TAVILY_API_KEY;
  if (!braveKey && !tavilyKey) return [];

  const perQuery = Math.max(3, Math.ceil(Math.min(limit, 20) / searchQueries.length));
  const all: RawItem[] = [];
  const provider = resolveProvider(query, {
    braveKeyPresent: Boolean(braveKey),
    tavilyKeyPresent: Boolean(tavilyKey),
    requestTavilyKeyPresent: Boolean(requestTavilyKey),
  });
  if (!provider) return [];

  // Fan the per-query fetches out concurrently (like the other source
  // adapters) instead of awaiting them one at a time. Promise.allSettled
  // preserves input order and isolates a single slow/failed query, so the
  // whole source no longer blocks on the slowest one — and one query timing
  // out no longer drops the rest.
  const settled = await Promise.allSettled(
    searchQueries.map((searchQuery) => {
      const paperQuery = `${searchQuery} paper OR preprint OR arxiv`;
      return provider === "brave"
        ? fetchBrave(paperQuery, perQuery, braveKey!)
        : fetchTavily(paperQuery, perQuery, tavilyKey, query.webSearch);
    }),
  );
  for (const result of settled) {
    if (result.status === "fulfilled") all.push(...result.value);
  }

  return uniqueById(all).slice(0, limit);
}

async function fetchBrave(query: string, limit: number, apiKey: string): Promise<RawItem[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(limit),
    freshness: "pm",
  });
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      console.error("[web-search] brave non-ok response:", res.status);
      return [];
    }
    const data = (await res.json()) as BraveResponse;
    return (data.web?.results ?? []).map((item) => braveToRawItem(item)).filter((item): item is RawItem => item !== null);
  } catch (err) {
    console.error("[web-search] brave fetch error:", err);
    return [];
  }
}

async function fetchTavily(
  query: string,
  limit: number,
  apiKey: string | undefined,
  options: SourceQuery["webSearch"],
): Promise<RawItem[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: limit,
        include_answer: false,
        include_domains: options?.includeDomains,
        exclude_domains: options?.excludeDomains,
      }),
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      console.error("[web-search] tavily non-ok response:", res.status);
      return [];
    }
    const data = (await res.json()) as TavilyResponse;
    return (data.results ?? []).map((item) => tavilyToRawItem(item)).filter((item): item is RawItem => item !== null);
  } catch (err) {
    console.error("[web-search] tavily fetch error:", err);
    return [];
  }
}

function braveToRawItem(result: BraveResult): RawItem | null {
  const title = cleanDisplayText(result.title);
  const url = cleanDisplayText(result.url);
  if (!title || !url) return null;
  return {
    id: `web:${url}`,
    source: "web",
    title,
    authors: [],
    abstract: cleanDisplayTextOrUndefined(result.description),
    url,
    publishedAt: "",
    venue: cleanDisplayTextOrUndefined(result.profile?.name),
    tags: ["web mention"],
    metadata: {},
  };
}

function tavilyToRawItem(result: TavilyResult): RawItem | null {
  const title = cleanDisplayText(result.title);
  const url = cleanDisplayText(result.url);
  if (!title || !url) return null;
  return {
    id: `web:${url}`,
    source: "web",
    title,
    authors: [],
    abstract: cleanDisplayTextOrUndefined(result.content),
    url,
    publishedAt: "",
    venue: "Web",
    tags: ["web mention"],
    metadata: {},
  };
}

function buildSearchQueries(query: SourceQuery): string[] {
  const source = query.queries?.length ? query.queries : query.topics;
  return Array.from(new Set(source.map((q) => q.trim()).filter(Boolean))).slice(0, 4);
}

function resolveProvider(
  query: SourceQuery,
  availability: {
    braveKeyPresent: boolean;
    tavilyKeyPresent: boolean;
    requestTavilyKeyPresent: boolean;
  },
): "brave" | "tavily" | null {
  const preferred = query.webSearch?.provider ?? "auto";
  if (preferred === "brave") {
    return availability.braveKeyPresent ? "brave" : null;
  }
  if (preferred === "tavily") {
    return availability.tavilyKeyPresent ? "tavily" : null;
  }
  if (availability.requestTavilyKeyPresent) return "tavily";
  if (availability.braveKeyPresent) return "brave";
  if (availability.tavilyKeyPresent) return "tavily";
  return null;
}

function uniqueById(items: RawItem[]): RawItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export const webSearch: SourceAdapter = {
  id: "web",
  fetch: fetchImpl,
};
