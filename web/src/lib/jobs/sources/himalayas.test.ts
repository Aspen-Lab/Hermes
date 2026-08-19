import { describe, expect, it } from "vitest";
import { himalayasJobToRawItem } from "./himalayas";

// B8-03 (round 8): before this round, no test file existed for this adapter
// at all (confirmed by directory listing). Himalayas is one of the three
// zero-key sources - it runs in every round's live sample regardless of
// configured keys. Unlike the other four adapters, the placeholder here sits
// behind resolveEmployerIdentity's "none" status (no JSON-LD-shaped
// structured evidence, no owned-text self-declaration), so the hardest case
// is specifically the combination: resolveEmployerIdentity finds nothing,
// AND the catalog label itself is empty - the one path that reached the
// fabricated fallback.
describe("himalayasJobToRawItem", () => {
  it("leaves company undefined when neither the catalog label nor resolveEmployerIdentity has anything", () => {
    const item = himalayasJobToRawItem({
      title: "Battery R&D Scientist",
      applicationLink: "https://himalayas.app/companies/acme/jobs/123",
      description: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  it("still keeps the catalog label when resolveEmployerIdentity finds nothing but the source provided a name", () => {
    const item = himalayasJobToRawItem({
      title: "Battery R&D Scientist",
      applicationLink: "https://himalayas.app/companies/acme/jobs/124",
      companyName: "Acme Materials",
      description: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBe("Acme Materials");
  });
});
