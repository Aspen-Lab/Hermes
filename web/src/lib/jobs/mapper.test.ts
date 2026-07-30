import { describe, expect, it } from "vitest";
import { scoredJobToJob } from "./mapper";
import type { ScoredJobItem } from "./types";

const fullJob: ScoredJobItem = {
  id: "adzuna:full-job",
  source: "adzuna",
  title: "Senior Battery Researcher",
  company: "Example Energy",
  location: "Chicago, IL",
  isRemote: false,
  description:
    "In this role, you will develop solid-state battery models for a growing research team. You will analyze electrochemical experiments and share findings with materials engineers.",
  url: "https://example.com/jobs/full-job",
  postedAt: "2026-07-25T12:00:00.000Z",
  employmentType: "full_time",
  salaryMin: 120_000,
  salaryMax: 160_000,
  salaryCurrency: "USD",
  salaryPeriod: "year",
  salaryIsEstimated: true,
  tags: ["PhD", "Electrochemistry"],
  score: 0.94,
  matchedKeywords: ["solid-state battery", "electrochemical"],
  matchReason: "Matches your battery research focus.",
};

describe("scoredJobToJob", () => {
  it("populates every detailed display field from a full scored job", () => {
    const job = scoredJobToJob(fullJob);

    expect(job).toMatchObject({
      salary: {
        min: 120_000,
        max: 160_000,
        currency: "USD",
        period: "year",
      },
      salaryIsEstimated: true,
      employmentType: "full_time",
      sourceId: "adzuna",
      matchedTerms: ["solid-state battery", "electrochemical"],
    });
    expect(job.summary).toContain("solid-state battery");
    expect(job.summary).toContain("electrochemical");
  });

  it("leaves absent optional fields undefined without throwing", () => {
    const job = scoredJobToJob({
      id: "arbeitnow:minimal",
      source: "arbeitnow",
      title: "Research Assistant",
      company: "Example Lab",
      location: "",
      isRemote: false,
      description: "",
      url: "https://example.com/jobs/minimal",
      tags: [],
      score: 0.7,
      matchedKeywords: [],
      matchReason: "Relevant to your profile.",
    });

    expect(job).toMatchObject({
      salary: undefined,
      salaryIsEstimated: undefined,
      employmentType: undefined,
      sourceId: "arbeitnow",
      summary: undefined,
      matchedTerms: undefined,
      locationFit: undefined,
    });
  });

  it("preserves preferred and unrelated on-site location fit", () => {
    expect(scoredJobToJob(fullJob, ["Chicago"]).locationFit).toBe(1);
    expect(
      scoredJobToJob({ ...fullJob, location: "San Francisco, CA" }, ["Chicago"]).locationFit,
    ).toBe(0.4);
  });
});
