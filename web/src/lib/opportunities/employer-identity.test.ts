import { describe, expect, it } from "vitest";
import { resolveEmployerIdentity } from "./employer-identity";

describe("resolveEmployerIdentity", () => {
  it("lets an owned direct declaration correct a catalog label", () => {
    expect(resolveEmployerIdentity({
      catalogLabel: "Workday",
      ownedTexts: ["At Luminare Health, our people build better care."],
    })).toEqual({ status: "declared", company: "Luminare Health" });
  });

  // J1 (Phase 3 round 3, Ruling 120g item 1 / Ruling 120d(4)): CONTRACT CHANGE.
  // Before this item, `catalogLabel` was accepted by the type and populated by
  // both callers but never read in this function body, so this case asserted
  // `{ status: "none" }` — the label was silently dropped here, and each
  // caller re-implemented its own unvalidated raw fallback instead (the exact
  // structural gap that let Himalayas' own upstream placeholder value "name"
  // reach real job cards, 20/200 sampled records). `catalogLabel` is now a
  // real, validated, lowest-priority tier, so a clean, non-placeholder,
  // non-host-brand label with no bounded declaration resolves to the new
  // `"catalog"` status instead of `"none"`. Rewritten per the standing rule
  // (never deleted): the assertion below states the NEW contract.
  it("routes a clean catalog label to the new catalog tier when no bounded declaration exists", () => {
    expect(resolveEmployerIdentity({
      catalogLabel: "Example Energy",
      ownedTexts: ["Benefits are available at Luminare Health after your first year."],
    })).toEqual({ status: "catalog", company: "Example Energy" });
  });

  it("rejects indirect identities and late/bare organization mentions", () => {
    expect(resolveEmployerIdentity({
      ownedTexts: ["At our client, our team supports projects. Partner Luminare Health is mentioned later."],
    })).toEqual({ status: "none" });
    expect(resolveEmployerIdentity({
      ownedTexts: [`${"Opening copy. ".repeat(60)}At Luminare Health, our people build care.`],
    })).toEqual({ status: "none" });
  });

  it("fails closed for competing direct or structured identities", () => {
    expect(resolveEmployerIdentity({
      ownedTexts: [
        "At Luminare Health, our team builds care.",
        "When you join Other Health, you help patients.",
      ],
    })).toEqual({ status: "ambiguous" });
    expect(resolveEmployerIdentity({
      ownedTexts: ["At Luminare Health, our team builds care. When you join Other Health, you help patients."],
    })).toEqual({ status: "ambiguous" });
    expect(resolveEmployerIdentity({
      structuredOrganizations: "Luminare Health",
      ownedTexts: ["At Other Health, our employees build care."],
    })).toEqual({ status: "ambiguous" });
  });

  it("uses an agreeing selected structured organization as the highest tier", () => {
    expect(resolveEmployerIdentity({
      structuredOrganizations: "Luminare Health",
      ownedTexts: ["At Luminare Health, our people build better care."],
    })).toEqual({ status: "structured", company: "Luminare Health" });
  });

  // B8-04 (round 8): neither evidence tier above had a shape/brand guard at
  // all. These cases test the new `host` guard, not the tiers themselves.
  describe("host-brand guard (B8-04)", () => {
    it("rejects a structured candidate that is itself the page's own host brand", () => {
      // The exact live-confirmed pair from this round's B8-01/B8-02 report:
      // a SaaS careers portal's own brand sitting on a subdomain, which the
      // structured (JSON-LD hiringOrganization) tier had no defense against.
      expect(resolveEmployerIdentity({
        structuredOrganizations: "Vaia",
        host: "talents.vaia.com",
      })).toEqual({ status: "none" });
    });

    it("rejects a declared candidate that is itself the page's own host brand", () => {
      // A different platform/host pair than the structured-tier case above,
      // so this proves the guard is applied independently on the free-text
      // tier too, not only reachable via the structured tier's own check.
      expect(resolveEmployerIdentity({
        ownedTexts: ["At Lever, our team helps companies hire well."],
        host: "jobs.lever.co",
      })).toEqual({ status: "none" });
    });

    it("keeps a real employer name that only shares a root with the host, not equal to it", () => {
      // The inverse hardest case: this round's own headline real employer
      // ("Savannah River National Laboratory", B8-01's confirmed example) on
      // the exact host whose brand the guard above must reject ("Vaia").
      // Proves the one-directional length safety survives being threaded
      // through resolveEmployerIdentity, not just inside looksLikeHostBrand
      // itself (already covered by B8-02's own tests) — a real, long,
      // unrelated name must not be caught by a guard built to catch a short
      // exact brand match.
      expect(resolveEmployerIdentity({
        structuredOrganizations: "Savannah River National Laboratory",
        host: "talents.vaia.com",
      })).toEqual({
        status: "structured",
        company: "Savannah River National Laboratory",
      });
    });

    it("does not reject a host-brand-shaped candidate when no host is supplied", () => {
      // Locks in the "additive and optional" contract explicitly: omitting
      // `host` (every caller before this item, and any future one that has
      // no URL context) must reproduce today's exact unguarded behavior,
      // not a silently stricter one.
      expect(resolveEmployerIdentity({
        structuredOrganizations: "Vaia",
      })).toEqual({ status: "structured", company: "Vaia" });
    });

    it("falls through to a real declared candidate when the structured tier is rejected as the host brand", () => {
      // The standard this whole round is held to: a rejected candidate must
      // be replaced by a correct value when one is available, not just by
      // silence. Silence is only correct when nothing else qualifies either
      // (the "none" cases above).
      expect(resolveEmployerIdentity({
        structuredOrganizations: "Vaia",
        ownedTexts: [
          "At Savannah River National Laboratory, our team advances nuclear science.",
        ],
        host: "talents.vaia.com",
      })).toEqual({
        status: "declared",
        company: "Savannah River National Laboratory",
      });
    });
  });

  // J1 (Phase 3 round 3, Ruling 120g item 1): `catalogLabel` is now a real,
  // validated, lowest-priority tier instead of a value both callers re-read
  // raw and unvalidated. Corpus per Phase 3 round 2 B, Deliverable 1.
  describe("catalog tier (J1, Phase 3 round 3)", () => {
    // MUST-CATCH. The measured live defect: Himalayas' own upstream API
    // returns `companyName: "name"` verbatim on 20 of 200 sampled real job
    // records (10%), spanning 18 distinct real employers. `"name"` is the
    // one closed-list member this codebase has actually measured; a catalog
    // label matching it exactly must never render as a company.
    it("rejects the measured closed-list placeholder value 'name'", () => {
      expect(resolveEmployerIdentity({
        catalogLabel: "name",
      })).toEqual({ status: "none" });
    });

    // Case-insensitive / whitespace-insensitive, same as every other exact
    // match in this file (`normalized`) — the defect is a field-label leak,
    // not a specific casing, and a source could plausibly emit either shape.
    it("rejects the placeholder value regardless of case or surrounding whitespace", () => {
      expect(resolveEmployerIdentity({
        catalogLabel: "  NAME  ",
      })).toEqual({ status: "none" });
    });

    // MUST-KEEP CONTROL — THE LOAD-BEARING WITNESS THAT MAKES THIS SAFE.
    // `companyName: "mercor"` is a REAL company (a recruiting/AI-adjacent
    // firm) sampled from the exact same 200-row Himalayas corpus as the
    // "name" defect above. It proves the predicate must be an EXACT
    // closed-list match, never a shape/length/casing heuristic: a "short
    // lowercase single word" guess would have wrongly rejected this real
    // employer right alongside the real defect.
    it("keeps a real company that shares the placeholder's shape but not its exact value ('mercor')", () => {
      expect(resolveEmployerIdentity({
        catalogLabel: "mercor",
      })).toEqual({ status: "catalog", company: "mercor" });
    });

    // The catalog tier is reached only when neither higher tier has a
    // candidate — a placeholder catalog label must not block a real
    // structured or declared identity that IS present.
    it("prefers a real structured candidate over a rejected placeholder catalog label", () => {
      expect(resolveEmployerIdentity({
        catalogLabel: "name",
        structuredOrganizations: "Luminare Health",
      })).toEqual({ status: "structured", company: "Luminare Health" });
    });

    it("prefers a real declared candidate over a rejected placeholder catalog label", () => {
      expect(resolveEmployerIdentity({
        catalogLabel: "name",
        ownedTexts: ["At Luminare Health, our people build better care."],
      })).toEqual({ status: "declared", company: "Luminare Health" });
    });

    // The catalog tier gets the SAME host-brand guard the two tiers above
    // already have (B8-04) — a source's catalog label can itself be the
    // page's own site brand, not just its structured/declared fields.
    it("rejects a catalog label that is itself the page's own host brand", () => {
      expect(resolveEmployerIdentity({
        catalogLabel: "Vaia",
        host: "talents.vaia.com",
      })).toEqual({ status: "none" });
    });

    // A miss (absent or failing catalog label, nothing else present) falls
    // to exactly today's pre-J1 "none" — a guard can only remove a value,
    // never invent one.
    it("stays 'none' when the catalog label is absent and no other tier has a candidate", () => {
      expect(resolveEmployerIdentity({})).toEqual({ status: "none" });
    });
  });
});
