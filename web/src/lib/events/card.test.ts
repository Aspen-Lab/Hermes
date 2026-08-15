import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import { eventCardView } from "./card";
import { opportunityFormat } from "@/lib/opportunities/facets";

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

// ─────────────────────────────────────────────────────────────────────────
// B20-01 (A: event A20-01). Hybrid attendance reaches the card.
//
// schema.org has THREE attendance modes — Offline, Online and Mixed — but the
// record carries a two-valued `isOnline`, so a HYBRID event is stored as
// `isOnline: true` and this tile used to delete its venue. The app already
// disagreed with itself: the Format facet chips called the same row `hybrid`
// while this tile called it `Online`. The fix asks the chips' own shipped,
// tested question (`isOnlineOnly`) at the render site.
//
// NEGATIVE PROOF, MEASURED BY MUTATION and recorded so a later round can check
// rather than rediscover: reverting `locationView` to `event.isOnline ?
// "Online" : …` turns the two HYBRID tests below red, and nothing else.
//
// THE SEVEN GENUINELY-ONLINE ROWS ARE A **LOCK, NOT COVERAGE**. Before this
// change `card.test.ts` had NO test where `isOnline` was `true` at all, so the
// shipped code passes them too — they cannot be uniquely red, and a later
// round must not present them as proof the guard works. They exist to stop a
// future edit from taking `Online` away from an event that really is
// online-only. Each row's shape is built the way its own source builds it.
// ─────────────────────────────────────────────────────────────────────────
describe("B20-01 — a hybrid event keeps its venue on the card", () => {
  const hybrid: Event = {
    ...event,
    isOnline: true,
    location: "Rome, Italy",
    place: { city: "Rome", country: "Italy" },
    locationFit: undefined,
  };

  it("renders the venue, not the word Online", () => {
    expect(eventCardView(hybrid, now).locationLabel).toBe("Rome, Italy");
  });

  it("agrees with the Format facet chip on the same row", () => {
    // The contradiction this item closes: one record, two answers.
    expect(opportunityFormat("events", hybrid)).toBe("hybrid");
    expect(eventCardView(hybrid, now).locationLabel).not.toBe("Online");
  });

  it("LOCK, not coverage: all seven genuinely-online shapes still say Online", () => {
    const onlineOnly: Array<[string, Partial<Event>]> = [
      ["eventweb, genuinely online", { isOnline: true, location: "Online" }],
      ["ccfddl, genuinely online", { isOnline: true, location: "Online" }],
      ["confstech online, no city", { isOnline: true, location: "Online" }],
      ["researchseminars online talk", { isOnline: true, location: "Online" }],
      ["eventweb online, enrichment failed", { isOnline: true, location: "" }],
      [
        "online with an all-blank place object",
        { isOnline: true, location: "Online", place: { city: "  ", region: "" } },
      ],
      ["ccfddl online, source place text was Online", { isOnline: true, location: "Online" }],
    ];
    expect(onlineOnly).toHaveLength(7);
    for (const [label, shape] of onlineOnly) {
      expect(
        eventCardView({ ...event, locationFit: undefined, ...shape }, now).locationLabel,
        label,
      ).toBe("Online");
    }
  });

  it("ADMITTED CONTROL: an offline event with no location at all is unchanged", () => {
    expect(
      eventCardView({ ...event, location: "", locationFit: undefined }, now).locationLabel,
    ).toBe("Location not listed");
  });

  it("a hybrid whose location string is empty falls back to Online, never to a blank", () => {
    // The one branch the fix adds that could have produced an empty tile.
    expect(
      eventCardView(
        { ...hybrid, location: "   " },
        now,
      ).locationLabel,
    ).toBe("Online");
  });

  it("DOCUMENTED KNOWN UNDER-CATCH: a ccfddl hybrid still reads Online", () => {
    // `events/sources/ccfddl.ts:146` overwrites the venue string with the
    // literal "Online" at INGESTION, before enrichment ever runs, while still
    // setting `place` from the same text. So the venue never reaches this
    // function to be rendered. That is a DIFFERENT defect in a DIFFERENT file
    // with zero live sightings; it is recorded here, not fixed here, and the
    // miss lands on an honest string the codebase already ships.
    expect(
      eventCardView(
        {
          ...event,
          isOnline: true,
          location: "Online",
          place: { city: "Chicago", region: "IL", country: "United States" },
          locationFit: undefined,
        },
        now,
      ).locationLabel,
    ).toBe("Online");
  });
});

// A23-02 / Ruling 62b. A month-granularity date renders at the granularity it
// was evidenced at. Printing "Aug 1, 2026" from "2026-08" would invent a day
// the page never stated.
describe("month-granularity dates on the card", () => {
  it("renders `Aug 2026`, not a first-of-the-month instant", () => {
    const view = eventCardView(
      { ...event, date: "2026-08", endDate: undefined },
      now,
    );
    expect(view.dateLabel).toBe("Aug 2026");
  });

  it("still renders a day-level date in full", () => {
    expect(eventCardView(event, now).dateLabel).toBe("Sep 10, 2026–Sep 12, 2026");
  });

  // A24-02. The private branch above moved into `formatDate`, and the early
  // return it used to sit behind also suppressed the END. The card keeps its
  // own "–" join, so it keeps that suppression explicitly: a month-granularity
  // start has no day to range FROM, exactly as `formatDateRange` decided.
  // Unwitnessed live (the one such row's endDate is ""), but this is a
  // regression guard on behaviour that already existed, not a new clause.
  it("ignores an end date on a month-granularity start", () => {
    expect(
      eventCardView({ ...event, date: "2026-08", endDate: "2026-09-12" }, now)
        .dateLabel,
    ).toBe("Aug 2026");
  });
});
