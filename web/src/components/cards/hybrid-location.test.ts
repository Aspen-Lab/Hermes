import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Event } from "@/types";

// The three feed/briefing surfaces read the feed store. Same shape as
// `completion.test.tsx`'s mock: the store is not under test here, the
// location line is.
const storeState = vi.hoisted(() => ({
  readItems: {} as Record<string, boolean>,
  savedEvents: [] as { id: string }[],
  eventFeedback: {} as Record<string, unknown>,
  savePaper: vi.fn(),
  moreLikePaper: vi.fn(),
  notInterestedPaper: vi.fn(),
  paperSummaries: {} as Record<string, string>,
  saveEvent: vi.fn(),
  unsaveEvent: vi.fn(),
  moreLikeEvent: vi.fn(),
  notInterestedEvent: vi.fn(),
  saveJob: vi.fn(),
  unsaveJob: vi.fn(),
  moreLikeJob: vi.fn(),
  notInterestedJob: vi.fn(),
}));

vi.mock("@/store/feed", () => ({
  useFeedStore: (selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

import { FeedTile } from "./feed-tile";
import { BriefingHero } from "./briefing-hero";
import { BriefingQuickHit } from "./briefing-quick-hit";

function ev(overrides: Partial<Event> = {}): Event {
  return {
    id: "event:1",
    name: "Chemistry World Conference",
    type: "conference",
    date: "2027-06-21",
    endDate: "2027-06-23",
    location: "Rome, Italy",
    isOnline: true,
    place: { city: "Rome", country: "Italy" },
    shortDescription: "",
    relevanceReason: "Matches your battery focus.",
    relevanceScore: 0.9,
    ...overrides,
  };
}

const ONLINE_ONLY = ev({ location: "Online", place: undefined });

// ───────────────────────────────────────────────────────────────────────────
// B20-01 (A: event A20-01), render sites 4, 5 and 6 of 6.
//
// `isOnline ? "Online" : location` appeared at SIX places. The card and the
// two event-report sites are asserted in their own files; these three feed and
// briefing surfaces had no location assertion at all, so a half-applied fix
// would have left them silently wrong. Each is asserted separately on purpose.
//
// NEGATIVE PROOF: reverting any one site to the raw `isOnline ?` form turns
// exactly that site's hybrid test below red.
//
// The `ONLINE_ONLY` rows are ADMITTED CONTROLS — they pass before and after,
// and exist to stop a later edit taking `Online` away from a genuinely-online
// event. They are not coverage of the change.
// ───────────────────────────────────────────────────────────────────────────
describe("B20-01 — the feed and briefing surfaces keep a hybrid's venue", () => {
  it("render site 4 — the feed tile names the city and drops the globe icon", () => {
    const html = renderToStaticMarkup(
      createElement(FeedTile, { item: { kind: "event", data: ev() } }),
    );
    expect(html).toContain("Rome, Italy");
    expect(html).not.toContain(">Online<");
  });

  it("render site 5 — the briefing hero names the city", () => {
    const html = renderToStaticMarkup(
      createElement(BriefingHero, { item: { kind: "event", data: ev() } }),
    );
    expect(html).toContain("Rome, Italy");
  });

  it("render site 6 — the briefing quick hit names the city", () => {
    const html = renderToStaticMarkup(
      createElement(BriefingQuickHit, { item: { kind: "event", data: ev() } }),
    );
    expect(html).toContain("Rome, Italy");
  });

  it("ADMITTED CONTROL: a genuinely-online event still says Online on all three", () => {
    const tile = renderToStaticMarkup(
      createElement(FeedTile, { item: { kind: "event", data: ONLINE_ONLY } }),
    );
    const hero = renderToStaticMarkup(
      createElement(BriefingHero, { item: { kind: "event", data: ONLINE_ONLY } }),
    );
    const quick = renderToStaticMarkup(
      createElement(BriefingQuickHit, { item: { kind: "event", data: ONLINE_ONLY } }),
    );
    for (const [label, html] of [
      ["feed tile", tile],
      ["briefing hero", hero],
      ["briefing quick hit", quick],
    ] as const) {
      expect(html, label).toContain("Online");
      expect(html, label).not.toContain("Rome");
    }
  });

  it("ADMITTED CONTROL: an in-person event is untouched on all three", () => {
    const inPerson = ev({
      isOnline: false,
      location: "Chicago, IL",
      place: { city: "Chicago", region: "IL" },
    });
    for (const [label, node] of [
      ["feed tile", createElement(FeedTile, { item: { kind: "event", data: inPerson } })],
      ["briefing hero", createElement(BriefingHero, { item: { kind: "event", data: inPerson } })],
      [
        "briefing quick hit",
        createElement(BriefingQuickHit, { item: { kind: "event", data: inPerson } }),
      ],
    ] as const) {
      expect(renderToStaticMarkup(node), label).toContain("Chicago, IL");
    }
  });
});
