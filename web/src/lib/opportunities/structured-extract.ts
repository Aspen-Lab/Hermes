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

type JsonRecord = Record<string, unknown>;

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
