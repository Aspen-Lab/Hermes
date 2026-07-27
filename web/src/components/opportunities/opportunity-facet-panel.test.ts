import { describe, expect, it } from "vitest";
import { toggleOpportunityFacet } from "./opportunity-facet-panel";

describe("toggleOpportunityFacet", () => {
  it("adds selections without replacing another facet group", () => {
    expect(
      toggleOpportunityFacet(
        { location: ["Chicago"], format: ["hybrid"] },
        "month",
        "2026-09",
      ),
    ).toEqual({
      location: ["Chicago"],
      month: ["2026-09"],
      format: ["hybrid"],
    });
  });

  it("removes the active value case-insensitively", () => {
    expect(
      toggleOpportunityFacet(
        { location: ["Chicago", "Boston"] },
        "location",
        "chicago",
      ),
    ).toEqual({ location: ["Boston"] });
  });

  it("clears an empty group while preserving other selections", () => {
    expect(
      toggleOpportunityFacet(
        { location: ["Chicago"], format: ["online"] },
        "format",
        "online",
      ),
    ).toEqual({ location: ["Chicago"], format: undefined });
  });
});
