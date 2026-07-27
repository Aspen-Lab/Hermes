export interface ExtractedPlace {
  city?: string;
  region?: string;
  country?: string;
}

export interface JsonLdOpportunity {
  kind: "event" | "job";
  name?: string;
  startDate?: string;
  endDate?: string;
  place?: ExtractedPlace;
  eventAttendanceMode?: string;
}

export interface OpenGraphTags {
  title?: string;
  description?: string;
  siteName?: string;
}

export interface MetaOpportunityDetails {
  start?: string;
  end?: string;
  city?: string;
  region?: string;
  isOnline: boolean;
}

type JsonRecord = Record<string, unknown>;

const MONTHS: Record<string, number> = {
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
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

const DATE_RANGE_PATTERN = new RegExp(
  `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s*[-–—]\\s*(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2}))?,?\\s+(\\d{4})\\b`,
  "i",
);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function schemaTypeName(value: string): string {
  const withoutTrailingSlash = value.trim().replace(/\/+$/, "");
  const separator = Math.max(
    withoutTrailingSlash.lastIndexOf("/"),
    withoutTrailingSlash.lastIndexOf("#"),
  );
  return withoutTrailingSlash.slice(separator + 1).toLowerCase();
}

function opportunityKind(value: unknown): JsonLdOpportunity["kind"] | null {
  const rawTypes = Array.isArray(value) ? value : [value];
  const types = rawTypes
    .filter((type): type is string => typeof type === "string")
    .map(schemaTypeName);

  if (types.includes("jobposting")) return "job";
  if (types.some((type) => type === "event" || type.endsWith("event"))) {
    return "event";
  }
  return null;
}

function firstRecord(value: unknown): JsonRecord | undefined {
  if (isRecord(value)) return value;
  if (!Array.isArray(value)) return undefined;
  return value.find(isRecord);
}

function countryName(value: unknown): string | undefined {
  const direct = nonEmptyString(value);
  if (direct) return direct;
  if (!isRecord(value)) return undefined;
  return nonEmptyString(value.name);
}

function extractPlace(location: unknown): ExtractedPlace | undefined {
  const locationRecord = firstRecord(location);
  if (!locationRecord) return undefined;
  const address = firstRecord(locationRecord.address);
  if (!address) return undefined;

  const place: ExtractedPlace = {
    city: nonEmptyString(address.addressLocality),
    region: nonEmptyString(address.addressRegion),
    country: countryName(address.addressCountry),
  };
  return place.city || place.region || place.country ? place : undefined;
}

function extractOpportunity(node: JsonRecord): JsonLdOpportunity | null {
  const kind = opportunityKind(node["@type"]);
  if (!kind) return null;

  return {
    kind,
    name: nonEmptyString(node.name),
    startDate: nonEmptyString(node.startDate),
    endDate: nonEmptyString(node.endDate),
    place: extractPlace(node.location),
    eventAttendanceMode: nonEmptyString(node.eventAttendanceMode),
  };
}

function walkJsonLd(value: unknown, output: JsonLdOpportunity[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) walkJsonLd(entry, output);
    return;
  }
  if (!isRecord(value)) return;

  const opportunity = extractOpportunity(value);
  if (opportunity) output.push(opportunity);

  if ("@graph" in value) walkJsonLd(value["@graph"], output);
}

function attributeValue(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = attributes.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  return value
    .replace(/&([a-z]+);/gi, (match, entity: string) => {
      return named[entity.toLowerCase()] ?? match;
    })
    .replace(/&#(x?[0-9a-f]+);/gi, (match, code: string) => {
      const radix = code[0]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? code.slice(1) : code;
      const point = Number.parseInt(digits, radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    });
}

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

function parseDateRange(text: string): Pick<MetaOpportunityDetails, "start" | "end"> {
  const match = text.match(DATE_RANGE_PATTERN);
  if (!match) return {};

  const startMonth = MONTHS[match[1].toLowerCase()];
  const startDay = Number.parseInt(match[2], 10);
  const endMonth = match[3]
    ? MONTHS[match[3].toLowerCase()]
    : startMonth;
  const endDay = match[4] ? Number.parseInt(match[4], 10) : undefined;
  const year = Number.parseInt(match[5], 10);
  const start = isoDate(year, startMonth, startDay);
  if (!start) return {};

  const end = endDay === undefined ? undefined : isoDate(year, endMonth, endDay);
  return { start, end };
}

function parseCityRegion(
  text: string,
): Pick<MetaOpportunityDetails, "city" | "region"> {
  const segments = text
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const withoutFormat = segment
      .replace(/\s*(?:\+|&)\s*(?:virtual|online)\s*$/i, "")
      .replace(/\s*[-–—]?\s*hybrid\s*$/i, "")
      .trim();
    const match = withoutFormat.match(
      /^([\p{L}][\p{L}\p{M} .'-]*?)\s*,\s*([\p{L}][\p{L}\p{M} .'-]*)$/u,
    );
    if (!match) continue;
    const city = match[1].trim();
    const region = match[2].trim();
    if (city && region) return { city, region };
  }
  return {};
}

function jsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const type = attributeValue(match[1] ?? "", "type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (type === "application/ld+json") blocks.push(match[2] ?? "");
  }
  return blocks;
}

export function extractJsonLdOpportunities(html: string): JsonLdOpportunity[] {
  const opportunities: JsonLdOpportunity[] = [];

  for (const block of jsonLdBlocks(html)) {
    try {
      walkJsonLd(JSON.parse(block), opportunities);
    } catch {
      // A malformed block must not discard valid JSON-LD elsewhere on the page.
    }
  }

  return opportunities;
}

export function extractOpenGraphTags(html: string): OpenGraphTags {
  const tags: OpenGraphTags = {};
  const metaPattern = /<meta\b([^>]*)\/?>/gi;

  for (const match of html.matchAll(metaPattern)) {
    const attributes = match[1] ?? "";
    const key = (
      attributeValue(attributes, "property") ??
      attributeValue(attributes, "name")
    )?.toLowerCase();
    const content = attributeValue(attributes, "content");
    if (!key || content === undefined) continue;

    const value = decodeHtmlEntities(content).trim();
    if (!value) continue;
    if (key === "og:title" && !tags.title) tags.title = value;
    if (key === "og:description" && !tags.description) {
      tags.description = value;
    }
    if (key === "og:site_name" && !tags.siteName) tags.siteName = value;
  }

  return tags;
}

export function extractMetaOpportunityDetails(
  html: string,
): MetaOpportunityDetails {
  const tags = extractOpenGraphTags(html);
  const text = [tags.title, tags.description, tags.siteName]
    .filter((value): value is string => Boolean(value))
    .join(" | ");

  return {
    ...parseDateRange(text),
    ...parseCityRegion(text),
    isOnline: /\b(?:virtual|online|hybrid)\b/i.test(text),
  };
}
