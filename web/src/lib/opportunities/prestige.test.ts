import { describe, expect, it } from "vitest";
import { eventPrestige } from "./prestige";

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
