import type { EventFee } from "@/types";
import { normalizeJobDate } from "./job-details";
import { stripHtml } from "./shared";

export interface EventPageDetails {
  registrationDeadline?: string;
  fees?: EventFee[];
  activities?: string[];
  travelGrant?: string;
  invitationLetter?: boolean;
  expectedSize?: number;
}

const MONTH_PATTERN =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const DAY_PATTERN = "\\d{1,2}(?:st|nd|rd|th)?";
const DATE_TOKEN_PATTERN =
  `(?:\\d{4}-\\d{2}-\\d{2}|${MONTH_PATTERN}\\.?\\s+${DAY_PATTERN}(?:,?\\s+\\d{4})?|${DAY_PATTERN}\\s+${MONTH_PATTERN}\\.?(?:,?\\s+\\d{4})?)`;
const REGISTRATION_LABEL_PATTERN =
  "(?:registration\\s+deadline|registrations?\\s+close(?:s)?|register\\s+by|last\\s+day\\s+to\\s+register)";

const PRICE_RE =
  /\bFree\b|(?:US|C|A|CA|AU|NZ)?\$\s*\d[\d,.]*|[€£]\s*\d[\d,.]*|\b(?:USD|EUR|GBP|CAD|AUD|NZD)\s*\d[\d,.]*/i;
const PRICE_TOKEN_PATTERN =
  "(?:Free|(?:US|C|A|CA|AU|NZ)?\\$\\s*[\\d,.]+|[€£]\\s*[\\d,.]+|(?:USD|EUR|GBP|CAD|AUD|NZD)\\s*[\\d,.]+)";

const ACTIVITY_PATTERNS: readonly {
  label: string;
  pattern: RegExp;
  rejectContext?: RegExp;
}[] = [
  { label: "poster session", pattern: /\bposter\s+sessions?\b/gi },
  { label: "workshop", pattern: /\bworkshops?\b/gi },
  {
    label: "tutorial",
    pattern: /\b(?:tutorials|tutorial\s+sessions?)\b/gi,
  },
  {
    label: "panel",
    pattern:
      /\b(?:panel\s+(?:discussions?|sessions?)|expert\s+panels?)\b|(?:^|\n)\s*panels\s*(?=\n|$)/gi,
    rejectContext:
      /\b(?:(?:data|dataset|regression|survey|solar|control)\s+panels?|flat[- ]panels?(?:\s+displays?)?|panels?\s+data)\b/i,
  },
  { label: "career fair", pattern: /\bcareer\s+fairs?\b/gi },
  { label: "job fair", pattern: /\bjob\s+fairs?\b/gi },
  {
    label: "exhibition",
    pattern: /\b(?:exhibitions?|exhibitors?|exhibit\s+halls?)\b/gi,
  },
  {
    label: "networking",
    pattern:
      /\bnetworking\s+(?:events?|sessions?|breaks?|lunch(?:es)?|receptions?|opportunit(?:y|ies))\b/gi,
  },
  { label: "hackathon", pattern: /\bhackathons?\b/gi },
  {
    label: "symposium",
    pattern:
      /(?:^|\n)\s*(?:symposiums|symposia)\s*(?=\n|$)|\b(?:symposium|symposia)\s+sessions?\b|\b(?:programme|program|schedule|agenda)\b[^\n.!?]{0,120}\b(?:symposiums?|symposia)\b/gi,
  },
  { label: "keynote", pattern: /\bkeynotes?\b/gi },
  { label: "plenary", pattern: /\bplenar(?:y|ies)\b/gi },
  {
    label: "awards ceremony",
    pattern: /\bawards?\s+ceremon(?:y|ies)\b/gi,
  },
  {
    label: "competition",
    // The bare word can never be matched: "competition between phases" and
    // "market competition" are ordinary research prose. Match it as a heading,
    // near a programme word, or in one of the named contest forms the 53-site
    // study actually found — a student paper competition in running text was
    // being missed entirely.
    pattern:
      /(?:^|\n)\s*competitions?\s*(?=\n|$)|\b(?:programme|program|schedule|agenda)\b[^\n.!?]{0,120}\bcompetitions?\b|\bcompetitions?\s+(?:sessions?|tracks?)\b|\b(?:student|paper|poster|design|robot|robotics|startup|start-up|pitch|programming|benchmark|innovation)\s+(?:\w+\s+)?competitions?\b/gi,
  },
  { label: "short course", pattern: /\bshort\s+courses?\b/gi },
  { label: "demo session", pattern: /\bdemos?\b/gi },
  {
    label: "doctoral consortium",
    pattern: /\bdoctoral\s+consorti(?:um|a)\b/gi,
  },
  {
    label: "banquet",
    pattern: /\b(?:banquets?|gala\s+dinners?)\b/gi,
  },
  { label: "social event", pattern: /\bsocial\s+events?\b/gi },
  {
    label: "lightning talk",
    pattern: /\b(?:lightning|flash|short)\s+talks?\b/gi,
  },
  {
    label: "field trip",
    pattern:
      /\b(?:field\s+trips?|technical\s+tours?)\b|(?:^|\n)\s*excursions?\s*(?=\n|$)|\b(?:programme|program|schedule|agenda)\b[^\n.!?]{0,120}\bexcursions?\b/gi,
  },
  {
    label: "school",
    pattern: /\b(?:summer|winter|methods|doctoral)\s+schools?\b/gi,
  },
  { label: "town hall", pattern: /\btown(?:\s+)?halls?\b/gi },
  {
    label: "meet the expert",
    pattern: /\bmeet\s+the\s+experts?\b/gi,
  },
  {
    label: "hands-on session",
    pattern: /\bhands-on\s+sessions?\b/gi,
  },
];

/**
 * B2-09. The event report used to guess whether an activity string was
 * vocabulary or prose from its shape (short, lowercase, few words) — a test
 * ordinary prose passes just as easily as a real label does. The report needs
 * the actual fixed list to tell the two apart, so it is exported rather than
 * re-derived.
 */
export const ACTIVITY_LABELS: readonly string[] = ACTIVITY_PATTERNS.map(
  (activity) => activity.label,
);

function textSegments(html: string): string[] {
  return stripHtml(html)
    .split(/\r?\n+|(?<=[.!?])\s+/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function lineWindows(text: string): string[] {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines.flatMap((line, index) =>
    lines[index + 1] ? [line, `${line} ${lines[index + 1]}`] : [line],
  );
}

function extractRegistrationDeadline(
  text: string,
  now: Date,
): string | undefined {
  const pattern = new RegExp(
    `${REGISTRATION_LABEL_PATTERN}\\s*(?:(?::|[-–—|]|is)\\s*)?(?:on\\s+)?(${DATE_TOKEN_PATTERN})`,
    "i",
  );

  for (const window of lineWindows(text)) {
    if (/\bearly[- ]bird\b/i.test(window)) continue;
    const token = window.match(pattern)?.[1];
    if (!token) continue;
    const normalized = normalizeJobDate(token, now);
    if (normalized) return normalized;
  }
  return undefined;
}

function tableRows(html: string): string[][][] {
  return Array.from(html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi), (table) =>
    Array.from(table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (row) =>
      Array.from(
        row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi),
        (cell) => stripHtml(cell[1]).replace(/\s+/g, " ").trim(),
      ),
    ).filter((row) => row.some(Boolean)),
  );
}

function headerIndex(
  cells: readonly string[],
  pattern: RegExp,
): number | undefined {
  const index = cells.findIndex((cell) => pattern.test(cell));
  return index >= 0 ? index : undefined;
}

function normalizedFeeDeadline(
  cells: readonly string[],
  deadlineIndex: number | undefined,
  label: string,
  now: Date,
): string | undefined {
  const explicit = deadlineIndex === undefined ? undefined : cells[deadlineIndex];
  if (explicit) {
    const normalized = normalizeJobDate(explicit, now);
    if (normalized) return normalized;
  }
  if (!/\bearly[- ]bird\b/i.test(label)) return undefined;
  const token = label.match(
    new RegExp(`\\b(?:until|through|by)\\s+(${DATE_TOKEN_PATTERN})`, "i"),
  )?.[1];
  return token ? normalizeJobDate(token, now) : undefined;
}

function extractFeeTables(html: string, now: Date): EventFee[] {
  const fees: EventFee[] = [];

  for (const rows of tableRows(html)) {
    const headerRow = rows.findIndex((cells) =>
      cells.some((cell) =>
        /\b(?:standard|regular|non-student|student|online|virtual|deadline|cutoff)\b/i.test(
          cell,
        ),
      ),
    );
    if (headerRow < 0) continue;

    const headers = rows[headerRow];
    const labelIndex =
      headerIndex(
        headers,
        /\b(?:item|category|tier|rate|registration(?:\s+type)?|fee(?:\s+type)?)\b/i,
      ) ?? 0;
    const standardIndex = headerIndex(
      headers,
      /\b(?:standard|regular|non-student)\b/i,
    );
    const studentIndex = headerIndex(headers, /\bstudent\b/i);
    const onlineIndex = headerIndex(headers, /\b(?:online|virtual)\b/i);
    const deadlineIndex = headerIndex(headers, /\b(?:deadline|cutoff)\b/i);
    if (
      standardIndex === undefined &&
      studentIndex === undefined &&
      onlineIndex === undefined
    ) {
      continue;
    }

    for (const cells of rows.slice(headerRow + 1)) {
      const label = cells[labelIndex]?.replace(/\s+/g, " ").trim();
      if (!label) continue;
      const standard =
        standardIndex === undefined ? undefined : cells[standardIndex];
      const student =
        studentIndex === undefined ? undefined : cells[studentIndex];
      const online = onlineIndex === undefined ? undefined : cells[onlineIndex];
      const fee: EventFee = {
        label,
        ...(standard && PRICE_RE.test(standard) ? { standard } : {}),
        ...(student && PRICE_RE.test(student) ? { student } : {}),
        ...(online && PRICE_RE.test(online) ? { online } : {}),
      };
      if (!fee.standard && !fee.student && !fee.online) continue;
      const deadline = normalizedFeeDeadline(
        cells,
        deadlineIndex,
        label,
        now,
      );
      fees.push({ ...fee, ...(deadline ? { deadline } : {}) });
    }
  }

  return fees;
}

function feeValue(
  line: string,
  labelPattern: string,
): string | undefined {
  return line.match(
    new RegExp(
      `\\b(?:${labelPattern})\\s*(?:fee|rate)?\\s*[:–—-]?\\s*(${PRICE_TOKEN_PATTERN})`,
      "i",
    ),
  )?.[1];
}

function extractFeeLines(text: string, now: Date): EventFee[] {
  const fees: EventFee[] = [];
  for (const line of text.split(/\r?\n+/)) {
    if (!/\b(?:standard|regular|non-student|student|online|virtual)\b/i.test(line)) {
      continue;
    }
    const standard = feeValue(line, "standard|regular|non-student");
    const student = feeValue(line, "student");
    const online = feeValue(line, "online|virtual");
    if (!standard && !student && !online) continue;

    const firstField = line.search(
      /\b(?:standard|regular|non-student|student|online|virtual)\b/i,
    );
    const leading = line
      .slice(0, Math.max(0, firstField))
      .replace(/[\s:|–—-]+$/g, "")
      .trim();
    const label =
      leading && leading.length <= 80
        ? leading
        : /\bearly[- ]bird\b/i.test(line)
          ? "Early bird"
          : "Registration";
    const cutoff = line.match(
      new RegExp(`\\b(?:until|through|deadline|cutoff|by)\\s*:?\\s*(${DATE_TOKEN_PATTERN})`, "i"),
    )?.[1];
    const deadline =
      /\bearly[- ]bird\b/i.test(line) && cutoff
        ? normalizeJobDate(cutoff, now)
        : undefined;
    fees.push({
      label,
      ...(standard ? { standard } : {}),
      ...(student ? { student } : {}),
      ...(online ? { online } : {}),
      ...(deadline ? { deadline } : {}),
    });
  }
  return fees;
}

function uniqueFees(fees: readonly EventFee[]): EventFee[] {
  const seen = new Set<string>();
  return fees.filter((fee) => {
    const key = JSON.stringify(fee).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractActivities(text: string): string[] {
  const matches: { label: string; index: number }[] = [];

  for (const activity of ACTIVITY_PATTERNS) {
    const pattern = new RegExp(activity.pattern.source, activity.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? Number.MAX_SAFE_INTEGER;
      const context = text.slice(
        Math.max(0, index - 24),
        index + match[0].length + 24,
      );
      if (activity.rejectContext?.test(context)) continue;
      matches.push({ label: activity.label, index });
      break;
    }
  }

  return matches
    .sort((left, right) => left.index - right.index)
    .map(({ label }) => label);
}

function extractTravelGrant(segments: readonly string[]): string | undefined {
  return segments.find(
    (segment) =>
      segment.length <= 400 &&
      /\b(?:student\s+)?travel\s+grants?\b/i.test(segment),
  );
}

function extractInvitationLetter(
  segments: readonly string[],
): boolean | undefined {
  const phrase = "(?:invitation\\s+letters?|letters?\\s+of\\s+invitation)";
  const negativeBefore = new RegExp(
    `\\b(?:do not|does not|cannot|can't|will not|won't|unable to)\\b[^.!?]{0,90}\\b${phrase}\\b`,
    "i",
  );
  const negativeAfter = new RegExp(
    `\\b${phrase}\\b[^.!?]{0,90}\\b(?:not available|not provided|not issued|unavailable)\\b`,
    "i",
  );
  if (segments.some((segment) => negativeBefore.test(segment) || negativeAfter.test(segment))) {
    return false;
  }

  const positiveBefore = new RegExp(
    `\\b(?:request|provide|issue|obtain|receive|download)\\b[^.!?]{0,90}\\b${phrase}\\b`,
    "i",
  );
  const positiveAfter = new RegExp(
    `\\b${phrase}\\b[^.!?]{0,90}\\b(?:available|provided|issued|on request|upon request)\\b`,
    "i",
  );
  if (segments.some((segment) => positiveBefore.test(segment) || positiveAfter.test(segment))) {
    return true;
  }
  return undefined;
}

/**
 * B4-10. `event.expectedSize` (the SCALE tile) was declared on the type
 * with no producer anywhere — genuinely never attempted, not a half-built
 * mechanism. Three phrasings, in the same spirit as
 * `extractTravelGrant`/`extractRegistrationDeadline`: a labelled figure
 * ("expected attendance: 2,400"), a bare count next to the word itself
 * ("2,400 attendees"), or a past edition's own figure ("previous edition
 * drew 1,800 attendees") — parsed to a number, never guessed when the page
 * is silent about size.
 */
const EXPECTED_SIZE_LABEL_RE =
  /\b(?:expected|anticipated)\s+(?:attendance|turnout|audience)\b[^.\n]{0,20}?(\d[\d,]{2,7})\b/i;
const EXPECTED_SIZE_COUNT_RE =
  /\b(\d[\d,]{2,7})\+?\s+(?:expected\s+)?(?:attendees|participants|delegates|registrants)\b/i;
const EXPECTED_SIZE_HISTORY_RE =
  /\b(?:past|previous)\s+edition[s]?\s+(?:drew|attracted|welcomed|had)\b[^.\n]{0,20}?(\d[\d,]{2,7})\b/i;

/**
 * B5-01 (round 5). `EXPECTED_SIZE_COUNT_RE` alone cannot tell a real
 * headcount ("2,400 attendees") from a cohort/programme year that happens
 * to sit next to the same trigger word ("...Spring 2025 Participants
 * Acme Robotics...", a section heading introducing a company list, not a
 * crowd-size sentence). Two independent, additive checks, applied only to
 * this one pattern's match — reject and let the loop fall through to the
 * next pattern rather than accept a plausible-looking wrong number:
 *
 * 1. The matched number is immediately preceded by a season/cohort word
 *    ("Spring 2025", "Class of 2025", "Cohort 12 2025") — reuses the
 *    concept `SEASON_COHORT_LABEL_RE` (`jobs/sources/jobweb.ts`) already
 *    established for the same shape of false signal in a different field.
 * 2. The trigger word is immediately followed by another capitalised (or
 *    digit-led) token with nothing lower-case or sentence-ending in
 *    between — a genuine crowd-size sentence almost always continues in
 *    lower case ("attendees are expected", "delegates from 40
 *    countries") or ends there; a list heading continues straight into
 *    the next capitalised entry.
 */
const SEASON_COHORT_BEFORE_RE =
  /\b(?:spring|summer|fall|autumn|winter)\s+$|\bclass\s+of\s+$|\bcohort\s+(?:\d+\s+)?$/i;
const SENTENCE_CONTINUES_AFTER_RE = /^(?:\s*$|\s*[a-z]|\s*[.,;:!?])/;

function looksLikeCohortOrListHeading(
  text: string,
  match: RegExpMatchArray,
): boolean {
  const index = match.index;
  if (index === undefined) return false;

  const before = text.slice(Math.max(0, index - 20), index);
  if (SEASON_COHORT_BEFORE_RE.test(before)) return true;

  const after = text.slice(index + match[0].length, index + match[0].length + 30);
  return !SENTENCE_CONTINUES_AFTER_RE.test(after);
}

function parseAttendanceCount(token: string): number | undefined {
  const value = Number(token.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractExpectedSize(text: string): number | undefined {
  for (const pattern of [
    EXPECTED_SIZE_LABEL_RE,
    EXPECTED_SIZE_COUNT_RE,
    EXPECTED_SIZE_HISTORY_RE,
  ]) {
    const match = text.match(pattern);
    const token = match?.[1];
    if (!token) continue;
    if (
      pattern === EXPECTED_SIZE_COUNT_RE &&
      looksLikeCohortOrListHeading(text, match)
    ) {
      continue;
    }
    const size = parseAttendanceCount(token);
    if (size) return size;
  }
  return undefined;
}

export function extractEventDetails(
  html: string,
  now = new Date(),
): EventPageDetails {
  const visibleText = stripHtml(html);
  const segments = textSegments(html);
  const registrationDeadline = extractRegistrationDeadline(visibleText, now);
  const tableFees = extractFeeTables(html, now);
  const fees = uniqueFees(
    tableFees.length > 0 ? tableFees : extractFeeLines(visibleText, now),
  );
  const activities = extractActivities(visibleText);
  const travelGrant = extractTravelGrant(segments);
  const invitationLetter = extractInvitationLetter(segments);
  const expectedSize = extractExpectedSize(visibleText);

  return {
    ...(registrationDeadline ? { registrationDeadline } : {}),
    ...(fees.length > 0 ? { fees } : {}),
    ...(activities.length > 0 ? { activities } : {}),
    ...(travelGrant ? { travelGrant } : {}),
    ...(invitationLetter !== undefined ? { invitationLetter } : {}),
    ...(expectedSize !== undefined ? { expectedSize } : {}),
  };
}
