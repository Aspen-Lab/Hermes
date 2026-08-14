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
 *
 * B13-02 part 1 (round 13): the leading count could not read a thousands
 * separator, so `1,000+ Molten Salt jobs in United States` (live, linkedin.com)
 * sailed through while the identical `1000+ …` was caught. Only this first
 * alternative's number changed; every other alternative is byte-identical.
 *
 * THE ALTERNATION SHAPE IS LOAD-BEARING — DO NOT "TIDY" IT INTO
 * `\d{1,3}(?:,\d{3})*`. B measured that tidier form and it silently LOSES two
 * shapes the pre-B13-02 regex already caught (`1000+ …`, `12345 vacancies`),
 * because with the comma group optional `\d{1,3}` can never consume a 4- or
 * 5-digit run. Shipped 6/9, the tidy draft 7/9 with two NEW misses, this form
 * 9/9 with zero false fires. The regression cases are asserted below.
 */
export const LISTING_TITLE_RE =
  /(?:^|\s)(?:\d{1,3}(?:,\d{3})+|\d{1,5})[+]?\s+[\w\s,&/-]{0,40}\b(?:jobs?|vacancies|openings?|positions?|opportunities)\b|\bjobs?,\s*employment\b|\b(?:jobs?|vacancies|openings?|positions?)\s+(?:in|near|at|for)\b.*\|\s*[\w.-]+\.\w+\s*$|\b(?:browse|search|find|latest|top|best)\s+[\w\s]{0,20}\b(?:jobs?|vacancies|openings?)\b/i;

/** Query-string or path shapes that mean "this is a search result listing". */
export const LISTING_URL_RE =
  /\/(?:job-search|jobsearch|search|browse|listings?|q-[\w-]*jobs?)(?:\/|$|\.)|[?&](?:q|query|keywords?|search|k)=/i;

/**
 * B13-02 part 2 (round 13): a syndication endpoint is a list of many items by
 * definition, never one posting. `lco-cdo.org/en/author/lco_admin/feed/` — an
 * author RSS feed — was ingested as a job and rendered the bare host slug
 * `lco-cdo` as its role title; `isListingPage` had no concept of a feed at all,
 * and the item did not even arrive through `JOB_PATH_RE` (it entered on
 * `JOB_TEXT_RE` matching "vacancies" in its text).
 *
 * Closed by construction, which is Ruling 37's bar: this enumerates the
 * standardised RSS/Atom endpoint conventions — a finite set fixed by the
 * syndication specs and by what CMSs emit — not a grammatical class English
 * keeps extending. Nothing about a real posting URL is drawn from that
 * vocabulary.
 *
 * THE WHOLE-SEGMENT ANCHORING IS LOAD-BEARING, and the four hardest
 * counterexamples are why: `/jobs/feedstock-process-engineer`,
 * `/careers/rss-platform-engineer`, `/jobs/atomic-layer-deposition-scientist`
 * and `/jobs/feeder-line-technician` are real-shaped posting slugs carrying a
 * feed token as a substring. All four are untouched, and all four are asserted
 * below. Same anchoring discipline `NAV_CHROME_SEGMENT_RE` uses.
 *
 * Failure direction: an unlisted feed convention survives — the status quo,
 * never a wrong value.
 */
const FEED_PATH_RE =
  /(?:^|\/)(?:feed|rss|atom)(?:\/|$)|\.(?:rss|atom|xml)$|[?&]feed=/i;

/**
 * B14-01 (round 14, Ruling 43): a FORUM THREAD is a discussion, not a posting.
 * `openmc.discourse.group/t/job-vacancies-looking-for-openmc-skills/1727?page=2`
 * rendered the forum CATEGORY (`Announcements`, and in another round `Users`) in
 * the employer slot, unanimously across all five of round 14 A's pulls.
 *
 * **THIS IS A PAGE-KIND RULE, NOT A STRING RULE, AND THAT IS THE WHOLE POINT.**
 * The three wrong-or-empty employer values recorded for this host are three
 * TITLES of ONE page. A string-side guard has to beat each separately; this
 * beats all of them at once because `isListingPage` is consulted BEFORE the
 * employer chain ever runs — the wrong value cannot be derived from an item that
 * never exists. B verified by execution that ALL FIVE recorded title shapes drop
 * from this one URL rule (paginated `Announcements`, page-1 `Announcements`,
 * `Users`, the `|`-separated r12 variant, and the no-category variant), which is
 * how Ruling 43's "both observed shapes, not one string" is satisfied. A sixth
 * title shape appearing tomorrow drops too. **The rule never reads the title.**
 *
 * Closed by construction, the same bar `FEED_PATH_RE` cleared: it enumerates
 * FORUM SOFTWARE'S OWN ROUTING CONVENTIONS — fixed by the software that emits
 * them, not by English — so it is not Ruling 37's open-class trap.
 *  1. Discourse: `/t/[<slug>/]<topic-id>[/<post-no>]` (the live shape).
 *  2. phpBB / vBulletin: the literal script filenames. A filename is as closed
 *     as a vocabulary gets.
 *  3. XenForo: `/threads/<slug>.<thread-id>` — the `.` + id suffix is XenForo's
 *     own and is REQUIRED, rather than matching the bare word `threads`.
 *
 * EVERY ALTERNATIVE IS WHOLE-SEGMENT ANCHORED AND EVERY ALTERNATIVE REQUIRES A
 * CONFIRMING STRUCTURAL TOKEN — a numeric id or a literal script filename. None
 * fires on a word alone. The naive token-only form (`/t/`, `/topic/`, `/thread/`,
 * `/forum/` …) was measured at 46/58 with EIGHT FALSE FIRES; do not simplify to
 * it. `/jobs/threading-machine-operator`, `/careers/discourse-analysis-researcher`,
 * `/t-shirt-designer/jobs/1234`, `/t/battery-research-scientist` (a `/t/` segment
 * with no id) and `/threads/hiring.today` (a dot with no id) are all real-shaped
 * posting URLs it would have destroyed. All are asserted below as must-keeps.
 *
 * TWO NARROWINGS B MEASURED AND C MUST NOT REVERSE:
 *  1. **NodeBB/Invision's `/topic/<id>` is DELIBERATELY ABSENT.** Adding it
 *     scores 58/58 instead of 57/58, and it is still wrong: its true-fire shape
 *     `/topic/8891-hiring-battery-postdocs/` and its false-fire shapes
 *     `/topic/12-month-battery-fellowship`, `/topic/2026-summer-internship` are
 *     both `/topic/<digits>-<slug>` and NO structural test separates them — a
 *     four-digit year is a four-digit id, so a digit floor does not help. The
 *     miss costs the status quo; the false fire destroys a real posting. Same
 *     arithmetic `LISTING_SECTION_TITLE_RE` used to exclude `for`. The miss is
 *     asserted below as a deliberate named miss so a later widening is a
 *     deliberate act rather than a drift.
 *  2. **Do NOT anchor the Discourse alternative to `^\/t\/`.** Measured at
 *     55/58: it stops catching subfolder Discourse installs
 *     (`/community/t/hiring-postdocs/8891`, a documented deployment shape) AND
 *     this suite's own idea of a forum thread URL.
 *
 * Ruling 39c's recorded preference was a HOST LIST, and this is neither a host
 * list nor phrase matching. 39c's own stated REASON for that preference —
 * avoiding an open class — endorses a URL-route rule; and a host list would not
 * have closed this item at all, because Discourse is a PLATFORM, not a site
 * (`discuss.example.org` and a subfolder install are the same defect on
 * different hosts, and both are caught here). Fixing one site is Ruling 32's
 * headline complaint. **The manager verified round 14 B and ENDORSED this
 * departure: the route rule is ruled the correct instrument. Do not "fix" it
 * back into a host list.**
 *
 * THE ASYMMETRY THAT SHAPED EVERY NARROWING: this is the first drop this loop
 * has designed for a wrong VALUE rather than a wrong ITEM. A guard's false fire
 * leaves a field empty; a DROP's false fire destroys a whole real posting. That
 * is why a matrix point was given up rather than keep `/topic/<id>`.
 *
 * Accepted cost, stated rather than hidden: if a forum thread is ever the only
 * home of a real vacancy, this drops it. What such a thread renders TODAY is a
 * thread title in the role slot (`Job vacancies looking for OpenMC skills` — not
 * a role anyone can apply to) and a forum category in the employer slot. That is
 * wrong data, which Ruling 23 ranks ABOVE missing data.
 *
 * Failure direction when it does NOT fire: exactly today's behaviour — an
 * unlisted forum convention stays in the pool with whatever employer the chain
 * derives. Never a new wrong value.
 */
const FORUM_THREAD_URL_RE =
  /(?:^|\/)t\/(?:[\w%.~-]+\/)?\d+(?:\/\d+)?(?:\/|$|\?)|(?:^|\/)(?:viewtopic|showthread|viewforum|forumdisplay)\.php(?:$|[?&])|(?:^|\/)threads\/[\w%.~-]*?\.\d+(?:\/|$|\?)/i;

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

/**
 * B13-02 part 3 (round 13): a title that NAMES A SECTION rather than a role.
 * `Jobs at Battery Ventures Companies` and `Intern Jobs at Battery Ventures
 * Companies` (live, `jobs.battery.com`) are one board's listing views, not
 * postings. `LISTING_TITLE_RE` already knows the `jobs at …` shape but only
 * when the title also ends in a `| host.tld` tail — the tail is the gap. The
 * LEADING ANCHOR here is what makes the tail unnecessary: it is the difference
 * between this check and `LISTING_TITLE_RE`'s unanchored alternative.
 *
 * TWO NARROWINGS, EACH FORCED BY A COUNTEREXAMPLE B WROTE TO BREAK ITS OWN
 * FIRST DRAFT. C MUST NOT SIMPLIFY THEM BACK OUT:
 *  1. `for` is DELIBERATELY NOT in the preposition list. With it, the check
 *     false-fires on three plausible real role titles — `Jobs for Veterans
 *     Program Manager`, `Job for a Battery Engineer`, `Career for Life
 *     Coordinator`. Measured: 3 of 15 real postings destroyed with it, 0 of 15
 *     without, and no loss of catch (8/8 listings still fire). All three are
 *     asserted below as must-keeps.
 *  2. The section word must be PLURAL. Strictly narrower at no cost — same 8/8
 *     catch — and it removes the whole singular-role-title risk class.
 *
 * The deliberate trap `Jobs Data Analyst at the Bureau of Labor Statistics` — a
 * real posting whose role BEGINS with `Jobs` — does not fire, because the
 * preposition must follow the section word immediately. `Research positions at
 * CERN` does not fire either: `positions` is deliberately absent from the list,
 * since a real posting legitimately uses it.
 *
 * Ruling 39c's host-list preference was tested and is NOT what landed, for two
 * recorded reasons: Ruling 32's headline is "stop fixing it one site at a
 * time", and the host route's safety rests on an unmeasured assumption about
 * `jobs.battery.com`/`linkedin.com` posting-URL shapes. If a later round finds
 * a board listing view with no section-form title, the host list is the right
 * second tool — kept here as a tested lead so it is not re-derived.
 */
const LISTING_SECTION_TITLE_RE =
  /^\s*(?:[\w&/-]+\s+)?(?:jobs|vacancies|openings|careers)\s+(?:at|in|near|with)\b/i;

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
 * A whole-candidate sentence naming the HOSTING PLATFORM's own posting
 * boilerplate, not the employer (B10-01, items 1+2). `looksLikeHostBrand`
 * is deliberately one-directional — it only rejects a candidate no LONGER
 * than a DNS label of the host (`shared.ts`'s own doc comment) — so a long,
 * well-formed sentence like "Job posted on PostdocJobs.com" survives it
 * untouched, the same way a real, long employer name is designed to. No
 * real employer name is grammatically shaped like this: closed,
 * sentence-shape check, not a general parser, matching this file's own
 * "catch a known shape" convention used by `SEASON_COHORT_LABEL_RE` et al.
 */
const HOST_BOILERPLATE_PHRASE_RE =
  /^(?:job\s+posted\s+on|posted\s+by|listing\s+on|see\s+more\s+jobs\s+at)\s+\S/i;

function looksLikeHostBoilerplatePhrase(candidate: string): boolean {
  return HOST_BOILERPLATE_PHRASE_RE.test(candidate.trim());
}

/**
 * B12-06 (round 12): `openmc.discourse.group` rendered the employer as
 * `"Page 2"`. Round 12 A ranked it the worst single value of the round.
 *
 * **This is not "a missing pagination rule" — it is a missing FAMILY MEMBER.**
 * The event side has had a whole family of chrome checks since round 5
 * (`isGenericPageTitle`, `isAllGenericWords`, `isEventIndexPage`, the filename
 * and markup regexes, the bare-date and bare-location checks) whose shared job
 * is "this segment is site furniture, not a name" — its `GENERIC_TITLE_WORD_RE`
 * even lists `page` explicitly. The employer slot had **no member of that family
 * at all**: all six of its existing rejections ask "is this a known-bad KIND of
 * name", never "is this navigation". So Ruling 32's shape shows up here in its
 * plainest form — the slot is filled by whatever survives, and nothing was ever
 * asked to recognise furniture.
 *
 * The vocabulary of pagination and navigation controls is **genuinely closed**:
 * it is a finite set of UI affordances, not an open grammatical class, so this
 * is not §1x Ruling 37's trap. Same anchored, narrow, closed style as
 * `SEASON_COHORT_LABEL_RE` above.
 *
 * **The `^…$` whole-segment anchor is load-bearing** and the four hardest
 * must-survive cases are why: `Home Depot`, `Page Industries`, `First Solar` and
 * `Next Energy Technologies` are all real companies whose names BEGIN with a
 * rejected word. Same anchor `SEASON_COHORT_LABEL_RE` and
 * `CAREERS_INDEX_TITLE_RE` already use in this file.
 *
 * Ruling 32's question, answered from the render side: when every candidate is
 * rejected, `.find()` returns `undefined`, `company` is `undefined`, and the UI
 * **omits the employer line entirely**. No placeholder, nothing rejected
 * reinserted, and it is this field's own existing behaviour: round 12 A's census
 * already has six null employers rendering exactly that way.
 *
 * CORRECTION (B13-01, round 13): this comment originally named TWO render
 * sites. There are **FOUR**, and all four omit rather than substitute —
 * `cards/job-card.tsx:87` and `cards/feed-tile.tsx:535` guard on
 * `job.companyOrLab`; `cards/briefing-hero.tsx:133` and
 * `cards/briefing-quick-hit.tsx:49` build an array and
 * `.filter(Boolean).join(" · ")`, so the separator disappears with the value
 * and no dangling middle dot is left behind. Checked in the components, not
 * assumed. Anything added to the candidate veto chain below inherits this
 * same honest-omission behaviour on all four.
 */
const NAV_CHROME_SEGMENT_RE =
  /^(?:page\s+\d+(?:\s+of\s+\d+)?|\d+\s+of\s+\d+|next|previous|prev|first|last|next\s+page|previous\s+page|home|back)$/i;

function looksLikeNavChrome(candidate: string): boolean {
  return NAV_CHROME_SEGMENT_RE.test(candidate.trim());
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
 * A research-subject/field label rendered as if it were the employer
 * (B9-02b/c/R13) — "Molten Salt Chemical and Electrochemical Engineering"
 * (`postdocjobs.com`), "Molten Salt Characterization"
 * (`careerservices.upenn.edu`, unchanged across two rounds). Both live
 * examples clear every guard above cleanly, because none of them has any
 * concept of "reads as a field of study, not an organisation."
 *
 * Fix direction B recommended (of two offered, chosen as "the safer
 * starting point"): reuse the profile's own search topics — which is
 * exactly what put this posting in the pool in the first place — rather
 * than a structural "field phrasing" grammar B explicitly warned risks
 * becoming a general parser. Two narrow, closed checks:
 *  1. The candidate IS one of the profile's own topics, verbatim
 *     (case/whitespace-insensitive) — a job's "employer" being literally
 *     the search topic that found it is never a real organisation name.
 *  2. The candidate STARTS WITH one of the profile's own topics as a
 *     whole-word prefix, and everything after it is drawn from a short,
 *     closed academic-field vocabulary (an adjective, "and", or a field
 *     noun) — the exact shape of both live-confirmed repros
 *     ("<topic> Characterization", "<topic> Chemical and Electrochemical
 *     Engineering"). Deliberately narrow and deliberately incomplete, per
 *     B's own framing: a real org name sharing one word with a topic
 *     ("Acme Molten Salt Technologies") survives, because the topic is not
 *     a PREFIX of the candidate (it's in the middle) and "Technologies" is
 *     not in the closed vocabulary — this under-catches on purpose rather
 *     than risk rejecting a real employer name.
 */
const FIELD_LABEL_CONTINUATION_WORD_RE =
  /^(?:and|chemical|electrochemical|mechanical|materials?|characterization|characterisation|engineering|chemistry|science|sciences)$/i;

function normalizeTopicText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeTopicLabel(candidate: string, topics: string[]): boolean {
  if (topics.length === 0) return false;
  const normalizedCandidate = normalizeTopicText(candidate);
  if (!normalizedCandidate) return false;
  for (const topic of topics) {
    const normalizedTopic = normalizeTopicText(topic);
    if (!normalizedTopic) continue;
    if (normalizedCandidate === normalizedTopic) return true;
    if (!normalizedCandidate.startsWith(`${normalizedTopic} `)) continue;
    const remainder = normalizedCandidate.slice(normalizedTopic.length).trim();
    const words = remainder.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.every((word) => FIELD_LABEL_CONTINUATION_WORD_RE.test(word))) {
      return true;
    }
  }
  return false;
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
 *
 * B13-02 (round 13) added three checks here, all in this one function because
 * this function is already this class's one home (Ruling 32). None of the five
 * pre-existing checks fired on ANY of round 13 A's four non-posting pool items;
 * each of the three additions carries exactly one of them, with no overlap.
 *
 * The single elegant rule — "require `POSTING_ID_RE` on every host" — was
 * considered and is NOT available: it drops
 * `hyetlithium.com/careers/internship-battery-research`, a real posting this
 * file's own tests already require to survive, and the doc comment above says
 * so deliberately. Recorded so nobody re-proposes it.
 */
export function isListingPage(
  title: string,
  host: string,
  pathAndQuery: string,
): boolean {
  if (FEED_PATH_RE.test(pathAndQuery)) return true;
  if (FORUM_THREAD_URL_RE.test(pathAndQuery)) return true;
  if (LISTING_TITLE_RE.test(title)) return true;
  if (CAREERS_INDEX_TITLE_RE.test(title)) return true;
  if (LISTING_SECTION_TITLE_RE.test(title)) return true;

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

export function webResultToRawJobItem(
  result: {
    title?: string;
    url?: string;
    snippet?: string;
  },
  // B9-02b/c (round 9): additive and optional, defaults to "no topics" so
  // every existing caller (this file's own two search functions before
  // this item, and every test in jobweb.test.ts) is unaffected unless it
  // opts in. The profile's own search topics — plumbed from JobsQuery,
  // which already carries them for scoring — are the signal
  // looksLikeTopicLabel needs.
  topics: string[] = [],
): RawJobItem | null {
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
  //
  // B10-01 (round 10): "See more jobs at PostdocJobs.com" is one of the
  // closed hosting-platform boilerplate phrases `looksLikeHostBoilerplatePhrase`
  // rejects below, but its own "at X" shape would otherwise be captured
  // HERE first, before the candidate-pool guard chain ever sees the whole
  // sentence \u2014 the same platform name, stripped of the very words that mark
  // it as boilerplate. The negative lookbehind keeps that one closed lead-in
  // out of this capture so the full segment reaches the guard chain intact.
  const titleEmployer = title.match(
    /(?<!more\s+jobs\s+)\bat\s+([A-Z][\w&.,'\u2019]*(?:\s+(?:[A-Z][\w&.,'\u2019]*|of\b|and\b|for\b|the\b|&))*)\s*(?:[-\u2013\u2014|\u00b7(]|$)/,
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
          !looksLikeHostBrand(p, host) &&
          !looksLikeTopicLabel(p, topics) &&
          !looksLikeHostBoilerplatePhrase(p) &&
          // B12-06: the family member this slot never had — see above.
          !looksLikeNavChrome(p) &&
          // B13-01 Gap A (round 13): a BARE careers-section label reaching the
          // employer slot. `Battery Research Scientist - Careers - Idaho
          // National Laboratory` rendered the employer as `Careers`.
          //
          // Nothing is invented here: `CAREERS_INDEX_TITLE_RE` is defined at
          // the top of this same file, is already anchored end to end, and is
          // already asserted by six tests through `isListingPage` — it was
          // simply never consulted on an employer CANDIDATE, only on a whole
          // title and on `roleTitle`. `stripTrailingCareersChrome`'s own doc
          // comment already states the intent ("a candidate that IS only this
          // word ... is the guards above's business, not this one's") — the
          // intent was documented and the guard was missing. This is it.
          //
          // The whole-segment anchor is why this costs nothing: all four
          // anchored trap names (`Home Depot`, `Page Industries`, `First
          // Solar`, `Next Energy Technologies`) and every other protected
          // employer survive, because a real company whose name merely
          // CONTAINS one of these words is not matched. Measured 19/21 on B's
          // matrix, the best of six designs, regressing nothing.
          //
          // EVIDENCE CLASS, recorded honestly rather than dressed up: Gap A is
          // LATENT, not live. Round 13 A's census contains no `Careers`
          // employer render; B found this by executing the chain against
          // breadcrumb shapes. It landed because it costs nothing and closes a
          // gap this file's own comment already says should be closed.
          //
          // Failure direction: a careers-section label not in the list
          // survives — the status quo, never a new wrong value.
          //
          // NOT FIXED HERE, deliberately: the `openmc.discourse.group`
          // `Announcements` render (Gap B). It is a site CATEGORY name, an
          // OPEN class with no string-side signal separating it from a real
          // employer, and every candidate design either misses it or deletes
          // correct employers. Ruling 42a rules it deferred to Ruling 39c's
          // forum-thread drop. Do not widen this clause to reach it.
          !CAREERS_INDEX_TITLE_RE.test(p),
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
  topics: string[],
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
      .map((r) => webResultToRawJobItem({ title: r.title, url: r.url, snippet: r.content }, topics))
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
  topics: string[],
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
        webResultToRawJobItem({ title: r.title, url: r.url, snippet: r.description }, topics),
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
        ? searchTavily(jobQuery, keys.tavily, perQuery, query.topics)
        : searchBrave(jobQuery, keys.brave!, perQuery, query.topics);
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
