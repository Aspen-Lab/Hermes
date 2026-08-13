import type { Event, Job, Paper } from "@/types";

export type ForecastItemType = "job" | "paper" | "event";

/**
 * A union with per-type optional fields, never a forced uniform shape
 * (RULING 4, docs/handoff/MULTIAGENT-mcp-app.md §1e). A field a source
 * genuinely lacks is omitted from the object entirely -- never `null`,
 * never a placeholder. Concretely: `Paper` items never carry `location` or
 * `deadline` at all (the schema has neither field); a job whose source
 * doesn't report a deadline omits the key rather than sending `null`.
 */
export interface ForecastItem {
  id: string;
  type: ForecastItemType;
  title: string;
  org?: string;
  location?: string;
  posted?: string;
  deadline?: string;
  relevance?: number;
  whyItMatters?: string;
  tags?: string[];
  deepLink?: string;
  /** Always `false` in M1 -- there are no write tools yet (M5 scope). */
  isSaved: boolean;
}

export interface ForecastCounts {
  jobs: number;
  papers: number;
  events: number;
  total: number;
  shown: number;
}

export interface DailyForecastResult {
  date: string;
  generatedAt: string;
  counts: ForecastCounts;
  items: ForecastItem[];
  /**
   * The user's display name, for the fullscreen home's "ranked for
   * {name}'s Persona" sub-line only -- `get_daily_forecast`'s inline card
   * doesn't need it, so only `open_home` populates this (optional, and a
   * user who never set a display name genuinely has none -- render a
   * generic "your Persona" fallback, never a placeholder name).
   */
  personaName?: string;
}

/**
 * Deletes any key whose value is `undefined`, so an absent field is
 * literally missing from the object -- not present-but-`null`. A source
 * field that's typed optional (e.g. a job with no reported deadline) goes
 * through here; a field a *type* structurally lacks (papers' location/
 * deadline) is never assigned in the first place, so it never reaches this
 * function at all -- see paperToForecastItem below.
 */
function omitUndefined<T extends object>(obj: T): T {
  const rec = obj as unknown as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (rec[key] === undefined) delete rec[key];
  }
  return obj;
}

export function jobToForecastItem(job: Job): ForecastItem {
  return omitUndefined<ForecastItem>({
    id: job.id,
    type: "job",
    title: job.roleTitle,
    org: job.companyOrLab,
    location: job.location,
    posted: job.postedDate,
    // RULING 4: stays absent when the source doesn't carry one -- most free
    // job sources don't (confirmed live in A's round-1 Pass 2).
    deadline: job.applicationDeadline,
    relevance: job.relevanceScore,
    whyItMatters: job.matchReason,
    tags: job.keyRequirements,
    deepLink: job.linkPosting,
    isSaved: false,
  });
}

export function paperToForecastItem(paper: Paper): ForecastItem {
  return omitUndefined<ForecastItem>({
    id: paper.id,
    type: "paper",
    title: paper.title,
    org: paper.venue,
    // location/deadline: never assigned -- `Paper` has neither field
    // (RULING 4). The mockup's "CHI deadline" row is illustrative content,
    // not a data contract; adding CFP deadlines to the paper pipeline is
    // product work outside this loop.
    posted: paper.publishedDate,
    relevance: paper.relevanceScore,
    whyItMatters: paper.relevanceReason,
    tags: paper.summaryExperimentKeywords,
    deepLink: paper.linkPaper ?? paper.linkArxiv,
    isSaved: false,
  });
}

export function eventToForecastItem(event: Event): ForecastItem {
  return omitUndefined<ForecastItem>({
    id: event.id,
    type: "event",
    title: event.name,
    org: event.organisations?.[0]?.name,
    location: event.location,
    posted: event.date,
    deadline: event.deadline ?? event.registrationDeadline,
    relevance: event.relevanceScore,
    whyItMatters: event.relevanceReason,
    tags: event.tags,
    deepLink: event.linkOfficial ?? event.linkRegistration,
    isSaved: false,
  });
}
