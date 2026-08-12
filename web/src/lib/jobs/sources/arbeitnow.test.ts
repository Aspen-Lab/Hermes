import { describe, expect, it } from "vitest";
import { arbeitnowJobToRawItem } from "./arbeitnow";

// B8-03 (round 8): before this round, no test file existed for this adapter
// at all (confirmed by directory listing). Arbeitnow is one of the three
// zero-key sources (sources/index.ts's own doc comment: "Tier 0 works with
// zero keys") - it runs in every round's live sample whether or not any API
// key is configured, so this is the highest-reach of B8-03's five findings.
describe("arbeitnowJobToRawItem", () => {
  it("leaves company undefined when the source record has no company_name", () => {
    const item = arbeitnowJobToRawItem({
      slug: "battery-rd-scientist",
      title: "Battery R&D Scientist",
      url: "https://arbeitnow.test/jobs/battery-rd-scientist",
    });
    expect(item?.company).toBeUndefined();
  });

  it("still keeps a real company name when the source record has one", () => {
    const item = arbeitnowJobToRawItem({
      slug: "battery-rd-scientist",
      title: "Battery R&D Scientist",
      company_name: "Acme Materials",
      url: "https://arbeitnow.test/jobs/battery-rd-scientist",
    });
    expect(item?.company).toBe("Acme Materials");
  });
});
