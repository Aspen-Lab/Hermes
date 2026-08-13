import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";
import { looksLikeHostBrand, urlHashId } from "@/lib/opportunities/shared";
import {
  JOB_QUERY_BUDGET,
  RESULTS_PER_SEARCH,
} from "@/lib/opportunities/query-budget";
import {
  cleanJobDescription,
  cleanJobSubtitlePart,
  cleanJobTitle,
} from "@/lib/opportunities/job-cleanup";
import { US_STATE_CODES } from "@/lib/opportunities/structured-extract";

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

/**
 * Search-results and category pages on job aggregators. These match every
 * job-shaped heuristic (job-ish URL, hiring language, a role in the title) but
 * are not postings — you cannot apply to "60 Molten Salt Jobs". They are the
 * jobs-side equivalent of the social-media noise the events adapter denies.
 */
export const LISTING_TITLE_RE =
  /(?:^|\s)\d{1,5}[+]?\s+[\w\s,&/-]{0,40}\b(?:jobs?|vacancies|openings?|positions?|opportunities)\b|\bjobs?,\s*employment\b|\b(?:jobs?|vacancies|openings?|positions?)\s+(?:in|near|at|for)\b.*\|\s*[\w.-]+\.\w+\s*$|\b(?:browse|search|find|latest|top|best)\s+[\w\s]{0,20}\b(?:jobs?|vacancies|openings?)\b/i;

/** Query-string or path shapes that mean "this is a search result listing". */
export const LISTING_URL_RE =
  /\/(?:job-search|jobsearch|search|browse|listings?|q-[\w-]*jobs?)(?:\/|$|\.)|[?&](?:q|query|keywords?|search|k)=/i;

/** Aggregators whose deep links are fine but whose listing pages are noise. */
const AGGREGATOR_HOSTS = [
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "simplyhired.com",
  "monster.com",
  "careerjet.com",
  "jooble.org",
  "neuvoo.com",
  "talent.com",
];

/**
 * Titles that name a careers section rather than a role. An employer's
 * "/careers" index passes every job-shaped heuristic but is not something the
 * user can apply to.
 */
export const CAREERS_INDEX_TITLE_RE =
  /^\s*(?:careers?|jobs?|vacancies|open(?:ings?)?|open positions?|current openings?|job openings?|work (?:with|for) us|join (?:us|our team)|employment|opportunities)\s*$/i;

/** A posting URL almost always carries a numeric or long opaque identifier. */
const POSTING_ID_RE = /\d{4,}|[?&](?:jk|jobId|gh_jid|id)=/i;

/**
 * A title segment that names only an internship cohort or season, not a
 * company — "Battery R&D Intern - Summer 2027 - Acme Corp" split on its own
 * separators leaves "Summer 2027" as a candidate segment, and nothing
 * checked whether a segment actually reads like a company before accepting
 * it. `KNOWN_JOB_BOARD_DOMAINS` only screens out a specific denylist of job
 * board hostnames, which a season label obviously never matches, so it
 * passed straight through (R7).
 */
const SEASON_COHORT_LABEL_RE =
  /^(?:spring|summer|fall|autumn|winter)\s+20\d{2}$|^class\s+of\s+20\d{2}$|^cohort\s+\d+$|^20\d{2}$/i;

/**
 * A trailing-state-code build regex, matching the whole candidate segment
 * against real, uppercase US state codes (case matters — see
 * `structured-extract.ts`'s `hasTrailingStateCode`, which this mirrors).
 * `US_STATE_CODES` is imported, not re-declared, so the two lists cannot
 * drift apart.
 */
const TRAILING_STATE_CODE_RE = new RegExp(`,\\s*(${US_STATE_CODES.join("|")})$`);

/**
 * A title segment shaped like a bare US address ("Cambridge, MA") is a
 * location, not a company (B5-03/R7) — the same structural signal
 * `hasTrailingStateCode()` in structured-extract.ts already uses to keep a
 * bare address out of the event WHERE tile (B4-02/R2), applied here to keep
 * one out of the job company slot instead.
 */
function looksLikeBareLocation(candidate: string): boolean {
  const match = candidate.match(TRAILING_STATE_CODE_RE);
  return Boolean(match && match[1] === match[1].toUpperCase());
}

/**
 * A trailing chrome word left on an otherwise-real employer candidate that
 * has already cleared every guard below (B9-02a/R13) — "Idaho National
 * Laboratory Careers" names the real employer with a careers-page suffix
 * still attached, not a different kind of string.
 * `CAREERS_INDEX_TITLE_RE` above already rejects a *bare* title drawn from
 * this same vocabulary; this strips the identical short, closed word list
 * when it trails a longer, otherwise-accepted candidate, instead of
 * duplicating a new list. Deliberately narrow, matching this file's own
 * "catch known shapes, not a general parser" convention: a rule that
 * stripped any trailing capitalised word would eat a real org name that
 * legitimately ends in an ordinary word ("Board of Regents"). The leading
 * `\s+` also means a candidate that IS only this word, with nothing before
 * it to strip, is left untouched here — it is the guards above's business,
 * not this one's.
 */
const TRAILING_CAREERS_CHROME_RE =
  /\s+(?:careers?|jobs?|employment|job\s+openings?)$/i;

function stripTrailingCareersChrome(
  candidate: string | undefined,
): string | undefined {
  if (!candidate) return candidate;
  const stripped = candidate.replace(TRAILING_CAREERS_CHROME_RE, "").trim();
  return stripped || candidate;
}

/**
 * True when the result is an aggregate listing or a careers index rather than
 * a single posting.
 *
 * Title shape is authoritative ("60 Molten Salt Jobs, Employment ...",
 * "CAREERS"). On known aggregator hosts we additionally require a posting
 * identifier in the URL, because their category pages
 * ("/Jobs/Battery-Research-Scientist/-in-San-Jose,CA") are indistinguishable
 * from postings by path shape alone. Employer sites are left alone so a real
 * posting at `/careers/internship-battery-research` still gets through.
 */
export function isListingPage(
  title: string,
  host: string,
  pathAndQuery: string,
): boolean {
  if (LISTING_TITLE_RE.test(title)) return true;
  if (CAREERS_INDEX_TITLE_RE.test(title)) return true;

  const isAggregator = AGGREGATOR_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (!isAggregator) return false;
  if (LISTING_URL_RE.test(pathAndQuery)) return true;
  return !POSTING_ID_RE.test(pathAndQuery);
}
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
  const title = cleanJobTitle(result.title);
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
  if (isListingPage(title, host, `${parsed.pathname}${parsed.search}`)) return null;

  // Split "Postdoc in X - University of Y | board.com" style titles.
  const parts = title.split(/\s+[-–—|·]\s+/);
  const roleTitle = parts[0]?.trim() || title;
  // The check above saw the full title; the card shows only this first
  // segment. "CAREER | Acme Corp" clears a whole-title test and then renders
  // as the bare word "CAREER", so the segment needs the same test.
  if (isListingPage(roleTitle, host, `${parsed.pathname}${parsed.search}`)) {
    return null;
  }
  // B6-04 (round 6): a result title can state the employer as "Role at
  // Employer" without any punctuation segment. Keep it in the existing
  // guarded candidate pool so it cannot bypass the board/location checks.
  // B8-01 (round 8): the character class had no space, so this could only
  // ever match a one-word employer ("at Tesla") and silently matched
  // nothing for the far more common multi-word case ("at Idaho National
  // Laboratory"), falling through to the older, unguarded parts.slice(1)
  // path below.
  //
  // The naive fix (just add a space to the character class) was tried and
  // rejected: with any char + space allowed, an unpunctuated title like
  // "... at Bell Labs remote position with great benefits" wrongly captured
  // the whole trailing clause as the employer, turning a silent absence
  // into wrong data - exactly the failure this loop treats as worse than
  // missing. Instead, the capture is a run of Title-Case words (each
  // starting with an uppercase letter, matching this file's own "catch
  // known shapes" style used by KNOWN_JOB_BOARD_DOMAINS et al.) optionally
  // joined by a small closed list of lowercase connectors real org names
  // use ("University of California", "Johnson & Johnson"). Ordinary lower-
  // case prose is not in that grammar, so it cannot be swallowed: the
  // repetition simply stops, and if what follows is not a separator or the
  // end of the string, the whole match fails and titleEmployer is
  // correctly undefined rather than a guess.
  const titleEmployer = title.match(
    /\bat\s+([A-Z][\w&.,'\u2019]*(?:\s+(?:[A-Z][\w&.,'\u2019]*|of\b|and\b|for\b|the\b|&))*)\s*(?:[-\u2013\u2014|\u00b7(]|$)/,
  )?.[1];
  const company = stripTrailingCareersChrome(
    [titleEmployer, ...parts.slice(1)]
      .map(cleanJobSubtitlePart)
      .find(
        (p) =>
          p &&
          !KNOWN_JOB_BOARD_DOMAINS.some((d) => p.toLowerCase().includes(d)) &&
          !SEASON_COHORT_LABEL_RE.test(p) &&
          !looksLikeBareLocation(p) &&
          !looksLikeHostBrand(p, host),
      ),
  );
  return {
    id: `jobweb:${urlHashId(url)}`,
    source: "jobweb",
    title: roleTitle,
    company,
    location: "",
    isRemote: /\bremote\b/i.test(text),
    description: cleanJobDescription(result.snippet),
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

  const searches = query.queries.slice(0, JOB_QUERY_BUDGET);
  if (searches.length === 0) return [];
  // Providers bill per search, not per result — see RESULTS_PER_SEARCH.
  const perQuery = RESULTS_PER_SEARCH;

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
