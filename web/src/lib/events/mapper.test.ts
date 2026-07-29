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
    expect(event.shortDescription).toBe(rankedEvent.description);
    expect(event.shortDescription).not.toMatch(/^CCF A/);
  });
});
