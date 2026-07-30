import { describe, expect, it } from "vitest";
import type { Event, Job, Paper } from "@/types";
import { localCalendarDate } from "@/lib/local-calendar-date";
import {
  ACTIVITY_LEDGER_STORAGE_KEY,
  aggregateActivity,
  appendActivity,
  buildActivitySnapshot,
  readActivityLedger,
  type ActivityLedgerStorage,
  type SavedActivityItem,
} from "./activity-ledger";

class MemoryStorage implements ActivityLedgerStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function localDate(base: Date, offset: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offset,
    12,
  );
}

describe("activity ledger", () => {
  it("appends idempotently and merges required-topic hits", () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 6, 30, 9);

    appendActivity(
      {
        now,
        arrivals: [
          {
            id: "shared-id",
            kind: "paper",
            requiredTopics: ["Battery Materials"],
          },
        ],
      },
      storage,
    );
    appendActivity(
      {
        now,
        arrivals: [
          {
            id: "shared-id",
            kind: "paper",
            requiredTopics: ["battery-materials", "Electrolytes"],
          },
          {
            id: "shared-id",
            kind: "event",
            requiredTopics: ["Battery Materials"],
          },
        ],
      },
      storage,
    );

    const ledger = readActivityLedger(storage);
    expect(ledger.days).toHaveLength(1);
    expect(ledger.days[0].arrivals).toHaveLength(2);
    expect(ledger.days[0].arrivals[0].requiredTopics).toEqual([
      "Battery Materials",
      "Electrolytes",
    ]);

    const aggregate = aggregateActivity(
      {
        from: localCalendarDate(now),
        through: localCalendarDate(now),
      },
      storage,
    );
    expect(aggregate.totals).toEqual({ papers: 1, events: 1, jobs: 0 });
    expect(aggregate.requiredTopicHits).toEqual({
      "Battery Materials": 2,
      Electrolytes: 1,
    });
  });

  it("aggregates an inclusive range and zero-fills missing local days", () => {
    const storage = new MemoryStorage();
    const first = new Date(2026, 6, 30, 23, 30);
    const third = new Date(2026, 7, 1, 0, 30);

    appendActivity(
      {
        now: first,
        arrivals: [
          {
            id: "paper-1",
            kind: "paper",
            requiredTopics: ["Batteries"],
          },
        ],
      },
      storage,
    );
    appendActivity(
      {
        now: third,
        arrivals: [
          {
            id: "job-1",
            kind: "job",
            requiredTopics: ["Interfaces"],
          },
        ],
      },
      storage,
    );

    const aggregate = aggregateActivity(
      { from: "2026-07-30", through: "2026-08-01" },
      storage,
    );
    expect(aggregate.days.map(({ date }) => date)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
    expect(aggregate.days[1].counts).toEqual({
      papers: 0,
      events: 0,
      jobs: 0,
    });
    expect(aggregate.totals).toEqual({ papers: 1, events: 0, jobs: 1 });
  });

  it("prunes the 91st day while retaining today and the prior 89 days", () => {
    const storage = new MemoryStorage();
    const today = new Date(2026, 6, 30, 12);
    const dayMinus90 = localDate(today, -90);
    const dayMinus89 = localDate(today, -89);

    appendActivity(
      {
        now: dayMinus90,
        arrivals: [
          { id: "too-old", kind: "paper", requiredTopics: [] },
        ],
      },
      storage,
    );
    appendActivity(
      {
        now: dayMinus89,
        arrivals: [
          { id: "oldest-kept", kind: "event", requiredTopics: [] },
        ],
      },
      storage,
    );
    appendActivity(
      {
        now: today,
        arrivals: [{ id: "today", kind: "job", requiredTopics: [] }],
      },
      storage,
    );

    expect(readActivityLedger(storage).days.map(({ date }) => date)).toEqual([
      localCalendarDate(dayMinus89),
      localCalendarDate(today),
    ]);
  });

  it("preserves and replaces the current saved-item snapshot independently", () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 6, 30, 12);
    const savedItems: SavedActivityItem[] = [
      {
        id: "event-1",
        kind: "event",
        title: "Battery Summit",
        read: true,
        registeredAt: "2026-07-30T15:00:00.000Z",
        deadlines: [
          { kind: "registration", at: "2026-08-05" },
          { kind: "submission", at: "2026-08-12" },
        ],
      },
      {
        id: "job-1",
        kind: "job",
        title: "Research Scientist",
        read: false,
        appliedAt: "2026-07-30T16:00:00.000Z",
        deadlines: [{ kind: "application", at: "2026-08-20" }],
      },
    ];

    appendActivity({ now, arrivals: [], savedItems }, storage);
    appendActivity({ now, arrivals: [] }, storage);

    const aggregate = aggregateActivity(
      { from: "2026-07-30", through: "2026-07-30" },
      storage,
    );
    expect(aggregate.savedItems).toEqual(savedItems);

    appendActivity({ now, arrivals: [], savedItems: [] }, storage);
    expect(readActivityLedger(storage).savedItems).toEqual([]);
  });

  it("builds arrivals and running saved state from feed data", () => {
    const paper: Paper = {
      id: "paper-1",
      title: "Solid-state interfaces",
      authors: ["A. Researcher"],
      relevanceReason: "Relevant",
      venue: "Example Journal",
      source: "other",
      summaryIntro: "Summary",
      summaryExperimentKeywords: ["solid-state batteries"],
      summaryResultDiscussion: "Result",
      isSaved: true,
    };
    const event: Event = {
      id: "event-1",
      name: "Battery Summit",
      type: "conference",
      date: "2026-09-01",
      location: "Chicago",
      isOnline: false,
      deadline: "2026-08-12",
      registrationDeadline: "2026-08-05",
      shortDescription: "Summary",
      relevanceReason: "Relevant",
      matchedTerms: ["electrolytes"],
      isSaved: true,
    };
    const job: Job = {
      id: "job-1",
      roleTitle: "Research Scientist",
      companyOrLab: "Example Lab",
      location: "Chicago",
      isRemote: false,
      applicationDeadline: "2026-08-20",
      keyRequirements: [],
      matchReason: "Relevant",
      matchedTerms: ["interfaces"],
      isSaved: true,
    };

    const snapshot = buildActivitySnapshot({
      papers: [paper],
      events: [event],
      jobs: [job],
      savedPapers: [paper],
      savedEvents: [event],
      savedJobs: [job],
      readItems: { [paper.id]: true },
      appliedAt: { [job.id]: "2026-07-30T16:00:00.000Z" },
      registeredAt: { [event.id]: "2026-07-30T15:00:00.000Z" },
      submittedAt: {},
      requiredTopics: {
        papers: ["Solid state batteries"],
        events: ["Electrolytes"],
        jobs: ["Interfaces"],
      },
    });

    expect(snapshot.arrivals.map(({ requiredTopics }) => requiredTopics)).toEqual(
      [
        ["Solid state batteries"],
        ["Electrolytes"],
        ["Interfaces"],
      ],
    );
    expect(snapshot.savedItems).toMatchObject([
      { id: paper.id, read: true },
      {
        id: event.id,
        registeredAt: "2026-07-30T15:00:00.000Z",
        deadlines: [
          { kind: "registration", at: "2026-08-05" },
          { kind: "submission", at: "2026-08-12" },
        ],
      },
      {
        id: job.id,
        appliedAt: "2026-07-30T16:00:00.000Z",
        deadlines: [{ kind: "application", at: "2026-08-20" }],
      },
    ]);
  });

  it("degrades corrupt storage to an empty ledger", () => {
    const storage = new MemoryStorage();
    storage.setItem(ACTIVITY_LEDGER_STORAGE_KEY, "{not-json");

    expect(readActivityLedger(storage)).toEqual({
      version: 1,
      days: [],
      savedItems: [],
    });
  });
});
