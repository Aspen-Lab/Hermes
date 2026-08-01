import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Job } from "@/types";
import type { JobEnrichment } from "@/lib/opportunities/enrichment";
import { JobReport } from "./page";

const NOW = Date.parse("2026-07-30T12:00:00Z");

function renderReport(
  job: Job,
  isApplied = false,
  enrichment: JobEnrichment | null = null,
  providerConfigured = false,
  isInterested = false,
): string {
  return renderToStaticMarkup(
    createElement(JobReport, {
      job,
      isSaved: false,
      isApplied,
      isInterested,
      nowMs: NOW,
      enrichment,
      providerConfigured,
      onToggleSave: () => undefined,
      onAppliedChange: () => undefined,
      onDismiss: () => undefined,
    }),
  );
}

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job:1",
    roleTitle: "Battery Research Scientist",
    companyOrLab: "Example Energy",
    location: "Chicago, IL",
    isRemote: false,
    keyRequirements: [],
    matchReason: "",
    ...overrides,
  };
}

describe("JobReport", () => {
  it("renders one wrapping action row with the paired feedback controls", () => {
    const html = renderReport(
      baseJob({ linkPosting: "https://jobs.example.test" }),
      false,
      null,
      false,
      true,
    );
    const actionRows = html.match(
      /<div[^>]*data-report-action-row="job"[^>]*>/g,
    );
    const interested = html.match(
      /<button[^>]*data-feedback-control="interested"[^>]*>/,
    )?.[0];

    expect(actionRows).toHaveLength(1);
    expect(actionRows?.[0]).toContain("flex flex-wrap items-center");
    expect(html.match(/data-opportunity-feedback-pair="true"/g)).toHaveLength(1);
    expect(interested).toContain('aria-pressed="true"');
    expect(html).toContain("Interested");
    expect(html).toContain("Not interested");
  });

  it("renders a sparse aggregator job without empty facts or placeholders", () => {
    const html = renderReport(
      baseJob({
        salary: {
          min: 120_000,
          max: 120_000,
          currency: "USD",
          period: "year",
        },
        postedDate: "2026-07-20",
      }),
    );

    expect(html).toContain("Battery Research Scientist");
    expect(html).toContain("Example Energy");
    expect(html).toContain("Chicago, IL");
    expect(html).toContain("$120k / yr");
    expect(html).toContain("Jul 20, 2026");
    expect(html.match(/data-job-fact=/g)).toHaveLength(2);
    expect(html).toContain('data-job-fact="salary"');
    expect(html).toContain('data-job-fact="posted"');
    expect(html).not.toMatch(/<dd[^>]*>\s*<\/dd>/);
    expect(html).not.toContain("—");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html.toLowerCase()).not.toContain("not listed");
    expect(html).not.toContain("Skills and profile gaps");
    expect(html).not.toContain("What the role is");
    expect(html).not.toContain("What to have ready");
    expect(html).not.toContain("Why Peer sent it");
    expect(html).not.toContain("Visa");
    expect(html).not.toContain("Apply by");
    expect(html).not.toContain("Starts");
  });

  it("renders all seven supported facts and the rich report in order", () => {
    const html = renderReport(
      baseJob({
        isRemote: true,
        roleKind: "staff",
        contractLength: "Two-year fixed-term appointment",
        employmentType: "full-time",
        salary: {
          min: 120_000,
          max: 150_000,
          currency: "USD",
          period: "year",
        },
        postedDate: "2026-07-20",
        applicationDeadline: "2026-08-15",
        startDate: "2026-10-01",
        visa: {
          state: "sponsors",
          evidence: "The laboratory will provide H-1B sponsorship.",
          country: "United States",
        },
        relevanceScore: 0.91,
        keyRequirements: ["Electrochemistry", "Python", "Scale-up"],
        matchedTerms: ["electrochemistry", "python"],
        summary: "Lead applied research on solid-state battery interfaces.",
        applicationMaterials: ["CV", "Cover letter"],
        matchReason: "Matches your declared solid-state battery focus.",
        linkPosting: "https://jobs.example.com/1",
      }),
    );

    expect(html.match(/data-job-fact=/g)).toHaveLength(6);
    expect(html.match(/Sponsorship available/g)).toHaveLength(1);
    expect(html).not.toContain('data-job-fact="visa"');
    expect(html).toContain("The laboratory will provide H-1B sponsorship.");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="67"');

    const timeline = html.indexOf("Timeline");
    const skills = html.indexOf("Skills and profile gaps");
    const role = html.indexOf("What the role is");
    const materials = html.indexOf("What to have ready");
    const why = html.indexOf("Why Peer sent it");
    expect(timeline).toBeGreaterThan(-1);
    expect(timeline).toBeLessThan(skills);
    expect(skills).toBeLessThan(role);
    expect(role).toBeLessThan(materials);
    expect(materials).toBeLessThan(why);

    const timelineSection = html.match(
      /<section[^>]*data-job-section="timeline"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    expect(timelineSection).toContain("Posted");
    expect(timelineSection).toContain("Jul 20, 2026");
    expect(timelineSection).toContain("Today");
    expect(timelineSection).toContain("Jul 30, 2026");
    expect(timelineSection).toContain("Apply by");
    expect(timelineSection).toContain("Aug 15, 2026");
    expect(timelineSection).toContain("Starts");
    expect(timelineSection).toContain("Oct 1, 2026");
    expect(timelineSection).not.toContain("Skills and profile gaps");
  });

  it("renders the Applied control in both inactive and completed states", () => {
    const pendingHtml = renderReport(baseJob(), false);
    const appliedHtml = renderReport(baseJob(), true);
    const pendingButton = pendingHtml.match(
      /<button[^>]*data-completion-control="applied"[^>]*>/,
    )?.[0];
    const appliedButton = appliedHtml.match(
      /<button[^>]*data-completion-control="applied"[^>]*>/,
    )?.[0];

    expect(pendingButton).toContain('aria-pressed="false"');
    expect(appliedButton).toContain('aria-pressed="true"');
    expect(appliedButton).toContain("bg-done-dim");
    expect(appliedHtml).toContain(">Applied<");
  });

  it("lists both requirements behind a zero-of-two skills count", () => {
    const html = renderReport(
      baseJob({
        keyRequirements: [
          "Experience with battery cyclers",
          "Statistical experiment design",
        ],
        matchedTerms: [],
      }),
    );

    expect(html).toContain("Skills and profile gaps");
    expect(html).toContain("0 of 2 requirements match terms in your profile");
    expect(
      html.match(/data-skill-requirement="unmatched"/g),
    ).toHaveLength(2);
    expect(html).toContain("Experience with battery cyclers");
    expect(html).toContain("Statistical experiment design");
  });

  it("omits the skills section and header when no requirements exist", () => {
    const html = renderReport(
      baseJob({ keyRequirements: [" ", "\t"], matchedTerms: ["Python"] }),
    );

    expect(html).not.toContain("Skills and profile gaps");
    expect(html).not.toContain("data-skill-requirement");
  });

  it("cleans stale cached title, subtitle, and description artifacts", () => {
    const html = renderReport(
      baseJob({
        roleTitle: "…Battery Research Internship",
        companyOrLab: "Apply now!",
        summary:
          "The lab values careful experiments. ] Tasks: Run battery diagnostics and document the results.",
      }),
    );

    expect(html).toContain("Battery Research Internship");
    expect(html).not.toContain("…Battery Research Internship");
    expect(html).not.toContain("Apply now!");
    expect(html).not.toContain("] Tasks");
    expect(html).toContain("Tasks: Run battery diagnostics");
  });

  it("renders the two quoted specifics with all four AI sections and hides the locked block", () => {
    const html = renderReport(
      baseJob({
        summary: "The posting says this role leads battery interface experiments.",
        visa: { state: "not-stated", evidence: "Sponsorship is not mentioned." },
      }),
      false,
      {
        specificRequirements: [
          "A PhD in electrochemistry or a related field is required.",
        ],
        specificDuties: [
          "Design and run solid-state interface experiments.",
        ],
        competitiveness: { verdict: "Strong match", reasoning: "Methods align." },
        sponsorshipRead: {
          likelihood: "Plausible",
          basis: "This is an inference from comparable roles.",
        },
        roleSummary: ["First sentence.", "Second sentence.", "Third sentence."],
        emphasise: ["Lead with interface work.", "Name the impedance method."],
      },
    );

    const requirements = html.indexOf("What this employer actually asks for");
    const duties = html.indexOf("What the person would actually do");
    const competitiveness = html.indexOf("How competitive this actually is");
    const sponsorship = html.indexOf("Sponsorship read");
    const summary = html.indexOf("The role in three clean sentences");
    const emphasise = html.indexOf("What to emphasise in your application");
    const extracted = html.indexOf("What the role is");
    const extractedDescription = html.indexOf(
      "The posting says this role leads battery interface experiments.",
    );
    expect(requirements).toBeGreaterThan(-1);
    expect(requirements).toBeLessThan(duties);
    expect(duties).toBeLessThan(competitiveness);
    expect(competitiveness).toBeLessThan(sponsorship);
    expect(sponsorship).toBeLessThan(summary);
    expect(summary).toBeLessThan(emphasise);
    expect(extracted).toBeGreaterThan(-1);
    expect(extracted).toBeLessThan(requirements);
    expect(extracted).toBeLessThan(summary);
    expect(extractedDescription).toBeLessThan(html.indexOf("First sentence."));
    expect(html).toContain("Posting evidence");
    expect(html).toContain(
      "A PhD in electrochemistry or a related field is required.",
    );
    expect(html).toContain(
      "Design and run solid-state interface experiments.",
    );
    expect(html).toContain("Peer inference — verify with the employer");
    expect(html).not.toContain("Also in this report with an AI key");
  });

  it("does not render or unlock empty quoted-specific sections", () => {
    const html = renderReport(
      baseJob(),
      false,
      { specificRequirements: [], specificDuties: [] },
      true,
    );

    expect(html).not.toContain('data-job-section="specific-requirements"');
    expect(html).not.toContain('data-job-section="specific-duties"');
    expect(html).toContain("Also in this report with an AI key");
  });

  it("renders and unlocks either quoted-specific section independently", () => {
    const requirementsHtml = renderReport(baseJob(), false, {
      specificRequirements: ["A doctorate in chemistry is required."],
    });
    const dutiesHtml = renderReport(baseJob(), false, {
      specificDuties: ["Lead weekly cell-testing reviews."],
    });

    expect(requirementsHtml).toContain("What this employer actually asks for");
    expect(requirementsHtml).toContain("A doctorate in chemistry is required.");
    expect(requirementsHtml).not.toContain('data-job-section="specific-duties"');
    expect(requirementsHtml).not.toContain("Also in this report with an AI key");
    expect(dutiesHtml).toContain("What the person would actually do");
    expect(dutiesHtml).toContain("Lead weekly cell-testing reviews.");
    expect(dutiesHtml).not.toContain(
      'data-job-section="specific-requirements"',
    );
    expect(dutiesHtml).not.toContain("Also in this report with an AI key");
  });

  it("keeps the locked block when provider availability produced no enrichment", () => {
    const html = renderReport(baseJob(), false, null, true);

    expect(html).toContain("Also in this report with an AI key");
  });
});
