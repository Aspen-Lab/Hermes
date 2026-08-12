import type { EventType } from "@/types";
import type { EventSourceAdapter, EventsQuery, RawEventItem } from "../types";
import { looksLikeHostBrand, urlHashId } from "@/lib/opportunities/shared";
import {
  EVENT_QUERY_BUDGET,
  RESULTS_PER_SEARCH,
} from "@/lib/opportunities/query-budget";
import { classifyEventType } from "../mapper";

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
  return classifyEventType(text, "");
}

// Signals that a web result is actually an event page (a conference, CFP,
// meeting, symposium…) rather than an arbitrary article. Used to keep
// date-less results that still clearly describe an event, since conference
// pages routinely omit a parseable date from their search snippet.
const EVENT_SIGNAL_RE =
  /\b(conference|symposium|workshop|seminar|colloquium|congress|meeting|summit|expo|exhibition|forum|round ?table|convention|career (?:fair|expo)|job fair|hiring fair|recruiting (?:fair|event)|hackathon|hack day|call for papers|cfp|abstract submission|registration|keynote|proceedings|society meeting|gordon research)\b/i;

export function looksLikeEvent(text: string): boolean {
  return EVENT_SIGNAL_RE.test(text);
}

export const DENY_HOSTS = [
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "pinterest.com",
  "iopscience.iop.org",
  "sciencedirect.com",
  "link.springer.com",
  "onlinelibrary.wiley.com",
  "nature.com",
  "pubs.acs.org",
  "pubs.rsc.org",
  "arxiv.org",
  "researchgate.net",
  "semanticscholar.org",
  "doi.org",
  "waset.org",
  "conferenceseries.com",
  "omicsonline.org",
  "alliedacademies.org",
  "iaras.org",
  "scitechseries.com",
] as const;

export const DENY_PATH_RE = /\/(?:article|doi|abs|reel|posts|p)(?:\/|$)/i;

/**
 * Storefront paths. A battery retailer's catalogue mentions "batteries" and
 * "charger" constantly and can clear the relevance gate, but it is a shop, not
 * an event — "Batteries, Charger & More" reached a live top 10 this way.
 */
export const COMMERCE_PATH_RE =
  /\/(?:shop|store|product|products|collections?|cart|checkout|catalog(?:ue)?|pricing|buy)(?:\/|$)/i;

/**
 * Editorial coverage *about* events rather than an event page. "The Year Ahead:
 * Key Events at the IAEA in 2026" is a news article; there is nothing to
 * register for. These read as events to a keyword check because they are full
 * of event vocabulary.
 */
export const NEWS_TITLE_RE =
  /^\s*(?:the\s+year\s+ahead|year\s+in\s+review|(?:top|best)\s+\d+\b|what\s+to\s+(?:expect|watch)|a\s+look\s+(?:back|ahead)|recap|highlights\s+from|report\s+from|announcing\b)|\b(?:news|press\s+release|blog\s+post|newsletter)\b/i;

/**
 * Paper and abstract pages. Conference proceedings sites host one page per
 * *paper*, and those pages carry the parent conference's event vocabulary, so
 * they clear both the event-signal check and the relevance gate. A user
 * looking for somewhere to go cannot attend an abstract.
 */
export const PAPER_PAGE_HOSTS = [
  "programmaster.org",
  "hal.science",
  "hal.archives-ouvertes.fr",
  "ui.adsabs.harvard.edu",
  "ouci.dntb.gov.ua",
  "colab.ws",
  "scilit.com",
] as const;

export const PAPER_TITLE_RE =
  /^\s*(?:about\s+this\s+abstract|abstract\s*[:#-]|archive\s+ouverte)\b|\b(?:archive\s+ouverte|hal\s+open\s+science)\b/i;

function isDeniedUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname.toLocaleLowerCase().replace(/^www\./, "");
  if (
    DENY_HOSTS.some(
      (denied) => host === denied || host.endsWith(`.${denied}`),
    ) ||
    PAPER_PAGE_HOSTS.some(
      (denied) => host === denied || host.endsWith(`.${denied}`),
    )
  ) {
    return true;
  }
  return (
    DENY_PATH_RE.test(parsed.pathname) || COMMERCE_PATH_RE.test(parsed.pathname)
  );
}

// Page titles that name the page rather than the event. Taking the first
// title segment blindly produced cards reading "Meeting Summary" or "Home",
// which tell the user nothing about what the event is.
//
// B5-06/R13 gap 1. A segment does not have to equal one of these words
// EXACTLY to be just as uninformative — "Agenda & Information" tells the
// reader nothing more than bare "Agenda" does, but the old anchored
// whole-segment match required an exact word and let the "+ trailing text"
// shape through as if it were the event's own name. The optional group
// below is deliberately bounded (a short connector, then <=24 more
// characters, then end of segment) so a genuinely long, substantive title
// that happens to start with one of these common words is not caught by
// accident — it reuses the same word list rather than a second, separate one.
const GENERIC_PAGE_TITLE_RE =
  /^(?:meeting\s+summary|summary|home|homepage|welcome|index|about(?:\s+us)?|agenda|programme?|schedule|overview|main\s+page|news|events?|conferences?)(?:\s*&\s*[\w\s]{1,24}|\s+(?:and|or)\s+[\w\s]{1,24})?$/i;

function isGenericPageTitle(candidate: string): boolean {
  return GENERIC_PAGE_TITLE_RE.test(candidate.trim());
}

/**
 * Calendar indexes, archives, and organisation homepages. These pass the
 * event-signal check (they are full of the word "events") but are not a single
 * event you can attend — the events-side equivalent of a job-board search
 * page. "Events for July 2026" and "Nuclear and Applied Materials Research
 * Group" both reached a live top-5 before this filter existed.
 */
export const EVENT_INDEX_TITLE_RE =
  /^\s*(?:all\s+|upcoming\s+|past\s+|our\s+)?events?\b(?:\s+(?:for|in|calendar|archive|list|listing)\b|\s*$)|^\s*(?:events?|conferences?|seminars?)\s+(?:calendar|archive|listings?|schedule)\b|^\s*(?:upcoming|browse|all)\s+[\w\s]{0,30}\b(?:events?|conferences?|seminars?|workshops?)\s*$|\b(?:research\s+group|research\s+laboratory|research\s+center|research\s+centre|department\s+of|faculty\s+of)\b/i;

export function isNewsArticleTitle(title: string): boolean {
  return NEWS_TITLE_RE.test(title.trim());
}

export function isPaperPageTitle(title: string): boolean {
  return PAPER_TITLE_RE.test(title.trim());
}

export function isEventIndexPage(title: string): boolean {
  return EVENT_INDEX_TITLE_RE.test(title.trim());
}

/**
 * Best available human-readable event name from a search result.
 *
 * Page titles arrive in three shapes: a clean event name, an event name with
 * site chrome appended ("… | Cambridge EnerTech"), or a generic page label
 * ("Meeting Summary"). Prefer the most informative segment of the title, and
 * when the whole title is generic, recover the event name from the snippet
 * rather than showing the user a meaningless card.
 */
/**
 * B5-06/R13 gap 2. A short filler word ("the"/"a"/"an") stuck in front of
 * what's otherwise the page's own domain restated — "The Engine" on
 * engine.xyz — is the same site-brand shape `looksLikeHostBrand` already
 * catches, just with an article attached. Deliberately its own function
 * rather than folding the filler-strip into `looksLikeHostBrand` itself
 * (shared.ts, built for B5-03's job-board-brand problem): a real company's
 * own display name legitimately elaborates its domain root with a TRAILING
 * descriptor far more often than a real name is genuinely "[article] +
 * [domain root]" the way a media/platform brand's name commonly is, so
 * widening the shared, job-side function itself to also strip a leading
 * article would raise its false-rejection risk for the job side for no
 * benefit there. Only reused where the shape is actually expected.
 */
const BRAND_FILLER_PREFIX_RE = /^(?:the|an?)\s+/i;

function looksLikeArticledHostBrand(candidate: string, host: string): boolean {
  const withoutFiller = candidate.replace(BRAND_FILLER_PREFIX_RE, "");
  if (withoutFiller === candidate) return false;
  return looksLikeHostBrand(withoutFiller, host);
}

/**
 * Site chrome: a title segment that names the website or a calendar view
 * rather than an event ("DLR Events", "Events for July 2026"). Real listings
 * routinely wrap a good event page in two of these, as in
 * "DLR Events | Events for July 2026" — whose URL is a specific workshop.
 *
 * B5-06/R13 gap 2 added the last two checks: a segment that is essentially
 * the page's own domain restated (a site's own brand, not an event's name)
 * — same mechanism B5-03 built for a job board's own brand leaking into the
 * job company slot, reused rather than reinvented here. `host` is optional
 * because `eventNameFrom` is sometimes called without a URL (see its own
 * tests); the brand checks simply do not run when there is nothing to
 * compare against, matching every other optional-signal convention in this
 * codebase.
 */
function isChromeSegment(segment: string, host: string | undefined): boolean {
  const trimmed = segment.trim();
  if (
    isGenericPageTitle(trimmed) ||
    isEventIndexPage(trimmed) ||
    /^[\w\s.-]{0,24}\bevents?$/i.test(trimmed)
  ) {
    return true;
  }
  if (!host) return false;
  return (
    looksLikeHostBrand(trimmed, host) || looksLikeArticledHostBrand(trimmed, host)
  );
}

/**
 * Recognises a segment that reads as a narrative sentence *about* an event
 * rather than the event's own name. B4-01's own repro — a real event whose
 * H1 rendered as "TiRT7 was originally planned for 2020 but was delayed due
 * to the COVID-19 pandemic." — clears isChromeSegment/isGenericPageTitle/
 * EVENT_INDEX_TITLE_RE cleanly, because none of them check whether a segment
 * reads as narration; it isn't a page label, an index, or a calendar view,
 * it is a grammatical sentence.
 *
 * Two independent signals, either is enough to reject:
 *  - a finite "to be" verb immediately before a past participle ("was
 *    planned", "was delayed", "has been postponed") — an event's own NAME is
 *    a noun phrase, not a conjugated claim about itself. This is the check
 *    that actually catches the repro above.
 *  - sentence-terminal punctuation with more text after it (more than one
 *    sentence). Requires a real word (3+ letters) before the punctuation so
 *    an abbreviation like "Dr." or "U.S." mid-title is not mistaken for a
 *    sentence boundary.
 *
 * Deliberately no length ceiling on its own: real event names run long ("The
 * First European Conference on Molten Salt Reactor Chemistry and
 * Technology" is eleven words), so length alone is never treated as proof of
 * narration. A generous word ceiling still applies as a last-resort net for
 * a long run of prose with neither shape above (no conjugated verb, no
 * terminal punctuation at all) — well above any real title's length, so it
 * should essentially never be the reason a real name is rejected.
 */
const NARRATIVE_VERB_RE =
  /\b(?:was|were|is|are|has been|have been|had been|will be)\s+\w+(?:ed|en)\b/i;

/**
 * B5-06/R13 gap 3, the second half. "Abstract submission deadline extended"
 * is narration about the event, exactly the same kind NARRATIVE_VERB_RE
 * already rejects when an auxiliary verb is present ("the deadline WAS
 * extended") — but a real headline routinely drops the auxiliary
 * ("deadline extended," not "deadline was extended"), and that elliptical
 * passive has no conjugated verb for NARRATIVE_VERB_RE to catch. Bounded to
 * a short, closed list of common headline subjects and participles — the
 * same "catch known shapes, not a general parser" approach
 * NARRATIVE_VERB_RE itself already uses — rather than a general
 * subject-verb parser.
 */
const HEADLINE_PASSIVE_RE =
  /\b(?:deadline|registration|abstract|submission|call\s+for\s+(?:papers|abstracts)|date)\b[^.]{0,30}\b(?:extended|postponed|cancell?ed|delayed|announced|updated|moved|rescheduled|confirmed)\b/i;

const MULTI_SENTENCE_RE = /\w{3,}[.!?]\s+[A-Z][a-z]/;
const MAX_TITLE_WORDS = 20;

export function looksLikeEventTitle(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  if (NARRATIVE_VERB_RE.test(trimmed)) return false;
  if (HEADLINE_PASSIVE_RE.test(trimmed)) return false;
  if (MULTI_SENTENCE_RE.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > MAX_TITLE_WORDS) return false;
  return true;
}

/** Human-readable event name recovered from a deep event URL's slug. */
function nameFromUrlSlug(url: string): string | undefined {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  const slug = path
    .split("/")
    .filter(Boolean)
    .reverse()
    .find((part) => /[a-z]/i.test(part) && part.replace(/[^a-z]/gi, "").length >= 8);
  if (!slug) return undefined;
  const words = slug
    .replace(/\.\w{2,5}$/, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (words.split(" ").length < 3) return undefined;
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

export function eventNameFrom(
  title: string,
  snippet: string,
  url?: string,
): string {
  // B5-06/R13 gap 3, the first half. The split only ever recognised a pipe,
  // middle dot, en dash or em dash — a plain ASCII hyphen ("Deadline
  // extended - SiteName") was never a recognised separator at all, so a
  // title using one stayed a single, unsplit segment no matter what else
  // this function did to it.
  const segments = title
    .split(/\s+[-|·–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  // B5-06/R13 gap 2. host is undefined when eventNameFrom is called without
  // a URL (some tests, and any future caller that doesn't have one) — the
  // brand checks inside isChromeSegment simply don't run in that case.
  let host: string | undefined;
  if (url) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = undefined;
    }
  }

  const informative = segments.filter(
    (part) => !isChromeSegment(part, host) && looksLikeEventTitle(part),
  );
  if (informative.length > 0) {
    // Prefer a segment that actually reads as an event, else the longest one:
    // site chrome is normally shorter than the event name.
    const eventLike = informative.filter((part) => looksLikeEvent(part));
    const pool = eventLike.length > 0 ? eventLike : informative;
    return pool.reduce((best, part) => (part.length > best.length ? part : best));
  }

  // Every title segment is chrome. A deep event URL's slug is the most
  // reliable remaining source of the actual event name — try it before the
  // snippet, whose longest sentence is often prose ("Networking: An opening
  // get-together...") rather than a name.
  const fromSlug = url ? nameFromUrlSlug(url) : undefined;
  if (fromSlug) return fromSlug;

  // Otherwise mine the snippet for its most informative event-like phrase.
  const substantial = snippet
    .split(/(?<=[.!?])\s+|\s+[|·–—]\s+|\n/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20 && part.length <= 120);
  const eventLike = substantial.filter((part) => looksLikeEvent(part));
  const pool = eventLike.length > 0 ? eventLike : substantial;
  if (pool.length > 0) {
    return pool.reduce((best, part) => (part.length > best.length ? part : best));
  }

  return segments[0] ?? title.trim();
}

export function webResultToRawEventItem(
  result: WebResult,
  now: number,
): RawEventItem | null {
  const title = result.title?.trim();
  const url = result.url?.trim();
  if (!title || !url) return null;
  if (isDeniedUrl(url)) return null;
  if (isEventIndexPage(title)) return null;
  if (isNewsArticleTitle(title)) return null;
  if (isPaperPageTitle(title)) return null;
  const text = `${title} ${result.snippet ?? ""}`;
  if (!looksLikeEvent(text)) return null;
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
    // Guard against past events that mention only a bare year ("held in 2019"):
    // if every year token in the text is in the past, treat it as finished.
    const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
    const currentYear = new Date(now).getUTCFullYear();
    if (years.length > 0 && years.every((y) => y < currentYear)) return null;
  }

  const isOnline = /\b(online|virtual|hybrid)\b/i.test(text);
  const name = eventNameFrom(title, result.snippet ?? "", url);
  return {
    id: `eventweb:${urlHashId(url)}`,
    source: "eventweb",
    name,
    type: classifyEventType(title, result.snippet ?? ""),
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

  const searches = query.queries.slice(0, EVENT_QUERY_BUDGET);
  if (searches.length === 0) return [];
  // Search providers bill per *search*, not per result, so asking each query
  // for a full page of results is free. The previous formula divided a fixed
  // cap across the query set, which meant every added query starved the
  // others — 18 queries yielded 4 results each. Measured: 4/query produced a
  // 65-item candidate pool where 10/query produces ~157, and the facet panel
  // is only as useful as the pool behind it.
  const perQuery = RESULTS_PER_SEARCH;

  const now = Date.now();
  const all: RawEventItem[] = [];
  // Run the daily allocation concurrently so the source's wall-clock timeout
  // cannot strand later, more specific queries.
  const resultSets = await Promise.all(
    searches.map((q) =>
      keys.tavily
        ? searchTavily(q, keys.tavily, perQuery)
        : searchBrave(q, keys.brave!, perQuery),
    ),
  );
  for (const results of resultSets) {
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
