import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  AggregatedActivityDay,
  SavedActivityItem,
} from "@/lib/dashboard/activity-ledger";
import { DashboardOverview } from "./dashboard-overview";

const days: AggregatedActivityDay[] = Array.from(
  { length: 14 },
  (_, index): AggregatedActivityDay => ({
    date: `2026-07-${String(17 + index).padStart(2, "0")}`,
    counts:
      index === 13
        ? { papers: 3, events: 2, jobs: 1 }
        : { papers: 0, events: 0, jobs: 0 },
    requiredTopicHits:
      index === 13 ? { "Battery materials": 2 } : {},
  }),
);

const savedItems: SavedActivityItem[] = [
  {
    id: "paper-read",
    kind: "paper",
    title: "Read paper",
    read: true,
    deadlines: [],
  },
  {
    id: "paper-unread",
    kind: "paper",
    title: "Unread paper",
    read: false,
    deadlines: [],
  },
  {
    id: "event-registered",
    kind: "event",
    title: "Registered event",
    read: false,
    registeredAt: "2026-07-30T12:00:00.000Z",
    deadlines: [],
  },
  {
    id: "job-applied",
    kind: "job",
    title: "Applied job",
    read: false,
    appliedAt: "2026-07-30T13:00:00.000Z",
    deadlines: [],
  },
];

describe("DashboardOverview", () => {
  it("renders today, 14-day activity, holdings and topic coverage", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardOverview, {
        today: { papers: 3, events: 2, jobs: 1 },
        days,
        savedItems,
        requiredTopics: ["Battery materials", "Electrolytes"],
        requiredTopicHits: { "Battery materials": 2 },
      }),
    );

    expect(html).toContain('data-dashboard-count="papers-today"');
    expect(html).toContain('data-dashboard-count="events-today"');
    expect(html).toContain('data-dashboard-count="jobs-today"');
    expect(html).toContain('data-dashboard-count="you-saved"');
    expect(html.match(/data-chart-day=/g)).toHaveLength(14);
    expect(html).toContain("1</span> / 2 read");
    expect(html).toContain("1</span> / 1 registered or submitted");
    expect(html).toContain("1</span> / 1 applied");
    expect(html).toContain('data-topic-coverage="Battery materials"');
    expect(html).toContain('data-topic-coverage="Electrolytes"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("handles empty holdings and topics without invalid ratios", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardOverview, {
        today: { papers: 0, events: 0, jobs: 0 },
        days,
        savedItems: [],
        requiredTopics: [],
        requiredTopicHits: {},
      }),
    );

    expect(html).toContain("0</span> / 0 read");
    expect(html).toContain("Add required topics");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
