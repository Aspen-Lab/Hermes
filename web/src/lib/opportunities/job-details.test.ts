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

  it("extracts a start-date-flexible signal alongside a fixed start date", () => {
    // B3-06 / Ruling 20. The posting states the start date can move; the
    // signal is a small phrase match, not an inference from silence.
    const html = `
      <dl>
        <dt>Closing date</dt><dd>15 September</dd>
        <dt>Expected start</dt><dd>1 November 2027</dd>
      </dl>
      <p>The start date is flexible for the right candidate.</p>
    `;

    expect(extractJobDetails(html, new Date("2026-11-10T12:00:00Z"))).toEqual({
      applicationDeadline: "2027-09-15",
      startDate: "2027-11-01",
      startDateFlexible: true,
    });
  });

  it("recognises 'flexible start date' phrasing on its own", () => {
    const html = "<p>We offer a flexible start date for the successful applicant.</p>";

    expect(extractJobDetails(html, new Date("2026-11-10T12:00:00Z"))).toEqual({
      startDateFlexible: true,
    });
  });

  it("recognises 'start date negotiable' phrasing on its own", () => {
    const html = "<p>Start date negotiable.</p>";

    expect(extractJobDetails(html, new Date("2026-11-10T12:00:00Z"))).toEqual({
      startDateFlexible: true,
    });
  });

  it("never invents startDateFlexible when the posting says nothing about it", () => {
    // Ruling 20's whole point: undefined unless the posting explicitly says
    // the start date can move, never inferred from silence.
    const html = "<p>Join our team as a research scientist.</p>";

    expect(extractJobDetails(html, new Date("2026-11-10T12:00:00Z"))).toEqual(
      {},
    );
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

  // B4-11. JSON-LD JobPosting.baseSalary/employmentType, read from this same
  // fetched page alongside validThrough above -- same JSON-LD parse, same
  // "first job-kind entry that actually carries the field" precedent.
  it("extracts JobPosting.baseSalary and employmentType from the fetched page", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Battery Researcher",
          "employmentType": "FULL_TIME",
          "baseSalary": {
            "currency": "USD",
            "value": { "minValue": 95000, "maxValue": 120000, "unitText": "YEAR" }
          }
        }
      </script>
    `;

    expect(extractJobDetails(html)).toEqual({
      salary: { min: 95000, max: 120000, currency: "USD", period: "year" },
      employmentType: "full_time",
    });
  });

  // B4-11. The same two shapes jobWorkMode() (web/src/lib/jobs/mapper.ts)
  // already checks against a job's location string, now also checked against
  // the fetched page's own free text -- the signal a jobweb-sourced posting's
  // always-empty location string could never carry.
  it("recognises hybrid work mode from the page's own text", () => {
    const html = "<p>This role follows a hybrid schedule, three days on-site.</p>";
    // "hybrid" is checked first, matching jobWorkMode()'s own precedence, so
    // this page (which also says "on-site") still resolves to "hybrid".
    expect(extractJobDetails(html)).toEqual({ workMode: "hybrid" });
  });

  it("recognises on-site / in-person work mode from the page's own text", () => {
    expect(
      extractJobDetails("<p>This is an on-site position in Chicago, IL.</p>"),
    ).toEqual({ workMode: "on-site" });
    expect(
      extractJobDetails("<p>This role is in-person at our Chicago lab.</p>"),
    ).toEqual({ workMode: "on-site" });
  });

  it("never invents workMode when the posting says nothing about work arrangement", () => {
    // Includes "remote" deliberately: that signal already reaches the mapper
    // via isRemote, and is not re-derived here (see job-details.ts's own
    // note on WORK_MODE_HYBRID_RE/WORK_MODE_ON_SITE_RE).
    expect(
      extractJobDetails("<p>Join our fully remote research team.</p>"),
    ).toEqual({});
  });

  // B5-02 (round 5). Adversarial-proximity case, per B5-08: the trigger word
  // is present, but attached to page furniture (a footer amenity mention),
  // not to a statement about this job's own work arrangement. This is the
  // real, confirmed false positive A found on careerservices.upenn.edu ("...
  // on-site fitness ... amenities"). Before this item, extractWorkMode() ran
  // on stripHtml(html), which does not remove nav/header/footer/aside, so
  // this exact shape returned "on-site". It must now stay silent.
  it("ignores an unrelated work-arrangement word sitting in page furniture", () => {
    const html = `
      <header><nav>Careers | About | Contact</nav></header>
      <p>We are hiring a research assistant to support our lab's ion-exchange work.</p>
      <footer>Employee amenities include on-site fitness, banking, and a cafeteria.</footer>
    `;
    expect(extractJobDetails(html).workMode).toBeUndefined();
  });

  // B5-02 (round 5). A genuine work-arrangement statement sitting directly
  // in the article body -- not furniture -- must still be found even when
  // the same page also carries unrelated nav/footer furniture. Guards
  // against the fix above over-correcting to "furniture-stripping means
  // nothing is ever recognised any more."
  it("still recognises a genuine work-arrangement statement alongside unrelated furniture", () => {
    const html = `
      <header><nav>Careers | About | Contact</nav></header>
      <p>The work location for this position is onsite in Los Alamos, NM.</p>
      <footer>Equal opportunity employer. All rights reserved.</footer>
    `;
    expect(extractJobDetails(html).workMode).toBe("on-site");
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
