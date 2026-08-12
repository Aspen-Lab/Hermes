import { describe, expect, it } from "vitest";
import {
  classifyEventType,
  cleanEventDescription,
  scoredEventToEvent,
} from "./mapper";
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

  it("carries only explicitly tagged report evidence while preserving discovery text", () => {
    const proved = scoredEventToEvent({
      ...rankedEvent,
      reportSummary: { text: "Source-owned summary.", authority: "source-record" },
    });
    expect(proved.shortDescription).toBe(rankedEvent.description);
    expect(proved.reportSummary).toEqual({ text: "Source-owned summary.", authority: "source-record" });
    expect(scoredEventToEvent(rankedEvent).reportSummary).toBeUndefined();
  });

  it("starts the measured description on a sentence and ends on a word boundary", () => {
    const measuredDescription =
      "than a quarter of a century. It will review the criteria necessary to achieve such extended life in commercially manufactured Li-ion cells. [...] This work presents an in situ diagnosis system of large capacity lithium-ion battery based on a sponge-type battery swelling sensor, w";
    const description = cleanEventDescription(measuredDescription);

    expect(description).toMatch(/^It will review/);
    expect(description).not.toContain("[...]");
    expect(description).not.toMatch(/\bw$/);
    expect(description).toMatch(/\u2026$/);
    expect(description.length).toBeLessThanOrEqual(280);
  });

  it("computes location fit when preferences are provided", () => {
    expect(scoredEventToEvent(rankedEvent, ["Chicago"]).locationFit).toBe(1);
  });

  it.each([
    ["National Laboratory Job Fair", "", "job-fair"],
    ["Materials Career Fair", "", "career-fair"],
    ["Future Energy Summit", "", "summit"],
    ["Advanced Battery Expo", "", "expo"],
    ["Climate Tech Hackathon", "", "hackathon"],
  ] as const)("classifies %s as %s", (title, description, expected) => {
    expect(classifyEventType(title, description)).toBe(expected);
  });

  it("uses description labels when the title is generic", () => {
    expect(
      classifyEventType(
        "Energy Futures 2027",
        "A recruiting event and job fair for energy researchers.",
      ),
    ).toBe("job-fair");
  });

  it("prefers the title kind over parent-event language in the description", () => {
    expect(
      classifyEventType(
        "Electrochemistry Workshop",
        "A focused session at the Future Energy Summit.",
      ),
    ).toBe("workshop");
  });
});
