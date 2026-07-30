import { describe, expect, it } from "vitest";
import { extractJobDetails, normalizeJobDate } from "./job-details";

describe("extractJobDetails", () => {
  it("prefers JobPosting.validThrough over a visible deadline", () => {
    const html = `
      <script type="application/ld+json">{ malformed json }</script>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Battery Researcher",
          "validThrough": "2027-01-31T23:59:59Z"
        }
      </script>
      <p>Application deadline: 15 January 2027</p>
      <p>Please submit a cover letter and curriculum vitae.</p>
    `;

    expect(extractJobDetails(html, new Date("2026-11-10T12:00:00Z"))).toEqual({
      applicationDeadline: "2027-01-31",
      applicationMaterials: ["Cover letter", "Curriculum vitae"],
    });
  });

  it("extracts a closing date, expected start, and fixed-term duration", () => {
    const html = `
      <dl>
        <dt>Closing date</dt><dd>15 September</dd>
        <dt>Expected start</dt><dd>1 November 2027</dd>
      </dl>
      <p>This is a fixed-term appointment for 3 years.</p>
    `;

    expect(extractJobDetails(html, new Date("2026-11-10T12:00:00Z"))).toEqual({
      applicationDeadline: "2027-09-15",
      startDate: "2027-11-01",
      contractLength: "fixed-term appointment for 3 years",
    });
  });

  it("extracts apply-by wording and application materials in source order", () => {
    const html = `
      <p>Apply by 1 December 2026.</p>
      <p>Upload a research statement, three letters of reference,
      and a cover letter.</p>
    `;

    expect(extractJobDetails(html, new Date("2026-07-30T12:00:00Z"))).toEqual({
      applicationDeadline: "2026-12-01",
      applicationMaterials: [
        "Research statement",
        "Three letters of reference",
        "Cover letter",
      ],
    });
  });

  it("extracts applications-close wording and a source-preserving contract phrase", () => {
    const html = `
      <p>Applications close on January 20, 2027.</p>
      <p>The role is a 3-year fixed-term position.</p>
    `;

    expect(extractJobDetails(html, new Date("2026-07-30T12:00:00Z"))).toEqual({
      applicationDeadline: "2027-01-20",
      contractLength: "3-year fixed-term position",
    });
  });

  it("extracts review-begins wording", () => {
    const html = `
      <p>Review of applications will begin 3 February 2027.</p>
      <p>Submit a teaching statement and CV.</p>
    `;

    expect(extractJobDetails(html, new Date("2026-07-30T12:00:00Z"))).toEqual({
      applicationDeadline: "2027-02-03",
      applicationMaterials: ["Teaching statement", "Curriculum vitae"],
    });
  });

  it("returns an empty object for a page with none of the fields", () => {
    expect(
      extractJobDetails(
        "<html><body><h1>Research opportunity</h1><p>Join our team.</p></body></html>",
      ),
    ).toEqual({});
  });
});

describe("normalizeJobDate", () => {
  it("resolves a yearless date to its next occurrence", () => {
    expect(
      normalizeJobDate("15 September", new Date("2026-08-10T12:00:00Z")),
    ).toBe("2026-09-15");
    expect(
      normalizeJobDate("15 September", new Date("2026-11-10T12:00:00Z")),
    ).toBe("2027-09-15");
    expect(
      normalizeJobDate("15 September", new Date("2026-09-15T23:59:00Z")),
    ).toBe("2026-09-15");
  });

  it("keeps explicit years and finds the next valid leap day", () => {
    expect(
      normalizeJobDate("15 September 2025", new Date("2026-11-10T12:00:00Z")),
    ).toBe("2025-09-15");
    expect(
      normalizeJobDate("29 February", new Date("2025-03-01T12:00:00Z")),
    ).toBe("2028-02-29");
    expect(
      normalizeJobDate("31 April 2027", new Date("2026-07-30T12:00:00Z")),
    ).toBeUndefined();
  });
});
