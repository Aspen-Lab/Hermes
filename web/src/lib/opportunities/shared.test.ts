import { describe, it, expect } from "vitest";
import { looksLikeHostBrand, routeSafeId, urlHashId } from "./shared";

// Regression guard: source ids flow straight into the single-segment
// /events/[id] and /jobs/[id] routes, so any slash (or other route-breaking
// char) in an id turns the detail page into a 404. Every adapter runs its raw
// id through routeSafeId — these tests lock that contract in.
describe("routeSafeId", () => {
  it("hashes URLs to a slash-free token", () => {
    const id = routeSafeId("https://himalayas.app/companies/helio/jobs/123");
    expect(id).not.toContain("/");
    expect(id).not.toContain(":");
    expect(id).toBe(urlHashId("https://himalayas.app/companies/helio/jobs/123"));
  });

  it("slugifies separators and spaces (no slashes survive)", () => {
    expect(routeSafeId("MITNT/42")).toBe("mitnt-42");
    expect(routeSafeId("ConFoo Montreal-2026-02-25")).toBe("confoo-montreal-2026-02-25");
  });

  it("is deterministic for the same input (stable across fetches)", () => {
    const a = routeSafeId("https://example.com/x/y");
    const b = routeSafeId("https://example.com/x/y");
    expect(a).toBe(b);
  });

  it("leaves already-safe ids readable", () => {
    expect(routeSafeId("aaai27")).toBe("aaai27");
    expect(routeSafeId("job_12345")).toBe("job_12345");
  });

  it("never returns an empty string", () => {
    expect(routeSafeId("///").length).toBeGreaterThan(0);
    expect(routeSafeId("").length).toBeGreaterThan(0);
  });
});

// B5-03 (round 5): a job board's own display name ("Climatebase" on
// climatebase.org) isn't a job-board *domain*, so a fixed denylist never
// catches it. Built once here so B5-06 can reuse it for an event title's
// site-brand segment instead of a second, duplicate check.
describe("looksLikeHostBrand", () => {
  it("rejects a candidate that equals the domain's own label", () => {
    expect(looksLikeHostBrand("Climatebase", "climatebase.org")).toBe(true);
  });

  it("rejects a candidate that is a prefix of a longer domain label", () => {
    expect(looksLikeHostBrand("ZeroB", "zerobonline.com")).toBe(true);
  });

  it("is case- and spacing-insensitive on both sides", () => {
    expect(looksLikeHostBrand("zero b", "ZeroBOnline.com")).toBe(true);
  });

  // The direction that must NOT reject: a real company's own display name
  // commonly shares a root with its own domain ("Acme Corp" at acme.test).
  // The domain label here is a prefix of a LONGER candidate, the opposite
  // shape from the two cases above — rejecting it would turn a real company
  // name into a lost one, which is worse than leaving the check narrower.
  it("keeps a real name that merely shares a root with a shorter domain label", () => {
    expect(looksLikeHostBrand("Acme Corp", "acme.test")).toBe(false);
    expect(looksLikeHostBrand("Acme Materials", "acme.test")).toBe(false);
  });

  it("ignores an unrelated candidate", () => {
    expect(looksLikeHostBrand("Northwind Labs", "acme.test")).toBe(false);
  });

  it("does not flag a short candidate (avoids over-matching on 1-2 letters)", () => {
    expect(looksLikeHostBrand("AI", "aiconf.org")).toBe(false);
  });

  // B8-02 (round 8): the pre-fix version only ever inspected the FIRST DNS
  // label, so a brand hosted on a subdomain was invisible to it. This is
  // the confirmed live shape (B8-01's own repro): a careers-portal-as-a-
  // service subdomain where the brand is the SECOND label, not the first.
  it("catches a brand on the second DNS label (subdomain-hosted careers portal)", () => {
    expect(looksLikeHostBrand("Vaia", "talents.vaia.com")).toBe(true);
  });

  // The hardest shape for "check every label": the brand sitting three
  // labels deep, to confirm the fix is not merely "also check the second
  // label" but genuinely checks all of them, matching the fix direction's
  // own instruction to try every label rather than guess which one or two
  // are "the real" ones.
  it("catches a brand three DNS labels deep", () => {
    expect(looksLikeHostBrand("Acme", "careers.jobs.acme.com")).toBe(true);
  });

  // The inverse of the two cases above, and the one most likely to break
  // silently if the one-directional guarantee were lost while widening to
  // multiple labels: a real, longer company name sharing a root with ONE of
  // several domain labels must still not be rejected, the same protection
  // the single-label version already had (see the "Acme Corp"/acme.test
  // case above), now proven across a multi-label host too.
  it("keeps a real, longer company name across a multi-label domain (one-directional guarantee still holds)", () => {
    expect(looksLikeHostBrand("Vaia Talent Solutions", "talents.vaia.com")).toBe(
      false,
    );
  });

  // B12-07 (round 12): talents.vaia.com — the EXACT host B8-02 was built on —
  // still let "Talents by Vaia" through as an employer. B8-02 changed the check
  // from "the first label" to "every label"; it never changed "one label at a
  // time". The board's display brand is composed of TWO of its own labels
  // joined by a filler word, so normalisation collapses it to a 13-character
  // token that is longer than talents, vaia and com individually and the
  // one-directional rule can never match it.
  describe("brand spanning two DNS labels (B12-07)", () => {
    // THE live defect. Both additions are required: the label RUN supplies
    // "talentsvaia", the filler strip supplies the candidate form that matches
    // it. Either one alone leaves this true.
    it("rejects a brand composed of two host labels joined by a filler word", () => {
      expect(looksLikeHostBrand("Talents by Vaia", "talents.vaia.com")).toBe(true);
    });

    // B8-02's own case, unchanged — the widening must not have replaced it.
    it("still rejects a single-label brand at depth", () => {
      expect(looksLikeHostBrand("Vaia", "talents.vaia.com")).toBe(true);
      expect(looksLikeHostBrand("Talents", "talents.vaia.com")).toBe(true);
    });

    // THE must-survive set, and the whole safety argument. Every one of these
    // is a real employer from round 12 A's own live census, checked against
    // the host it actually appeared on. A real name that is merely longer than
    // every label RUN is still never rejected — that is the one-directional
    // guarantee surviving the widening.
    it.each([
      ["Savannah River National Laboratory", "talents.vaia.com"],
      ["Idaho National Laboratory", "inl.referrals.selectminds.com"],
      ["Las Cumbres Observatory", "lco.global"],
      ["Thermo Fisher Scientific", "grad.wisc.edu"],
      ["Battery Ventures", "employbl.com"],
      ["Tesla", "ev.careers"],
      ["trawa", "arbeitnow.com"],
    ])("keeps the real employer %s on %s", (candidate, host) => {
      expect(looksLikeHostBrand(candidate, host)).toBe(false);
    });

    // shared.ts's own documented must-survive, re-run against the label-run
    // widening: "acme" + "test" concatenates to "acmetest", which must NOT
    // swallow "Acme Corp".
    it("keeps a company hosting under its own name when the name differs", () => {
      expect(looksLikeHostBrand("Acme Corp", "acme.test")).toBe(false);
      expect(looksLikeHostBrand("Acme Materials", "acme.test")).toBe(false);
    });

    // A filler word is only dropped as a WHOLE word. A real name whose letters
    // merely contain a filler's letters must be unaffected.
    it("only drops a filler word standing alone, never letters inside a word", () => {
      expect(looksLikeHostBrand("Bythe Analytics", "by.the.com")).toBe(false);
    });

    // Pre-existing cost, asserted so nobody attributes it to B12-07: a company
    // posting under its own exact domain is rejected TODAY by the equal-length
    // branch, and identically after. A's census records the same trade-off live
    // on careers.gevernova.com.
    it("rejects a company posting under its own exact domain, exactly as before", () => {
      expect(looksLikeHostBrand("Bank of America", "bankofamerica.com")).toBe(true);
    });
  });
});
