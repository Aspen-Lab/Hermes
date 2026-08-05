import { describe, expect, it } from "vitest";
import {
  formatSalary,
  formatSalaryRange,
  normalizeSalary,
  parseSalaryText,
  SALARY_NOT_DISCLOSED,
  type NormalizedSalary,
} from "./salary";

const usd = (
  min: number,
  max: number,
  period: NormalizedSalary["period"] = "year",
): NormalizedSalary => ({ min, max, currency: "USD", period });

describe("parseSalaryText", () => {
  it.each([
    ["$18 - $22/hr", usd(18, 22, "hour")],
    ["$30k - $100k", usd(30_000, 100_000)],
    ["$45,000 - $50,000", usd(45_000, 50_000)],
    ["$14/hr", usd(14, 14, "hour")],
    ["$36k", usd(36_000, 36_000)],
    ["$90 - $150 /hour", usd(90, 150, "hour")],
    ["$120 - $170 /hour", usd(120, 170, "hour")],
    ["$150k - $230k", usd(150_000, 230_000)],
    ["$170k - $200k", usd(170_000, 200_000)],
    ["$31,2k- $52k", usd(31_200, 52_000)],
    ["$80k - $100k", usd(80_000, 100_000)],
    ["$55k - $100k", usd(55_000, 100_000)],
    ["OTE $25k - $35k", usd(25_000, 35_000)],
    // "$3k - $10k" is also a measured Remotive string, but it is asserted in
    // the sanity-gate block below — it parses cleanly and is then rejected.
    ["$50-$75 /hour", usd(50, 75, "hour")],
    ["$20k -$35k", usd(20_000, 35_000)],
    ["$12K", usd(12_000, 12_000)],
    ["$120k - $220k", usd(120_000, 220_000)],
  ])("parses the measured Remotive fixture %s", (text, expected) => {
    expect(parseSalaryText(text)).toEqual(expected);
  });

  it("returns null for missing or unconfident input", () => {
    expect(parseSalaryText("")).toBeNull();
    expect(parseSalaryText("   ")).toBeNull();
    expect(parseSalaryText(undefined)).toBeNull();
    expect(parseSalaryText("competitive")).toBeNull();
    expect(parseSalaryText("$20k plus bonus")).toBeNull();
  });

  it("treats an unmarked small value as hourly", () => {
    expect(parseSalaryText("$14")).toEqual(usd(14, 14, "hour"));
  });

  // The free-text path must enforce the same plausibility gate as the
  // structured path. Before this, "$3k - $10k" — a real Remotive string —
  // rendered as "$3k–10k / yr" while the identical structured input was
  // rejected.
  it("applies the sanity gate to free text, not just structured input", () => {
    expect(parseSalaryText("$3k - $10k")).toBeNull();
    expect(
      normalizeSalary({ min: 3_000, max: 10_000, currency: "USD", period: "annual" }),
    ).toBeNull();
    expect(parseSalaryText("$4,999")).toBeNull();
    expect(parseSalaryText("$2,500,000")).toBeNull();
  });

  it("declines to guess a period in the ambiguous band", () => {
    // Above a real hourly rate, below a real annual salary — a confident
    // "$500 / hr" ($1.04M a year) is worse than admitting we do not know.
    expect(parseSalaryText("$500")).toBeNull();
    expect(parseSalaryText("$1k")).toBeNull();
    // Either side of the band still resolves.
    expect(parseSalaryText("$300")).toEqual(usd(300, 300, "hour"));
    expect(parseSalaryText("$36k")).toEqual(usd(36_000, 36_000));
    // An explicit marker always wins over the heuristic.
    expect(parseSalaryText("$500 / month")).toEqual(usd(500, 500, "month"));
  });

  it("reads a two-place decimal comma before a k suffix", () => {
    expect(parseSalaryText("$31,25k")).toEqual(usd(31_250, 31_250));
    expect(parseSalaryText("$31,2k")).toEqual(usd(31_200, 31_200));
    // Three digits after the comma is a thousands separator, not a decimal.
    expect(parseSalaryText("$1,000k")).toEqual(usd(1_000_000, 1_000_000));
  });
});

describe("normalizeSalary", () => {
  it.each([
    [
      { min: 800, max: 1_500, currency: "USD", period: "monthly" },
      usd(800, 1_500, "month"),
    ],
    [
      { min: 1_000, max: 2_000, currency: "USD", period: "monthly" },
      usd(1_000, 2_000, "month"),
    ],
    [
      { min: 210_000, max: 280_000, currency: "USD", period: "annual" },
      usd(210_000, 280_000),
    ],
    [
      { min: 22_000, max: 26_000, currency: "ZAR", period: "monthly" },
      { min: 22_000, max: 26_000, currency: "ZAR", period: "month" },
    ],
    [
      { min: 64_000, max: 125_000, currency: "EUR", period: "annual" },
      { min: 64_000, max: 125_000, currency: "EUR", period: "year" },
    ],
  ])("normalizes the measured Himalayas row %#", (input, expected) => {
    expect(normalizeSalary(input)).toEqual(expected);
  });

  it("rejects the measured garbage monthly range", () => {
    expect(
      normalizeSalary({ min: 50, max: 1_000, currency: "USD", period: "monthly" }),
    ).toBeNull();
  });

  it("returns null when both values are missing even if a period is present", () => {
    expect(
      normalizeSalary({ min: null, max: null, currency: "USD", period: "annual" }),
    ).toBeNull();
  });

  it("uses the present bound when only one side is provided", () => {
    expect(normalizeSalary({ min: 75_000, currency: "USD", period: "year" })).toEqual(
      usd(75_000, 75_000),
    );
    expect(normalizeSalary({ max: 80_000, currency: "USD", period: "year" })).toEqual(
      usd(80_000, 80_000),
    );
  });

  it("rejects reversed and implausible ranges", () => {
    expect(
      normalizeSalary({ min: 80_000, max: 70_000, currency: "USD", period: "year" }),
    ).toBeNull();
    expect(
      normalizeSalary({ min: 4_999, max: 70_000, currency: "USD", period: "year" }),
    ).toBeNull();
    expect(
      normalizeSalary({ min: 70_000, max: 2_000_001, currency: "USD", period: "year" }),
    ).toBeNull();
  });
});

describe("formatSalary", () => {
  it.each([
    [usd(150_000, 230_000), "$150k–230k / yr"],
    [{ min: 64_000, max: 125_000, currency: "EUR", period: "year" }, "€64k–125k / yr"],
    [usd(18, 22, "hour"), "$18–22 / hr"],
    [{ min: 22_000, max: 26_000, currency: "ZAR", period: "month" }, "ZAR 22k–26k / mo"],
    [usd(36_000, 36_000), "$36k / yr"],
    // Past a million, "1,500k" reads as a formatting mistake.
    [usd(1_200_000, 1_800_000), "$1.2M–1.8M / yr"],
  ] satisfies Array<[NormalizedSalary, string]>)("formats %# as %s", (salary, expected) => {
    expect(formatSalary(salary)).toBe(expected);
  });

  it("exports one canonical missing-salary label", () => {
    expect(SALARY_NOT_DISCLOSED).toBe("Salary not disclosed");
  });
});

describe("formatSalaryRange", () => {
  // B2-02. Plate 02's SALARY tile value: no period suffix (the tile's own
  // detail line states the period), a spaced en dash, and the currency symbol
  // repeated on the upper bound. A separate function from formatSalary, which
  // keeps its existing compact form for the feed and job cards.
  it.each([
    [usd(95_000, 120_000), "$95k – $120k"],
    [{ min: 22_000, max: 26_000, currency: "ZAR", period: "month" as const }, "ZAR 22k – ZAR 26k"],
    [usd(120_000, 120_000), "$120k"],
  ] satisfies Array<[NormalizedSalary, string]>)("formats %# as %s", (salary, expected) => {
    expect(formatSalaryRange(salary)).toBe(expected);
  });

  it("never changes formatSalary's own output", () => {
    // The two are independent on purpose. If this ever fails, the split in
    // B2-02 was done wrong — formatSalary must stay byte-identical for every
    // caller outside the report (feed cards, search).
    expect(formatSalary(usd(150_000, 230_000))).toBe("$150k–230k / yr");
  });
});
