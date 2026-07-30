import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, Job, Paper } from "@/types";

const storeState = vi.hoisted(() => ({
  saveJob: vi.fn(),
  unsaveJob: vi.fn(),
  notInterestedJob: vi.fn(),
  saveEvent: vi.fn(),
  unsaveEvent: vi.fn(),
  notInterestedEvent: vi.fn(),
}));

vi.mock("@/store/feed", () => ({
  useFeedStore: (
    selector?: (state: typeof storeState) => unknown,
  ) => (selector ? selector(storeState) : storeState),
}));

import { SavedPageView } from "./page";

const paper: Paper = {
  id: "paper:saved",
  title: "A saved paper",
  authors: ["A. Researcher"],
  relevanceReason: "Matches your research.",
  venue: "Example Journal",
  source: "other",
  summaryIntro: "A concise abstract.",
  summaryExperimentKeywords: ["battery"],
  summaryResultDiscussion: "A useful result.",
  isSaved: true,
};

const job: Job = {
  id: "job:applied",
  roleTitle: "Battery Research Scientist",
  companyOrLab: "Example Energy",
  location: "Chicago, IL",
  isRemote: false,
  keyRequirements: [],
  matchReason: "Matches your battery research.",
  isSaved: true,
};

const event: Event = {
  id: "event:registered",
  name: "Battery Interfaces Summit",
  type: "conference",
  date: "2026-09-10",
  location: "Chicago, IL",
  isOnline: false,
  deadline: "2026-08-02",
  shortDescription: "A focused research summit.",
  relevanceReason: "Matches your battery research.",
  isSaved: true,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("SavedPageView", () => {
  it("segments saved kinds and renders registered or applied items as done", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00Z"));
    const html = renderToStaticMarkup(
      createElement(SavedPageView, {
        savedPapers: [paper],
        savedEvents: [event],
        savedJobs: [job],
        appliedAt: { [job.id]: "2026-07-30T15:00:00.000Z" },
        registeredAt: { [event.id]: "2026-07-30T16:00:00.000Z" },
        submittedAt: {},
        onJobApplied: () => undefined,
        onEventRegistered: () => undefined,
        onEventSubmitted: () => undefined,
        initialStatus: "done",
      }),
    );

    for (const label of ["All", "Papers", "Events", "Jobs", "To-do", "Done"]) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html.match(/data-completion-state="done"/g)).toHaveLength(2);
    expect(html).toContain(">Applied<");
    expect(html).toContain(">Registered<");
    expect(html).toContain(">Submitted<");
    expect(html).not.toContain("A saved paper");
    expect(html).toContain("CFP closes in 3 days");
    expect(html).toContain("text-red");
  });
});
