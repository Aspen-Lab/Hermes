import type { Event, Job, Paper } from "@/types";
import { localCalendarDate } from "@/lib/local-calendar-date";

export const ACTIVITY_LEDGER_STORAGE_KEY = "peer-activity-ledger-v1";

export type ActivityItemKind = "paper" | "event" | "job";
export type ActivityDeadlineKind =
  | "application"
  | "registration"
  | "submission";

export interface ActivityArrival {
  id: string;
  kind: ActivityItemKind;
  requiredTopics: string[];
}

export interface ActivityDeadline {
  kind: ActivityDeadlineKind;
  at: string;
}

export interface SavedActivityItem {
  id: string;
  kind: ActivityItemKind;
  title: string;
  read: boolean;
  appliedAt?: string;
  registeredAt?: string;
  submittedAt?: string;
  deadlines: ActivityDeadline[];
}

export interface StoredActivityDay {
  date: string;
  arrivals: ActivityArrival[];
}

export interface ActivityLedger {
  version: 1;
  days: StoredActivityDay[];
  /** Current running state, intentionally independent of 90-day arrival rows. */
  savedItems: SavedActivityItem[];
}

export interface ActivityCounts {
  papers: number;
  events: number;
  jobs: number;
}

export interface AggregatedActivityDay {
  date: string;
  counts: ActivityCounts;
  requiredTopicHits: Record<string, number>;
}

export interface ActivityAggregate {
  days: AggregatedActivityDay[];
  totals: ActivityCounts;
  requiredTopicHits: Record<string, number>;
  savedItems: SavedActivityItem[];
}

export interface ActivityLedgerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BuildActivitySnapshotInput {
  papers: Paper[];
  events: Event[];
  jobs: Job[];
  savedPapers: Paper[];
  savedEvents: Event[];
  savedJobs: Job[];
  readItems: Record<string, true>;
  appliedAt: Record<string, string>;
  registeredAt: Record<string, string>;
  submittedAt: Record<string, string>;
  requiredTopics: {
    papers: string[];
    events: string[];
    jobs: string[];
  };
}

const EMPTY_COUNTS = (): ActivityCounts => ({
  papers: 0,
  events: 0,
  jobs: 0,
});

function emptyLedger(): ActivityLedger {
  return { version: 1, days: [], savedItems: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function itemKind(value: unknown): ActivityItemKind | undefined {
  return value === "paper" || value === "event" || value === "job"
    ? value
    : undefined;
}

function deadlineKind(value: unknown): ActivityDeadlineKind | undefined {
  return value === "application" ||
    value === "registration" ||
    value === "submission"
    ? value
    : undefined;
}

function validDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function dateFromKey(value: string): Date | undefined {
  if (!validDateKey(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function shiftDateKey(value: string, days: number): string | undefined {
  const date = dateFromKey(value);
  if (!date) return undefined;
  date.setDate(date.getDate() + days);
  return localCalendarDate(date);
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function topicIdentity(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const topics = new Map<string, string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const label = candidate.trim();
    const key = topicIdentity(label);
    if (key && !topics.has(key)) topics.set(key, label);
  }
  return [...topics.values()];
}

function mergeTopics(first: string[], second: string[]): string[] {
  return normalizedTopics([...first, ...second]);
}

function normalizeArrival(value: unknown): ActivityArrival | undefined {
  if (!isRecord(value)) return undefined;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const kind = itemKind(value.kind);
  if (!id || !kind) return undefined;
  return {
    id,
    kind,
    requiredTopics: normalizedTopics(value.requiredTopics),
  };
}

function normalizeDeadline(value: unknown): ActivityDeadline | undefined {
  if (!isRecord(value)) return undefined;
  const kind = deadlineKind(value.kind);
  if (!kind || !validTimestamp(value.at)) return undefined;
  return { kind, at: value.at };
}

function normalizeSavedItem(value: unknown): SavedActivityItem | undefined {
  if (!isRecord(value)) return undefined;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const kind = itemKind(value.kind);
  if (!id || !kind) return undefined;

  const deadlines = new Map<string, ActivityDeadline>();
  if (Array.isArray(value.deadlines)) {
    for (const candidate of value.deadlines) {
      const deadline = normalizeDeadline(candidate);
      if (deadline) deadlines.set(`${deadline.kind}:${deadline.at}`, deadline);
    }
  }

  return {
    id,
    kind,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : id,
    read: value.read === true,
    ...(validTimestamp(value.appliedAt)
      ? { appliedAt: value.appliedAt }
      : {}),
    ...(validTimestamp(value.registeredAt)
      ? { registeredAt: value.registeredAt }
      : {}),
    ...(validTimestamp(value.submittedAt)
      ? { submittedAt: value.submittedAt }
      : {}),
    deadlines: [...deadlines.values()],
  };
}

function normalizeSavedItems(value: unknown): SavedActivityItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, SavedActivityItem>();
  for (const candidate of value) {
    const item = normalizeSavedItem(candidate);
    if (item) items.set(`${item.kind}:${item.id}`, item);
  }
  return [...items.values()];
}

function normalizeLedger(value: unknown): ActivityLedger {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.days)) {
    return emptyLedger();
  }

  const days = new Map<string, Map<string, ActivityArrival>>();
  for (const candidate of value.days) {
    if (!isRecord(candidate) || !validDateKey(candidate.date)) continue;
    const arrivals = days.get(candidate.date) ?? new Map();
    if (Array.isArray(candidate.arrivals)) {
      for (const rawArrival of candidate.arrivals) {
        const arrival = normalizeArrival(rawArrival);
        if (!arrival) continue;
        const key = `${arrival.kind}:${arrival.id}`;
        const existing = arrivals.get(key);
        arrivals.set(
          key,
          existing
            ? {
                ...existing,
                requiredTopics: mergeTopics(
                  existing.requiredTopics,
                  arrival.requiredTopics,
                ),
              }
            : arrival,
        );
      }
    }
    days.set(candidate.date, arrivals);
  }

  return {
    version: 1,
    days: [...days.entries()]
      .map(([date, arrivals]) => ({
        date,
        arrivals: [...arrivals.values()],
      }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    savedItems: normalizeSavedItems(value.savedItems),
  };
}

function browserStorage(
  explicit?: ActivityLedgerStorage,
): ActivityLedgerStorage | undefined {
  if (explicit) return explicit;
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function writeLedger(
  ledger: ActivityLedger,
  storage?: ActivityLedgerStorage,
): void {
  const target = browserStorage(storage);
  if (!target) return;
  try {
    target.setItem(ACTIVITY_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Browser storage can be disabled or full; the in-memory result still works.
  }
}

export function readActivityLedger(
  storage?: ActivityLedgerStorage,
): ActivityLedger {
  const target = browserStorage(storage);
  if (!target) return emptyLedger();
  try {
    const raw = target.getItem(ACTIVITY_LEDGER_STORAGE_KEY);
    return raw ? normalizeLedger(JSON.parse(raw) as unknown) : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

export function appendActivity(
  input: {
    arrivals: ActivityArrival[];
    savedItems?: SavedActivityItem[];
    now?: Date;
  },
  storage?: ActivityLedgerStorage,
): ActivityLedger {
  const now = input.now ?? new Date();
  const today = localCalendarDate(now);
  const cutoffDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 89,
    12,
  );
  const cutoff = localCalendarDate(cutoffDate);
  const current = readActivityLedger(storage);
  const todayArrivals = new Map<string, ActivityArrival>();
  const existingToday = current.days.find(({ date }) => date === today);

  for (const candidate of existingToday?.arrivals ?? []) {
    const arrival = normalizeArrival(candidate);
    if (arrival) todayArrivals.set(`${arrival.kind}:${arrival.id}`, arrival);
  }
  for (const candidate of input.arrivals) {
    const arrival = normalizeArrival(candidate);
    if (!arrival) continue;
    const key = `${arrival.kind}:${arrival.id}`;
    const existing = todayArrivals.get(key);
    todayArrivals.set(
      key,
      existing
        ? {
            ...existing,
            requiredTopics: mergeTopics(
              existing.requiredTopics,
              arrival.requiredTopics,
            ),
          }
        : arrival,
    );
  }

  const nextDays = current.days.filter(
    ({ date }) => date !== today && date >= cutoff,
  );
  if (todayArrivals.size > 0) {
    nextDays.push({ date: today, arrivals: [...todayArrivals.values()] });
  }
  nextDays.sort((left, right) => left.date.localeCompare(right.date));

  const next: ActivityLedger = {
    version: 1,
    days: nextDays,
    savedItems:
      input.savedItems === undefined
        ? current.savedItems
        : normalizeSavedItems(input.savedItems),
  };
  writeLedger(next, storage);
  return next;
}

export function aggregateActivity(
  input: { from: string; through: string },
  storage?: ActivityLedgerStorage,
): ActivityAggregate {
  const ledger = readActivityLedger(storage);
  const throughDate = dateFromKey(input.through);
  const requestedFrom = dateFromKey(input.from);
  const empty: ActivityAggregate = {
    days: [],
    totals: EMPTY_COUNTS(),
    requiredTopicHits: {},
    savedItems: ledger.savedItems,
  };
  if (!throughDate || !requestedFrom || input.from > input.through) return empty;

  // The store retains only 90 days; cap wider requests to that same window.
  const retainedFrom = shiftDateKey(input.through, -89);
  if (!retainedFrom) return empty;
  const from = input.from < retainedFrom ? retainedFrom : input.from;
  const arrivalsByDate = new Map(
    ledger.days.map((day) => [day.date, day.arrivals]),
  );
  const totals = EMPTY_COUNTS();
  const requiredTopicHits: Record<string, number> = {};
  const days: AggregatedActivityDay[] = [];

  for (
    let cursor = dateFromKey(from);
    cursor && localCalendarDate(cursor) <= input.through;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const date = localCalendarDate(cursor);
    const counts = EMPTY_COUNTS();
    const dayTopicHits: Record<string, number> = {};
    for (const arrival of arrivalsByDate.get(date) ?? []) {
      if (arrival.kind === "paper") counts.papers += 1;
      else if (arrival.kind === "event") counts.events += 1;
      else counts.jobs += 1;
      for (const topic of arrival.requiredTopics) {
        dayTopicHits[topic] = (dayTopicHits[topic] ?? 0) + 1;
        requiredTopicHits[topic] = (requiredTopicHits[topic] ?? 0) + 1;
      }
    }
    totals.papers += counts.papers;
    totals.events += counts.events;
    totals.jobs += counts.jobs;
    days.push({ date, counts, requiredTopicHits: dayTopicHits });
  }

  return {
    days,
    totals,
    requiredTopicHits,
    savedItems: ledger.savedItems,
  };
}

export function clearActivityLedger(storage?: ActivityLedgerStorage): void {
  const target = browserStorage(storage);
  if (!target) return;
  try {
    target.removeItem(ACTIVITY_LEDGER_STORAGE_KEY);
  } catch {
    // Match the read/write degradation contract.
  }
}

function matchedRequiredTopics(
  requiredTopics: string[],
  matchedTerms: string[],
): string[] {
  const matchedKeys = new Set(
    normalizedTopics(matchedTerms).map(topicIdentity),
  );
  return normalizedTopics(requiredTopics).filter((topic) =>
    matchedKeys.has(topicIdentity(topic)),
  );
}

function deadline(
  kind: ActivityDeadlineKind,
  at: string | undefined,
): ActivityDeadline[] {
  return validTimestamp(at) ? [{ kind, at }] : [];
}

export function buildActivitySnapshot(
  input: BuildActivitySnapshotInput,
): {
  arrivals: ActivityArrival[];
  savedItems: SavedActivityItem[];
} {
  const arrivals: ActivityArrival[] = [
    ...input.papers.map((paper) => ({
      id: paper.id,
      kind: "paper" as const,
      requiredTopics: matchedRequiredTopics(
        input.requiredTopics.papers,
        paper.summaryExperimentKeywords,
      ),
    })),
    ...input.events.map((event) => ({
      id: event.id,
      kind: "event" as const,
      requiredTopics: matchedRequiredTopics(
        input.requiredTopics.events,
        event.matchedTerms ?? [],
      ),
    })),
    ...input.jobs.map((job) => ({
      id: job.id,
      kind: "job" as const,
      requiredTopics: matchedRequiredTopics(
        input.requiredTopics.jobs,
        job.matchedTerms ?? [],
      ),
    })),
  ];

  const savedItems: SavedActivityItem[] = [
    ...input.savedPapers.map((paper) => ({
      id: paper.id,
      kind: "paper" as const,
      title: paper.title,
      read: Boolean(input.readItems[paper.id]),
      deadlines: [],
    })),
    ...input.savedEvents.map((event) => ({
      id: event.id,
      kind: "event" as const,
      title: event.name,
      read: Boolean(input.readItems[event.id]),
      ...(input.registeredAt[event.id]
        ? { registeredAt: input.registeredAt[event.id] }
        : {}),
      ...(input.submittedAt[event.id]
        ? { submittedAt: input.submittedAt[event.id] }
        : {}),
      deadlines: [
        ...deadline("registration", event.registrationDeadline),
        ...deadline("submission", event.deadline),
      ],
    })),
    ...input.savedJobs.map((job) => ({
      id: job.id,
      kind: "job" as const,
      title: job.roleTitle,
      read: Boolean(input.readItems[job.id]),
      ...(input.appliedAt[job.id]
        ? { appliedAt: input.appliedAt[job.id] }
        : {}),
      deadlines: deadline("application", job.applicationDeadline),
    })),
  ];

  return {
    arrivals: arrivals
      .map(normalizeArrival)
      .filter((arrival): arrival is ActivityArrival => Boolean(arrival)),
    savedItems: normalizeSavedItems(savedItems),
  };
}
