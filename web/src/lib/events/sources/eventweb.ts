import type { EventType } from "@/types";
import type { EventSourceAdapter, EventsQuery, RawEventItem } from "../types";
import {
  DATE_TOKEN_PATTERN,
  DAY_PATTERN,
  looksLikeHostBrand,
  MONTH_PATTERN,
  urlHashId,
} from "@/lib/opportunities/shared";
import { US_STATE_CODES } from "@/lib/opportunities/structured-extract";
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
//
// B10-03 (round 10): `call\s+for\s+(?:papers|abstracts)|cfp` added —
// `ecs.confex.com`'s live repro, "Call for Papers", a real conference-
// platform page/section label standing in for the event's own name, in
// none of this list's phrases. `EVENT_SIGNAL_RE` below lists this exact
// phrase as one of its own POSITIVE event signals, which is what lets a
// page carrying it be recognised as an event page in the first place —
// the same signal that gets a page through the front door then wins the
// segment-selection tie-break over a plainer chrome segment. Not adding
// the sibling labels ("Program"/"Technical Program"/"Registration") B also
// named as plausible on the same class of platform — B had no live
// evidence any of them has actually fired, and this loop's own standing
// practice (Ruling 32/34b) is to land what is confirmed, not what merely
// seems likely; left for a future A to measure.
const GENERIC_PAGE_TITLE_RE =
  /^(?:meeting\s+summary|summary|home|homepage|welcome|index|about(?:\s+us)?|agenda|programme?|schedule|overview|main\s+page|news|events?|conferences?|call\s+for\s+(?:papers|abstracts)|cfp)(?:\s*&\s*[\w\s]{1,24}|\s+(?:and|or)\s+[\w\s]{1,24})?$/i;

/**
 * B8-06 (round 8): GENERIC_PAGE_TITLE_RE above only recognises ONE exact
 * generic phrase, optionally plus a connector-joined trailing phrase — it
 * has no form for two generic words concatenated directly with no
 * connector, which is exactly how a real page titled bare "Conference
 * Program" reads (A's own reconfirmed live example, round 6 and round 8
 * both). Checking this as "every space-separated word is itself one of the
 * same generic words" (rather than widening the regex into an unreadable
 * alternation) catches that shape without touching the single-phrase-plus-
 * connector form above. Requires 2+ words so this stays additive to, not a
 * replacement for, the exact single-word/single-phrase form
 * GENERIC_PAGE_TITLE_RE already owns.
 *
 * `program(?:me)?s?` deliberately does NOT reuse GENERIC_PAGE_TITLE_RE's own
 * `programme?` spelling verbatim: verified directly (before writing this)
 * that `programme?` matches only "programme"/"programm", never the American
 * "program" — and "Conference Program" (the actual live-confirmed repro) uses
 * the American spelling. Copying the existing pattern here would have shipped
 * a check that cannot catch its own named example. Not fixing this same gap
 * in GENERIC_PAGE_TITLE_RE itself — that form's own bare/connector shape is
 * not one of this round's three named shapes and has no live evidence behind
 * it; flagged in the round log for the next A instead of silently expanding
 * scope.
 */
const GENERIC_TITLE_WORD_RE =
  /^(?:meeting|summary|home|homepage|welcome|index|about|us|agenda|program(?:me)?s?|schedule|overview|main|page|news|events?|conferences?|sessions?|workshops?)$/i;

function isAllGenericWords(candidate: string): boolean {
  const words = candidate.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.every((word) => GENERIC_TITLE_WORD_RE.test(word));
}

function isGenericPageTitle(candidate: string): boolean {
  const trimmed = candidate.trim();
  return GENERIC_PAGE_TITLE_RE.test(trimmed) || isAllGenericWords(trimmed);
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

/**
 * B12-03 gap B (round 12): the news-article filter's VOCABULARY is not missing
 * anything — its INPUT is wrong. `adt.media` publishes an article about a
 * conference; the tell sits in the page's own `<h1>` ("What to expect at the
 * Automotive Battery Conference 2026") and in its URL path, while the search
 * provider hands Peer a title with no tell in it at all
 * ("Automotive Battery Conference 2026: key topics and speakers"). So the filter
 * gets a second input: the URL path, normalised to spaced words.
 *
 * ONLY THE ANCHORED HEADLINE FORMS ARE APPLIED TO THE PATH, never
 * `NEWS_TITLE_RE` whole. B tested the whole regex on a path and it over-reaches
 * badly: its final alternative `\b(?:news|press release|blog post|newsletter)\b`
 * is unanchored, so it matches `news/call-for-abstracts` — which is
 * `battery2030.eu`'s own URL, the OTHER host on this very item. A page living
 * under `/news/` on an organiser's own site is routinely a real event
 * announcement; a path that BEGINS with a listicle headline never is.
 *
 * When this fires the result is dropped entirely (`webResultToRawEventItem`
 * returns null) — one fewer card, not a different name, which is correct: there
 * is no name on that page that would be right, because it is not the
 * conference's own page.
 */
const NEWS_HEADLINE_PATH_RE =
  /^(?:the\s+year\s+ahead|year\s+in\s+review|(?:top|best)\s+\d+\b|what\s+to\s+(?:expect|watch)|a\s+look\s+(?:back|ahead)|recap|highlights\s+from|report\s+from|announcing\b)/i;

/** The URL's path as spaced lowercase words, so a slug reads as a headline. */
function urlPathPhrase(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  const phrase = path.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(" ");
  return phrase || undefined;
}

/**
 * `url` is optional so every existing one-argument caller keeps working
 * unchanged — the path check simply does not run without it.
 */
export function isNewsArticleTitle(title: string, url?: string): boolean {
  if (NEWS_TITLE_RE.test(title.trim())) return true;
  const phrase = urlPathPhrase(url);
  return phrase !== undefined && NEWS_HEADLINE_PATH_RE.test(phrase);
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
/**
 * B8-06 (round 8): a served document's own filename with its extension
 * ("AA ECC10 POSTERS 08072026.xlsx") is neither a page label, an index, nor
 * a brand — it's a raw filename that happened to be the page's own <title>.
 * Traced which function this actually passes through before writing
 * anything: nameFromUrlSlug (below) already strips a trailing extension
 * before it can return one, so a segment still carrying its extension did
 * NOT come from the URL-slug fallback — it reaches here, straight from
 * bestEventTitleSegment's own title-segment split. Narrow and high-
 * confidence: a real event name essentially never ends this way.
 */
const DOCUMENT_FILENAME_RE = /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip)$/i;

/**
 * B11-03 (round 11): scraped widget/markup chrome — a class B11-01's
 * enumeration named that NO guard on either candidate path had ever
 * targeted, and the one that produced two of round 11's three confirmed
 * wrong event names. Distinct from every check above it: these strings are
 * not a page label, not an index, not a date, not a location, and not
 * narration either — B11-01 confirmed by execution that both live repros
 * pass `looksLikeEventTitle` unchanged, so B11-02's guard alone cannot
 * reach them. What they are is raw page furniture that survived text
 * extraction and got stitched into what reads as one 20-120-character
 * fragment.
 *
 * Both follow this file's own established convention (NARRATIVE_VERB_RE,
 * HEADLINE_PASSIVE_RE, PRESENT_NARRATIVE_RE): a narrow, closed regex per
 * confirmed shape, not a general markup parser.
 *
 * A media/document filename with its extension, optionally followed by a
 * query-string suffix, ANYWHERE in the segment. Deliberately not anchored
 * to the end the way DOCUMENT_FILENAME_RE above is — that check targets a
 * segment that IS a filename, whereas this shape is a filename STITCHED to
 * other scraped text (internationalbatteryseminar.com's live repro: an
 * image filename with a cache-busting query string, then a bracketed
 * ellipsis, then a carousel widget's own label). The trailing `\b` is
 * load-bearing: it keeps a real word that merely CONTAINS an extension's
 * letters after a period (".docs", ".zipper") from matching, since there is
 * no word boundary mid-word.
 */
const EMBEDDED_FILENAME_RE =
  /\.(?:jpe?g|png|gif|webp|svg|bmp|tiff?|pdf|docx?|xlsx?|pptx?|csv|zip)(?:\?[\w=&%-]*)?\b/i;

/**
 * B11-03 (round 11), second shape: raw Markdown syntax leaking through text
 * extraction — an ATX heading marker or a bracketed ellipsis, both artifacts
 * of the extraction step rather than anything a real event name contains.
 * thebatteryshowsouth.com's live repro carried both.
 *
 * The `{2,6}` hash floor is deliberate and was verified against a
 * constructed adversarial case before being written here, per Ruling 31: a
 * SINGLE `#` followed by a space is closer to plausible real-title
 * punctuation ("Session # 3: ...") than to markup, and this shape has
 * exactly one live confirmation to justify it on. `{1,6}` would have been
 * wider for no evidence. The must-not-reject test for that boundary is in
 * eventweb.test.ts and exists specifically so a future round cannot relax
 * the floor without a test telling it what it just gave up.
 */
const MARKDOWN_CHROME_RE = /#{2,6}\s|\[\s*\.\.\.\s*\]/;

/**
 * B9-04's bare-date guard (round 9): a segment that is ONLY a date —
 * "March 15-18, 2027" — clears every check above cleanly (none of them has
 * any concept of "this is only a date, not a name") and clears
 * looksLikeEventTitle too (no narrative verb, not multi-sentence, well
 * under the word ceiling), so nothing else in the chain rejects it either.
 * Confirmed live: internationalbatteryseminar.com rendered exactly this
 * string as an event's name.
 *
 * Reuses shared.ts's MONTH_PATTERN/DAY_PATTERN/DATE_TOKEN_PATTERN (moved
 * there this round specifically so this file could reuse them without a
 * circular import with event-details.ts, which already imports
 * looksLikeEventTitle FROM this file) rather than a new from-scratch date
 * parser. DATE_TOKEN_PATTERN alone does not cover the live repro — its
 * "Month Day[, Year]" alternative allows only a single day, not a range —
 * so this adds two more alternatives with a day range in the middle
 * ("15-18"), the same optional-range shape this file's own DATE_DMY_RE
 * already uses for the other date order (day before month).
 *
 * Anchored to the WHOLE trimmed segment on both ends: "SolarPACES 2026"
 * (an existing passing case that must not be affected) contains a bare
 * year but is not a date-shaped segment as a whole, so it does not match
 * here — this rejects a segment that IS a date, not one that merely
 * contains one.
 */
const BARE_DATE_SEGMENT_RE = new RegExp(
  `^(?:${DATE_TOKEN_PATTERN}` +
    `|${MONTH_PATTERN}\\.?\\s+${DAY_PATTERN}\\s*[-–]\\s*${DAY_PATTERN}(?:,?\\s+\\d{4})?` +
    `|${DAY_PATTERN}\\s*[-–]\\s*${DAY_PATTERN}\\s+${MONTH_PATTERN}\\.?(?:,?\\s+\\d{4})?)$`,
  "i",
);

function isBareDateSegment(candidate: string): boolean {
  return BARE_DATE_SEGMENT_RE.test(candidate.trim());
}

/**
 * B10-02 (round 10): a segment that IS only a US city/state location
 * ("Orlando, FL") reads as a perfectly fine "title" to every check above —
 * none has any concept of "this is only a location, not a name." Confirmed
 * live: internationalbatteryseminar.com rendered exactly this string once
 * B9-04's bare-date guard removed the sibling date segment that used to sit
 * next to it, leaving the location as the sole survivor — the event side's
 * own version of a gap `looksLikeBareLocation` already closed for the job
 * side (`jobweb.ts`), reusing the same `US_STATE_CODES` list so the two
 * cannot drift apart.
 *
 * Deliberately NOT a straight copy of the job side's check, which is
 * unanchored (it only requires the candidate to END in ", ST", with no
 * bound on what precedes it — safe there because a job-title split segment
 * carrying a location is already isolated to just the location in
 * practice). An event segment could legitimately be a longer, real title
 * that merely ENDS in a city/state — a live, already-correct example this
 * round is `10times.com`'s own "Solid-State Battery Summit (Aug 2026),
 * Chicago USA". Anchored to the WHOLE trimmed segment instead, mirroring
 * `isBareDateSegment`'s own `^...$` convention: "the segment IS a bare
 * location," not "the segment ENDS WITH one." Bounded to at most four
 * Title-Case-or-lowercase words before the comma so a long real title that
 * happens to end in a real city/state is not caught by accident.
 */
const BARE_LOCATION_SEGMENT_RE = new RegExp(
  `^[A-Za-z][\\w.'-]*(?:\\s+[A-Za-z][\\w.'-]*){0,3},\\s*(${US_STATE_CODES.join("|")})$`,
);

function isBareLocationSegment(candidate: string): boolean {
  const match = candidate.trim().match(BARE_LOCATION_SEGMENT_RE);
  return Boolean(match && match[1] === match[1].toUpperCase());
}

/**
 * B9-04 Fix 2 (round 9): additive and optional, same "thread an option
 * through, default preserves old behaviour" convention this file already
 * used for `host` itself (B8-04). `skipHostBrand` lets a caller ask "is this
 * chrome for any reason OTHER than matching the page's own host brand" —
 * built for `enrich.ts`'s typedName rescue, which legitimately needs to
 * un-reject a structured/typed event name for host-brand collisions only
 * (an organisation's own domain commonly IS its own name) while still
 * rejecting it for every other reason a segment can be chrome. Every
 * existing caller omits this and is unaffected.
 */
interface ChromeSegmentOptions {
  skipHostBrand?: boolean;
}

function isChromeSegment(
  segment: string,
  host: string | undefined,
  options?: ChromeSegmentOptions,
): boolean {
  const trimmed = segment.trim();
  if (
    isGenericPageTitle(trimmed) ||
    isEventIndexPage(trimmed) ||
    /^[\w\s.-]{0,24}\bevents?$/i.test(trimmed) ||
    DOCUMENT_FILENAME_RE.test(trimmed) ||
    EMBEDDED_FILENAME_RE.test(trimmed) ||
    MARKDOWN_CHROME_RE.test(trimmed) ||
    isBareDateSegment(trimmed) ||
    isBareLocationSegment(trimmed)
  ) {
    return true;
  }
  if (options?.skipHostBrand || !host) return false;
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

/**
 * B8-06 (round 8): a present-tense, active-voice sentence NAMING an event
 * ("Ruggiero Group Attends the 2026 Crystal Engineering GRC" — A's own
 * reconfirmed live example, round 6 and round 8 both) has no "to be"
 * auxiliary for NARRATIVE_VERB_RE to catch (it isn't a participle) and
 * matches none of HEADLINE_PASSIVE_RE's closed noun list — simple present
 * tense is a different grammatical shape from both existing checks. Same
 * "catch known shapes, not a general parser" practice as HEADLINE_PASSIVE_RE
 * itself: a small, closed verb list, not "any present-tense verb" (which
 * would risk rejecting a real terse name that happens to contain a common
 * verb-shaped word). Anchored to the START of the segment — a leading
 * subject phrase (1-5 words) immediately followed by one of the verbs — so
 * a long real title that merely contains one of these words well after its
 * own subject is not caught by accident. Verified directly against both the
 * confirmed repro and this file's own existing "must not over-reject"
 * precedents before being written here (see eventweb.test.ts's
 * "present-tense narrative sentence (B8-06)" block).
 *
 * B10-04 (round 10): the subject words were originally required to be
 * `[A-Z]`-led (Title-Case), built and tested against a real page `<h1>`/
 * `<title>`, which is normally Title-Cased. But `nameFromUrlSlug` — one of
 * `eventNameFrom`'s own fallback stages — capitalises only the FIRST
 * character of its entire output, so a slug-derived narrative sentence
 * ("Ruggiero group attends the 2026 crystal engineering GRC") stays
 * lowercase from the second word on. The identical sentence was correctly
 * rejected Title-Cased and wrongly accepted sentence-cased, confirmed live,
 * 2 of 2 pulls, character-for-character. Fix is casing-only: the leading
 * subject words no longer require an uppercase letter (`\w` in place of
 * `[A-Z]`), and the verb alternation drops its manual `[Aa]`-style casing in
 * favour of the `i` flag doing the same job — `nameFromUrlSlug`'s own output
 * casing is untouched, only which casing reaches this check changes.
 */
const PRESENT_NARRATIVE_RE =
  /^\w[\w&.'-]*(?:\s+\w[\w&.'-]*){0,4}\s+(?:attends?|announces?|hosts?|presents?|joins?|visits?)\b/i;

const MULTI_SENTENCE_RE = /\w{3,}[.!?]\s+[A-Z][a-z]/;
const MAX_TITLE_WORDS = 20;

export function looksLikeEventTitle(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  if (NARRATIVE_VERB_RE.test(trimmed)) return false;
  if (HEADLINE_PASSIVE_RE.test(trimmed)) return false;
  if (PRESENT_NARRATIVE_RE.test(trimmed)) return false;
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

/**
 * B11-02 (round 11): extracted verbatim from `bestEventTitleSegment`'s own
 * inline block, unchanged in behaviour, because `eventNameFrom`'s snippet
 * stage now needs the identical value to run the identical guards. Two
 * copies of this derivation that must agree for the two stages to guard the
 * same way is exactly the drift this loop has been bitten by before; one
 * function cannot drift from itself. `eventNameFrom`'s final URL-host
 * fallback deliberately does NOT use this helper — it must return an empty
 * hostname verbatim where this helper's callers want a falsy "no host,
 * don't run the brand checks" instead.
 */
function hostFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * B12-02 (round 12, §1w Ruling 36's pre-set third strike + §1y Ruling 38's
 * binding addition): `ruggedthz.com` publishes one blog post per event
 * attended, and every such title has the same STRUCTURE —
 * `<narrative sentence naming the event> – <the lab's own brand>`. The brand
 * half always survives the guards (it is a perfectly well-formed organisation
 * name); the naming half is always rejected by PRESENT_NARRATIVE_RE. **The
 * name the reader wants only ever exists inside the rejected half**, which is
 * why widening the host-brand check cannot fix this host even in principle,
 * and why Ruling 36's recorded design lead (recover from the rejected sibling)
 * is the only route.
 *
 * Nothing here is parsed from scratch and no new fallback is created (Ruling
 * 35): the verb is located by the guard that already rejected the segment, the
 * remainder is re-admitted only by the SAME shipped guard pair, and every step
 * is a veto — when any of them fails the function returns undefined and the
 * existing chain continues byte-identically.
 *
 * Corroboration by the page's own URL slug (step 5) and the stand-down when a
 * surviving sibling is corroborated instead (step 6) are the two steps that
 * make this safe. B's first version had neither and was killed by its own
 * counterexample — `"SolarPACES Announces the 2026 Call Deadline – SolarPACES
 * 2026"`, where the correct answer IS the sibling and a naive recovery
 * replaces a real name with a label. Both steps have their own must-survive
 * tests; see the B12-02 block in eventweb.test.ts.
 *
 * Ruling 37's open-class trap was checked deliberately: step 4's two tests are
 * a 4-digit year and this file's existing `looksLikeEvent` vocabulary of event
 * NOUNS. Both are genuinely finite. No verb list is extended here.
 */
const NARRATIVE_DETERMINER_RE = /^(?:the|an?|its|our|their|his|her)\s+/i;

/**
 * The page's own URL path as a set of whole lowercase alphanumeric words.
 * `undefined` when there is no URL (or it is malformed) — which is what makes
 * the recovery impossible to fire on a caller that passes no URL, and is why
 * `eventweb.test.ts`'s existing no-URL Ruggiero assertion is untouched.
 */
function urlPathWords(url: string | undefined): Set<string> | undefined {
  if (!url) return undefined;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  const words = path.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.length > 0 ? new Set(words) : undefined;
}

/** Every alphanumeric word of the candidate appears as a whole word in the path. */
function isSlugCorroborated(
  candidate: string,
  pathWords: Set<string> | undefined,
): boolean {
  if (!pathWords) return false;
  const words = candidate.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((word) => pathWords.has(word));
}

/**
 * Steps 1-5 of B12-02. Step 6 (the surviving-sibling stand-down) lives in
 * `bestEventTitleSegment`, because that is the only place siblings exist.
 *
 * IMPLEMENTATION NOTE, flagged by B because B hit it: the re-guard on line
 * "guard pair" below must call `isChromeSegment` + `looksLikeEventTitle`
 * DIRECTLY. Calling `bestEventTitleSegment` from here would be infinite
 * recursion, since `bestEventTitleSegment` is this function's own caller.
 */
function recoverFromNarrative(
  segment: string,
  host: string | undefined,
  pathWords: Set<string> | undefined,
): string | undefined {
  if (!pathWords) return undefined;
  const trimmed = segment.trim();
  // 1. Locate the verb with the guard that already found it — the text AFTER
  //    PRESENT_NARRATIVE_RE's own match, nothing parsed from scratch.
  const match = PRESENT_NARRATIVE_RE.exec(trimmed);
  if (!match) return undefined;
  // 2. Strip one leading determiner. It belongs HERE and nowhere else: in this
  //    shape the article is demonstrably a sentence artefact ("Attends THE 2026
  //    Crystal Engineering GRC"), which is not true of a title segment in
  //    general — see B12-01, which deliberately does not strip one.
  const rest = trimmed
    .slice(match[0].length)
    .trim()
    .replace(NARRATIVE_DETERMINER_RE, "")
    .trim();
  if (!rest) return undefined;
  // 3. Re-run the shipped guard pair on the remainder.
  if (isChromeSegment(rest, host) || !looksLikeEventTitle(rest)) return undefined;
  // 4. The remainder must actually look like an event's name, by one of two
  //    closed tests. Blocks "Its Annual Review" and "Berlin And Munich".
  if (!YEAR_RE.test(rest) && !looksLikeEvent(rest)) return undefined;
  // 5. The page's own URL slug must corroborate it.
  if (!isSlugCorroborated(rest, pathWords)) return undefined;
  return rest;
}

/**
 * B12-03 gap A (round 12): the welded page-type label. Every guard in this file
 * only ever operates on a segment the SPLITTER already produced, and the
 * splitter needs a separator surrounded by whitespace
 * (`/\s+[-|·–—]\s+/`). So `"Call for papers - Battery Conference 2027"` splits,
 * the label half is caught by `GENERIC_PAGE_TITLE_RE`, and the real name
 * survives — while `"Call for Abstracts for the Battery 2030+ Annual Conference
 * 2026"` and `"Advanced Battery Power Conference 2026 Call for Papers"` are ONE
 * segment each, are not generic (not every word is a generic word) and are not
 * narration, so they pass every guard and reach the reader with the label welded
 * on. Same defect, two hosts, one cause; established by execution in B12-03.
 *
 * This is the job side's own precedent reused, not a new invention:
 * `stripTrailingCareersChrome` (`jobs/sources/jobweb.ts`, B9-02a) strips a short
 * closed chrome word off an otherwise-accepted candidate in exactly this shape.
 *
 * `\s+for\s+(?:the\s+)?` on the FRONT form is LOAD-BEARING and B found it only by
 * running the design against the existing suite. Without it the front form also
 * eats `"Call for Papers now open for the 2026 Battery Symposium"` down to
 * `"now open for the 2026 Battery Symposium"`, breaking the must-survive
 * assertion B10-03 already put in `eventweb.test.ts`. Requiring the label to be
 * IMMEDIATELY followed by `for (the)` separates the live defect ("Call for
 * Abstracts FOR THE Battery 2030+…") from the protected string ("Call for
 * Papers NOW OPEN…").
 *
 * Every check is a veto and the fallback is "do not modify" — this edits an
 * accepted candidate rather than adding or removing one, so no rejected value
 * can be introduced anywhere (Ruling 32's mandatory question).
 */
const WELDED_LABEL =
  "(?:call\\s+for\\s+(?:papers|abstracts)|cfp|registration|programme|program|agenda|schedule)";
const WELDED_LABEL_FRONT_RE = new RegExp(`^${WELDED_LABEL}\\s+for\\s+(?:the\\s+)?`, "i");
const WELDED_LABEL_BACK_RE = new RegExp(`[\\s:–—-]+${WELDED_LABEL}$`, "i");

/**
 * The remainder must still NAME an event, by a closed list of event-kind nouns.
 *
 * KNOWN LIMITATION, recorded rather than fixed here: this list is single-word,
 * while this codebase's own event-kind enumerations (`EVENT_SIGNAL_RE` above,
 * `eventKindIn` in `events/mapper.ts`) also carry MULTI-WORD kinds —
 * `round table`, `hack day`, `lecture series`, `networking event`. A title whose
 * kind is named in two words therefore fails this test and is simply NOT
 * stripped. That direction is safe: the fallback is "leave the segment alone",
 * so the cost is a missed fix, never a wrong value. It is NOT safe in B12-01,
 * which uses the same list as a hard veto on whether a name exists at all —
 * which is why B12-01 is stopped and recorded rather than landed. Whoever
 * resolves that should reconcile both uses in one place.
 */
const EVENT_KIND_NOUN_RE =
  /\b(?:conference|symposium|workshop|seminar|colloquium|congress|meeting|summit|expo|exposition|exhibition|forum|convention|show|school|hackathon|roundtable|fair)\b/i;

/** B12-03 gap A. Returns the segment with a welded label removed, or unchanged. */
function stripWeldedPageTypeLabel(segment: string): string {
  for (const pattern of [WELDED_LABEL_FRONT_RE, WELDED_LABEL_BACK_RE]) {
    if (!pattern.test(segment)) continue;
    const remainder = segment.replace(pattern, "").trim();
    if (!remainder) continue;
    if (!EVENT_KIND_NOUN_RE.test(remainder)) continue;
    if (!looksLikeEventTitle(remainder)) continue;
    return remainder;
  }
  return segment;
}

export function bestEventTitleSegment(
  title: string,
  url?: string,
  options?: ChromeSegmentOptions,
): string | undefined {
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
  const host = hostFromUrl(url);

  const informative = segments.filter(
    (part) => !isChromeSegment(part, host, options) && looksLikeEventTitle(part),
  );

  // B12-02, attachment point 1 of 2 (ruggedthz.com failure mode 1: the
  // provider returns the real page <title>). Step 6 — the recovery runs ONLY
  // when no surviving sibling is itself corroborated by the same slug. When
  // one is, that sibling IS the event ("SolarPACES 2026" on a
  // /solarpaces-announces-… path) and the selection below runs untouched.
  const pathWords = urlPathWords(url);
  if (pathWords && !informative.some((part) => isSlugCorroborated(part, pathWords))) {
    for (const part of segments) {
      const recovered = recoverFromNarrative(part, host, pathWords);
      if (recovered) return recovered;
    }
  }

  if (informative.length > 0) {
    // Prefer a segment that actually reads as an event, else the longest one:
    // site chrome is normally shorter than the event name.
    const eventLike = informative.filter((part) => looksLikeEvent(part));
    const pool = eventLike.length > 0 ? eventLike : informative;
    // B12-03 gap A: strip a welded page-type label off the CHOSEN segment.
    // Deliberately last, after selection: the label is part of why a segment
    // wins the longest-wins tie-break, so stripping earlier would change which
    // segment is picked, which is not what this fix is for.
    return stripWeldedPageTypeLabel(
      pool.reduce((best, part) => (part.length > best.length ? part : best)),
    );
  }

  return undefined;
}

export function eventNameFrom(
  title: string,
  snippet: string,
  url?: string,
): string {
  const titleSegment = bestEventTitleSegment(title, url);
  if (titleSegment) return titleSegment;

  // Every title segment is chrome. A deep event URL's slug is the most
  // reliable remaining source of the actual event name — try it before the
  // snippet, whose longest sentence is often prose ("Networking: An opening
  // get-together...") rather than a name.
  const fromSlug = url ? nameFromUrlSlug(url) : undefined;
  if (fromSlug) {
    if (bestEventTitleSegment(fromSlug, url) === fromSlug) {
      return fromSlug;
    }
    // B12-02, attachment point 2 of 2 (ruggedthz.com failure mode 2, which A
    // caught on its fifth pull: the SAME page, but the provider returned a
    // chrome-only title that minute, so the title stage yields nothing and the
    // slug re-guard correctly rejects the slug's own narrative sentence —
    // B10-04's casing fix working as designed). Without this the snippet stage
    // below supplies a mid-sentence prose fragment. One host, two confirmed
    // failure modes, so one design has to attach at two points.
    //
    // There are no siblings here, so step 6 is vacuous by construction.
    // Capitalisation follows `nameFromUrlSlug`'s own documented convention
    // (first character only) because the recovery returns a substring of that
    // function's output; cosmetic, not load-bearing.
    const recovered = recoverFromNarrative(
      fromSlug,
      hostFromUrl(url),
      urlPathWords(url),
    );
    if (recovered) {
      return recovered.charAt(0).toLocaleUpperCase() + recovered.slice(1);
    }
  }

  // Otherwise mine the snippet for its most informative event-like phrase.
  //
  // B11-02 (round 11, Rulings 32/35): this stage used to filter candidates
  // with `looksLikeEvent` ALONE — a topicality check (does this text mention
  // a conference/keynote/symposium at all?) already used upstream to decide
  // whether a web result is about an event, with no concept of sentence
  // shape, narration, or scraped markup. It is not a name-quality check and
  // was never meant to be one. The title-segment stage above has had every
  // guard this loop built since round 4 (`isChromeSegment` +
  // `looksLikeEventTitle`); this stage had none of them, so a full narrative
  // sentence containing one topic keyword sailed through here after being
  // correctly rejected one stage earlier. Live-confirmed on ecs.confex.com,
  // which rendered "Invited speakers present keynote lectures." as an event
  // name: `looksLikeEvent` passes it ("keynote"), `looksLikeEventTitle`
  // rejects it, and only the first check ran. Reuse of the existing pair,
  // not a new parallel check — B11-01's enumeration confirmed the URL-slug
  // stage above is already re-guarded by this same pair, so this makes the
  // snippet stage the last one to get them rather than inventing anything.
  //
  // Applying them to `nameLike` FIRST, ahead of the `looksLikeEvent`
  // preference tier, also closes B11-01's enumeration shape 4 for free: the
  // `eventLike.length > 0 ? ... : ...` ternary now falls back to the
  // hard-filtered `nameLike`, never to raw `substantial`, so a snippet in
  // which nothing scores as event-like can no longer discard the guard's
  // verdict wholesale and hand back its longest unfiltered fragment. When
  // every candidate is rejected, execution falls through to the honest URL-
  // host last resort below (B9-04 Fix 1), which already exists — per Ruling
  // 35, no new fallback needed designing.
  const host = hostFromUrl(url);
  const substantial = snippet
    .split(/(?<=[.!?])\s+|\s+[|·–—]\s+|\n/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20 && part.length <= 120);
  const nameLike = substantial.filter(
    (part) => !isChromeSegment(part, host) && looksLikeEventTitle(part),
  );
  const eventLike = nameLike.filter((part) => looksLikeEvent(part));
  const pool = eventLike.length > 0 ? eventLike : nameLike;
  if (pool.length > 0) {
    return pool.reduce((best, part) => (part.length > best.length ? part : best));
  }

  // B9-04 Fix 1 (round 9, Ruling 32): every title segment was already
  // rejected by bestEventTitleSegment above -- that rejection is the only
  // way execution reaches this line -- so re-splitting the title and
  // returning segments[0] here would hand back one of those exact rejected
  // strings, verbatim (confirmed live: "Conference Program" in, "Conference
  // Program" out). The URL host is never itself a value a guard rejected,
  // and mirrors this codebase's own honest-placeholder precedent on the job
  // side ("See posting", jobs/mapper.ts). Falls back to a literal
  // placeholder only when there is no URL to read a host from at all.
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      // Malformed url - fall through to the placeholder below.
    }
  }
  return "Untitled event";
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
  // B12-03 gap B: the URL is now a second input — see isNewsArticleTitle.
  if (isNewsArticleTitle(title, url)) return null;
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
