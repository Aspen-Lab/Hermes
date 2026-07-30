import { describe, expect, it } from "vitest";
import { eventUrgency, jobUrgency } from "./urgency";

describe("eventUrgency", () => {
  it.each([
    [-1, "Closed"],
    [0, "Soon"],
    [14, "Soon"],
    [15, "Coming up"],
    [60, "Coming up"],
    [61, "Upcoming"],
  ])("maps %i days to %s", (days, label) => {
    expect(eventUrgency(days).label).toBe(label);
  });

  it("returns semantic theme tokens", () => {
    expect(eventUrgency(5)).toMatchObject({
      text: "text-red",
      bg: "bg-red/[0.06]",
      dot: "bg-red",
    });
  });
});

describe("jobUrgency", () => {
  it.each([
    [0, "Fresh"],
    [7, "Fresh"],
    [8, "Recent"],
    [30, "Recent"],
    [31, "Stale"],
  ])("maps a posting age of %i days to %s", (days, label) => {
    expect(jobUrgency(days).label).toBe(label);
  });

  it("returns semantic theme tokens", () => {
    expect(jobUrgency(3)).toMatchObject({
      text: "text-accent",
      bg: "bg-accent-dim",
      dot: "bg-accent",
    });
  });
});
