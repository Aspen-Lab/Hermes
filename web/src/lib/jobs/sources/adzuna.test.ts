import { describe, expect, it } from "vitest";
import { adzunaJobToRawItem } from "./adzuna";

// B8-03 (round 8): before this round, no test file existed for this adapter
// at all (confirmed by directory listing). The empty-company branch
// hardcoded a fabricated "Unknown company" placeholder - Ruling 26's own
// anti-pattern, unaudited since B5-03 introduced the rule in jobweb.ts. This
// is the hardest case for this adapter: the one path nobody had exercised.
describe("adzunaJobToRawItem", () => {
  it("leaves company undefined when the source record has no display_name", () => {
    const item = adzunaJobToRawItem(
      {
        id: 123,
        title: "Battery R&D Scientist",
        company: {},
        redirect_url: "https://acme.test/jobs/123",
      },
      "us",
    );
    expect(item?.company).toBeUndefined();
  });

  it("still keeps a real company name when the source record has one", () => {
    const item = adzunaJobToRawItem(
      {
        id: 124,
        title: "Battery R&D Scientist",
        company: { display_name: "Acme Materials" },
        redirect_url: "https://acme.test/jobs/124",
      },
      "us",
    );
    expect(item?.company).toBe("Acme Materials");
  });
});
