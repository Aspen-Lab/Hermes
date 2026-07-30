import { stripHtml } from "./shared";
import { extractJsonLdOpportunities } from "./structured-extract";

export interface JobPageDetails {
  applicationDeadline?: string;
  startDate?: string;
  contractLength?: string;
  applicationMaterials?: string[];
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
): JobPageDetails {
  const visibleText = stripHtml(html);
  const structuredDeadline = extractJsonLdOpportunities(html).find(
    (item) => item.kind === "job" && item.validThrough,
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
  const contractLength = extractContractLength(visibleText);
  const applicationMaterials = extractApplicationMaterials(visibleText);

  return {
    ...(applicationDeadline ? { applicationDeadline } : {}),
    ...(startDate ? { startDate } : {}),
    ...(contractLength ? { contractLength } : {}),
    ...(applicationMaterials.length > 0 ? { applicationMaterials } : {}),
  };
}
