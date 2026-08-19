import { describe, expect, it } from "vitest";
import { resolveEmployerIdentity } from "./employer-identity";

describe("resolveEmployerIdentity", () => {
  it("lets an owned direct declaration correct a catalog label", () => {
    expect(resolveEmployerIdentity({
      catalogLabel: "Workday",
      ownedTexts: ["At Luminare Health, our people build better care."],
    })).toEqual({ status: "declared", company: "Luminare Health" });
  });

  it("keeps catalog fallback available when no bounded declaration exists", () => {
    expect(resolveEmployerIdentity({
      catalogLabel: "Example Energy",
      ownedTexts: ["Benefits are available at Luminare Health after your first year."],
    })).toEqual({ status: "none" });
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
});
