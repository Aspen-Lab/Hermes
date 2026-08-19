import { describe, expect, it } from "vitest";
import { jsearchJobToRawItem } from "./jsearch";

// B8-03 (round 8): before this round, no test file existed for this adapter
// at all (confirmed by directory listing). The empty-company branch
// hardcoded a fabricated "Unknown company" placeholder - the hardest case
// for this adapter, since it is the one path nobody had exercised.
describe("jsearchJobToRawItem", () => {
  it("leaves company undefined when the source record has no employer_name", () => {
    const item = jsearchJobToRawItem({
      job_id: "abc123",
      job_title: "Battery R&D Scientist",
      job_apply_link: "https://acme.test/jobs/abc123",
    });
    expect(item?.company).toBeUndefined();
  });

  it("still keeps a real company name when the source record has one", () => {
    const item = jsearchJobToRawItem({
      job_id: "abc124",
      job_title: "Battery R&D Scientist",
      employer_name: "Acme Materials",
      job_apply_link: "https://acme.test/jobs/abc124",
    });
    expect(item?.company).toBe("Acme Materials");
  });
});
