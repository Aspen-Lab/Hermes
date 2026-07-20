import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";

// Web discovery for academic positions. The classic academic boards
// (HigherEdJobs, jobs.ac.uk, Nature Careers, EURAXESS) all block direct
// server-side fetches, so we reach their public listings through a search
// provider instead: Tavily (BYOK or TAVILY_API_KEY) or Brave
// (BRAVE_SEARCH_API_KEY). Disabled when neither key is present.

const ACADEMIC_JOB_DOMAINS = [
  "higheredjobs.com",
  "jobs.ac.uk",
  "academicpositions.com",
  "euraxess.ec.europa.eu",
  "nature.com",
  "timeshighereducation.com",
  "academicjobsonline.org",
  "science.org",
];

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

export function webResultToRawJobItem(result: {
  title?: string;
  url?: string;
  snippet?: string;
}): RawJobItem | null {
  const title = result.title?.trim();
  const url = result.url?.trim();
  if (!title || !url) return null;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  // Split "Postdoc in X - University of Y | board.com" style titles.
  const parts = title.split(/\s+[-–—|·]\s+/);
  const roleTitle = parts[0]?.trim() || title;
  const company =
    parts
      .slice(1)
      .map((p) => p.trim())
      .find((p) => p && !ACADEMIC_JOB_DOMAINS.some((d) => p.toLowerCase().includes(d))) ||
    host;
  const text = `${title} ${result.snippet ?? ""}`;
  return {
    id: `jobweb:${url}`,
    source: "jobweb",
    title: roleTitle,
    company,
    location: "",
    isRemote: /\bremote\b/i.test(text),
    description: (result.snippet ?? "").trim(),
    url,
    tags: ["academic listing", host],
  };
}

async function searchTavily(
  query: string,
  apiKey: string,
  limit: number,
): Promise<RawJobItem[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: limit,
        include_answer: false,
        include_domains: ACADEMIC_JOB_DOMAINS,
      }),
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 3 * 60 * 60 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TavilyResult[] };
    return (data.results ?? [])
      .map((r) => webResultToRawJobItem({ title: r.title, url: r.url, snippet: r.content }))
      .filter((item): item is RawJobItem => item !== null);
  } catch (err) {
    console.error("[jobs/jobweb] tavily error:", err);
    return [];
  }
}

async function searchBrave(
  query: string,
  apiKey: string,
  limit: number,
): Promise<RawJobItem[]> {
  const siteFilter = ACADEMIC_JOB_DOMAINS.map((d) => `site:${d}`).join(" OR ");
  const params = new URLSearchParams({
    q: `${query} (${siteFilter})`,
    count: String(limit),
    freshness: "pm",
  });
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 3 * 60 * 60 },
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { web?: { results?: BraveResult[] } };
    return (data.web?.results ?? [])
      .map((r) =>
        webResultToRawJobItem({ title: r.title, url: r.url, snippet: r.description }),
      )
      .filter((item): item is RawJobItem => item !== null);
  } catch (err) {
    console.error("[jobs/jobweb] brave error:", err);
    return [];
  }
}

function resolveKeys(query: JobsQuery): { tavily?: string; brave?: string } {
  return {
    tavily: query.webSearch?.tavilyApiKey?.trim() || process.env.TAVILY_API_KEY,
    brave: process.env.BRAVE_SEARCH_API_KEY,
  };
}

async function fetchImpl(query: JobsQuery): Promise<RawJobItem[]> {
  const keys = resolveKeys(query);
  if (!keys.tavily && !keys.brave) return [];

  const searches = query.queries.slice(0, 3);
  if (searches.length === 0) return [];
  const perQuery = Math.max(4, Math.ceil(Math.min(query.limit, 20) / searches.length));

  const all: RawJobItem[] = [];
  for (const q of searches) {
    const jobQuery = `${q} position opening apply`;
    const items = keys.tavily
      ? await searchTavily(jobQuery, keys.tavily, perQuery)
      : await searchBrave(jobQuery, keys.brave!, perQuery);
    all.push(...items);
  }
  return Array.from(new Map(all.map((item) => [item.id, item])).values()).slice(
    0,
    query.limit,
  );
}

export const jobweb: JobSourceAdapter = {
  id: "jobweb",
  enabled: (query) => {
    const keys = resolveKeys(query);
    return Boolean(keys.tavily || keys.brave);
  },
  fetch: fetchImpl,
};
