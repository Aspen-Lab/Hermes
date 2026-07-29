import { describe, expect, it } from "vitest";
import { parseSalaryText, type NormalizedSalary } from "./salary";

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
    ["$3k - $10k", usd(3_000, 10_000)],
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
});
