import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JobReport } from "@/app/jobs/[id]/page";
import { scoredJobToJob } from "@/lib/jobs/mapper";
import { webResultToRawJobItem } from "@/lib/jobs/sources/jobweb";
import type { Job } from "@/types";

const fixture = JSON.parse(
  readFileSync(
    new URL("./__fixtures__/job-extraction-artifacts.json", import.meta.url),
    "utf8",
  ),
) as {
  title: string;
  url: string;
  snippet: string;
  location: string;
  visa: NonNullable<Job["visa"]>;
};

describe("measured job extraction artifacts", () => {
  it("cleans CTA subtitle text, bracket debris, and duplicate visa output", () => {
    const raw = webResultToRawJobItem(fixture);
    expect(raw).not.toBeNull();

    const job = scoredJobToJob({
      ...raw!,
      location: fixture.location,
      visa: fixture.visa,
      score: 0.85,
      matchedKeywords: ["battery safety"],
      matchReason: "Matches your declared battery safety focus.",
    });
    const html = renderToStaticMarkup(
      createElement(JobReport, {
        job,
        isSaved: false,
        isApplied: false,
        nowMs: Date.parse("2026-07-31T12:00:00Z"),
        onToggleSave: () => undefined,
        onAppliedChange: () => undefined,
        onDismiss: () => undefined,
      }),
    );

    expect(job.roleTitle).toBe("Research in Reno at American Battery");
    expect(job.companyOrLab).toBe("americanbattery.example");
    expect(job.location).toBe("Reno, Nevada, United States");
    expect(job.summary).not.toContain("]");
    expect(job.summary).toContain("Dive into hands-on research");
    expect(html).not.toContain("Apply now!");
    // B-06 rewrote this. Plate 02 has a VISA tile, so the tile is no longer
    // absent — but what this test actually protects is that the visa fact is
    // not printed twice. It still holds: the header chip carries the long
    // phrase, the tile carries the plate's short value ("Not stated").
    expect(html.match(/Visa not stated/g)).toHaveLength(1);
    expect(html).toContain('data-job-fact="visa"');
  });
});
