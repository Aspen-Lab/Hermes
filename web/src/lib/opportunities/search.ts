import type { Event, Job, OpportunityPlace } from "@/types";

export type OpportunitySearchSurface = "all" | "papers" | "events" | "jobs";

function normalizedQuery(query: string): string | undefined {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized.length >= 2 ? normalized : undefined;
}

function placeFields(place: OpportunityPlace | undefined): string[] {
  return [place?.city, place?.region, place?.country].filter(
    (value): value is string => Boolean(value),
  );
}

function includesQuery(fields: readonly string[], query: string): boolean {
  return fields.some((field) => field.toLocaleLowerCase().includes(query));
}

export function shouldSearchPapers(
  surface: OpportunitySearchSurface,
  query: string,
): boolean {
  return Boolean(
    normalizedQuery(query) &&
      (surface === "all" || surface === "papers"),
  );
}

export function shouldSearchOpportunities(
  surface: OpportunitySearchSurface,
  query: string,
): boolean {
  return Boolean(normalizedQuery(query) && surface !== "papers");
}

export function filterEventsByOpportunityQuery(
  events: Event[],
  query: string,
): Event[] {
  const normalized = normalizedQuery(query);
  if (!normalized) return events;

  return events.filter((event) =>
    includesQuery(
      [
        event.name,
        event.shortDescription,
        event.location,
        ...placeFields(event.place),
        event.type,
      ],
      normalized,
    ),
  );
}

export function filterJobsByOpportunityQuery(
  jobs: Job[],
  query: string,
): Job[] {
  const normalized = normalizedQuery(query);
  if (!normalized) return jobs;

  return jobs.filter((job) =>
    includesQuery(
      [
        job.roleTitle,
        ...(job.companyOrLab ? [job.companyOrLab] : []),
        job.matchReason,
        job.location,
        ...placeFields(job.place),
        ...job.keyRequirements,
      ],
      normalized,
    ),
  );
}
