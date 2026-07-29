import { describe, expect, it } from "vitest";
import { matchQuality } from "./match-quality";

describe("matchQuality", () => {
  it.each([
    [0.9, { pct: 90, band: "strong", label: "Strong match" }],
    [1, { pct: 100, band: "strong", label: "Strong match" }],
    [0.89, { pct: 89, band: "relevant", label: "Relevant" }],
    [0.7, { pct: 70, band: "relevant", label: "Relevant" }],
    [0.699, { pct: 70, band: "marginal", label: "Marginal" }],
  ] as const)("maps a score of %s", (score, expected) => {
    expect(matchQuality(score)).toEqual(expected);
  });

  it("passes missing and non-finite scores through as null", () => {
    expect(matchQuality(undefined)).toBeNull();
    expect(matchQuality(null)).toBeNull();
    expect(matchQuality(Number.NaN)).toBeNull();
  });

  it("reuses the shared clamped percentage behavior", () => {
    expect(matchQuality(1.4)?.pct).toBe(100);
    expect(matchQuality(-0.2)?.pct).toBe(0);
  });
});
