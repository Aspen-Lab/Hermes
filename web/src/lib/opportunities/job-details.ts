import type { Job } from "@/types";
import { stripHtml } from "./shared";
import { extractPageText } from "./page-text";
import type { NormalizedSalary } from "./salary";
import { extractJsonLdOpportunities, type JsonLdOpportunity } from "./structured-extract";

export interface JobPageDetails {
  applicationDeadline?: string;
  startDate?: string;
  /**
   * B3-06 / Ruling 20. Whether the posting itself says the start date can
   * move. `true` only -- never inferred from a posting's silence, exactly
   * like `startDate` above it never invents a date the posting doesn't state.
   */
  startDateFlexible?: true;
  contractLength?: string;
  applicationMaterials?: string[];
  /** B4-11. schema.org JobPosting.baseSalary, from this same fetched page. */
  salary?: NormalizedSalary;
  /** B4-11. schema.org JobPosting.employmentType, from this same fetched page. */
  employmentType?: string;
  /**
   * B4-11. Same convention as `startDateFlexible` above: `undefined` unless
   * the posting's own fetched-page text explicitly says "hybrid" or
   * "on-site"/"in-person" -- never inferred from silence. Additive alongside
   * the mapper's own cheap location-string check
   * (`jobWorkMode` in `web/src/lib/jobs/mapper.ts`), not a replacement for
   * it: a `jobweb`-sourced posting's `location` string is always empty, so
   * that check can never see this signal no matter what the real page says.
   */
  workMode?: Job["workMode"];
  /**
   * V26-J06 / Ruling 74 (round 27, item 7). Plate 02's `ELIGIBILITY` row —
   * one short clause stating who may apply (`PhD awarded by start date`).
   *
   * The posting's OWN words, clipped, never paraphrased. Peer clips; it does
   * not rewrite. Five boundaries, and the two that bite are the negatives:
   * NEVER from `keyRequirements` (that is Peer's own derived skills list, and
   * printing it here would turn a Peer inference into an employer promise) and
   * NEVER from LLM enrichment (Ruling 69 fixes the measurement profile to
   * no-LLM, so a field that only exists under enrichment is unwitnessable by
   * every A census). Absent means the row does not render at all.
   */
  eligibility?: string;
  /**
   * V26-J06 / Ruling 74. Plate 02's `TEAM` row reads
   * `Energy & Materials, 14 researchers` — a unit NAME and a HEADCOUNT, two
   * facts with very different evidence.
   *
   * **THIS FIELD IS THE NAME HALF ONLY, AND THE HEADCOUNT'S ABSENCE IS AN
   * ACCEPTED, NAMED COST UNDER RULING 74 — NOT AN OVERSIGHT.** No schema.org
   * property carries a team size; `Organization.numberOfEmployees` describes
   * the whole employer, so publishing it here would be a WRONG number rather
   * than a partial one; a number lifted from prose is A22-01's exact mechanism
   * (`our team of 14 researchers` versus `14 open positions`); Peer counts no
   * people on the job side; and an LLM guess is a fabricated fact about a real
   * employer. **Do not "fix" this by inventing the count.** Ruling 74 re-opens
   * it at Phase 2 as a measurement question about the LLM path.
   *
   * One boundary specific to this field: it must NEVER fall back to the
   * employer name. `TEAM: Toyota Research Institute` would restate the
   * employer already in the header — a duplicate dressed as a new fact, which
   * is Ruling 26's own failure shape.
   *
   * Expect it to be SILENT on most postings: `employmentUnit` is rarely
   * populated in the wild and B measured no hit rate for it.
   */
  team?: string;
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_PATTERN =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const DAY_PATTERN = "\\d{1,2}(?:st|nd|rd|th)?";
const DATE_TOKEN_PATTERN =
  `(?:\\d{4}-\\d{2}-\\d{2}|${MONTH_PATTERN}\\.?\\s+${DAY_PATTERN}(?:,?\\s+\\d{4})?|${DAY_PATTERN}\\s+${MONTH_PATTERN}\\.?(?:,?\\s+\\d{4})?)`;

const DEADLINE_LABEL_PATTERN =
  "(?:application\\s+deadline|closing\\s+date|apply\\s+by|applications?\\s+close(?:s)?|review\\s+of\\s+applications\\s+will\\s+begin)";
const START_LABEL_PATTERN =
  "(?:(?:expected|anticipated|proposed)\\s+start(?:\\s+date)?|start\\s+date)";

/**
 * B3-06 / Ruling 20. A small phrase-match list, in the same spirit as
 * `visa.ts`'s phrase sets but not copied from them -- there is no evidence
 * quote to render here, only a boolean, so this stays a plain regex rather
 * than that file's heavier country-scoped state machine.
 */
const START_DATE_FLEXIBLE_RE =
  /\b(?:start\s*date|start)\s+(?:is\s+)?(?:flexible|negotiable)\b|\bflexible\s+start\s*date\b|\bstart\s*date\s+(?:is\s+)?open\s+to\s+discussion\b/i;

function extractStartDateFlexible(text: string): true | undefined {
  return START_DATE_FLEXIBLE_RE.test(text) ? true : undefined;
}

/**
 * B4-11. The exact two patterns `jobWorkMode()`
 * (`web/src/lib/jobs/mapper.ts`) already checks against a job's `location`
 * string, reused here against the fetched page's own free text instead. A
 * `jobweb`-sourced posting's `location` is always `""` -- Tavily/Brave search
 * results carry no structured location field -- so `jobWorkMode()` can only
 * ever resolve "remote" (via `isRemote`) or nothing for those postings, no
 * matter what the real page says about hybrid or on-site work. "remote" is
 * deliberately not re-derived here: `isRemote` already carries that signal
 * from elsewhere, and this only ever fills the gap `jobWorkMode()` cannot
 * reach, never overrides it.
 */
const WORK_MODE_HYBRID_RE = /\bhybrid\b/i;
const WORK_MODE_ON_SITE_RE = /\bon[\s-]?site\b|\bin[\s-]?person\b/i;
const WORK_MODE_AMENITY_TAIL_RE =
  /^\s+(?:fitness|gym|parking|banking|cafeteria|dining|caf[eé]|daycare|child\s?care|visitors?|guests?|concierge)\b/i;

function extractWorkMode(text: string): Job["workMode"] {
  if (WORK_MODE_HYBRID_RE.test(text)) return "hybrid";
  // B6-08: evaluate every occurrence independently. A page can mention an
  // amenity and still state that the role itself is on-site elsewhere.
  const onSiteMatches = text.matchAll(
    new RegExp(WORK_MODE_ON_SITE_RE.source, "gi"),
  );
  for (const match of onSiteMatches) {
    const tail = text.slice((match.index ?? 0) + match[0].length);
    if (!WORK_MODE_AMENITY_TAIL_RE.test(tail)) return "on-site";
  }
  return undefined;
}

const CONTRACT_PATTERNS = [
  /\b(?:\d+(?:\.\d+)?|one|two|three|four|five)\s*[- ]\s*(?:year|month)s?\s+fixed\s*[- ]\s*term(?:\s+(?:contract|appointment|position|post|role))?\b/gi,
  /\bfixed\s*[- ]\s*term(?:\s+(?:contract|appointment|position|post|role))?(?:\s+(?:for|of)\s+(?:up to\s+)?(?:\d+(?:\.\d+)?|one|two|three|four|five)\s*[- ]?\s*(?:year|month)s?)?\b/gi,
  /\b(?:contract|appointment)\s+(?:length|term|duration)?\s*(?::|is|of|for)?\s*(?:up to\s+)?(?:\d+(?:\.\d+)?|one|two|three|four|five)\s*[- ]?\s*(?:year|month)s?\b/gi,
] as const;

const MATERIAL_PATTERNS = [
  { key: "cover-letter", label: "Cover letter", pattern: /\bcover\s+letter\b/gi },
  {
    key: "curriculum-vitae",
    label: "Curriculum vitae",
    pattern: /\b(?:curriculum\s+vitae|CV)\b/gi,
  },
  {
    key: "research-statement",
    label: "Research statement",
    pattern: /\bresearch\s+statement\b/gi,
  },
  {
    key: "teaching-statement",
    label: "Teaching statement",
    pattern: /\bteaching\s+statement\b/gi,
  },
  {
    key: "writing-sample",
    label: "Writing sample",
    pattern: /\bwriting\s+sample\b/gi,
  },
  {
    key: "transcripts",
    label: "Transcripts",
    pattern: /\btranscripts?\b/gi,
  },
] as const;

const REFERENCE_LETTERS_PATTERN =
  /\b(?:(?:one|two|three|four|five|\d+)\s+)?(?:letters?\s+of\s+(?:reference|recommendation)|reference\s+letters?)\b/gi;

function isoDate(year: number, month: number, day: number): string | undefined {
  const value = new Date(Date.UTC(year, month, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month ||
    value.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value.toISOString().slice(0, 10);
}

function monthIndex(value: string): number | undefined {
  return MONTHS[value.toLowerCase().replace(/\.$/, "")];
}

function nextOccurrence(
  month: number,
  day: number,
  now: Date,
): string | undefined {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  // Eight years always reaches another leap year for a valid Feb 29 while
  // keeping invalid tokens bounded.
  for (let year = now.getUTCFullYear(); year <= now.getUTCFullYear() + 8; year++) {
    const candidate = isoDate(year, month, day);
    if (!candidate) continue;
    if (Date.UTC(year, month, day) >= today) return candidate;
  }
  return undefined;
}

export function normalizeJobDate(
  raw: string,
  now = new Date(),
): string | undefined {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) {
    return isoDate(
      Number.parseInt(iso[1], 10),
      Number.parseInt(iso[2], 10) - 1,
      Number.parseInt(iso[3], 10),
    );
  }

  const cleaned = value
    .replace(/(\d)(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const monthFirst = cleaned.match(
    new RegExp(`^(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:\\s+(\\d{4}))?$`, "i"),
  );
  const dayFirst = cleaned.match(
    new RegExp(`^(\\d{1,2})\\s+(${MONTH_PATTERN})\\.?(?:\\s+(\\d{4}))?$`, "i"),
  );

  const month = monthFirst
    ? monthIndex(monthFirst[1])
    : dayFirst
      ? monthIndex(dayFirst[2])
      : undefined;
  const day = Number.parseInt(
    monthFirst?.[2] ?? dayFirst?.[1] ?? "",
    10,
  );
  const explicitYear = monthFirst?.[3] ?? dayFirst?.[3];
  if (month === undefined || !Number.isFinite(day)) return undefined;

  return explicitYear
    ? isoDate(Number.parseInt(explicitYear, 10), month, day)
    : nextOccurrence(month, day, now);
}

function lineWindows(text: string): string[] {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const windows: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    windows.push(lines[index]);
    if (lines[index + 1]) windows.push(`${lines[index]} ${lines[index + 1]}`);
  }
  return windows;
}

function extractLabeledDate(
  text: string,
  labelPattern: string,
  now: Date,
): string | undefined {
  const pattern = new RegExp(
    `${labelPattern}\\s*(?:(?::|[-–—]|is)\\s*)?(?:at\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?\\s*)?(?:on\\s+)?(${DATE_TOKEN_PATTERN})`,
    "i",
  );

  for (const window of lineWindows(text)) {
    const token = window.match(pattern)?.[1];
    if (!token) continue;
    const normalized = normalizeJobDate(token, now);
    if (normalized) return normalized;
  }
  return undefined;
}

/**
 * V26-J06 / Ruling 74. Closed label vocabularies — the same discipline
 * `DEADLINE_LABEL_PATTERN` uses. A grammatical class English keeps extending
 * would fail Ruling 37's bar; these are the labels postings actually print.
 */
const ELIGIBILITY_LABEL_PATTERN =
  "(?:eligibility(?:\\s+requirements?)?|who\\s+can\\s+apply|who\\s+may\\s+apply|(?:minimum|basic)\\s+qualifications)";
const TEAM_LABEL_PATTERN = "(?:department|group|team|division|unit)";

/**
 * V26-J06 / Ruling 74. The plate's values are ONE SHORT CLAUSE
 * (`PhD awarded by start date`, `Energy & Materials`), and `qualifications` is
 * routinely a multi-paragraph blob. So: take the text after the label up to
 * the first sentence end, and **DROP rather than truncate** when it is too
 * long. A truncated eligibility clause can invert its own meaning — "PhD not
 * required for candidates who…" cut at the cap says the opposite of the
 * sentence the employer wrote — so silence is the only safe overflow.
 *
 * Same clip-to-clause shape `extractLabeledDate` above already uses, and the
 * same `lineWindows` input, so nothing new is scanned.
 */
const MAX_APPLY_ROW_CHARS = 80;

function extractLabeledClause(
  text: string,
  labelPattern: string,
): string | undefined {
  const pattern = new RegExp(
    `(?:^|[\\s>|·])${labelPattern}\\s*(?::|[-–—])\\s*([^.;!?\\n]+)`,
    "i",
  );
  for (const window of lineWindows(text)) {
    const raw = pattern.exec(window)?.[1];
    if (!raw) continue;
    const clause = raw.replace(/\s+/g, " ").trim().replace(/[,;:]+$/, "");
    if (!clause) continue;
    // Drop rather than truncate. See the note above.
    if (clause.length > MAX_APPLY_ROW_CHARS) continue;
    if (!/\p{L}/u.test(clause)) continue;
    return clause;
  }
  return undefined;
}

function extractContractLength(text: string): string | undefined {
  const matches = CONTRACT_PATTERNS.flatMap((pattern) => {
    const localPattern = new RegExp(pattern.source, pattern.flags);
    return Array.from(text.matchAll(localPattern), (match) => ({
      index: match.index ?? Number.MAX_SAFE_INTEGER,
      value: match[0].replace(/\s+/g, " ").trim(),
    }));
  }).sort((left, right) => {
    if (left.index !== right.index) return left.index - right.index;
    return right.value.length - left.value.length;
  });
  return matches[0]?.value;
}

function titleCaseFirst(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function extractApplicationMaterials(text: string): string[] {
  const found: { index: number; key: string; label: string }[] = [];

  for (const material of MATERIAL_PATTERNS) {
    const pattern = new RegExp(material.pattern.source, material.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      found.push({
        index: match.index ?? Number.MAX_SAFE_INTEGER,
        key: material.key,
        label: material.label,
      });
    }
  }

  for (const match of text.matchAll(REFERENCE_LETTERS_PATTERN)) {
    const normalized = match[0]
      .replace(/\brecommendation\b/i, "reference")
      .replace(/\breference letters?\b/i, "letters of reference")
      .replace(/\s+/g, " ")
      .toLowerCase();
    found.push({
      index: match.index ?? Number.MAX_SAFE_INTEGER,
      key: "reference-letters",
      label: titleCaseFirst(normalized),
    });
  }

  found.sort((left, right) => left.index - right.index);
  const seen = new Set<string>();
  return found.flatMap(({ key, label }) => {
    if (seen.has(key)) return [];
    seen.add(key);
    return [label];
  });
}

export function extractJobDetails(
  html: string,
  now = new Date(),
  selectedStructured?: JsonLdOpportunity,
): JobPageDetails {
  // B5-02 (round 5). Was `stripHtml(html)`, which removes only <script>/
  // <style> and markup -- it does NOT remove nav/header/footer/aside/other-
  // listing furniture, unlike `extractPageText()`'s own
  // `withoutPageFurniture()`. A real job-listing aggregator page put an
  // unrelated "on-site fitness" amenity mention and a different job's own
  // "hybrid" text within reach of every regex below, because nothing had
  // stripped the surrounding page chrome first. `extractPageText` returns
  // `null` for a JS-shell-shaped page too short to have real content; fall
  // back to `stripHtml(html)` there, since today's behaviour on that page is
  // already "extract nothing" either way, so the fallback changes nothing
  // observable for that case. Furniture can only ever be noise for any of
  // the six fields this shared text feeds, never genuine posting content.
  const visibleText = extractPageText(html) ?? stripHtml(html);
  // B4-11. One parse of the page's JSON-LD, shared by validThrough (existing)
  // and the two new fields below -- each still takes the first job-kind
  // entry that actually carries it, exactly as validThrough already did, so
  // this is a no-behaviour-change refactor for validThrough itself.
  const jobOpportunities = selectedStructured
    ? [selectedStructured]
    : extractJsonLdOpportunities(html).filter((item) => item.kind === "job");
  const structuredDeadline = jobOpportunities.find(
    (item) => item.validThrough,
  )?.validThrough;
  const applicationDeadline =
    (structuredDeadline
      ? normalizeJobDate(structuredDeadline, now)
      : undefined) ??
    extractLabeledDate(visibleText, DEADLINE_LABEL_PATTERN, now);
  const startDate = extractLabeledDate(
    visibleText,
    START_LABEL_PATTERN,
    now,
  );
  const startDateFlexible = extractStartDateFlexible(visibleText);
  const contractLength = extractContractLength(visibleText);
  const applicationMaterials = extractApplicationMaterials(visibleText);
  const salary = jobOpportunities.find((item) => item.salary)?.salary;
  const employmentType = jobOpportunities.find(
    (item) => item.employmentType,
  )?.employmentType;
  const workMode = extractWorkMode(visibleText);
  // V26-J06 / Ruling 74. Structured first, labelled line second — the same
  // precedence `applicationDeadline` above already uses. Both are capped, and
  // an over-long structured blob is dropped by the same rule as a labelled
  // one, so `qualifications` cannot print a wall of text into a one-line row.
  const eligibility =
    withinApplyRowCap(
      jobOpportunities.find((item) => item.educationRequirements)
        ?.educationRequirements,
    ) ?? extractLabeledClause(visibleText, ELIGIBILITY_LABEL_PATTERN);
  // The TEAM NAME only. There is deliberately no `?? hiringOrganization`
  // anywhere in this expression: an absent unit renders nothing rather than
  // restating the employer already in the report header (Ruling 26's shape).
  // The HEADCOUNT half is Ruling 74's accepted, named cost — see the field's
  // own doc comment; do not add a source for it here.
  const team =
    withinApplyRowCap(
      jobOpportunities.find((item) => item.employmentUnit)?.employmentUnit,
    ) ?? extractLabeledClause(visibleText, TEAM_LABEL_PATTERN);

  return {
    ...(applicationDeadline ? { applicationDeadline } : {}),
    ...(startDate ? { startDate } : {}),
    ...(startDateFlexible ? { startDateFlexible } : {}),
    ...(contractLength ? { contractLength } : {}),
    ...(applicationMaterials.length > 0 ? { applicationMaterials } : {}),
    ...(salary ? { salary } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(workMode ? { workMode } : {}),
    ...(eligibility ? { eligibility } : {}),
    ...(team ? { team } : {}),
  };
}

/** V26-J06 / Ruling 74. Same drop-rather-than-truncate rule, structured side. */
function withinApplyRowCap(value: string | undefined): string | undefined {
  const clause = value?.replace(/\s+/g, " ").trim();
  if (!clause || clause.length > MAX_APPLY_ROW_CHARS) return undefined;
  return /\p{L}/u.test(clause) ? clause : undefined;
}
