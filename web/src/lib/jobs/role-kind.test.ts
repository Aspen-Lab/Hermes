import { describe, expect, it } from "vitest";
import { classifyRoleKind } from "./role-kind";

describe("classifyRoleKind", () => {
  it.each([
    ["Battery Research Internship", "internship"],
    ["PhD Candidate in Electrochemistry", "phd-position"],
    ["Postdoctoral Research Fellow", "postdoc"],
    ["Applied Scientist, Battery Modeling", "staff"],
    ["Assistant Professor of Materials Science", "faculty"],
  ] as const)("classifies %s as %s", (title, expected) => {
    expect(classifyRoleKind(title)).toBe(expected);
  });

  it("uses description text only when the title has no role-kind signal", () => {
    expect(
      classifyRoleKind(
        "Battery Materials Opening",
        "This is a doctoral position studying solid electrolytes.",
      ),
    ).toBe("phd-position");
  });

  it("does not let a description override a classified title", () => {
    expect(
      classifyRoleKind(
        "Research Internship",
        "You will collaborate with professors and postdoctoral researchers.",
      ),
    ).toBe("internship");
  });

  it("prefers specific role kinds when a title matches broad staff wording", () => {
    expect(classifyRoleKind("Postdoctoral Researcher")).toBe("postdoc");
    expect(classifyRoleKind("Faculty Researcher")).toBe("faculty");
  });

  it("returns undefined when neither field identifies a role kind", () => {
    expect(
      classifyRoleKind(
        "Battery Modeling Opening",
        "Develop electrochemical simulations for a growing energy company.",
      ),
    ).toBeUndefined();
  });
});
