import type {
  OpportunityFacetCounts,
  OpportunityFacetSelection,
  OpportunityFormat,
  OpportunityPlace,
} from "@/types";

export const MAX_OPPORTUNITY_POOL_ITEMS = 200;
export const DEFAULT_OPPORTUNITY_TOP_N = 10;

export interface FacetableOpportunity {
  location: string;
  place?: OpportunityPlace;
  startDate?: string;
  postedAt?: string;
  /** Mapped API shapes use `date` / `postedDate`. */
  date?: string;
  postedDate?: string;
  isOnline?: boolean;
  isRemote?: boolean;
}

export type FacetSurface = "events" | "jobs";

const OPPORTUNITY_FORMATS = [
  "in-person",
  "online",
  "hybrid",
] as const satisfies readonly OpportunityFormat[];

function cleanLabel(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  return cleaned || undefined;
}

function locationLabel(item: FacetableOpportunity): string | undefined {
  return cleanLabel(item.place?.city) ?? cleanLabel(item.place?.country);
}

function normalizedLabel(value: string): string {
  return cleanLabel(value)?.toLocaleLowerCase() ?? "";
}

function monthLabel(item: FacetableOpportunity): string | undefined {
  const raw =
    cleanLabel(item.startDate) ??
    cleanLabel(item.postedAt) ??
    cleanLabel(item.date) ??
    cleanLabel(item.postedDate);
  if (!raw) return undefined;

  const iso = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (iso) {
    const month = Number(iso[2]);
    return month >= 1 && month <= 12 ? `${iso[1]}-${iso[2]}` : undefined;
  }

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return undefined;
  const date = new Date(parsed);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export function opportunityFormat(
  surface: FacetSurface,
  item: FacetableOpportunity,
): OpportunityFormat {
  const explicitlyHybrid = /\bhybrid\b/i.test(item.location);
  if (explicitlyHybrid) return "hybrid";

  if (surface === "events") {
    if (!item.isOnline) return "in-person";
    const hasPhysicalPlace = Boolean(
      cleanLabel(item.place?.city) ||
        cleanLabel(item.place?.region) ||
        cleanLabel(item.place?.country),
    );
    return hasPhysicalPlace ? "hybrid" : "online";
  }

  return item.isRemote ? "online" : "in-person";
}

function incrementLabel(
  counts: Map<string, { label: string; count: number }>,
  label: string | undefined,
): void {
  if (!label) return;
  const key = label.toLocaleLowerCase();
  const current = counts.get(key);
  if (current) {
    current.count += 1;
  } else {
    counts.set(key, { label, count: 1 });
  }
}

function rankedRecord(
  counts: Map<string, { label: string; count: number }>,
): Record<string, number> {
  return Object.fromEntries(
    Array.from(counts.values())
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.label.localeCompare(right.label),
      )
      .map(({ label, count }) => [label, count]),
  );
}

export function countOpportunityFacets(
  surface: FacetSurface,
  items: FacetableOpportunity[],
): OpportunityFacetCounts {
  const locations = new Map<string, { label: string; count: number }>();
  const months = new Map<string, { label: string; count: number }>();
  const format: OpportunityFacetCounts["format"] = {
    "in-person": 0,
    online: 0,
    hybrid: 0,
  };

  for (const item of items) {
    incrementLabel(locations, locationLabel(item));
    incrementLabel(months, monthLabel(item));
    format[opportunityFormat(surface, item)] += 1;
  }

  return {
    location: rankedRecord(locations),
    month: Object.fromEntries(
      Array.from(months.values())
        .sort((left, right) => left.label.localeCompare(right.label))
        .map(({ label, count }) => [label, count]),
    ),
    format,
  };
}

function cleanStringSelection(input: unknown, limit = 50): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Map<string, string>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    const label = cleanLabel(value);
    if (!label) continue;
    const key = normalizedLabel(label);
    if (!unique.has(key)) unique.set(key, label);
    if (unique.size >= limit) break;
  }
  return Array.from(unique.values());
}

export function parseOpportunityFacetSelection(
  input: unknown,
): OpportunityFacetSelection | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  const value = input as Record<string, unknown>;
  const location = cleanStringSelection(value.location);
  const month = cleanStringSelection(value.month);
  const requestedFormats = new Set(
    cleanStringSelection(value.format, OPPORTUNITY_FORMATS.length).map(
      (format) => format.toLocaleLowerCase(),
    ),
  );
  const format = OPPORTUNITY_FORMATS.filter((candidate) =>
    requestedFormats.has(candidate),
  );
  if (location.length === 0 && month.length === 0 && format.length === 0) {
    return undefined;
  }
  return {
    location: location.length > 0 ? location : undefined,
    month: month.length > 0 ? month : undefined,
    format: format.length > 0 ? format : undefined,
  };
}

export function hasActiveOpportunityFacets(
  selection: OpportunityFacetSelection | undefined,
): boolean {
  return Boolean(
    selection &&
      ((selection.location ?? []).some((value) => normalizedLabel(value)) ||
        (selection.month ?? []).some((value) => normalizedLabel(value)) ||
        (selection.format ?? []).some((value) =>
          OPPORTUNITY_FORMATS.includes(value),
        )),
  );
}

function matchesSelectedFormat(
  actual: OpportunityFormat,
  selected: Set<OpportunityFormat>,
): boolean {
  if (selected.has(actual)) return true;
  // A hybrid event is both attendable online and tied to a physical place.
  return (
    actual === "hybrid" &&
    (selected.has("online") || selected.has("in-person"))
  );
}

export function filterOpportunitiesByFacets<
  TItem extends FacetableOpportunity,
>(
  surface: FacetSurface,
  items: TItem[],
  selection: OpportunityFacetSelection | undefined,
): TItem[] {
  if (!hasActiveOpportunityFacets(selection)) return items;

  const locations = new Set(
    (selection?.location ?? []).map(normalizedLabel).filter(Boolean),
  );
  const months = new Set(
    (selection?.month ?? []).map(normalizedLabel).filter(Boolean),
  );
  const formats = new Set(
    (selection?.format ?? []).filter((value) =>
      OPPORTUNITY_FORMATS.includes(value),
    ),
  );

  return items.filter((item) => {
    const location = locationLabel(item);
    if (
      locations.size > 0 &&
      (!location || !locations.has(normalizedLabel(location)))
    ) {
      return false;
    }

    const month = monthLabel(item);
    if (months.size > 0 && (!month || !months.has(normalizedLabel(month)))) {
      return false;
    }

    return (
      formats.size === 0 ||
      matchesSelectedFormat(opportunityFormat(surface, item), formats)
    );
  });
}
