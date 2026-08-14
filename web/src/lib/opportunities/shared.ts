// Shared plumbing for the jobs & events pipelines. These mirror the paper
// pipeline's conventions (8s per-source wall, RawItem scoring facade) without
// importing from lib/feed, so the three surfaces stay parallel implementations.

import { canonicalize, isGenericTerm } from "@/lib/scoring/term-expand";
import type { RawItem } from "@/lib/sources/types";
import type { PreferenceConcept } from "@/types";

/**
 * B9-04 (round 9): moved here from `event-details.ts`, unchanged, so
 * `events/sources/eventweb.ts` can reuse the same date-token building
 * blocks for its own bare-date-segment guard. `event-details.ts` already
 * imports `looksLikeEventTitle` FROM `eventweb.ts` — importing these three
 * constants the other way, directly from `event-details.ts` INTO
 * `eventweb.ts`, would create a real circular import between the two (a
 * genuine risk for top-level `const`s used to build other top-level
 * `const`s, not just a style concern). `shared.ts` has no dependency on
 * either file, so it is the safe common home. `event-details.ts` now
 * imports these from here instead of defining them locally; its own three
 * call sites are unchanged.
 */
export const MONTH_PATTERN =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
export const DAY_PATTERN = "\\d{1,2}(?:st|nd|rd|th)?";
export const DATE_TOKEN_PATTERN =
  `(?:\\d{4}-\\d{2}-\\d{2}|${MONTH_PATTERN}\\.?\\s+${DAY_PATTERN}(?:,?\\s+\\d{4})?|${DAY_PATTERN}\\s+${MONTH_PATTERN}\\.?(?:,?\\s+\\d{4})?)`;

/**
 * Hard wall on a single source's fetch — same contract as the paper
 * pipeline's guard: one slow source never drags Promise.allSettled past 8s.
 */
export async function withSourceTimeout<T>(
  sourceId: string,
  promise: Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[${sourceId}] source-timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Stable, slash-free id suffix derived from a URL. Web-discovered items key on
 * their source URL, but embedding the raw URL in an id (`eventweb:https://…`)
 * breaks the single-segment `/events/[id]` route — the slashes make it a 404.
 * A short hash keeps ids unique and route-safe; the real URL lives in the
 * item's `url` field for outbound links. Deterministic (no Date/Math.random)
 * so the same posting dedups to the same id across fetches.
 */
export function urlHashId(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Make an id suffix safe for the single-segment `/events/[id]` and
 * `/jobs/[id]` routes. Any slash (or other route-breaking char) in an id
 * turns the detail page into a 404, so EVERY adapter must run its raw id
 * through this. URLs collapse to a stable hash; everything else keeps a
 * readable, deterministic slug. The result is used as the item's id
 * everywhere (dedup, scoring, dismissals, routing), so it must be stable for
 * the same input across fetches — no Date/Math.random.
 */
export function routeSafeId(raw: string): string {
  if (raw.includes("://")) return urlHashId(raw);
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || urlHashId(raw);
}

/** Strip HTML tags/entities from source-provided rich text (job descriptions). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Generous default: the Tier-0 keyword gate runs over this text, and "machine
// learning" often first appears deep in a posting's requirements section.
export function truncateText(text: string, maxChars = 2400): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, "")}…`;
}

/**
 * Facade so job/event candidates can flow through the existing scoring
 * primitives (scoreKeyword, TF-IDF index, scorePreferenceMatch), which all
 * take the paper pipeline's RawItem shape. `source` is a nominal placeholder
 * — the jobs/events scorers never use RawItem.source.
 */
export function toScoringItem(input: {
  id: string;
  title: string;
  text: string;
  summary?: string;
  tags: string[];
  publishedAt?: string;
  url?: string;
  preferenceSignals?: PreferenceConcept[];
}): RawItem {
  const metadata: RawItem["metadata"] & { gateText?: string } = {
    preferenceSignals: input.preferenceSignals,
    gateText: input.summary,
  };
  return {
    id: input.id,
    source: "web",
    title: input.title,
    authors: [],
    abstract: input.text,
    url: input.url ?? "",
    publishedAt: input.publishedAt ?? "",
    tags: input.tags,
    metadata,
  };
}

/** Lower-cased, punctuation-stripped, whitespace-collapsed — for loose text
 * comparisons where exact casing/punctuation shouldn't matter (location
 * matching here; also reused by jobs/summarize.ts's B5-07 title-echo check). */
export function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REMOTE_PREF_RE = /\b(remote|anywhere|online)\b/i;

/**
 * 0–1 fit between an item's location and the user's location preferences.
 * Neutral (1) when the user has no preferences; remote items are always a
 * decent match; otherwise substring match against each preference.
 */
export function locationFit(
  itemLocation: string,
  isRemote: boolean,
  preferences: string[],
): number {
  const prefs = preferences.map(normalizeLoose).filter(Boolean);
  if (prefs.length === 0) return 1;
  if (isRemote && prefs.some((p) => REMOTE_PREF_RE.test(p))) return 1;
  const location = normalizeLoose(itemLocation);
  if (location) {
    for (const pref of prefs) {
      if (location.includes(pref) || pref.includes(location)) return 1;
    }
  }
  if (isRemote) return 0.85;
  return 0.4;
}

/**
 * Shared relevance gate for the events and jobs scorers.
 *
 * A candidate is relevant enough to rank when it either names a *specific*
 * required topic where it counts (title + short summary), or corroborates a
 * weaker signal by matching two distinct required topics anywhere.
 *
 * The generic-term rule is the important part: a lone match on a word like
 * "materials" or "energy" never opens the gate, because those words appear in
 * unrelated postings constantly ("marketing materials", "training materials",
 * "energy drinks"). Such a term still contributes to ranking via
 * `termSpecificity` — it just cannot be the sole reason an item is shown.
 */
export function passesRequiredGate(
  requiredTopics: string[],
  scoped: { matched: string[] },
  anywhere: { matched: string[] },
): boolean {
  if (requiredTopics.length === 0) return true;

  const specificScoped = scoped.matched.filter((t) => !isGenericTerm(t));
  if (specificScoped.length >= 1) return true;

  const distinctAnywhere = new Set(
    anywhere.matched.map((t) => t.toLocaleLowerCase()),
  );
  if (distinctAnywhere.size >= 2) return true;

  // Only generic matches, and only one of them — not enough to prove relevance.
  return false;
}

/**
 * RULING 57b (round 21, item 5): AN OWNER'S NAME THAT HAPPENS TO CONTAIN A
 * TOPIC WORD IS NOT EVIDENCE THE ITEM IS ON TOPIC.
 *
 * `Battery Ventures` — a private-equity firm — kept clearing the required gate
 * for a battery researcher with `2027 Summer Investment Internship`, three
 * rounds running. **The gate does not open on the company FIELD**: somebody
 * already decided an employer's name must not open it, and `scoreKeyword`'s
 * scoped read excludes it. It opens because **the advert repeats the firm's own
 * name as PROSE** ("Battery is a private equity and venture capital firm…").
 * So "keep the company name out of the haystack" is already done and is NOT the
 * fix — recorded so nobody proposes it again.
 *
 * **FIVE CONJUNCTS. ALL FIVE MUST HOLD. EVERY ONE IS PROVED LOAD-BEARING BY A
 * TEST THAT TURNS RED WHEN IT ALONE IS REMOVED** (scores on the 18-row
 * adversarial table: all five 18/18, and 16/16/17/17/15 with each removed).
 *
 * **CONJUNCT 5 IS THE HEART OF IT, AND IT IS WHY THE MUST-KEEP CLASS SURVIVES
 * BY CONSTRUCTION.** A name ending in `Ventures` / `Capital` / `Partners`
 * asserts a FINANCIAL line of business, so a topic word inside it is a brand. A
 * name ending in `Global` / `Solutions` / `Resourcers` / `Technologies` asserts
 * an OPERATING business, so the topic word may genuinely describe what the firm
 * does — and those are admitted unconditionally, as the status quo. **The
 * distinguishing signal is the owner's LINE OF BUSINESS, never the topic
 * word**, exactly as Ruling 57b required.
 *
 * **THE COLLISION TOPIC IS CHOSEN BY THE OWNER NAME, NEVER BY LIST ORDER.** B's
 * first draft took the first MATCHED topic, which made the verdict depend on
 * where a topic sits in the user's own profile list rather than on any property
 * of the item. Here a topic is selected because it is inside the owner's name,
 * and when several are, the LONGEST wins. Asserted invariant under every
 * rotation and the reversal of the profile's topic list.
 *
 * **B's SIXTH CONJUNCT IS DELIBERATELY NOT SHIPPED.** It asked "does the item
 * name an owner", and mutation proves it changes nothing — conjunct 1 requires
 * a topic to be a proper sub-span of the owner name, and an empty name has no
 * sub-spans. Restoring it scores an identical 18/18. It is structurally
 * subsumed, so the empty-owner case falls out of conjunct 1 rather than being
 * restated; a guard clause no test can turn red is what Ruling 53b exists to
 * catch.
 *
 * **NOT A DENYLIST AND NOT A HOST RULE.** `Battery Ventures`, `employbl.com`
 * and `battery.com` appear nowhere in it; it is asserted on two constructed
 * siblings on unrelated topics (`Molten Salt Capital`, `Ion Exchange Partners`).
 *
 * **THIS DOES NOT DECIDE RULING 33.** 33 is the SHORT-ACRONYM class (`LCO` vs
 * `lco-cdo.org`) and stays exactly where it is — an accepted cost, neither
 * widened nor narrowed. This guard needs the topic to be a PROPER sub-span of a
 * LONGER owner name plus four more conjuncts, so it cannot reach a bare
 * three-character acronym. Asserted.
 *
 * Matching uses `canonicalize` plus whole-word token spans rather than
 * `expandTerm`: an expanded term set makes "appears exactly once" ill-defined,
 * and every expansion would only ever widen the KEEP side.
 *
 * Misses fall to ADMISSION — the status quo — and every conjunct fails that
 * way. There is no path by which this drops a posting whose ROLE content
 * carries the topic; conjuncts 3 and 4 both stop that, and both are asserted.
 */
const INVESTMENT_VEHICLE_TAIL_RE =
  /(?:^|\s)(?:ventures?|capital|partners|holdings?|equity|funds?|investments?|advisors?|advisers?|asset management)$/;

function wholeWordSpanCount(haystack: string[], needle: string[]): number {
  if (needle.length === 0 || haystack.length < needle.length) return 0;
  let count = 0;
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    if (needle.every((word, j) => haystack[i + j] === word)) count += 1;
  }
  return count;
}

export function isOwnerNameTopicCollision(
  item: {
    ownerName?: string | null;
    title?: string | null;
    description?: string | null;
  },
  requiredTopics: string[],
): boolean {
  const ownerTokens = canonicalize(item.ownerName ?? "")
    .split(" ")
    .filter(Boolean);

  // CONJUNCT 1 — a required topic is a PROPER sub-span of the owner's own name.
  // An absent owner name has no sub-spans, so it falls out here.
  let collisionTopic = "";
  let collisionTokens: string[] = [];
  for (const topic of requiredTopics) {
    const tokens = canonicalize(topic).split(" ").filter(Boolean);
    if (tokens.length === 0) continue;
    if (ownerTokens.length <= tokens.length) continue;
    if (wholeWordSpanCount(ownerTokens, tokens) === 0) continue;
    if (tokens.length > collisionTokens.length) {
      collisionTopic = topic;
      collisionTokens = tokens;
    }
  }
  if (collisionTokens.length === 0) return false;

  const titleTokens = canonicalize(item.title ?? "").split(" ").filter(Boolean);
  const bodyTokens = canonicalize(`${item.title ?? ""} ${item.description ?? ""}`)
    .split(" ")
    .filter(Boolean);

  // CONJUNCT 2 — no OTHER required topic corroborates the item.
  for (const topic of requiredTopics) {
    if (topic === collisionTopic) continue;
    const tokens = canonicalize(topic).split(" ").filter(Boolean);
    if (tokens.length === 0) continue;
    if (wholeWordSpanCount(bodyTokens, tokens) > 0) return false;
  }

  // CONJUNCT 3 — the collision topic is not in the item's TITLE.
  if (wholeWordSpanCount(titleTokens, collisionTokens) > 0) return false;

  // CONJUNCT 4 — it appears exactly once in title + description.
  if (wholeWordSpanCount(bodyTokens, collisionTokens) !== 1) return false;

  // CONJUNCT 5 — the owner's line of business is an investment vehicle.
  return INVESTMENT_VEHICLE_TAIL_RE.test(ownerTokens.join(" "));
}

/** Case-insensitive containment against a list of phrases. */
export function textMatchesAny(haystack: string, phrases: string[]): boolean {
  const lower = haystack.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

/**
 * True when a short candidate string is essentially the page's own domain
 * restated, rather than an independent name — a job board's display name
 * ("Climatebase" on climatebase.org) or a site's own brand in a title
 * segment ("The Engine" on engine.xyz), neither of which is a job-board
 * *domain* so neither ever matched a fixed denylist (B5-03/R7).
 *
 * Deliberately one direction only: the candidate must not be LONGER than the
 * domain label it is checked against. `"zerob"` is a prefix of
 * `"zerobonline"` (reject); `"climatebase"` equals `"climatebase"` (reject).
 * The reverse shape — a short domain label sitting as a prefix of a longer
 * candidate, e.g. `"acme"` inside `"Acme Corp"` at `acme.test` — is the
 * ordinary, correct pattern of a company hosting under its own name, and
 * rejecting it would turn a real company name into a lost one. A real
 * company's display name legitimately shares a root with its own domain far
 * more often than a job board's own brand leaks into a candidate slot, so
 * only the narrower, safer direction is checked here. Built for B5-03 (a job
 * board's own name in the job subtitle's company slot); reuse this rather
 * than reinventing it for a similar site-brand check elsewhere (B5-06).
 *
 * B8-02 (round 8): checked only `host`'s FIRST label, so a brand hosted on a
 * subdomain (`talents.vaia.com` — the brand "Vaia" is the SECOND label) was
 * never caught, and a title-parsed "Vaia" sailed through as if it were a
 * real employer name. Now checked against every label the host has — a
 * brand can sit at any depth, and there is no reliable way to guess which
 * label is "the real one" without public-suffix parsing (`co.uk`-shaped
 * TLDs and the like), which this does not need: trying every label is
 * simpler and carries the same one-directional safety per label, so a real
 * company name that merely happens to be longer than every label (the
 * ordinary, correct case above) is still never rejected.
 *
 * B12-07 (round 12): `talents.vaia.com` — the exact host B8-02 was built on —
 * still rendered `"Talents by Vaia"` as an employer. **B8-02 changed the check
 * from "the first label" to "every label"; it did not change "one label at a
 * time."** The board's display brand is composed of TWO of its own host labels
 * joined by a filler word, and normalisation collapses it to the single
 * 13-character token `talentsbyvaia`, which is longer than `talents`, `vaia`
 * and `com` individually — so the one-directional rule could never match it.
 * Two additions, both keeping that rule intact:
 *
 *  1. Compare against contiguous RUNS of labels, not only single labels. For
 *     `talents.vaia.com`: `talents`, `talentsvaia`, `talentsvaiacom`, `vaia`,
 *     `vaiacom`, `com`. This is the natural completion of B8-02's own reasoning
 *     — a brand can sit at any depth, so a brand can also SPAN depths.
 *  2. Also try the candidate with a short closed list of filler words removed,
 *     in addition to the current whole-string form. `"Talents by Vaia"` becomes
 *     `talentsvaia`, which is exactly the `talents`+`vaia` run. This mirrors
 *     `looksLikeArticledHostBrand` in `events/sources/eventweb.ts`, which
 *     already strips `the|a|an` for the same reason.
 *
 * `startsWith` keeps its direction and the 3-character floor still applies, so
 * the protection above is untouched: a real company name that is merely longer
 * than every label RUN is still never rejected. Verified against every real
 * employer in round 12 A's own census — the only behaviour change on B's whole
 * adversarial matrix was the one live defect.
 *
 * Pre-existing cost, restated so it is not attributed to B12-07: a company
 * posting under its own exact domain name (`Bank of America` at
 * `bankofamerica.com`) is rejected TODAY by the equal-length branch this comment
 * describes above, and is rejected identically after B12-07. A's census records
 * the same trade-off live on `careers.gevernova.com`.
 */
const HOST_BRAND_FILLER_RE = /^(?:by|at|for|the|a|an|of|and|und|de)$/i;

/** Every contiguous run of host labels, joined — B12-07 addition 1. */
function hostLabelRuns(host: string): string[] {
  const labels = host.toLowerCase().split(".").filter(Boolean);
  const runs: string[] = [];
  for (let start = 0; start < labels.length; start += 1) {
    let run = "";
    for (let end = start; end < labels.length; end += 1) {
      run += labels[end];
      runs.push(run);
    }
  }
  return runs;
}

export function looksLikeHostBrand(candidate: string, host: string): boolean {
  const forms: string[] = [];
  const whole = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (whole.length >= 3) forms.push(whole);
  // B12-07 addition 2: the same candidate with closed-list filler words dropped.
  const withoutFiller = candidate
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word && !HOST_BRAND_FILLER_RE.test(word))
    .join("")
    .replace(/[^a-z0-9]/g, "");
  if (withoutFiller.length >= 3 && withoutFiller !== whole) forms.push(withoutFiller);
  if (forms.length === 0) return false;
  return hostLabelRuns(host).some((run) => forms.some((form) => run.startsWith(form)));
}
