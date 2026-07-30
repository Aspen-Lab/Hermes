import { describe, expect, it } from "vitest";
import { scoredEventToEvent } from "./mapper";
import type { ScoredEventItem } from "./types";

const rankedEvent: ScoredEventItem = {
  id: "ccfddl:test-2027",
  source: "ccfddl",
  name: "Test Conference 2027",
  type: "conference",
  startDate: "2027-06-10",
  location: "Chicago, IL",
  isOnline: false,
  description: "A focused conference for battery and materials research.",
  url: "https://example.com/test-2027",
  rank: "CCF A",
  tags: ["battery", "materials"],
  score: 0.92,
  matchedKeywords: ["battery"],
  relevanceReason: "Matches your battery focus.",
};

describe("scoredEventToEvent", () => {
  it("keeps rank structured and leaves the description clean", () => {
    const event = scoredEventToEvent(rankedEvent);

    expect(event.rank).toBe("CCF A");
    expect(event.tags).toEqual(["battery", "materials"]);
    expect(event.matchedTerms).toEqual(["battery"]);
    expect(event.shortDescription).toBe(rankedEvent.description);
    expect(event.shortDescription).not.toMatch(/^CCF A/);
  });

  it("leaves absent optional display values undefined", () => {
    const event = scoredEventToEvent({
      ...rankedEvent,
      id: "eventweb:minimal",
      source: "eventweb",
      rank: undefined,
      tags: [],
      matchedKeywords: [],
    });

    expect(event).toMatchObject({
      rank: undefined,
      tags: undefined,
      matchedTerms: undefined,
      locationFit: undefined,
    });
  });

  it("computes location fit when preferences are provided", () => {
    expect(scoredEventToEvent(rankedEvent, ["Chicago"]).locationFit).toBe(1);
  });
});
