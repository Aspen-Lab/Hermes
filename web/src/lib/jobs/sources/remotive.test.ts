import { describe, expect, it } from "vitest";
import { remotiveJobToRawItem } from "./remotive";

// B8-03 (round 8): before this round, no test file existed for this adapter
// at all (confirmed by directory listing). Remotive is one of the three
// zero-key sources - it runs in every round's live sample regardless of
// configured keys, and B8-03 confirmed live this round that this exact
// adapter returned 17 items with 0 empty companies on the day's sample -
// reachable but not triggered that day. The hardest case is exactly the
// untriggered path.
describe("remotiveJobToRawItem", () => {
  it("leaves company undefined when the source record has no company_name", () => {
    const item = remotiveJobToRawItem({
      id: 123,
      title: "Battery R&D Scientist",
      url: "https://remotive.test/jobs/123",
    });
    expect(item?.company).toBeUndefined();
  });

  it("still keeps a real company name when the source record has one", () => {
    const item = remotiveJobToRawItem({
      id: 124,
      title: "Battery R&D Scientist",
      company_name: "Acme Materials",
      url: "https://remotive.test/jobs/124",
    });
    expect(item?.company).toBe("Acme Materials");
  });
});
