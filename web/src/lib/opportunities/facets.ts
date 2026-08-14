import type {
  Job,
  OpportunityFacetCounts,
  OpportunityFacetSelection,
  OpportunityFormat,
  OpportunityPlace,
  RoleKind,
} from "@/types";

export const MAX_OPPORTUNITY_POOL_ITEMS = 200;
export const DEFAULT_OPPORTUNITY_TOP_N = 10;
export const OPPORTUNITY_MIN_SCORE = 0.35;

export function emptyOpportunityFacetCounts(): OpportunityFacetCounts {
  return {
    location: {},
    month: {},
    format: { "in-person": 0, online: 0, hybrid: 0 },
  };
}

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

export type JobLocationMode = "anywhere" | "prefer" | "only";
export type JobWhen = "any" | "24h" | "7d" | "30d";
export type JobVisaState = NonNullable<Job["visa"]>["state"];

export interface JobFacetSelection {
  locations: string[];
  locationMode: JobLocationMode;
  roleKinds: RoleKind[];
  visaStates: JobVisaState[];
  when: JobWhen;
  includeVisaMismatch: boolean;
}

export interface JobFacetCounts {
  locations: Record<string, number>;
  roleKinds: Record<RoleKind, number>;
  visaStates: Record<JobVisaState, number>;
  when: Record<JobWhen, number>;
}

export interface FacetableJob extends FacetableOpportunity {
  roleKind?: RoleKind;
  visa?: Job["visa"];
}

export const DEFAULT_JOB_FACET_SELECTION: JobFacetSelection = {
  locations: [],
  locationMode: "anywhere",
  roleKinds: [],
  visaStates: [],
  when: "any",
  includeVisaMismatch: false,
};

export type FacetSurface = "events" | "jobs";

export interface OpportunityFacetValues {
  location?: string;
  month?: string;
  format: OpportunityFormat;
}

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

function jobLocationLabels(item: FacetableJob): string[] {
  const labels = [item.place?.city, item.place?.country]
    .map(cleanLabel)
    .filter((value): value is string => Boolean(value));
  return Array.from(
    new Map(labels.map((label) => [normalizedLabel(label), label])).values(),
  );
}

function matchesJobLocation(
  item: FacetableJob,
  selectedLocations: Set<string>,
): boolean {
  if (
    jobLocationLabels(item).some((label) =>
      selectedLocations.has(normalizedLabel(label)),
    )
  ) {
    return true;
  }

  const rawLocation = normalizedLabel(item.location);
  return Array.from(selectedLocations).some(
    (selected) =>
      rawLocation === selected ||
      rawLocation.startsWith(`${selected},`) ||
      rawLocation.includes(`, ${selected}`),
  );
}

function withinDays(
  postedDate: string | undefined,
  days: number,
  nowMs: number,
): boolean {
  if (!postedDate) return false;
  const postedMs = Date.parse(postedDate);
  if (!Number.isFinite(postedMs)) return false;
  const ageMs = nowMs - postedMs;
  return ageMs >= 0 && ageMs <= days * 86_400_000;
}

export function countJobFacets(
  items: FacetableJob[],
  nowMs = Date.now(),
): JobFacetCounts {
  const locations = new Map<string, { label: string; count: number }>();
  const roleKinds: JobFacetCounts["roleKinds"] = {
    internship: 0,
    "phd-position": 0,
    postdoc: 0,
    staff: 0,
    faculty: 0,
  };
  const visaStates: JobFacetCounts["visaStates"] = {
    sponsors: 0,
    "not-stated": 0,
    "wont-sponsor": 0,
  };
  const when: JobFacetCounts["when"] = {
    any: items.length,
    "24h": 0,
    "7d": 0,
    "30d": 0,
  };

  for (const item of items) {
    for (const label of jobLocationLabels(item)) {
      incrementLabel(locations, label);
    }
    if (item.roleKind) roleKinds[item.roleKind] += 1;
    visaStates[item.visa?.state ?? "not-stated"] += 1;
    if (withinDays(item.postedDate ?? item.postedAt, 1, nowMs)) {
      when["24h"] += 1;
    }
    if (withinDays(item.postedDate ?? item.postedAt, 7, nowMs)) {
      when["7d"] += 1;
    }
    if (withinDays(item.postedDate ?? item.postedAt, 30, nowMs)) {
      when["30d"] += 1;
    }
  }

  return {
    locations: rankedRecord(locations),
    roleKinds,
    visaStates,
    when,
  };
}

export function hasActiveJobFacets(selection: JobFacetSelection): boolean {
  return Boolean(
    selection.roleKinds.length > 0 ||
      selection.visaStates.length > 0 ||
      selection.when !== "any" ||
      selection.includeVisaMismatch ||
      (selection.locationMode !== "anywhere" &&
        selection.locations.some((location) => normalizedLabel(location))),
  );
}

export function filterJobsByFacets<TItem extends FacetableJob>(
  items: TItem[],
  selection: JobFacetSelection,
  {
    authorisedCountries = [],
    nowMs = Date.now(),
  }: {
    authorisedCountries?: string[];
    nowMs?: number;
  } = {},
): TItem[] {
  const roles = new Set(selection.roleKinds);
  const visaStates = new Set(selection.visaStates);
  const authorised = new Set(
    authorisedCountries.map(normalizedLabel).filter(Boolean),
  );
  const explicitlyShowsNoSponsor =
    selection.includeVisaMismatch || visaStates.has("wont-sponsor");
  const whenDays =
    selection.when === "24h"
      ? 1
      : selection.when === "7d"
        ? 7
        : selection.when === "30d"
          ? 30
          : undefined;

  const filtered = items.filter((item) => {
    if (roles.size > 0 && (!item.roleKind || !roles.has(item.roleKind))) {
      return false;
    }

    const visaState = item.visa?.state ?? "not-stated";
    if (visaStates.size > 0 && !visaStates.has(visaState)) return false;

    if (
      authorised.size > 0 &&
      !explicitlyShowsNoSponsor &&
      visaState === "wont-sponsor"
    ) {
      const country = normalizedLabel(
        item.place?.country ?? item.visa?.country ?? "",
      );
      if (!country || !authorised.has(country)) return false;
    }

    return (
      whenDays === undefined ||
      withinDays(item.postedDate ?? item.postedAt, whenDays, nowMs)
    );
  });

  const selectedLocations = new Set(
    selection.locations.map(normalizedLabel).filter(Boolean),
  );
  if (
    selectedLocations.size === 0 ||
    selection.locationMode === "anywhere"
  ) {
    return filtered;
  }

  const matching: TItem[] = [];
  const remaining: TItem[] = [];
  for (const item of filtered) {
    (matchesJobLocation(item, selectedLocations) ? matching : remaining).push(
      item,
    );
  }
  if (matching.length === 0) return filtered;
  return selection.locationMode === "only"
    ? matching
    : [...matching, ...remaining];
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

/**
 * B20-01 (A: event A20-01). schema.org has THREE attendance modes — Offline,
 * Online and **Mixed** — but an opportunity record carries a two-valued
 * `isOnline` boolean, so `Mixed` (which means "there is a physical venue AND
 * an online option") is stored as if it meant "there is no physical venue".
 * Every render site then used that flag to delete the venue, which is how a
 * physical conference in Rome came to render `Online` on its card while THIS
 * FILE already classified the very same row as `hybrid` for the filter chips.
 *
 * Exported so the render sites ask the question the facet layer was already
 * asking, off ONE definition — the card, the event report and the facet chips
 * cannot drift apart again. `opportunityFormat` below is unchanged in
 * behaviour; it now calls this instead of inlining the same three checks.
 */
export function hasPhysicalPlace(place: OpportunityPlace | undefined): boolean {
  return Boolean(
    cleanLabel(place?.city) || cleanLabel(place?.region) || cleanLabel(place?.country),
  );
}

/**
 * B20-01. The one question every `isOnline` render site must ask before it
 * replaces a venue with the word `Online`: is this record *only* online?
 * A hybrid answers `false` here and keeps its venue.
 */
export function isOnlineOnly(item: {
  isOnline?: boolean;
  place?: OpportunityPlace;
}): boolean {
  return Boolean(item.isOnline) && !hasPhysicalPlace(item.place);
}

export function opportunityFormat(
  surface: FacetSurface,
  item: FacetableOpportunity,
): OpportunityFormat {
  const explicitlyHybrid = /\bhybrid\b/i.test(item.location);
  if (explicitlyHybrid) return "hybrid";

  if (surface === "events") {
    if (!item.isOnline) return "in-person";
    return hasPhysicalPlace(item.place) ? "hybrid" : "online";
  }

  return item.isRemote ? "online" : "in-person";
}

export function opportunityFacetValues(
  surface: FacetSurface,
  item: FacetableOpportunity,
): OpportunityFacetValues {
  return {
    location: locationLabel(item),
    month: monthLabel(item),
    format: opportunityFormat(surface, item),
  };
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
    const values = opportunityFacetValues(surface, item);
    incrementLabel(locations, values.location);
    incrementLabel(months, values.month);
    format[values.format] += 1;
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

export function mergeOpportunityFacetCounts(
  ...sources: OpportunityFacetCounts[]
): OpportunityFacetCounts {
  const merged = emptyOpportunityFacetCounts();
  for (const source of sources) {
    for (const [label, count] of Object.entries(source.location)) {
      merged.location[label] = (merged.location[label] ?? 0) + count;
    }
    for (const [label, count] of Object.entries(source.month)) {
      merged.month[label] = (merged.month[label] ?? 0) + count;
    }
    for (const format of OPPORTUNITY_FORMATS) {
      merged.format[format] += source.format[format] ?? 0;
    }
  }
  return merged;
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
    const values = opportunityFacetValues(surface, item);
    const location = values.location;
    if (
      locations.size > 0 &&
      (!location || !locations.has(normalizedLabel(location)))
    ) {
      return false;
    }

    const month = values.month;
    if (months.size > 0 && (!month || !months.has(normalizedLabel(month)))) {
      return false;
    }

    return (
      formats.size === 0 ||
      matchesSelectedFormat(values.format, formats)
    );
  });
}
