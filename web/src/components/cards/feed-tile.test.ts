import { describe, expect, it } from "vitest";
import { resolvePaperTileSummary } from "./feed-tile";

const paper = {
  summaryIntro: "First abstract sentence. Second abstract sentence. Third abstract sentence.",
  relevanceReason: "Matches your declared battery topic.",
};

describe("resolvePaperTileSummary", () => {
  it("prefers the stored digest sentence", () => {
    expect(
      resolvePaperTileSummary(paper, "Digest sentence for this paper."),
    ).toBe("Digest sentence for this paper.");
  });

  it("falls back to the first two abstract sentences", () => {
    expect(resolvePaperTileSummary(paper)).toBe(
      "First abstract sentence. Second abstract sentence.",
    );
  });

  it("falls back to the relevance reason when the abstract is absent", () => {
    expect(
      resolvePaperTileSummary({
        summaryIntro: " ",
        relevanceReason: "Matches your declared electrolyte topic.",
      }),
    ).toBe("Matches your declared electrolyte topic.");
  });

  it("never returns an empty body", () => {
    expect(
      resolvePaperTileSummary({
        summaryIntro: "",
        relevanceReason: "",
      }),
    ).toBe("Open this paper for details.");
  });
});
