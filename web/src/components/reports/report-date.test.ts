import { describe, expect, it } from "vitest";
import { reportShortDate } from "./report-date";

// B2-01 / Ruling 8. A dedicated test for the shared year-guard, independent
// of the two report pages that call it — both a defence against a regression
// hiding behind a report fixture that never exercises a >12-month date, and
// documentation of the actual contract.
describe("reportShortDate", () => {
  const NOW = Date.parse("2026-07-30T12:00:00Z");

  it("drops the year for a date inside the report's own horizon", () => {
    expect(reportShortDate("2026-09-15", NOW)).toBe("Sep 15");
    expect(reportShortDate("2026-07-22", NOW)).toBe("Jul 22");
  });

  it("keeps the year once a date is more than ~12 months out, in either direction", () => {
    expect(reportShortDate("2028-01-10", NOW)).toBe("Jan 10, 2028");
    expect(reportShortDate("2024-01-10", NOW)).toBe("Jan 10, 2024");
  });

  // A24-02 / Ruling 62b. The month-granularity branch moved into `formatDate`,
  // so it reaches this year-guard too — plate 03's deadline strip was one of
  // the five sites printing "Aug 1" from "2026-08".
  it("renders a month-granularity claim as its month, with its year kept", () => {
    // Reverted, this reads "Aug 1" — a day the page never stated.
    expect(reportShortDate("2026-08", NOW)).toBe("Aug 2026");
    // A DELIBERATE, FLAGGED COSMETIC DEVIATION, stated rather than hidden:
    // inside the one-year horizon a day-level neighbour prints "Sep 15" with
    // NO year, and this one carries 2026. The alternative is a bare "Aug",
    // which is ambiguous across years — worse than an extra year, and the same
    // class of trade the manager already accepted for "Aug 2026" over 62b's
    // literal "August 2026". The year is NOT deleted.
    expect(reportShortDate("2026-09-15", NOW)).toBe("Sep 15");
  });

  it("returns undefined for missing or unparseable input", () => {
    expect(reportShortDate(undefined, NOW)).toBeUndefined();
    expect(reportShortDate(null, NOW)).toBeUndefined();
    expect(reportShortDate("not-a-date", NOW)).toBeUndefined();
  });
});
