"use client";

import { type ReactNode, useState } from "react";
import type {
  OpportunityFacetCounts,
  OpportunityFacetSelection,
  OpportunityFormat,
  RoleKind,
} from "@/types";
import { FilterChip } from "@/components/search/filter-chip";
import {
  COUNTRY_NAMES,
  CONFERENCE_CITIES,
} from "@/lib/opportunities/structured-extract";
import {
  DEFAULT_JOB_FACET_SELECTION,
  type JobFacetCounts,
  type JobFacetSelection,
  type JobLocationMode,
  type JobVisaState,
  type JobWhen,
} from "@/lib/opportunities/facets";

type FacetGroup = keyof OpportunityFacetSelection;

interface OpportunityFacetPanelProps {
  counts: OpportunityFacetCounts;
  selection: OpportunityFacetSelection;
  onChange: (selection: OpportunityFacetSelection) => void;
  scopeLabel: string;
}

interface FacetOption {
  value: string;
  label: string;
  count: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const VISIBLE_OPTIONS = 6;
const FORMAT_LABELS: Record<OpportunityFormat, string> = {
  "in-person": "In person",
  online: "Online",
  hybrid: "Hybrid",
};

const GROUP_LABELS: Record<FacetGroup, string> = {
  location: "Location",
  month: "When",
  format: "Format",
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function selectionValues(
  selection: OpportunityFacetSelection,
  group: FacetGroup,
): string[] {
  return (selection[group] ?? []) as string[];
}

export function toggleOpportunityFacet(
  selection: OpportunityFacetSelection,
  group: FacetGroup,
  value: string,
): OpportunityFacetSelection {
  const current = selectionValues(selection, group);
  const key = normalized(value);
  const active = current.some((candidate) => normalized(candidate) === key);
  const next = active
    ? current.filter((candidate) => normalized(candidate) !== key)
    : [...current, value];
  return {
    ...selection,
    [group]: next.length > 0 ? next : undefined,
  };
}

function formatMonth(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  const monthName = MONTH_NAMES[Number(match[2]) - 1];
  return monthName ? `${monthName} ${match[1]}` : value;
}

function optionsFor(
  group: FacetGroup,
  counts: OpportunityFacetCounts,
): FacetOption[] {
  if (group === "format") {
    return (Object.keys(FORMAT_LABELS) as OpportunityFormat[])
      .map((value) => ({
        value,
        label: FORMAT_LABELS[value],
        count: counts.format[value],
      }))
      .filter((option) => option.count > 0);
  }

  const options = Object.entries(counts[group])
    .filter(([, count]) => count > 0)
    .map(([value, count]) => ({
      value,
      label: group === "month" ? formatMonth(value) : value,
      count,
    }));
  return options.sort((left, right) =>
    group === "month"
      ? left.value.localeCompare(right.value)
      : right.count - left.count || left.label.localeCompare(right.label),
  );
}

function isSelected(
  selection: OpportunityFacetSelection,
  group: FacetGroup,
  value: string,
): boolean {
  const key = normalized(value);
  return selectionValues(selection, group).some(
    (candidate) => normalized(candidate) === key,
  );
}

export function OpportunityFacetPanel({
  counts,
  selection,
  onChange,
  scopeLabel,
}: OpportunityFacetPanelProps) {
  const [expanded, setExpanded] = useState<
    Partial<Record<FacetGroup, boolean>>
  >({});
  const total = Object.values(counts.format).reduce(
    (sum, count) => sum + count,
    0,
  );
  const activeCount =
    (selection.location?.length ?? 0) +
    (selection.month?.length ?? 0) +
    (selection.format?.length ?? 0);

  return (
    <section
      aria-label="Filter opportunities"
      className="mt-4 rounded-3xl glass shadow-card px-4 py-4 sm:px-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-body-sm font-semibold tracking-[-0.01em] text-heading">
            Today’s opportunity pool
          </p>
          <p className="mt-0.5 text-caption text-text-muted">
            {total} {scopeLabel} found today · refreshing keeps the same set until tomorrow
          </p>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="shrink-0 rounded-full px-3 py-1.5 text-caption font-medium text-accent transition-colors hover:bg-accent/10"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {(["location", "month", "format"] as FacetGroup[]).map((group) => {
          const options = optionsFor(group, counts);
          const showAll = expanded[group] || options.length <= VISIBLE_OPTIONS;
          const visible = showAll
            ? options
            : options.slice(0, VISIBLE_OPTIONS);
          const hiddenCount = options.length - visible.length;

          return (
            <div
              key={group}
              role="group"
              aria-label={GROUP_LABELS[group]}
              className="grid min-w-0 gap-2 sm:grid-cols-[52px_minmax(0,1fr)] sm:items-start"
            >
              <span className="text-caption font-medium text-text-muted sm:pt-2.5">
                {GROUP_LABELS[group]}
              </span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {visible.length === 0 ? (
                  <span className="py-2 text-caption text-text-faint">
                    Nothing to filter yet
                  </span>
                ) : (
                  visible.map((option) => {
                    const active = isSelected(
                      selection,
                      group,
                      option.value,
                    );
                    return (
                      <FilterChip
                        key={option.value}
                        label={option.label}
                        displayValue={`${option.label} ${option.count}`}
                        active={active}
                        onClick={() =>
                          onChange(
                            toggleOpportunityFacet(
                              selection,
                              group,
                              option.value,
                            ),
                          )
                        }
                        onClear={
                          active
                            ? () =>
                                onChange(
                                  toggleOpportunityFacet(
                                    selection,
                                    group,
                                    option.value,
                                  ),
                                )
                            : undefined
                        }
                        ariaLabel={`${active ? "Remove" : "Apply"} ${GROUP_LABELS[group].toLocaleLowerCase()} filter ${option.label}, ${option.count} ${option.count === 1 ? "item" : "items"}`}
                      />
                    );
                  })
                )}
                {options.length > VISIBLE_OPTIONS && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [group]: !current[group],
                      }))
                    }
                    aria-expanded={Boolean(expanded[group])}
                    className="h-10 rounded-full px-3 text-caption font-medium text-text-muted transition-colors hover:bg-bg-secondary hover:text-heading"
                  >
                    {expanded[group] ? "Show fewer" : `More +${hiddenCount}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const JOB_LOCATION_OPTIONS = Array.from(
  new Map(
    [...CONFERENCE_CITIES, ...COUNTRY_NAMES].map((location) => [
      normalized(location),
      location,
    ]),
  ).values(),
).sort((left, right) => left.localeCompare(right));

const ROLE_LABELS: Record<RoleKind, string> = {
  internship: "Internship",
  "phd-position": "PhD position",
  postdoc: "Postdoc",
  staff: "Staff",
  faculty: "Faculty",
};

const VISA_LABELS: Record<JobVisaState, string> = {
  sponsors: "Sponsors",
  "not-stated": "Not stated",
  "wont-sponsor": "Won't sponsor",
};

const WHEN_LABELS: Record<JobWhen, string> = {
  any: "Any time",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

const LOCATION_MODE_LABELS: Record<JobLocationMode, string> = {
  anywhere: "Anywhere",
  prefer: "Prefer",
  only: "Only these",
};

function toggleValue<TValue extends string>(
  values: TValue[],
  value: TValue,
): TValue[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export function jobLocationSuggestions(
  query: string,
  selected: string[],
  limit = 8,
): string[] {
  const key = normalized(query);
  if (!key) return [];
  const selectedKeys = new Set(selected.map(normalized));
  return JOB_LOCATION_OPTIONS.filter(
    (location) =>
      !selectedKeys.has(normalized(location)) &&
      normalized(location).includes(key),
  ).slice(0, limit);
}

function JobFilterRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-start">
      <span className="text-caption font-medium text-text-muted sm:pt-2.5">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function JobFacetPanel({
  counts,
  selection,
  onChange,
  onLocationAdded,
  usesAuthorisationDefault,
}: {
  counts: JobFacetCounts;
  selection: JobFacetSelection;
  onChange: (selection: JobFacetSelection) => void;
  onLocationAdded: (location: string) => void;
  usesAuthorisationDefault: boolean;
}) {
  const [locationQuery, setLocationQuery] = useState("");
  const suggestions = jobLocationSuggestions(
    locationQuery,
    selection.locations,
  );
  const activeCount =
    selection.locations.length +
    selection.roleKinds.length +
    selection.visaStates.length +
    Number(selection.when !== "any") +
    Number(selection.includeVisaMismatch);

  const addLocation = (location: string) => {
    onChange({
      ...selection,
      locations: [...selection.locations, location],
      locationMode:
        selection.locationMode === "anywhere"
          ? "prefer"
          : selection.locationMode,
    });
    onLocationAdded(location);
    setLocationQuery("");
  };

  return (
    <section aria-label="Filter jobs" className="mt-5 border-t border-border/50 pt-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-body-sm font-semibold text-heading">Job filters</p>
          <p className="mt-0.5 text-caption text-text-muted">
            Refine today without changing tomorrow&apos;s saved pool.
          </p>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...DEFAULT_JOB_FACET_SELECTION,
                locations: [],
                roleKinds: [],
                visaStates: [],
              })
            }
            className="shrink-0 rounded-full px-3 py-1.5 text-caption font-medium text-accent transition-colors hover:bg-accent/10"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="space-y-4">
        <JobFilterRow label="Where">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LOCATION_MODE_LABELS) as JobLocationMode[]).map(
              (mode) => (
                <FilterChip
                  key={mode}
                  label={LOCATION_MODE_LABELS[mode]}
                  active={selection.locationMode === mode}
                  onClick={() =>
                    onChange({ ...selection, locationMode: mode })
                  }
                />
              ),
            )}
          </div>

          {selection.locations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selection.locations.map((location) => {
                const count = counts.locations[location] ?? 0;
                return (
                  <button
                    key={location}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...selection,
                        locations: selection.locations.filter(
                          (candidate) =>
                            normalized(candidate) !== normalized(location),
                        ),
                      })
                    }
                    className="rounded-xl bg-accent-dim px-3 py-2 text-left text-caption text-accent"
                    aria-label={`Remove location ${location}`}
                  >
                    <span className="block font-medium">{location} ×</span>
                    <span className="mt-0.5 block text-micro opacity-75">
                      {count > 0
                        ? `${count} today`
                        : "nothing today, added to tomorrow's search"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative mt-2">
            <label className="sr-only" htmlFor="job-location-filter">
              Add a city or country
            </label>
            <input
              id="job-location-filter"
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              placeholder="Add a city or country"
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-body-sm text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
            />
            {locationQuery.trim() && (
              <div
                role="listbox"
                aria-label="Location suggestions"
                className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-card-hover"
              >
                {suggestions.length > 0 ? (
                  suggestions.map((location) => {
                    const count = counts.locations[location] ?? 0;
                    return (
                      <button
                        key={location}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => addLocation(location)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-body-sm text-text hover:bg-bg-secondary"
                      >
                        <span>{location}</span>
                        <span className="text-caption text-text-faint">
                          {count > 0 ? `${count} today` : "nothing today"}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-caption text-text-faint">
                    Keep typing a city or country from the list.
                  </p>
                )}
              </div>
            )}
          </div>
        </JobFilterRow>

        <JobFilterRow label="Role type">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROLE_LABELS) as RoleKind[]).map((roleKind) => (
              <FilterChip
                key={roleKind}
                label={ROLE_LABELS[roleKind]}
                displayValue={`${ROLE_LABELS[roleKind]} ${counts.roleKinds[roleKind]}`}
                active={selection.roleKinds.includes(roleKind)}
                onClick={() =>
                  onChange({
                    ...selection,
                    roleKinds: toggleValue(selection.roleKinds, roleKind),
                  })
                }
              />
            ))}
          </div>
        </JobFilterRow>

        <JobFilterRow label="Visa">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VISA_LABELS) as JobVisaState[]).map((visaState) => (
              <FilterChip
                key={visaState}
                label={VISA_LABELS[visaState]}
                displayValue={`${VISA_LABELS[visaState]} ${counts.visaStates[visaState]}`}
                active={selection.visaStates.includes(visaState)}
                onClick={() =>
                  onChange({
                    ...selection,
                    visaStates: toggleValue(
                      selection.visaStates,
                      visaState,
                    ),
                  })
                }
              />
            ))}
          </div>
          {usesAuthorisationDefault && (
            <div className="mt-2 flex items-center gap-2 text-caption text-text-faint">
              <span>
                No-sponsor roles outside your authorised countries are hidden.
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...selection,
                    includeVisaMismatch: !selection.includeVisaMismatch,
                  })
                }
                className="shrink-0 font-medium text-accent hover:underline"
              >
                {selection.includeVisaMismatch ? "Use default" : "Show anyway"}
              </button>
            </div>
          )}
        </JobFilterRow>

        <JobFilterRow label="When">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(WHEN_LABELS) as JobWhen[]).map((when) => (
              <FilterChip
                key={when}
                label={WHEN_LABELS[when]}
                displayValue={`${WHEN_LABELS[when]} ${counts.when[when]}`}
                active={selection.when === when}
                onClick={() => onChange({ ...selection, when })}
              />
            ))}
          </div>
        </JobFilterRow>
      </div>
    </section>
  );
}
