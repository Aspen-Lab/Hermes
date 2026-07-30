import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Event, Job } from "@/types";
import { buildDeadlineRows, DeadlinesBoard } from "./deadlines-board";

const mixedEvent: Event = {
  id: "event-mixed",
  name: "Battery Research Summit",
  type: "conference",
  date: "2026-09-10",
  location: "Chicago, IL",
  isOnline: false,
  deadline: "2026-07-20",
  registrationDeadline: "2026-07-25",
  shortDescription: "Research summit",
  relevanceReason: "Matches battery materials",
};

const pendingJob: Job = {
  id: "job-pending",
  roleTitle: "Electrolyte Researcher",
  companyOrLab: "Peer Lab",
  location: "Chicago, IL",
  isRemote: false,
  keyRequirements: ["Electrochemistry"],
  matchReason: "Matches battery materials",
  applicationDeadline: "2026-08-05",
};

const doneJob: Job = {
  ...pendingJob,
  id: "job-done",
  roleTitle: "Applied Scientist",
  applicationDeadline: "2026-07-15",
};

const nowMs = new Date(2026, 6, 30, 12).getTime();

describe("deadlines board", () => {
  it("sorts incomplete deadlines first by time remaining and sinks two done rows", () => {
    const rows = buildDeadlineRows({
      savedJobs: [pendingJob, doneJob],
      savedEvents: [mixedEvent],
      appliedAt: { "job-done": "2026-07-10T12:00:00.000Z" },
      registeredAt: { "event-mixed": "2026-07-11T12:00:00.000Z" },
      submittedAt: {},
      nowMs,
    });

    expect(rows.map((row) => row.key)).toEqual([
      "event:event-mixed:submission",
      "job:job-pending:application",
      "job:job-done:application",
      "event:event-mixed:registration",
    ]);
    expect(rows[0]).toMatchObject({ daysLeft: -10, done: false });
    expect(rows.filter((row) => row.done)).toHaveLength(2);
  });

  it("renders overdue urgency and blue completed rows with action chips", () => {
    const html = renderToStaticMarkup(
      createElement(DeadlinesBoard, {
        savedJobs: [pendingJob, doneJob],
        savedEvents: [mixedEvent],
        appliedAt: { "job-done": "2026-07-10T12:00:00.000Z" },
        registeredAt: { "event-mixed": "2026-07-11T12:00:00.000Z" },
        submittedAt: {},
        onJobApplied: vi.fn(),
        onEventRegistered: vi.fn(),
        onEventSubmitted: vi.fn(),
        nowMs,
      }),
    );

    expect(html).toContain("10 days overdue");
    expect(html).toContain("bg-red");
    expect(html.match(/data-deadline-state="done"/g)).toHaveLength(2);
    expect(html).toContain("bg-done-dim");
    expect(html).toContain('data-completion-control="applied"');
    expect(html).toContain('data-completion-control="registered"');
    expect(html).toContain('data-completion-control="submitted"');
  });
});
