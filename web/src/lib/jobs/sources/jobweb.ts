import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";
import { urlHashId } from "@/lib/opportunities/shared";

// Web discovery for research and R&D positions across academic and industry
// employers. Search providers reach public listings that frequently block
// direct server-side crawling. Disabled when neither key is present.

const KNOWN_JOB_BOARD_DOMAINS = [
  "higheredjobs.com",
  "jobs.ac.uk",
  "academicpositions.com",
  "euraxess.ec.europa.eu",
  "nature.com",
  "timeshighereducation.com",
  "academicjobsonline.org",
  "science.org",
];

export const JOB_PATH_RE =
  /\/(?:job|jobs|career|careers|position|positions|vacancy|vacancies|opportunity|opportunities|job-search|jobsearch)(?:\/|$)/i;
export const NON_JOB_PATH_RE =
  /\/(?:article|articles|doi|paper|papers|publication|publications|news|blog|posts)(?:\/|$)/i;
const JOB_TEXT_RE =
  /\b(job opening|job posting|open position|position available|vacanc(?:y|ies)|now hiring|we(?:'re| are) hiring|apply (?:now|today|for)|applications? (?:are )?(?:open|invited)|research (?:scientist|engineer|intern)|postdoc(?:toral)?|internship|r&d (?:scientist|engineer))\b/i;

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
  let parsed: URL;
  let host = "";
  try {
    parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const text = `${title} ${result.snippet ?? ""}`;
  if (NON_JOB_PATH_RE.test(parsed.pathname)) return null;
  if (!JOB_PATH_RE.test(parsed.pathname) && !JOB_TEXT_RE.test(text)) return null;

  // Split "Postdoc in X - University of Y | board.com" style titles.
  const parts = title.split(/\s+[-–—|·]\s+/);
  const roleTitle = parts[0]?.trim() || title;
  const company =
    parts
      .slice(1)
      .map((p) => p.trim())
      .find((p) => p && !KNOWN_JOB_BOARD_DOMAINS.some((d) => p.toLowerCase().includes(d))) ||
    host;
  return {
    id: `jobweb:${urlHashId(url)}`,
    source: "jobweb",
    title: roleTitle,
    company,
    location: "",
    isRemote: /\bremote\b/i.test(text),
    description: (result.snippet ?? "").trim(),
    url,
    tags: ["web job listing", host],
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
  const params = new URLSearchParams({
    q: query,
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

  const searches = query.queries.slice(0, 8);
  if (searches.length === 0) return [];
  const perQuery = Math.max(4, Math.ceil(Math.min(query.limit, 20) / searches.length));

  const resultSets = await Promise.all(
    searches.map((q) => {
      const jobQuery = `${q} position opening apply`;
      return keys.tavily
        ? searchTavily(jobQuery, keys.tavily, perQuery)
        : searchBrave(jobQuery, keys.brave!, perQuery);
    }),
  );
  const all: RawJobItem[] = [];
  for (const items of resultSets) {
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
