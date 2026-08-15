import { describe, expect, it } from "vitest";
import {
  dateClaimEndMs,
  daysUntil,
  formatCount,
  formatDate,
  formatDateRange,
  formatDayAge,
  formatDayDistance,
  formatDaysAgo,
  formatDaysLeft,
  formatMatchPct,
  formatTimeAgo,
  formatWeekdayRange,
  isMonthGranularity,
  parseDate,
} from "./format";

describe("parseDate", () => {
  it("parses date-only strings as local dates (no UTC day-shift)", () => {
    const d = parseDate("2026-07-19")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(19); // would fail in US timezones with new Date("2026-07-19")
  });

  it("returns null for garbage and empty input", () => {
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe("formatDate", () => {
  it("renders each style", () => {
    expect(formatDate("2026-07-19", "medium")).toBe("Jul 19, 2026");
    expect(formatDate("2026-07-19", "short")).toBe("Jul 19");
    expect(formatDate("2026-07-19", "monthYear")).toBe("Jul 2026");
    expect(formatDate("2026-07-19", "full")).toContain("July 19, 2026");
  });
});

describe("formatTimeAgo", () => {
  const now = new Date(2026, 6, 19, 12, 0, 0).getTime();
  it("walks the granularity ladder", () => {
    expect(formatTimeAgo(new Date(now - 30_000).toISOString(), now)).toBe("just now");
    expect(formatTimeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(formatTimeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h ago");
    expect(formatTimeAgo(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2d ago");
    expect(formatTimeAgo(new Date(2026, 6, 1).toISOString(), now)).toBe("Jul 1");
  });
});

describe("formatDayAge", () => {
  const now = new Date(2026, 6, 19, 12, 0, 0).getTime();
  it("matches the posted/published vocabulary", () => {
    expect(formatDayAge("2026-07-19", now)).toBe("Today");
    expect(formatDayAge("2026-07-18", now)).toBe("Yesterday");
    expect(formatDayAge("2026-07-10", now)).toBe("9d ago");
    expect(formatDayAge("2026-06-25", now)).toBe("3w ago");
    expect(formatDayAge("2026-01-05", now)).toBe("Jan 2026");
  });
});

describe("formatDayDistance / daysUntil", () => {
  it("speaks both directions", () => {
    expect(formatDayDistance(0)).toBe("today");
    expect(formatDayDistance(1)).toBe("tomorrow");
    expect(formatDayDistance(5)).toBe("in 5 days");
    expect(formatDayDistance(-5)).toBe("5 days ago");
    expect(formatDayDistance(21)).toBe("in 3 weeks");
    expect(formatDayDistance(-400)).toBe("1 years ago");
  });

  it("daysUntil is signed", () => {
    const now = new Date(2026, 6, 19, 12, 0, 0).getTime();
    expect(daysUntil("2026-07-24", now)).toBe(5);
    expect(daysUntil("2026-07-14", now)).toBe(-5);
  });
});

describe("formatDaysLeft / formatDaysAgo", () => {
  // B2-01 / Ruling 8. The report's own countdown vocabulary — always days,
  // never bucketed into weeks or months, never abbreviated to "Nd". Distinct
  // from formatDayDistance / formatDayAge above, which keep serving the feed
  // and papers view unchanged.
  it("counts down in the plate's words", () => {
    expect(formatDaysLeft(47)).toBe("47 days left");
    expect(formatDaysLeft(1)).toBe("1 day left");
    expect(formatDaysLeft(0)).toBe("due today");
    expect(formatDaysLeft(-3)).toBe("due today");
  });

  it("counts up in the plate's words", () => {
    expect(formatDaysAgo(8)).toBe("8 days ago");
    expect(formatDaysAgo(1)).toBe("1 day ago");
    expect(formatDaysAgo(0)).toBe("today");
    expect(formatDaysAgo(-3)).toBe("today");
  });
});

describe("formatCount", () => {
  it("compacts", () => {
    expect(formatCount(842)).toBe("842");
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(2000)).toBe("2k");
    expect(formatCount(34_500)).toBe("35k");
    expect(formatCount(1_100_000)).toBe("1.1M");
  });
});

describe("formatMatchPct", () => {
  it("clamps dirty scores", () => {
    expect(formatMatchPct(0.87)).toBe(87);
    expect(formatMatchPct(1.4)).toBe(100);
    expect(formatMatchPct(-0.2)).toBe(0);
    expect(formatMatchPct(null)).toBeNull();
    expect(formatMatchPct(undefined)).toBeNull();
  });
});

// A23-02 / Ruling 62b. A date evidenced only to the month.
describe("month-granularity date claims", () => {
  it("recognises the shape and nothing else", () => {
    expect(isMonthGranularity("2026-08")).toBe(true);
    expect(isMonthGranularity("2026-08-11")).toBe(false);
    expect(isMonthGranularity("2026")).toBe(false);
    expect(isMonthGranularity("2026-13")).toBe(false);
    expect(isMonthGranularity(undefined)).toBe(false);
  });

  it("parses to the first of the month as a LOCAL date", () => {
    const d = parseDate("2026-08");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getDate()).toBe(1);
  });

  it("ends the claim at the END of the month, never the start", () => {
    // The whole point of the ruling: reading `2026-08` as a day-level date puts
    // its expiry at 1 August, which would retire a live August event wrongly
    // early.
    expect(dateClaimEndMs("2026-08")).toBeGreaterThan(
      new Date(2026, 7, 31, 23, 0).getTime(),
    );
    expect(dateClaimEndMs("2026-08")).toBeLessThan(new Date(2026, 8, 1).getTime());
  });

  it("is identical to Date.parse for every day-level value", () => {
    expect(dateClaimEndMs("2026-08-11T12:00:00.000Z")).toBe(
      Date.parse("2026-08-11T12:00:00.000Z"),
    );
  });
});

// A24-02 / Ruling 62b. THE GRANULARITY BRANCH NOW LIVES IN THE SHARED
// FORMATTER. Before round 24 only `lib/events/card.ts` had it; five render
// sites reached `format.ts` directly and printed a day the page never stated —
// plate 03's DATES tile value and its weekday sub-line, plate 03's deadline
// strip, the feed tile, the briefing quick-hit and the briefing hero. Each
// `it` below is the uniquely-red case for one clause of the fix.
describe("A24-02: month-granularity rendering in the shared formatter", () => {
  it("renders the month for EVERY style — no style may invent a day", () => {
    // Reverted, these read "Aug 1, 2026" (default/medium, the tile and the
    // hero), "Aug 1" (short, the deadline strip, feed tile and quick-hit) and
    // "Saturday, August 1, 2026" (full).
    expect(formatDate("2026-08")).toBe("Aug 2026");
    expect(formatDate("2026-08", "medium")).toBe("Aug 2026");
    expect(formatDate("2026-08", "short")).toBe("Aug 2026");
    expect(formatDate("2026-08", "full")).toBe("Aug 2026");
    expect(formatDate("2026-08", "monthYear")).toBe("Aug 2026");
  });

  it("keys on the SHAPE, never on the day happening to be the 1st", () => {
    // The single most likely wrong implementation, and a silent one: a real
    // event that genuinely starts on 1 August keeps its evidenced day.
    expect(formatDate("2026-08-01", "medium")).toBe("Aug 1, 2026");
    expect(formatDate("2026-08-01", "short")).toBe("Aug 1");
    expect(formatWeekdayRange("2026-08-01", undefined)).toBe("Sat");
    expect(formatDateRange("2026-08-01", "2026-08-03")).toBe("Aug 1 – 3, 2026");
  });

  it("widens ONLY — a day-level value asked for monthYear still gets monthYear", () => {
    expect(formatDate("2026-09-15", "monthYear")).toBe("Sep 2026");
    expect(formatDate("2026-09-15", "medium")).toBe("Sep 15, 2026");
  });

  it("drops the weekday sub-line entirely, because a MONTH has no weekday", () => {
    // Reverted, both read "Sat" — the weekday of a first-of-the-month anchor.
    // `null` is what plate 03's `detail: … ?? undefined` consumes, so the
    // sub-line disappears rather than showing a wrong or blank one.
    expect(formatWeekdayRange("2026-08", undefined)).toBeNull();
    expect(formatWeekdayRange("2026-08", "2026-09-15")).toBeNull();
  });

  it("ignores the end — a month-granularity start has no day to range FROM", () => {
    // Reverted, the third reads "Aug 1 – Sep 15, 2026".
    expect(formatDateRange("2026-08", undefined)).toBe("Aug 2026");
    expect(formatDateRange("2026-08", "")).toBe("Aug 2026");
    expect(formatDateRange("2026-08", "2026-09-15")).toBe("Aug 2026");
  });

  it("FILLS nothing — an unparseable value is still null, never a fallback", () => {
    // 62b's own named boundary: never a year-only fallback, never a bare month
    // with no year, never a placeholder. Null is what drops the tile entirely.
    expect(formatDate("not-a-date")).toBeNull();
    expect(formatDate("2026-13")).toBeNull();
    // ESCAPE CLAUSE, ROUND 24 C — RECORDED, NOT FIXED, NOT WIDENED.
    // A YEAR-ONLY value is a shape round 24 B's cases did not span, and it is
    // NOT null today: `formatDate("2026")` renders "Dec 31, 2025" in any
    // behind-UTC zone, because it falls past both `parseDate` branches into a
    // raw `new Date("2026")` = UTC midnight, 1 January. An invented day AND a
    // wrong year. It is UNREACHABLE in the shipped pipeline as of this round —
    // `readDateOnlyParenthetical` (eventweb.ts:1346) emits a month-year ONLY
    // when it has BOTH month and year and `null` otherwise, `extractEventDate`
    // needs a month-day, and the two other year-ish call sites
    // (`search-result-card.tsx:207`, `formatDayAge`) already ask for
    // "monthYear". So it is LATENT. This assertion locks today's answer so the
    // shape cannot start moving unnoticed; it is not an endorsement of it.
    expect(formatDate("2026")).not.toBeNull();
    expect(formatDateRange("not-a-date", "2026-09-15")).toBeNull();
    expect(formatWeekdayRange("not-a-date", undefined)).toBeNull();
  });

  // A GUARD, NOT A PROOF — this block is green both before and after the fix by
  // design. It is the boundary condition round 24 B named: a single day-level
  // byte moving is a failed fix. All four are REAL live pool shapes B measured.
  it("leaves every day-level value byte-identical", () => {
    expect(
      formatDateRange("2026-09-15T12:00:00.000Z", "2026-09-18T12:00:00.000Z"),
    ).toBe("Sep 15 – 18, 2026");
    expect(
      formatWeekdayRange("2026-09-15T12:00:00.000Z", "2026-09-18T12:00:00.000Z"),
    ).toBe("Tue – Fri");
    expect(formatDateRange("2026-12-07", "2026-12-10")).toBe("Dec 7 – 10, 2026");
    expect(formatWeekdayRange("2026-12-07", "2026-12-10")).toBe("Mon – Thu");
    expect(
      formatDateRange("2026-10-12T12:00:00.000Z", "2026-10-15T12:00:00.000Z"),
    ).toBe("Oct 12 – 15, 2026");
    expect(
      formatWeekdayRange("2026-10-12T12:00:00.000Z", "2026-10-15T12:00:00.000Z"),
    ).toBe("Mon – Thu");
    expect(formatDateRange("2027-03-15T12:00:00.000Z", undefined)).toBe(
      "Mar 15, 2027",
    );
    expect(formatWeekdayRange("2027-03-15T12:00:00.000Z", undefined)).toBe("Mon");
  });
});
