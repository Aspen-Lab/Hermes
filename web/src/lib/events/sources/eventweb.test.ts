import { describe, expect, it } from "vitest";
import {
  bestEventTitleSegment,
  eventNameFrom,
  looksLikeEventTitle,
  webResultToRawEventItem,
} from "./eventweb";

// No test file existed for this source adapter before B4-01 (round 4) — see
// MULTIAGENT-report-parity.md, B4-01's own risk note. These are foundational
// cases for the existing fallback chain plus the new title-shape guard;
// this file does not attempt full coverage of every helper in eventweb.ts.

describe("looksLikeEventTitle", () => {
  it("rejects a narrative sentence about the event, not its name", () => {
    // Same shape as B4-01's real repro (a page whose H1 rendered as a
    // sentence describing the event's history rather than its name),
    // paraphrased rather than quoted verbatim.
    expect(
      looksLikeEventTitle(
        "Rivertown Summit was originally planned for 2020 but was delayed due to a global outbreak.",
      ),
    ).toBe(false);
    expect(looksLikeEventTitle("The workshop has been postponed until further notice.")).toBe(
      false,
    );
  });

  it("rejects a candidate that is more than one sentence", () => {
    expect(
      looksLikeEventTitle("Registration is now open. Book your seat today for the workshop."),
    ).toBe(false);
  });

  it("does not mistake a mid-title abbreviation for a sentence boundary", () => {
    expect(looksLikeEventTitle("Dr. James Wong Memorial Lecture Series")).toBe(true);
    expect(looksLikeEventTitle("U.S. National Conference on Materials Science")).toBe(true);
  });

  it("accepts real, long event names", () => {
    expect(
      looksLikeEventTitle(
        "The First European Conference on Molten Salt Reactor Chemistry and Technology",
      ),
    ).toBe(true);
    expect(looksLikeEventTitle("Solid-State Battery Summit 2026")).toBe(true);
  });

  it("rejects an implausibly long run of prose with no other tell", () => {
    const longRun = Array.from({ length: 25 }, (_, i) => `topic${i}`).join(" ");
    expect(looksLikeEventTitle(longRun)).toBe(false);
  });

  it("rejects an empty or blank candidate", () => {
    expect(looksLikeEventTitle("")).toBe(false);
    expect(looksLikeEventTitle("   ")).toBe(false);
  });
});

describe("eventNameFrom", () => {
  it("picks the informative segment over site chrome", () => {
    expect(eventNameFrom("Solid-State Battery Summit | Cambridge EnerTech", "")).toBe(
      "Solid-State Battery Summit",
    );
  });

  it("does not turn generic Open Graph page chrome into an event title", () => {
    expect(bestEventTitleSegment("Home | Events", "https://example.com/event")).toBeUndefined();
  });

  it("falls through to snippet mining when the whole title is a sentence", () => {
    const title =
      "Rivertown Summit was originally planned for 2020 but was delayed due to a global outbreak.";
    const snippet =
      "Rivertown Summit is a two-day materials science conference held every spring.";
    expect(eventNameFrom(title, snippet)).toBe(
      "Rivertown Summit is a two-day materials science conference held every spring.",
    );
  });

  it("falls through to the URL slug when both title and snippet fail every check", () => {
    const title = "Rivertown Summit was originally planned for 2020 but was delayed.";
    const snippet = "";
    const url = "https://example.com/events/rivertown-materials-summit-2026";
    // nameFromUrlSlug only title-cases the very first character; the rest of
    // the slug's own casing (already lowercase) passes through unchanged.
    expect(eventNameFrom(title, snippet, url)).toBe("Rivertown materials summit 2026");
  });

  it("does not use a headline-shaped URL slug as an event name", () => {
    expect(
      eventNameFrom(
        "Home | Events",
        "The International Battery Summit brings researchers together.",
        "https://example.com/events/registration-deadline-extended-march-2026",
      ),
    ).toBe("The International Battery Summit brings researchers together.");
  });

  // B9-04 Fix 1 (round 9, Ruling 32): this test used to assert "Home" — one
  // of the two segments isChromeSegment/GENERIC_PAGE_TITLE_RE had already
  // rejected a few lines above ("Home" and "Events" are both chrome here),
  // reinstated verbatim by the old `segments[0] ?? title.trim()` absolute
  // last resort. That is exactly the pattern Ruling 32 named the defect: a
  // guard rejects a candidate, then a fallback hands the reader that same
  // rejected candidate anyway. With no URL to read an honest host from, the
  // new last resort is a literal placeholder, not a second look at the
  // pool the guard just rejected.
  it("falls back to a literal placeholder when every title segment is chrome and there is no URL", () => {
    expect(eventNameFrom("Home | Events", "", undefined)).toBe("Untitled event");
  });

  // The same "every segment is chrome" shape, but WITH a URL present — the
  // last resort now reads the URL's own host, which is never a value any
  // guard rejected (only title segments were ever tested), matching this
  // codebase's own honest-placeholder precedent on the job side.
  it("falls back to the URL host when every title segment is chrome and a URL is available", () => {
    expect(eventNameFrom("Home | Events", "", "https://www.example.org/events/index")).toBe(
      "example.org",
    );
  });

  // B5-06/R13, three separate sub-gaps confirmed on real events A found,
  // none of them the shape R1's own guard (NARRATIVE_VERB_RE) targets.

  // Gap 1: a chrome segment that STARTS WITH a recognised generic word but
  // isn't an exact match for it ("Agenda & Information", paraphrased —
  // real event 2's title segment started with "Agenda" the same way).
  it("rejects a generic-title word with a short trailing phrase, not only an exact match", () => {
    expect(
      eventNameFrom("Agenda & Information | Riverside Materials Symposium", ""),
    ).toBe("Riverside Materials Symposium");
    expect(
      eventNameFrom("Schedule and Details | Example Energy Conference", ""),
    ).toBe("Example Energy Conference");
  });

  // Gap 2: a segment that is the page's OWN site/organisation brand, not the
  // event's name — "The Engine" on engine.xyz, paraphrased from real event
  // 2's other title segment. Reuses looksLikeHostBrand (B5-03).
  it("rejects a segment that is the page's own site brand (with or without a leading article)", () => {
    expect(
      eventNameFrom(
        "The Engine | Deep Tech Founders Expo",
        "",
        "https://engine.xyz/events/123",
      ),
    ).toBe("Deep Tech Founders Expo");
    expect(
      eventNameFrom(
        "Deep Tech Founders Expo | ExampleBoard",
        "",
        "https://exampleboard.io/events/123",
      ),
    ).toBe("Deep Tech Founders Expo");
  });

  // Without a URL, the brand checks have nothing to compare against and
  // simply don't run — the same segment that gets rejected once a host IS
  // available (previous test) is treated as informative instead. Isolated
  // to a single-segment title so the outcome actually depends on this,
  // rather than incidentally passing via the eventLike/longest-segment
  // tie-break the way a two-segment title would.
  it("does not attempt the site-brand check when no URL is available", () => {
    expect(eventNameFrom("The Engine", "")).toBe("The Engine");
  });

  // Gap 3, both halves together: a plain-hyphen-joined title now splits
  // (previously stayed one unsplit segment, matching real event 3's own
  // title shape), AND the headline segment this exposes ("Registration
  // deadline extended") is itself recognised as narration, not a name, even
  // with no auxiliary verb for NARRATIVE_VERB_RE to catch. Confirmed by
  // hand this test would fail without the headline check: "registration" is
  // itself an EVENT_SIGNAL_RE keyword, so without HEADLINE_PASSIVE_RE the
  // longer headline segment (31 chars) would out-rank the real name (26
  // chars) under the existing longest-segment tie-break.
  it("splits on a plain hyphen and rejects the elliptical-passive headline it exposes", () => {
    expect(
      eventNameFrom(
        "Registration deadline extended - Example Energy Conference",
        "",
      ),
    ).toBe("Example Energy Conference");
  });

  it("splits a hyphen-joined title the same way it already splits a pipe-joined equivalent", () => {
    const viaHyphen = eventNameFrom(
      "Riverside Materials Symposium - Example Host",
      "",
    );
    const viaPipe = eventNameFrom(
      "Riverside Materials Symposium | Example Host",
      "",
    );
    expect(viaHyphen).toBe("Riverside Materials Symposium");
    expect(viaHyphen).toBe(viaPipe);
  });

  // B8-06 (round 8): confirms what renders AFTER the shape-1 guard fires,
  // not only that looksLikeEventTitle itself returns false in isolation
  // (already covered above). This is the standard B's own log named
  // explicitly: a rejected segment must yield a real name from the same
  // fallback chain, not just disappear.
  it("falls through to a real event name when the narrative-sentence segment is rejected", () => {
    expect(
      eventNameFrom(
        "Ruggiero Group Attends the 2026 Crystal Engineering GRC | Crystal Engineering Symposium",
        "",
      ),
    ).toBe("Crystal Engineering Symposium");
  });

  // B8-06 (round 8), shape 2: two generic words concatenated with no
  // connector at all ("Conference Program") — round 6 first named this
  // shape, reconfirmed live again this round on the same URL.
  describe("bare concatenated generic words (B8-06)", () => {
    it("rejects a bare two-word generic phrase with no connector, keeping the real event name", () => {
      // A's own reconfirmed live example, verbatim.
      expect(
        eventNameFrom("Conference Program | Riverside Materials Symposium", ""),
      ).toBe("Riverside Materials Symposium");
    });

    it("does not treat a real two-word segment as chrome merely because one word is generic", () => {
      // Hardest inverse case: "Workshop" alone is in the same generic-word
      // list that must catch "Conference Program" above, but a real,
      // specific segment pairing it with a substantive word must survive —
      // the "every word must be generic" requirement is what protects this,
      // not the word list being short.
      expect(bestEventTitleSegment("Battery Workshop")).toBe("Battery Workshop");
    });
  });

  // B8-06 (round 8), shape 3: a served document's own filename with its
  // extension ("AA ECC10 POSTERS 08072026.xlsx") reaching the title-segment
  // path directly — new this round, traced to bestEventTitleSegment, not
  // the URL-slug fallback (nameFromUrlSlug already strips an extension
  // before it can return one).
  describe("raw filename with extension (B8-06)", () => {
    it("rejects a raw filename-with-extension segment, keeping the real event name", () => {
      // A's own reconfirmed live example, verbatim.
      expect(
        eventNameFrom("AA ECC10 POSTERS 08072026.xlsx | Advanced Composites Conference", ""),
      ).toBe("Advanced Composites Conference");
    });

    it("does not reject a real segment merely because it ends with a period-abbreviated word", () => {
      // Hardest inverse case: the extension check is anchored to a short,
      // closed document-extension list, not "ends with a period" — a real
      // segment ending in an unrelated period-abbreviation must survive.
      expect(
        bestEventTitleSegment("International Workshop on Molten Salt Chemistry, Inc."),
      ).toBe("International Workshop on Molten Salt Chemistry, Inc.");
    });
  });

  // B9-04 Fix 2 (round 9): unit-level coverage for the new skipHostBrand
  // option itself, independent of enrich.ts's own integration tests (which
  // cover the actual call site being changed). isChromeSegment bundles four
  // checks; skipHostBrand must bypass only the host-brand one.
  describe("skipHostBrand option (B9-04 Fix 2)", () => {
    it("rescues a segment rejected only for matching its own host's brand", () => {
      // Without the option: rejected, same as before this fix — an
      // organisation's own domain restating its own name still looks like
      // site chrome by default.
      expect(
        bestEventTitleSegment("SolarPACES", "https://solarpaces.example.org/conference"),
      ).toBeUndefined();
      // With it: rescued. This is the one thing skipHostBrand exists to do.
      expect(
        bestEventTitleSegment("SolarPACES", "https://solarpaces.example.org/conference", {
          skipHostBrand: true,
        }),
      ).toBe("SolarPACES");
    });

    it("still rejects a generic page title even with skipHostBrand set", () => {
      // "Conference Program" (B8-06/B9-01's live-confirmed repro) is chrome
      // for a reason that has nothing to do with the host — skipHostBrand
      // must not accidentally widen into "skip every check."
      expect(
        bestEventTitleSegment("Conference Program", "https://example.com/event", {
          skipHostBrand: true,
        }),
      ).toBeUndefined();
    });

    it("still rejects a raw document filename even with skipHostBrand set", () => {
      // The other B8-06/B9-01 shape, same reasoning: rejected for being a
      // filename, not for matching a host brand.
      expect(
        bestEventTitleSegment("AA ECC10 POSTERS 08072026.xlsx", "https://example.com/event", {
          skipHostBrand: true,
        }),
      ).toBeUndefined();
    });
  });

  // B9-04's bare-date guard (round 9): internationalbatteryseminar.com's
  // own live-confirmed repro — a segment that is only a date cleared every
  // existing check and rendered as the event's name.
  describe("bare date segment (B9-04)", () => {
    // Multi-word, punctuated hardest case per Ruling 31: the live repro
    // itself, with a day range and a comma, paired with a real name it must
    // lose to.
    it("rejects a segment that is only a date, falling through to a real name", () => {
      expect(
        eventNameFrom("March 15-18, 2027 | International Battery Seminar", ""),
      ).toBe("International Battery Seminar");
    });

    // The "should match nothing" hardest case, and the one this guard is
    // most likely to get wrong: "SolarPACES 2026" (an existing passing case
    // elsewhere in this file) legitimately CONTAINS a year but is not a
    // date-shaped segment as a whole — the guard must require the segment
    // be date-and-nothing-else, not merely date-containing.
    it("does not reject a real event name merely because it contains a year", () => {
      expect(bestEventTitleSegment("SolarPACES 2026")).toBe("SolarPACES 2026");
    });

    // The literal live shape: the WHOLE title is nothing but a date, no
    // second segment to fall back to within bestEventTitleSegment itself —
    // eventNameFrom must continue past it to the snippet, same fallback
    // chain every other chrome shape in this file already uses.
    it("continues past a bare date-only title with no other segment to the snippet", () => {
      expect(
        eventNameFrom(
          "March 15-18, 2027",
          "The International Battery Seminar brings together researchers.",
        ),
      ).toBe("The International Battery Seminar brings together researchers.");
    });
  });

  // Must not over-trigger: a real name that merely mentions one of the
  // headline-subject words as its own topic, with no announcement-shaped
  // participle nearby, is not narration and must survive.
  it("does not reject a real title that merely mentions a headline-subject word as its topic", () => {
    expect(looksLikeEventTitle("International Symposium on Registration Systems and Data Standards")).toBe(
      true,
    );
  });

  // B8-06 (round 8), shape 1: a present-tense, active-voice sentence NAMING
  // an event has no "to be" auxiliary (NARRATIVE_VERB_RE) and matches none
  // of HEADLINE_PASSIVE_RE's closed noun list — a third grammatical shape,
  // still open two rounds after round 6 first named it, reconfirmed live
  // again this round.
  describe("present-tense narrative sentence (B8-06)", () => {
    it("rejects a subject-verb narrative sentence with no auxiliary verb", () => {
      // A's own reconfirmed live example, verbatim.
      expect(
        looksLikeEventTitle("Ruggiero Group Attends the 2026 Crystal Engineering GRC"),
      ).toBe(false);
    });

    it("does not reject a real event name sharing the same subject phrase but no verb", () => {
      // Hardest inverse case for this shape: the identical two-word subject
      // ("Ruggiero Group") that must be rejected above, immediately
      // followed by ordinary event-name words instead of a verb — proves
      // the check targets the VERB specifically, not "starts with a
      // capitalized organisation name."
      expect(
        looksLikeEventTitle("Ruggiero Group Battery Innovation Summit 2026"),
      ).toBe(true);
    });
  });
});

describe("webResultToRawEventItem", () => {
  it("keeps a punctuated search snippet scoreable but untagged for reports", () => {
    const item = webResultToRawEventItem(
      { title: "Battery Summit 2026", url: "https://example.com/battery", snippet: "Battery research sessions are included." },
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(item?.description).toBe("Battery research sessions are included.");
    expect(item?.reportSummary).toBeUndefined();
  });

  it("uses the guarded name for a real-shaped result", () => {
    const item = webResultToRawEventItem(
      {
        title: "Advanced Battery Materials Workshop 2026",
        url: "https://example.com/events/advanced-battery-materials-workshop",
        snippet: "Join researchers for the annual workshop on battery materials.",
      },
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(item?.name).toBe("Advanced Battery Materials Workshop 2026");
  });

  it("does not let a narrative-sentence title through as the event name", () => {
    // No year mentioned here — webResultToRawEventItem separately drops a
    // result when every year it mentions is already in the past, which is
    // not what this case is testing.
    const item = webResultToRawEventItem(
      {
        title: "Rivertown Summit was originally scheduled early but was delayed significantly.",
        url: "https://example.com/events/rivertown-summit",
        snippet: "Rivertown Summit convenes battery researchers every spring in Ohio.",
      },
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(item?.name).not.toMatch(/\bwas\b/i);
    expect(item?.name).toBe("Rivertown Summit convenes battery researchers every spring in Ohio.");
  });
});
