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
});
