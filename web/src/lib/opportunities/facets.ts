import type {
  OpportunityFacetCounts,
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
  isOnline?: boolean;
  isRemote?: boolean;
}

export type FacetSurface = "events" | "jobs";

function cleanLabel(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  return cleaned || undefined;
}

function locationLabel(item: FacetableOpportunity): string | undefined {
  return cleanLabel(item.place?.city) ?? cleanLabel(item.place?.country);
}

function monthLabel(item: FacetableOpportunity): string | undefined {
  const raw = cleanLabel(item.startDate) ?? cleanLabel(item.postedAt);
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
