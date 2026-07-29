import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import { eventCardView } from "./card";

const now = new Date(2026, 6, 29, 12).getTime();

const event: Event = {
  id: "ccfddl:test",
  name: "Test Conference",
  type: "conference",
  date: "2026-09-10",
  endDate: "2026-09-12",
  location: "Chicago, IL",
  isOnline: false,
  deadline: "2026-08-16",
  shortDescription: "A test event.",
  relevanceReason: "Matches your battery focus.",
  relevanceScore: 0.92,
  rank: "CCF A",
  matchedTerms: ["battery", "materials"],
  locationFit: 1,
};

describe("eventCardView", () => {
  it("builds the six-row facts without component logic", () => {
    expect(eventCardView(event, now)).toMatchObject({
      prestige: { tier: "top", label: "CCF A" },
      matchLabel: "92% · Strong match",
      matchTone: "accent",
      dateLabel: "Sep 10, 2026–Sep 12, 2026",
      locationLabel: "Chicago, IL · Preferred",
      locationTone: "accent",
      urgency: {
        label: "CFP closes in 18 days",
        progress: 70,
        bucket: { label: "Coming up" },
      },
      matchedTerms: ["battery", "materials"],
    });
  });

  it("states missing facts plainly", () => {
    expect(
      eventCardView(
        {
          ...event,
          date: "",
          deadline: undefined,
          rank: undefined,
          relevanceScore: undefined,
          matchedTerms: undefined,
          locationFit: undefined,
        },
        now,
      ),
    ).toMatchObject({
      prestige: { tier: "unranked", label: "Unranked" },
      matchLabel: "Match not scored",
      dateLabel: "Date not listed",
      locationLabel: "Chicago, IL",
      urgency: { label: "CFP deadline not listed", bucket: { label: "Not listed" } },
      matchedTerms: [],
    });
  });
});
