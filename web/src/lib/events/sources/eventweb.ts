import type { EventType } from "@/types";
import type { EventSourceAdapter, EventsQuery, RawEventItem } from "../types";

// Web discovery for academic events. The curated feeds (ccfddl, confs.tech)
// are CS-heavy; this adapter is what finds a materials-science symposium or a
// neuroscience summer school: profile-driven queries (LLM-refined when a
// provider is available — see lib/opportunities/query-gen) through Tavily
// (BYOK or TAVILY_API_KEY) or Brave (BRAVE_SEARCH_API_KEY).

interface WebResult {
  title?: string;
  url?: string;
  snippet?: string;
}

const MONTH =
  "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
// First "Month D" token — the year is resolved separately so cross-month
// ranges ("November 29 - December 4, 2026") anchor on the range start.
const MONTH_DAY_RE = new RegExp(`${MONTH}\\.?\\s+(\\d{1,2})\\b(?!\\d)`, "i");
const DATE_DMY_RE = new RegExp(`(\\d{1,2})(?:\\s*[-–]\\s*\\d{1,2})?\\s+${MONTH}\\.?,?\\s+(\\d{4})`, "i");
const YEAR_RE = /\b(20\d{2})\b/;
const DEADLINE_RE = new RegExp(
  `(?:deadline|submissions? (?:due|close)|abstracts? due)[^.]{0,40}?(${MONTH}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MONTH}\\.?,?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})`,
  "i",
);

function parseDateToken(token: string): string | undefined {
  const ms = Date.parse(`${token.replace(/[-–].*?(?=,|\s\d{4})/, "")} 12:00:00 UTC`);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const iso = Date.parse(token);
  return Number.isFinite(iso) ? new Date(iso).toISOString() : undefined;
}

/** Best-effort event start date from title+snippet text. */
export function extractEventDate(text: string): string | undefined {
  const md = text.match(MONTH_DAY_RE);
  if (md) {
    // Year: prefer the first year appearing after the month-day token,
    // falling back to the first year anywhere in the text.
    const after = text.slice((md.index ?? 0) + md[0].length);
    const year = after.match(YEAR_RE)?.[1] ?? text.match(YEAR_RE)?.[1];
    if (year) return parseDateToken(`${md[1]} ${md[2]}, ${year}`);
  }
  const dmy = text.match(DATE_DMY_RE);
  if (dmy) return parseDateToken(`${dmy[2]} ${dmy[1]}, ${dmy[3]}`);
  return undefined;
}

/** Best-effort CFP deadline from snippet text. */
export function extractDeadline(text: string): string | undefined {
  const match = text.match(DEADLINE_RE);
  if (!match) return undefined;
  return parseDateToken(match[1]);
}

export function guessEventType(text: string): EventType {
  if (/\bworkshop\b/i.test(text)) return "workshop";
  if (/\b(seminar|colloquium|webinar|lecture series)\b/i.test(text)) return "seminar";
  if (/\b(meetup|networking event)\b/i.test(text)) return "meetup";
  return "conference";
}

// Signals that a web result is actually an event page (a conference, CFP,
// meeting, symposium…) rather than an arbitrary article. Used to keep
// date-less results that still clearly describe an event, since conference
// pages routinely omit a parseable date from their search snippet.
const EVENT_SIGNAL_RE =
  /\b(conference|symposium|workshop|seminar|colloquium|congress|meeting|summit|call for papers|cfp|abstract submission|registration|keynote|proceedings|society meeting|gordon research)\b/i;

export function looksLikeEvent(text: string): boolean {
  return EVENT_SIGNAL_RE.test(text);
}

export function webResultToRawEventItem(
  result: WebResult,
  now: number,
): RawEventItem | null {
  const title = result.title?.trim();
  const url = result.url?.trim();
  if (!title || !url) return null;
  const text = `${title} ${result.snippet ?? ""}`;
  const startDate = extractEventDate(text);
  const deadline = extractDeadline(text);
  const anchor = [startDate, deadline]
    .filter((d): d is string => Boolean(d))
    .map((d) => Date.parse(d));
  // A parsed date that's already in the past means the page describes a
  // finished event — drop it.
  if (anchor.length > 0 && Math.max(...anchor) < now) return null;
  if (anchor.length === 0) {
    // No parseable date is common for conference pages (the date lives in a
    // table the snippet doesn't capture). Keep the result only if it clearly
    // reads as an event; the card shows "date TBA" until opened.
    if (!looksLikeEvent(text)) return null;
    // Guard against past events that mention only a bare year ("held in 2019"):
    // if every year token in the text is in the past, treat it as finished.
    const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
    const currentYear = new Date(now).getUTCFullYear();
    if (years.length > 0 && years.every((y) => y < currentYear)) return null;
  }

  const isOnline = /\b(online|virtual|hybrid)\b/i.test(text);
  const name = title.split(/\s+[|·]\s+/)[0].trim() || title;
  return {
    id: `eventweb:${url}`,
    source: "eventweb",
    name,
    type: guessEventType(text),
    startDate: startDate && Date.parse(startDate) > now ? startDate : "",
    location: isOnline ? "Online" : "See event page",
    isOnline,
    deadline: deadline && Date.parse(deadline) > now ? deadline : undefined,
    description: (result.snippet ?? "").trim().slice(0, 600),
    url,
    tags: ["web discovery"],
  };
}

async function searchTavily(
  query: string,
  apiKey: string,
  limit: number,
): Promise<WebResult[]> {
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
        exclude_domains: ["arxiv.org", "openalex.org", "semanticscholar.org"],
      }),
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 6 * 60 * 60 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  } catch (err) {
    console.error("[events/eventweb] tavily error:", err);
    return [];
  }
}

async function searchBrave(
  query: string,
  apiKey: string,
  limit: number,
): Promise<WebResult[]> {
  const params = new URLSearchParams({ q: query, count: String(limit) });
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 6 * 60 * 60 },
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
  } catch (err) {
    console.error("[events/eventweb] brave error:", err);
    return [];
  }
}

function resolveKeys(query: EventsQuery): { tavily?: string; brave?: string } {
  return {
    tavily: query.webSearch?.tavilyApiKey?.trim() || process.env.TAVILY_API_KEY,
    brave: process.env.BRAVE_SEARCH_API_KEY,
  };
}

async function fetchImpl(query: EventsQuery): Promise<RawEventItem[]> {
  const keys = resolveKeys(query);
  if (!keys.tavily && !keys.brave) return [];

  const searches = query.queries.slice(0, 3);
  if (searches.length === 0) return [];
  const perQuery = Math.max(4, Math.ceil(Math.min(query.limit, 20) / searches.length));

  const now = Date.now();
  const all: RawEventItem[] = [];
  for (const q of searches) {
    const results = keys.tavily
      ? await searchTavily(q, keys.tavily, perQuery)
      : await searchBrave(q, keys.brave!, perQuery);
    for (const result of results) {
      const item = webResultToRawEventItem(result, now);
      if (item) all.push(item);
    }
  }
  return Array.from(new Map(all.map((item) => [item.id, item])).values()).slice(
    0,
    query.limit,
  );
}

export const eventweb: EventSourceAdapter = {
  id: "eventweb",
  enabled: (query) => {
    const keys = resolveKeys(query);
    return Boolean(keys.tavily || keys.brave);
  },
  fetch: fetchImpl,
};
