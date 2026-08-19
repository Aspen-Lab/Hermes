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

  // J1 (Phase 3 round 3, Ruling 120g item 1). Phase 3 round 2 B fetched
  // Himalayas' own live upstream API directly and found `companyName: "name"`
  // verbatim on 20 of 200 sampled real job records (10%), spanning 18
  // distinct real employers (Salesforce, ServiceNow, Lockheed Martin among
  // them) — a platform-side data defect, not a per-employer anomaly. Before
  // this item, `catalogLabel` was never read inside `resolveEmployerIdentity`
  // at all, so this adapter's own raw fallback (`job.companyName?.trim() ||
  // undefined`) rendered the literal word "name" as the company on real job
  // cards. These two cases mirror B's own live-execution verification
  // method, at this adapter's boundary rather than the raw API.
  describe("J1 — the closed placeholder-token predicate", () => {
    it("MUST-CATCH: drops the measured live placeholder value 'name' rather than rendering it", () => {
      const item = himalayasJobToRawItem({
        title: "Junior Development Engineer",
        applicationLink: "https://himalayas.app/companies/esvolta/jobs/junior-development-engineer",
        companyName: "name",
        description: "esVolta, LP is a leading developer of battery storage systems.",
      });
      expect(item?.company).toBeUndefined();
    });

    // The second of B's two topic-relevant witnesses, re-confirmed live —
    // same defect, different real employer and a non-English description, so
    // this is not just a re-run of the esVolta shape above with new filler.
    it("MUST-CATCH: drops the same placeholder value on the second named witness (Renergo)", () => {
      const item = himalayasJobToRawItem({
        title: "EPC Manager Owner's Engineer",
        applicationLink: "https://himalayas.app/companies/renergo/jobs/epc-manager-owner-s-engineer",
        companyName: "name",
        description: "Die Renergo entwickelt Batteriespeicherprojekte in ganz Europa.",
      });
      expect(item?.company).toBeUndefined();
    });

    // MUST-KEEP CONTROL — the load-bearing witness from the SAME 200-row
    // corpus that makes the predicate above safe. "mercor" is a real
    // recruiting/AI-adjacent company styled as a bare lowercase word; the
    // predicate is an exact closed-list match, never a shape heuristic, so
    // this real employer must keep rendering exactly as today.
    it("MUST-KEEP: still renders the real company 'mercor' from the same corpus, unaffected by the predicate", () => {
      const item = himalayasJobToRawItem({
        title: "Software Engineer",
        applicationLink: "https://himalayas.app/companies/mercor/jobs/software-engineer",
        companyName: "mercor",
        description: "Join our team building the future of hiring.",
      });
      expect(item?.company).toBe("mercor");
    });
  });
});
