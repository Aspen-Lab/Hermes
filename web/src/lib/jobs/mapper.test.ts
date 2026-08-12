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
  place: { city: "Chicago", region: "IL", country: "United States" },
  visa: {
    state: "wont-sponsor",
    evidence: "Applicants must already be authorised to work in the US.",
    country: "US",
  },
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

  it("keeps an absent company absent instead of fabricating a hostname", () => {
    // B6-03 (round 6): company absence is a valid report-safe state.
    expect(scoredJobToJob({ ...fullJob, company: "" }).companyOrLab).toBeUndefined();
  });

  it("prefers fetched page text over a chrome-shaped source snippet for summaries", () => {
    const job = scoredJobToJob({
      ...fullJob,
      description: "### Battery filters ] Sign up now",
      pageText: "This role develops solid-state battery models with electrochemical experiments.",
    });
    expect(job.summary).toContain("solid-state battery models");
    expect(job.summary).not.toContain("Sign up");
  });

  it("preserves preferred and unrelated on-site location fit", () => {
    expect(scoredJobToJob(fullJob, ["Chicago"]).locationFit).toBe(1);
    expect(
      scoredJobToJob({ ...fullJob, location: "San Francisco, CA" }, ["Chicago"]).locationFit,
    ).toBe(0.4);
  });

  it("suppresses visa state only when the job country is authorised", () => {
    expect(
      scoredJobToJob(fullJob, undefined, ["United States"]).visa,
    ).toBeUndefined();
    expect(
      scoredJobToJob(fullJob, undefined, ["United Kingdom"]).visa,
    ).toEqual(fullJob.visa);
  });

  describe("workMode", () => {
    // B2-06, layer 2. Only ever set from a signal the posting actually gave —
    // never a guessed "on-site" default when the location says nothing about
    // work arrangement at all.
    it("reads hybrid from the posting's own location text", () => {
      expect(
        scoredJobToJob({ ...fullJob, location: "Los Altos, CA (Hybrid)" })
          .workMode,
      ).toBe("hybrid");
    });

    it("reads on-site / in-person from the posting's own location text", () => {
      expect(
        scoredJobToJob({ ...fullJob, location: "On-site in Chicago, IL" })
          .workMode,
      ).toBe("on-site");
      expect(
        scoredJobToJob({ ...fullJob, location: "In-person, Chicago, IL" })
          .workMode,
      ).toBe("on-site");
    });

    it("falls back to remote from isRemote when the location says nothing", () => {
      expect(
        scoredJobToJob({ ...fullJob, location: "", isRemote: true }).workMode,
      ).toBe("remote");
    });

    it("leaves workMode undefined rather than guessing on-site from silence", () => {
      expect(
        scoredJobToJob({ ...fullJob, location: "Chicago, IL", isRemote: false })
          .workMode,
      ).toBeUndefined();
    });

    it("prefers the upstream-extracted workMode over the location-derived one", () => {
      // B4-11. item.workMode is set only during enrichment, from the
      // posting's own fetched-page free text (job-details.ts's
      // extractWorkMode) -- proven here with a location string that would
      // derive a different result on its own, so the two cannot agree by
      // coincidence.
      expect(
        scoredJobToJob({
          ...fullJob,
          location: "On-site in Chicago, IL",
          workMode: "hybrid",
        }).workMode,
      ).toBe("hybrid");
    });
  });
});
