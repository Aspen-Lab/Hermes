import { describe, expect, it } from "vitest";
import type { Event, Job } from "@/types";
import {
  filterEventsByOpportunityQuery,
  filterJobsByOpportunityQuery,
  shouldSearchOpportunities,
  shouldSearchPapers,
} from "./search";

const events: Event[] = [
  {
    id: "event-1",
    name: "Solid-State Battery Summit",
    type: "conference",
    date: "2026-09-10",
    location: "McCormick Place",
    place: {
      city: "Chicago",
      region: "Illinois",
      country: "United States",
    },
    isOnline: false,
    shortDescription: "Research on next-generation electrolytes",
    relevanceReason: "Matches battery research",
  },
  {
    id: "event-2",
    name: "Electrochemistry Office Hours",
    type: "seminar",
    date: "2026-10-03",
    location: "Online",
    isOnline: true,
    shortDescription: "An informal Q&A",
    relevanceReason: "Matches electrochemistry",
  },
];

const jobs: Job[] = [
  {
    id: "job-1",
    roleTitle: "Battery Research Scientist",
    companyOrLab: "Argonne National Laboratory",
    location: "Lemont, IL",
    place: {
      city: "Lemont",
      region: "Illinois",
      country: "United States",
    },
    isRemote: false,
    keyRequirements: ["Electrochemistry", "Python"],
    matchReason: "Strong fit for solid-state battery experience",
  },
  {
    id: "job-2",
    roleTitle: "Materials Engineer",
    companyOrLab: "Volt Labs",
    location: "Berlin",
    place: {
      city: "Berlin",
      country: "Germany",
    },
    isRemote: false,
    keyRequirements: ["Electron microscopy"],
    matchReason: "Matches materials characterization",
  },
];

describe("filterEventsByOpportunityQuery", () => {
  it.each([
    [" summit ", "event-1"],
    ["NEXT-GENERATION", "event-1"],
    ["mccormick", "event-1"],
    ["chicago", "event-1"],
    ["illinois", "event-1"],
    ["united states", "event-1"],
    ["conference", "event-1"],
    ["office hours", "event-2"],
  ])("matches %s across event search fields", (query, expectedId) => {
    expect(filterEventsByOpportunityQuery(events, query).map(({ id }) => id)).toEqual([
      expectedId,
    ]);
  });

  it("returns the original event array for a trimmed query under two characters", () => {
    expect(filterEventsByOpportunityQuery(events, " A ")).toBe(events);
    expect(filterEventsByOpportunityQuery(events, "   ")).toBe(events);
  });
});

describe("filterJobsByOpportunityQuery", () => {
  it.each([
    [" scientist ", "job-1"],
    ["ARGONNE", "job-1"],
    ["solid-state", "job-1"],
    ["lemont", "job-1"],
    ["illinois", "job-1"],
    ["united states", "job-1"],
    ["python", "job-1"],
    ["microscopy", "job-2"],
  ])("matches %s across job search fields", (query, expectedId) => {
    expect(filterJobsByOpportunityQuery(jobs, query).map(({ id }) => id)).toEqual([
      expectedId,
    ]);
  });

  it("returns the original job array for a trimmed query under two characters", () => {
    expect(filterJobsByOpportunityQuery(jobs, " x ")).toBe(jobs);
    expect(filterJobsByOpportunityQuery(jobs, "")).toBe(jobs);
  });
});

describe("opportunity search routing", () => {
  it("keeps paper API search on All and Papers only", () => {
    expect(shouldSearchPapers("all", "battery")).toBe(true);
    expect(shouldSearchPapers("papers", "battery")).toBe(true);
    expect(shouldSearchPapers("events", "battery")).toBe(false);
    expect(shouldSearchPapers("jobs", "battery")).toBe(false);
  });

  it("filters local pools on All, Events, and Jobs only", () => {
    expect(shouldSearchOpportunities("all", "battery")).toBe(true);
    expect(shouldSearchOpportunities("events", "battery")).toBe(true);
    expect(shouldSearchOpportunities("jobs", "battery")).toBe(true);
    expect(shouldSearchOpportunities("papers", "battery")).toBe(false);
  });

  it("does not enter either search mode for a trimmed one-character query", () => {
    expect(shouldSearchPapers("papers", " x ")).toBe(false);
    expect(shouldSearchOpportunities("events", " x ")).toBe(false);
  });
});
