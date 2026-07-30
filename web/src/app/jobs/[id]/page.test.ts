import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Job } from "@/types";
import { JobReport } from "./page";

const NOW = Date.parse("2026-07-30T12:00:00Z");

function renderReport(job: Job): string {
  return renderToStaticMarkup(
    createElement(JobReport, {
      job,
      isSaved: false,
      nowMs: NOW,
      onToggleSave: () => undefined,
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

    expect(html.match(/data-job-fact=/g)).toHaveLength(7);
    expect(html).toContain("Sponsorship available");
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
  });
});
