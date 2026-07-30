import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, Job } from "@/types";

const storeActions = vi.hoisted(() => ({
  saveJob: vi.fn(),
  unsaveJob: vi.fn(),
  notInterestedJob: vi.fn(),
  saveEvent: vi.fn(),
  unsaveEvent: vi.fn(),
  notInterestedEvent: vi.fn(),
}));

vi.mock("@/store/feed", () => ({
  useFeedStore: (
    selector?: (state: typeof storeActions) => unknown,
  ) => (selector ? selector(storeActions) : storeActions),
}));

import { EventCard } from "./event-card";
import { JobCard } from "./job-card";

const job: Job = {
  id: "job:done",
  roleTitle: "Battery Research Scientist",
  companyOrLab: "Example Energy",
  location: "Chicago, IL",
  isRemote: false,
  keyRequirements: ["Electrochemistry"],
  matchReason: "Matches your battery research.",
  isSaved: true,
  relevanceScore: 0.91,
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
  relevanceScore: 0.9,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("saved opportunity completion cards", () => {
  it("tints an applied job and keeps the Applied word visible", () => {
    const html = renderToStaticMarkup(
      createElement(JobCard, {
        job,
        completion: {
          applied: true,
          onChange: () => undefined,
        },
      }),
    );

    expect(html).toContain('data-completion-state="done"');
    expect(html).toContain('data-completion-control="applied"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("bg-done-dim text-done");
    expect(html).toContain("--color-done-dim");
    expect(html).toContain(">Applied<");
  });

  it("tints a registered-only event while its CFP deadline stays red", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00Z"));
    const html = renderToStaticMarkup(
      createElement(EventCard, {
        event,
        completion: {
          registered: true,
          submitted: false,
          onRegisteredChange: () => undefined,
          onSubmittedChange: () => undefined,
        },
      }),
    );

    expect(html).toContain('data-completion-state="done"');
    const registered = html.match(
      /<button[^>]*data-completion-control="registered"[^>]*>/,
    )?.[0];
    const submitted = html.match(
      /<button[^>]*data-completion-control="submitted"[^>]*>/,
    )?.[0];
    expect(registered).toContain('aria-pressed="true"');
    expect(submitted).toContain('aria-pressed="false"');
    expect(html).toContain("CFP closes in 3 days");
    expect(html).toContain("text-red");
  });
});
