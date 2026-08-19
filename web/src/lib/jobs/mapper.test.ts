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
  // A22-03(a) (round 22 C): the summary gate is now FAIL-CLOSED — publication
  // requires a proven `owned` scope, not merely the absence of `"unproven"`.
  // This fixture always meant "text that belongs to this posting"; it now says
  // so out loud. Without this line the two summary assertions below go red,
  // and that red IS the new contract.
  fetchedPostingScope: "owned",
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

  // A22-03 (round 22, `lensa.com`): a `$111K-$135K` Principal Engineer role in
  // Alameda was rendered under an internship in Albuquerque — a DIFFERENT job
  // from the same aggregator page. Two independent causes, tested separately.
  describe("ownership is required before a summary or a remote flag is published (A22-03)", () => {
    // The body every case below shares: two publishable sentences, so the only
    // variable under test is ownership, never length.
    const BODY =
      "This role develops solid-state battery cells for a growing research team. "
      + "You will analyze electrochemical experiments and publish the findings.";

    it("publishes no summary when the page could not be fetched at all", () => {
      // `undefined` scope is the state with the LEAST evidence: enrich.ts
      // returns early when there is no html, which is what happened when
      // lensa.com answered 403. The old gate named only "unproven", so this
      // state sailed through and published the provider's snippet.
      const job = scoredJobToJob({
        ...fullJob,
        source: "jobweb",
        fetchedPostingScope: undefined,
        pageText: undefined,
        description: BODY,
      });
      expect(job.summary).toBeUndefined();
    });

    it("still publishes no summary when the page was read but not attributed", () => {
      const job = scoredJobToJob({
        ...fullJob,
        source: "jobweb",
        fetchedPostingScope: "unproven",
        pageText: undefined,
        description: BODY,
      });
      expect(job.summary).toBeUndefined();
    });

    it("publishes a summary once ownership is proven — the admitted control", () => {
      // The must-keep. If this ever goes silent the gate has stopped being a
      // gate and become a blanket ban, which would be a wrong silence.
      const job = scoredJobToJob({
        ...fullJob,
        source: "jobweb",
        fetchedPostingScope: "owned",
        pageText: BODY,
      });
      expect(job.summary).toContain("solid-state battery");
    });

    it("refuses to summarise an owned block that is only its own witness (Ruling 60d)", () => {
      // The minimum-substance floor. B measured the five `owned` job rows in a
      // live pool carrying 8, 9, 48, 74 and 83 characters of "owned" text —
      // the 83 being a blog post's headline. Ownership proves WHOSE text it
      // is; it does not prove there is any.
      const job = scoredJobToJob({
        ...fullJob,
        source: "jobweb",
        fetchedPostingScope: "owned",
        pageText: "Solid-State Battery Research Scientist 2 | Example Energy Careers",
      });
      expect(job.summary).toBeUndefined();
    });

    it("does not render a web-search snippet's `remote` as a location or work mode", () => {
      // `jobweb` sets isRemote from `title + snippet` at ingestion and nothing
      // revisits it. lensa's snippet carried another posting's "Remote
      // Alameda, CA". All three rendered forms go silent together.
      const job = scoredJobToJob({
        ...fullJob,
        source: "jobweb",
        location: "",
        isRemote: true,
        workMode: undefined,
      });
      expect(job.location).toBe("See posting");
      expect(job.isRemote).toBe(false);
      expect(job.workMode).toBeUndefined();
    });

    it("keeps a structured source's own remote flag — the admitted control", () => {
      // The must-keep on the other side. Adzuna/USAJOBS/Remotive set isRemote
      // from a structured field of the item's OWN record, where it is owned,
      // and none of them is touched.
      const job = scoredJobToJob({ ...fullJob, location: "", isRemote: true });
      expect(job.location).toBe("Remote");
      expect(job.isRemote).toBe(true);
      expect(job.workMode).toBe("remote");
    });

    it("still prefers an owned page's work mode on a jobweb row", () => {
      // The honest source is unaffected: `workMode` comes from OWNED page text
      // via extractJobDetails and still wins outright.
      const job = scoredJobToJob({
        ...fullJob,
        source: "jobweb",
        location: "",
        isRemote: true,
        workMode: "hybrid",
      });
      expect(job.workMode).toBe("hybrid");
    });

    it("leaves the scoring input untouched so no score moves", () => {
      // locationFit reads the RAW item.isRemote, not the rendered flag. This
      // is the difference between a render-boundary edit and deleting the
      // signal, which B explicitly warned against.
      const remote = scoredJobToJob(
        { ...fullJob, source: "jobweb", location: "", isRemote: true },
        ["Chicago"],
      );
      const notRemote = scoredJobToJob(
        { ...fullJob, source: "jobweb", location: "", isRemote: false },
        ["Chicago"],
      );
      expect(remote.locationFit).not.toBe(notRemote.locationFit);
    });
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
      // A22-03(b) / Ruling 60d: extended from one sentence to two. The floor
      // requires an owned block to carry a BODY, and this fixture's original
      // single sentence was shorter than the nav fragments the floor exists to
      // reject. What the case tests — that fetched page text beats a
      // chrome-shaped snippet — is unchanged and still asserted below.
      pageText:
        "This role develops solid-state battery models with electrochemical experiments. "
        + "You will publish findings and work alongside the materials characterisation team.",
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
