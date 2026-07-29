import { describe, expect, it } from "vitest";
import { eventPrestige, jobPrestige } from "./prestige";

describe("eventPrestige", () => {
  it.each([
    ["CCF A", { tier: "top", label: "CCF A" }],
    ["CORE A*", { tier: "top", label: "CORE A*" }],
    ["CCF B", { tier: "strong", label: "CCF B" }],
    ["CORE C", { tier: "solid", label: "CORE C" }],
  ] as const)("maps %s to its prestige tier", (rank, expected) => {
    expect(eventPrestige(rank)).toEqual(expected);
  });

  it("takes the best rank in a mixed string", () => {
    expect(eventPrestige("CCF B · CORE A")).toEqual({
      tier: "top",
      label: "CCF B · CORE A",
    });
  });

  it("states plainly when an event is unranked", () => {
    expect(eventPrestige(undefined)).toEqual({ tier: "unranked", label: "Unranked" });
    expect(eventPrestige("")).toEqual({ tier: "unranked", label: "Unranked" });
    expect(eventPrestige("other")).toEqual({ tier: "unranked", label: "Unranked" });
  });
});

describe("jobPrestige", () => {
  it.each([
    [
      ["Google DeepMind", "jsearch", "Research engineer working on foundation models"],
      { tier: "bigTech", label: "Big tech" },
    ],
    [
      ["Argonne National Laboratory", "usajobs", "Battery characterization scientist"],
      { tier: "nationalLab", label: "National lab" },
    ],
    [
      ["University of Illinois", "jobweb", "Postdoctoral researcher in materials science"],
      { tier: "academic", label: "Academic" },
    ],
    [
      ["Volt Forge", "himalayas", "Join our seed-stage battery startup as a founding scientist"],
      { tier: "startup", label: "Startup" },
    ],
    [
      ["Acme Industries", "remotive", "Support the product engineering organization"],
      { tier: "unknown", label: "Type unknown" },
    ],
  ] as const)("classifies the employer signal %#", (args, expected) => {
    expect(jobPrestige(args[0], args[1], args[2])).toEqual(expected);
  });

  it("only inspects the first few hundred description characters", () => {
    expect(jobPrestige("Acme", "remotive", `${"x".repeat(600)} startup`)).toEqual({
      tier: "unknown",
      label: "Type unknown",
    });
  });
});
