import { describe, expect, it } from "vitest";
import type { Event, Job, Paper } from "@/types";
import { eventToForecastItem, jobToForecastItem, paperToForecastItem } from "./types";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "remotive:123",
    roleTitle: "ML Research Intern",
    companyOrLab: "Meridian Labs",
    location: "Boston / Remote",
    isRemote: true,
    keyRequirements: ["pytorch", "nlp"],
    matchReason: "Matches your machine learning focus",
    linkPosting: "https://remotive.com/jobs/123",
    postedDate: "2026-08-12T00:00:00.000Z",
    relevanceScore: 0.92,
    ...overrides,
  };
}

function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: "arxiv:2508.00001",
    title: "Learning-Based Planning",
    authors: ["A. Author"],
    relevanceReason: "Matches your machine learning interest",
    venue: "arXiv",
    source: "arxiv",
    summaryIntro: "intro",
    summaryExperimentKeywords: ["cs.RO"],
    summaryResultDiscussion: "discussion",
    linkPaper: "https://arxiv.org/abs/2508.00001",
    publishedDate: "2026-08-12T00:00:00.000Z",
    isSaved: false,
    relevanceScore: 0.88,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "ccfddl:chi2027",
    name: "CHI 2027",
    type: "conference",
    date: "2027-04-01",
    location: "Honolulu, HI",
    isOnline: false,
    shortDescription: "desc",
    relevanceReason: "Matches your HCI interest",
    deadline: "2026-08-21",
    tags: ["hci"],
    linkOfficial: "https://chi2027.acm.org",
    relevanceScore: 0.81,
    ...overrides,
  };
}

describe("jobToForecastItem", () => {
  it("maps every present field", () => {
    const item = jobToForecastItem(makeJob());
    expect(item).toEqual({
      id: "remotive:123",
      type: "job",
      title: "ML Research Intern",
      org: "Meridian Labs",
      location: "Boston / Remote",
      posted: "2026-08-12T00:00:00.000Z",
      relevance: 0.92,
      whyItMatters: "Matches your machine learning focus",
      tags: ["pytorch", "nlp"],
      deepLink: "https://remotive.com/jobs/123",
      isSaved: false,
    });
  });

  it("omits deadline entirely (not null) when the source doesn't carry one (RULING 4)", () => {
    const item = jobToForecastItem(makeJob({ applicationDeadline: undefined }));
    expect("deadline" in item).toBe(false);
    expect(item.deadline).toBeUndefined();
  });

  it("includes deadline when the source has one", () => {
    const item = jobToForecastItem(makeJob({ applicationDeadline: "2026-09-01" }));
    expect(item.deadline).toBe("2026-09-01");
  });
});

describe("paperToForecastItem", () => {
  it("never carries a location or deadline key at all (RULING 4) — not merely null", () => {
    const item = paperToForecastItem(makePaper());
    expect("location" in item).toBe(false);
    expect("deadline" in item).toBe(false);
    expect(Object.keys(item)).not.toContain("location");
    expect(Object.keys(item)).not.toContain("deadline");
  });

  it("maps every other present field", () => {
    const item = paperToForecastItem(makePaper());
    expect(item).toEqual({
      id: "arxiv:2508.00001",
      type: "paper",
      title: "Learning-Based Planning",
      org: "arXiv",
      posted: "2026-08-12T00:00:00.000Z",
      relevance: 0.88,
      whyItMatters: "Matches your machine learning interest",
      tags: ["cs.RO"],
      deepLink: "https://arxiv.org/abs/2508.00001",
      isSaved: false,
    });
  });

  it("falls back to linkArxiv when linkPaper is absent", () => {
    const item = paperToForecastItem(
      makePaper({ linkPaper: undefined, linkArxiv: "https://arxiv.org/abs/2508.00001" }),
    );
    expect(item.deepLink).toBe("https://arxiv.org/abs/2508.00001");
  });
});

describe("eventToForecastItem", () => {
  it("maps every present field, including CFP deadline", () => {
    const item = eventToForecastItem(makeEvent());
    expect(item).toEqual({
      id: "ccfddl:chi2027",
      type: "event",
      title: "CHI 2027",
      location: "Honolulu, HI",
      posted: "2027-04-01",
      deadline: "2026-08-21",
      relevance: 0.81,
      whyItMatters: "Matches your HCI interest",
      tags: ["hci"],
      deepLink: "https://chi2027.acm.org",
      isSaved: false,
    });
  });

  it("omits org when no organisations are present", () => {
    const item = eventToForecastItem(makeEvent({ organisations: undefined }));
    expect("org" in item).toBe(false);
  });

  it("uses the first organisation's name when present", () => {
    const item = eventToForecastItem(
      makeEvent({ organisations: [{ name: "ACM SIGCHI" }] }),
    );
    expect(item.org).toBe("ACM SIGCHI");
  });

  it("falls back to registrationDeadline when there is no CFP deadline", () => {
    const item = eventToForecastItem(
      makeEvent({ deadline: undefined, registrationDeadline: "2027-03-01" }),
    );
    expect(item.deadline).toBe("2027-03-01");
  });

  it("omits tags entirely when the source has none", () => {
    const item = eventToForecastItem(makeEvent({ tags: undefined }));
    expect("tags" in item).toBe(false);
  });
});
