import { describe, expect, it } from "vitest";
import {
  OPPORTUNITY_RELEVANCE_THRESHOLDS,
  opportunityRelevanceTone,
} from "./relevance-tier";

describe("opportunity relevance tiers", () => {
  it("uses fixed absolute score thresholds", () => {
    expect(opportunityRelevanceTone(0.499)?.tier).toBe("low");
    expect(
      opportunityRelevanceTone(
        OPPORTUNITY_RELEVANCE_THRESHOLDS.medium,
      )?.tier,
    ).toBe("medium");
    expect(opportunityRelevanceTone(0.599)?.tier).toBe("medium");
    expect(
      opportunityRelevanceTone(
        OPPORTUNITY_RELEVANCE_THRESHOLDS.high,
      )?.tier,
    ).toBe("high");
  });

  it("increases both the tint and accent bar strength by tier", () => {
    const low = opportunityRelevanceTone(0.4);
    const medium = opportunityRelevanceTone(0.55);
    const high = opportunityRelevanceTone(0.7);

    expect(low).not.toBeNull();
    expect(medium).not.toBeNull();
    expect(high).not.toBeNull();
    expect(low!.tintPercent).toBeLessThan(medium!.tintPercent);
    expect(medium!.tintPercent).toBeLessThan(high!.tintPercent);
    expect(low!.barPercent).toBeLessThan(medium!.barPercent);
    expect(medium!.barPercent).toBeLessThan(high!.barPercent);
  });

  it("does not imply relevance when a score is missing or invalid", () => {
    expect(opportunityRelevanceTone(undefined)).toBeNull();
    expect(opportunityRelevanceTone(Number.NaN)).toBeNull();
  });
});
