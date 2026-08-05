import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatCount,
  formatDate,
  formatDayAge,
  formatDayDistance,
  formatDaysAgo,
  formatDaysLeft,
  formatMatchPct,
  formatTimeAgo,
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
