import { describe, expect, it } from "vitest";
import type { Job } from "@/types";
import { jobCardView } from "./card";

const now = new Date(2026, 6, 29, 12).getTime();

const job: Job = {
  id: "adzuna:test",
  roleTitle: "Battery Research Engineer",
  companyOrLab: "Google",
  location: "Chicago, IL",
  isRemote: false,
  keyRequirements: ["PhD", "Electrochemistry"],
  matchReason: "Matches your battery focus.",
  postedDate: "2026-07-26T12:00:00-05:00",
  relevanceScore: 0.93,
  salary: { min: 120_000, max: 160_000, currency: "USD", period: "year" },
  salaryIsEstimated: true,
  employmentType: "full_time",
  sourceId: "adzuna",
  summary: "You will develop solid-state battery models for a research team.",
  matchedTerms: ["solid-state battery"],
  locationFit: 1,
};

describe("jobCardView", () => {
  it("builds the detailed job facts and disclosure labels", () => {
    expect(jobCardView(job, now)).toMatchObject({
      prestige: { tier: "bigTech", label: "Big tech" },
      employmentTypeLabel: "Full Time",
      matchLabel: "93% · Strong match",
      postedLabel: "3d ago",
      locationLabel: "Chicago, IL · Preferred",
      salaryLabel: "$120k–160k / yr · Estimated",
      salaryTone: "neutral",
      urgency: { label: "Posted 3 days ago", bucket: { label: "Fresh" } },
      summaryText: job.summary,
      matchedTerms: ["solid-state battery"],
    });
  });

  it("states missing salary, date, type, and match plainly", () => {
    expect(
      jobCardView(
        {
          ...job,
          postedDate: undefined,
          relevanceScore: undefined,
          salary: undefined,
          salaryIsEstimated: undefined,
          employmentType: undefined,
          summary: undefined,
          matchedTerms: undefined,
          locationFit: undefined,
        },
        now,
      ),
    ).toMatchObject({
      employmentTypeLabel: "Type not listed",
      matchLabel: "Match not scored",
      postedLabel: "Posting date not listed",
      salaryLabel: "Salary not disclosed",
      salaryTone: "muted",
      urgency: { label: "Posting date not listed", bucket: { label: "Not listed" } },
      summaryText: job.matchReason,
      matchedTerms: [],
    });
  });
});
