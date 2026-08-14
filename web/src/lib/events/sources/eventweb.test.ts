import { describe, expect, it } from "vitest";
import {
  bestEventTitleSegment,
  eventNameFrom,
  isEarningsCallPage,
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
    // B12-01 (round 12, §1aa Ruling 40): restated, not deleted. The snippet
    // stage used to return the whole sentence; it now returns the name inside
    // it. Strictly better in the same direction — a sentence is never a name.
    expect(eventNameFrom(title, snippet)).toBe("Rivertown Summit");
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
      // B12-01 (round 12, §1aa Ruling 40): restated. The determiner stays on —
      // Ruling 39a point 4 is binding and this design strips none.
    ).toBe("The International Battery Summit");
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
        // B12-01 (round 12, §1aa Ruling 40): restated to the name inside the
        // sentence. What this test guards — that execution continues PAST the
        // bare date to the snippet — is unchanged.
      ).toBe("The International Battery Seminar");
    });
  });

  // B10-02 (round 10): internationalbatteryseminar.com's own live-confirmed
  // repro — once B9-04's bare-date guard rejects the sibling date segment,
  // a bare "City, ST" location segment fills the slot instead, because
  // nothing in this file had any concept of "this is only a location."
  describe("bare location segment (B10-02)", () => {
    // The live repro itself: a bare location segment must lose to a real
    // name sitting in the same title.
    it("rejects a segment that is only a city/state location, falling through to a real name", () => {
      expect(
        eventNameFrom("March 15-18, 2027 | Orlando, FL | International Battery Seminar", ""),
      ).toBe("International Battery Seminar");
    });

    // The literal live shape: no other segment to fall back to within
    // bestEventTitleSegment itself.
    it("rejects a bare location-only title with no other segment, continuing to the snippet", () => {
      expect(
        eventNameFrom(
          "Orlando, FL",
          "The International Battery Seminar brings together researchers.",
        ),
        // B12-01 (round 12, §1aa Ruling 40): restated to the name inside the
        // sentence. What this test guards — that a location-only title falls
        // through to the snippet — is unchanged.
      ).toBe("The International Battery Seminar");
    });

    // The "should match nothing" hardest case, and the reason this check is
    // anchored to the WHOLE segment rather than copying the job side's
    // unanchored trailing check verbatim: a real, longer event name that
    // merely ENDS in a city/state must survive. A's own live, already-
    // correct 10times.com example, named explicitly per B10-02's own
    // instruction rather than a synthetic case.
    it("does not reject a real event name merely because it ends in a city/state", () => {
      expect(
        bestEventTitleSegment("Solid-State Battery Summit (Aug 2026), Chicago USA"),
      ).toBe("Solid-State Battery Summit (Aug 2026), Chicago USA");
    });
  });

  // B10-03 (round 10): ecs.confex.com's live repro — a real conference-
  // platform page/section label ("Call for Papers") stands in for the
  // event's own name. Ironic mechanism named in B10-03: EVENT_SIGNAL_RE
  // treats the identical phrase as a POSITIVE event signal, which is part
  // of why the page is recognised as an event page at all.
  describe("Call for Papers page label (B10-03)", () => {
    it("rejects a bare 'Call for Papers' segment, falling through to a real name", () => {
      expect(eventNameFrom("Call for Papers | 250th ECS Meeting", "")).toBe("250th ECS Meeting");
    });

    it("rejects a bare 'Call for Papers' title with no other segment, continuing to the snippet", () => {
      expect(
        eventNameFrom("Call for Papers", "The 250th ECS Meeting welcomes abstract submissions."),
        // B12-01 (round 12, §1aa Ruling 40): restated. B11-02 wrote this test
        // and its asserted "correct" answer was itself a wrong event name —
        // the real name is "The 250th ECS Meeting", not a sentence about it.
        // This is the assertion that made the class visible.
      ).toBe("The 250th ECS Meeting");
    });

    // Must-survive: a longer, real sentence that legitimately CONTAINS the
    // phrase must not be caught as chrome — the generic-title check requires
    // either an exact phrase match or every word in the segment to be
    // generic, and a longer real sentence has words outside that closed
    // list, so it must reach bestEventTitleSegment's output untouched.
    it("does not reject a real sentence that merely contains the phrase", () => {
      expect(
        bestEventTitleSegment("Call for Papers now open for the 2026 Battery Symposium"),
      ).toBe("Call for Papers now open for the 2026 Battery Symposium");
    });
  });

  // B12-03 gap A (round 12): the WELDED page-type label. A's item 4 looked like
  // three hosts with one defect; B established by execution that it is two
  // different defects, and this describe covers the first.
  //
  // The mechanism, and it is the whole item: every guard in this file only ever
  // sees a segment the SPLITTER already produced, and the splitter needs a
  // separator with whitespace around it. `battery-power.eu` writes
  // "Call for papers - Battery Conference 2027", which splits, so B10-03's
  // generic-title check catches the label half and the real name survives.
  // The two hosts below weld the label on with no separator at all, so the
  // whole title is ONE segment which is neither generic (not every word is a
  // generic word) nor narration — it passes every guard and reaches the reader
  // with the label still attached.
  describe("welded page-type label (B12-03 gap A)", () => {
    // battery2030.eu's live repro, verbatim. Front form.
    it("strips a leading label welded on with 'for the'", () => {
      expect(
        bestEventTitleSegment("Call for Abstracts for the Battery 2030+ Annual Conference 2026"),
      ).toBe("Battery 2030+ Annual Conference 2026");
    });

    // isea.rwth-aachen.de's live repro, verbatim. Back form, no punctuation.
    it("strips a trailing label welded on with no separator", () => {
      expect(
        bestEventTitleSegment("Advanced Battery Power Conference 2026 Call for Papers"),
      ).toBe("Advanced Battery Power Conference 2026");
    });

    it("strips a trailing label attached by a colon", () => {
      expect(
        bestEventTitleSegment("Advanced Battery Power Conference 2026: Call for Papers"),
      ).toBe("Advanced Battery Power Conference 2026");
    });

    // The same shape with a SPACED hyphen resolves through the splitter and
    // B10-03's generic-title check instead, never reaching the strip. Asserted
    // because the two routes must agree on the answer — if a future round
    // changes one, this says the other exists.
    it("reaches the same answer through the splitter when the separator is spaced", () => {
      expect(
        bestEventTitleSegment("Advanced Battery Power Conference 2026 - Call for Papers"),
      ).toBe("Advanced Battery Power Conference 2026");
    });

    // THE must-survive case, and the one B12-03's design was shaped around.
    // B found this by running the design against the existing suite: without
    // requiring `for (the)` IMMEDIATELY after the label, the front form eats
    // this into "now open for the 2026 Battery Symposium" and breaks B10-03's
    // assertion four lines above. This is a second copy of that assertion,
    // stated here as a must-survive so the reason it matters is local to the
    // fix that endangers it.
    it("does not strip a label that continues into a real sentence", () => {
      expect(
        bestEventTitleSegment("Call for Papers now open for the 2026 Battery Symposium"),
      ).toBe("Call for Papers now open for the 2026 Battery Symposium");
    });

    // The remainder must still NAME an event. A real call for papers for a
    // PRIZE is not an event, so stripping would leave a non-name behind.
    it("does not strip when the remainder names no kind of event", () => {
      expect(bestEventTitleSegment("Call for Papers for the 2026 Ruggiero Prize")).toBe(
        "Call for Papers for the 2026 Ruggiero Prize",
      );
    });

    // Real names that merely resemble the shape, none of which must move.
    it.each([
      "26th Advanced Automotive Battery Conference (AABC)",
      "Battery Conference 2027",
      "SolarPACES 2026",
    ])("does not touch a real event name: %s", (title) => {
      expect(bestEventTitleSegment(title)).toBe(title);
    });

    // A bare label is NOT this fix's business — isGenericPageTitle already owns
    // it and rejects the segment outright, which is a different and better
    // outcome than stripping it to nothing.
    it("leaves a bare label to the generic-title check, which rejects it", () => {
      expect(bestEventTitleSegment("Call for Papers")).toBeUndefined();
    });

    // Recorded by B as correct-not-a-miss, and asserted so a future round does
    // not read it as over-reach that slipped through untested: this is the same
    // trade the job side already accepts when B9-02a strips "Careers" off
    // "Idaho National Laboratory Careers". The remainder still names the event.
    it("strips a trailing 'Programme' label, the same trade the job side accepts", () => {
      expect(bestEventTitleSegment("Riverside Materials Symposium Programme")).toBe(
        "Riverside Materials Symposium",
      );
    });
  });

  // B12-04 (round 12): an event named after its own domain. The host-brand
  // check normalises "International Battery Seminar" to
  // "internationalbatteryseminar" and asks whether any DNS label starts with
  // it — the label IS that string, so the guard fires and the correct name,
  // which is sitting right there in the page's own title, is thrown away. The
  // title stage then returns nothing, the root URL has no deep slug to mine,
  // and the render falls all the way through to the snippet.
  //
  // Mirror image of B12-02: that host defeats the brand check by having a
  // domain that looks NOTHING like its name; this one by having a domain that
  // IS its name. Same check, opposite failure, and neither is fixable by
  // widening the check.
  describe("event named after its own domain (B12-04)", () => {
    // THE live repro. Note the existing B10-02 assertion higher up uses this
    // same title with NO url — which is why it passed all along and never
    // exercised the defect. The URL is the entire difference.
    it("keeps a name that matches its own host when the name is an event kind", () => {
      expect(
        eventNameFrom(
          "March 15-18, 2027 | Orlando, FL | International Battery Seminar",
          "",
          "https://www.internationalbatteryseminar.com/",
        ),
      ).toBe("International Battery Seminar");
    });

    // The same segment on its own, so the outcome cannot come from the
    // sibling tie-break.
    it("keeps a lone host-matching segment that names an event kind", () => {
      expect(
        bestEventTitleSegment(
          "International Battery Seminar",
          "https://www.internationalbatteryseminar.com/",
        ),
      ).toBe("International Battery Seminar");
    });

    // MUST STAY REJECTED. Every one of these is a real site brand that matches
    // its host and names no kind of event, so the exemption cannot reach it.
    // These are B5-06's and B5-03's own repros — the fixes this exemption
    // could plausibly have undone.
    it.each([
      ["The Engine", "https://engine.xyz/events/123"],
      ["Climatebase", "https://climatebase.org/events/123"],
      ["10times", "https://10times.com/events/123"],
    ])("still rejects the site's own brand: %s", (segment, url) => {
      expect(bestEventTitleSegment(segment, url)).toBeUndefined();
    });

    // The exemption defers to isEventIndexPage by construction — that check
    // returns true before the host-brand branch is ever reached — so an events
    // DIRECTORY whose brand contains an event noun is still rejected. This is
    // the residual risk B named, asserted rather than left as prose.
    it("still rejects an events directory whose own brand names an event kind", () => {
      expect(
        bestEventTitleSegment("Upcoming Battery Conferences", "https://batteryconferences.com/"),
      ).toBeUndefined();
    });

    // §1z Ruling 39's recorded lead, acted on because its own condition fired:
    // "if the guard family is touched again, a year-less variant test is the
    // cheap way to make that fragility visible before it bites."
    //
    // The SolarPACES regression lock survives the host-brand check ONLY because
    // its title carries a trailing year, which makes the candidate longer than
    // the DNS label and trips looksLikeHostBrand's one-directional rule. These
    // two assertions state that plainly: with the year it survives, without the
    // year it does not — and B12-04 does NOT change that, because "SolarPACES"
    // names no event kind so the exemption cannot reach it either. Recorded as
    // the CURRENT behaviour, not as a behaviour anyone should want.
    it("shows the SolarPACES lock still depends on its trailing year", () => {
      expect(bestEventTitleSegment("SolarPACES 2026", "https://www.solarpaces.org/")).toBe(
        "SolarPACES 2026",
      );
      expect(bestEventTitleSegment("SolarPACES", "https://www.solarpaces.org/")).toBeUndefined();
    });
  });

  // B12-05 (round 12): the URL-slug stage was LAUNDERING a document filename
  // past the guard written to reject it. DOCUMENT_FILENAME_RE (B8-06) stops a
  // served document's filename becoming an event name, and it works at the
  // title stage — but the slug stage's first act was to strip the extension,
  // so the guard could never see one. Round 9's B named it exactly: "a
  // filename, just without the dot and three letters." Unchanged since, and
  // euchems2026.eu rotates the document, so the mechanism mints a fresh wrong
  // name every time it is measured.
  describe("document filename laundered through the URL slug (B12-05)", () => {
    // The live repro. Round 9 and round 12 saw different documents from the
    // same host, which is the point.
    it("does not turn a served document's filename into an event name", () => {
      expect(
        eventNameFrom(
          "ECC102026-POSTERS-v2.pdf",
          "",
          "https://www.euchems2026.eu/files/ECC102026-POSTERS-v2.pdf",
        ),
      ).toBe("euchems2026.eu");
    });

    // The title stage already rejected it; this asserts the two stages now
    // agree instead of the second undoing the first.
    it("keeps the title stage and the slug stage agreeing on a filename", () => {
      expect(
        bestEventTitleSegment(
          "ECC102026-POSTERS-v2.pdf",
          "https://www.euchems2026.eu/files/ECC102026-POSTERS-v2.pdf",
        ),
      ).toBeUndefined();
    });

    // Media extensions come from EMBEDDED_FILENAME_RE, the other existing list.
    it("does not turn an image filename into an event name", () => {
      expect(
        eventNameFrom("Home | Events", "", "https://example.org/media/battery-symposium-photo.jpg"),
      ).toBe("example.org");
    });

    // MUST-SURVIVE, and B named it as the assertion to protect: a slug with NO
    // extension is untouched. This is the same case as the existing
    // "falls through to the URL slug" test higher up, restated here so the
    // protection is local to the fix that could break it.
    it("still reads a real event name from an extensionless slug", () => {
      expect(
        eventNameFrom(
          "Rivertown Summit was originally planned for 2020 but was delayed.",
          "",
          "https://example.com/events/rivertown-materials-summit-2026",
        ),
      ).toBe("Rivertown materials summit 2026");
    });

    // MUST-SURVIVE, and the reason the generic `\.\w{2,5}$` strip below the new
    // check is deliberately left in place: a PAGE extension is not a document,
    // and rejecting those would throw away real names on every classic-CMS
    // site. Only the closed document/media lists reject.
    it.each(["html", "php", "aspx"])(
      "still reads a real event name from a slug ending .%s",
      (ext) => {
        expect(
          eventNameFrom(
            "Home | Events",
            "",
            `https://example.com/events/rivertown-materials-summit-2026.${ext}`,
          ),
        ).toBe("Rivertown materials summit 2026");
      },
    );
  });

  // B11-02 (round 11, Rulings 32/35): the sequel to B10-03 above, same host.
  // Once "Call for Papers" is correctly rejected as a title segment,
  // execution reaches the snippet-mining stage — which filtered candidates
  // with `looksLikeEvent` alone, a topicality check that happily passes a
  // full narrative sentence containing one topic keyword. ecs.confex.com
  // rendered "Invited speakers present keynote lectures." live as a result.
  describe("snippet stage shape guard (B11-02)", () => {
    // THE hardest real shape, and the case B11-01 identified as the actual
    // live mechanism: two candidates in one snippet, both passing
    // `looksLikeEvent` ("Meeting" and "keynote" are both on its list), where
    // the WRONG one wins the longest-fragment tie-break by two characters
    // (42 vs 40). Both fragments are real and confirmed present on the live
    // page by round 11 A part 2. No test in either file exercising this
    // stage had more than one viable candidate before this one, which is
    // why nothing caught the regression: with `looksLikeEvent` as the only
    // filter this returns the narrative sentence, not the name.
    it("prefers the real name over a longer narrative sentence in the same snippet", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "250th ECS Meeting (October 25-29, 2026). Invited speakers present keynote lectures.",
        ),
        // B12-01 (round 12, §1aa Ruling 40): restated, and this is the NINTH
        // such assertion — B12-01's design counted eight, because it enumerated
        // the ones asserting a SENTENCE. This one asserted a name with a
        // parenthetical date and a full stop welded on, which is the same
        // defect wearing different clothes. The span stops at "(October"
        // because an opening bracket is not a name token.
      ).toBe("250th ECS Meeting");
    });

    // The narrative sentence on its own, with nothing better beside it. The
    // guard is only a fix if what replaces the rejected value is defensible
    // (Ruling 26): here every candidate is rejected, so execution falls
    // through to the honest URL-host last resort (B9-04 Fix 1) rather than
    // reinstating the string the guard just rejected.
    it("falls through to the honest host when the only candidate is a narrative sentence", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "Invited speakers present keynote lectures.",
          "https://www.ecs.confex.com/ecs/250/cfp.cgi",
        ),
      ).toBe("ecs.confex.com");
    });

    // B11-01's enumeration shape 4, closed as a side effect of filtering
    // BEFORE the `looksLikeEvent` preference tier rather than after it: when
    // no fragment is event-like at all, the old ternary discarded the
    // filter's verdict wholesale and returned the longest raw fragment. The
    // snippet here has no topic keyword and its longest fragment is a
    // narrative sentence, so the old code returned that sentence.
    it("does not reinstate an unfiltered fragment when nothing is event-like", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "The venue was refurbished last year and now seats twelve hundred people.",
          "https://example.org/cfp",
        ),
      ).toBe("example.org");
    });
  });

  // B12-01 (round 12, §1aa Ruling 40): the sequel to B11-02 above, same host,
  // same stage. B11-02's guard was not bypassed — it ran and correctly said
  // "not narration", because the stage's own CONTRACT was to return a whole
  // sentence and this file asserted that nine times. So this item changes what
  // the stage RETURNS: the leading NAME SPAN inside the fragment, or nothing.
  // Those nine assertions are restated above, each commented `B12-01`.
  //
  // Ruling 40 resolved the item's one open question: the event-kind test is
  // PHRASE-level over the joined span, not word-level, because both codebase
  // enumerations the design draws on carry multi-word kinds. The first attempt
  // was stopped for exactly that — see the must-recover cases at the end.
  describe("leading name span (B12-01)", () => {
    // THE live defect this item exists for, verbatim from round 12 A's log.
    // Every narrative check in `looksLikeEventTitle` passes it: it is a copular
    // predication ("are due" — an adjective, not a participle), so no verb
    // inventory can see it. The span rule stops at "Abstracts", one word.
    it("drops the live deadline sentence and falls through to the honest host", () => {
      const rendered = eventNameFrom(
        "Call for Papers",
        "Abstracts are due no later than Friday, 4 September 2026 at 11:59 PM Eastern Standard Time.",
        "https://www.ecs.confex.com/ecs/250/cfp.cgi",
      );
      expect(rendered).toBe("ecs.confex.com");
      // Why step 1 is anchored to the START, verified rather than assumed: an
      // unanchored "longest Title-Case run anywhere" finds this inside the very
      // sentence the item exists to reject.
      expect(rendered).not.toBe("Friday, 4 September 2026");
    });

    // The SHARPENED must-reject. Its first version ended "...no late work will
    // be accepted", which `NARRATIVE_VERB_RE` catches — so it passed pre-fix
    // for the wrong reason and proved nothing about the span rule. Rewritten to
    // clear all four narrative checks, so only the span rule can stop it.
    it("drops a deadline sentence that clears every narrative check", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "The deadline falls on Friday and nothing later than that counts.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    it("drops a sentence whose leading span is a page label and its joiners", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "Registration for the conference opens in May.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    it("drops a submission-instruction sentence", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "Papers must reach the committee by 30 June.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    it("drops a venue-change sentence", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "This year the meeting moves to Lisbon.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    it("drops a logistics sentence", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "Delegates receive a printed programme on arrival.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    // ruggedthz.com's failure mode 2, the mid-sentence prose fragment a
    // provider snippet can start on. Nothing capitalised leads it, so the span
    // is empty before the walk takes a single step.
    it("drops a fragment that starts mid-sentence in lower case", () => {
      expect(
        eventNameFrom(
          "Home | Events",
          "sessions, even if breakfast occasionally became more of a debate than a meal.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    // The two-word floor. A lone event-kind noun is a topic, not a name — this
    // is the check that stops the rule claiming "Workshop" as an event's name.
    it("drops a span of a single event-kind word", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "Workshop registration closes at noon on the final day.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    // Trailing joiners are dropped BEFORE the two-word floor is applied, so
    // "Symposium on the" counts as one word and not three.
    it("drops trailing joiners before applying the two-word floor", () => {
      expect(
        eventNameFrom(
          "Call for Papers",
          "Symposium on the future of grid storage begins in June.",
          "https://example.com/cfp",
        ),
      ).toBe("example.com");
    });

    // THE DOCUMENTED HONEST MISS, asserted rather than hidden. Every token is
    // Title-Case and "Conference" is an event kind, so this survives the span
    // rule unchanged — it passes both pre- and post-fix, which is the whole
    // point of writing it down. internationalbatteryseminar.com's carousel
    // label has its own cause and its own fix (B12-04); B12-01 neither fixes it
    // nor makes it worse, and this test is what will fail loudly if a future
    // round ever believes otherwise.
    it("does NOT fix a Title-Case widget label — the honest miss, stated in the suite", () => {
      expect(eventNameFrom("Home", "Conference Image Gallery Carousel")).toBe(
        "Conference Image Gallery Carousel",
      );
    });

    // MUST-RECOVER, and this is the regression that stopped B12-01's first
    // attempt. The design's noun list was single-word (`roundtable`), the real
    // name says `Round Table`, and the kind test is a hard veto — so a correct,
    // live-derived event name became "Untitled event", the one direction
    // Rulings 23/26 forbid. Ruling 40's phrase-level test is what recovers it.
    // The same fixture is asserted independently in events/scoring.test.ts.
    it("recovers a name whose event kind is two words (the Round Table regression)", () => {
      expect(
        eventNameFrom(
          "Meeting Summary",
          "2026 International Round Table on Titanium Production in Molten Salts. Registration is open.",
        ),
      ).toBe("2026 International Round Table on Titanium Production in Molten Salts.");
    });

    // MUST-RECOVER, second kind. `lecture series` appears in NO single-word
    // form anywhere in either enumeration, so this name is recoverable only
    // through the phrase list — it is the case that fails if that list is ever
    // quietly reduced back to single words.
    it("recovers a name whose event kind is only ever spelled as a phrase", () => {
      expect(
        eventNameFrom(
          "Meeting Summary",
          "Molten Salt Lecture Series on Reactor Chemistry begins in autumn.",
        ),
      ).toBe("Molten Salt Lecture Series on Reactor Chemistry");
    });
  });

  // B11-03 (round 11): scraped widget/markup chrome — the defect class
  // B11-01's enumeration named and neither existing guard had any concept
  // of. B11-01 confirmed by execution that BOTH live repros below pass
  // looksLikeEventTitle unchanged, so B11-02's guard alone cannot reach
  // them; these two checks are only reachable at all through the
  // isChromeSegment call B11-02 added to the snippet stage, which is why
  // that item had to land first.
  describe("scraped widget and markup chrome (B11-03)", () => {
    // internationalbatteryseminar.com's live repro. Everything the regex
    // actually keys on is verbatim from B11-01's own log — the image
    // extension, the cache-busting query string, the bracketed ellipsis and
    // the carousel widget's own label. Only the leading personal name of the
    // photographed speaker is substituted, since it is a real individual's
    // name, carries no part of the shape being tested, and this file already
    // has a precedent for paraphrasing the non-load-bearing part of a repro
    // (see the looksLikeEventTitle block at the top).
    it("rejects an embedded filename with a query string stitched into scraped text", () => {
      expect(
        bestEventTitleSegment(
          "Speaker Photo.jpeg?sfvrsn=2fdd4033_1) [...] Conference Image Gallery Carousel",
        ),
      ).toBeUndefined();
    });

    // The same value in the place it actually reached a reader: the snippet
    // stage, where it beat the real name on the longest-fragment tie-break.
    // This is the case that proves the two items compose — it fails with
    // B11-02 alone.
    it("keeps the real event name when scraped image chrome sits beside it in a snippet", () => {
      expect(
        eventNameFrom(
          "Home",
          "Speaker Photo.jpeg?sfvrsn=2fdd4033_1) [...] Conference Image Gallery Carousel. The International Battery Seminar brings researchers together.",
        ),
        // B12-01 (round 12, §1aa Ruling 40): restated to the name inside the
        // sentence. What this test guards — that the scraped image chrome loses
        // to the real name — is unchanged; B11-03's filter still rejects the
        // chrome fragment before B12-01's span rule ever sees it.
      ).toBe("The International Battery Seminar");
    });

    // thebatteryshowsouth.com's live repro, verbatim.
    it("rejects a raw Markdown heading marker and bracketed ellipsis", () => {
      expect(bestEventTitleSegment("[...] ## 2026 Keynote Speakers")).toBeUndefined();
    });

    it("keeps the real event name when scraped Markdown chrome sits beside it in a snippet", () => {
      expect(
        eventNameFrom(
          "Home",
          "[...] ## 2026 Keynote Speakers. The Battery Show South returns to Atlanta this year.",
        ),
        // B12-01 (round 12, §1aa Ruling 40): restated. The determiner stays on
        // — "The Battery Show South" is the event's actual name, and B12-01's
        // own mid-design correction is why no determiner strip exists here.
      ).toBe("The Battery Show South");
    });

    // THE must-survive case, and the reason the hash floor is {2,6} rather
    // than {1,6}. A single `#` followed by a space reads as ordinary title
    // punctuation, not markup, and this shape has exactly one live
    // confirmation behind it — so the narrower floor is doing deliberate
    // work. This test exists so a future round cannot quietly relax the
    // floor without a failing test telling it exactly what that costs.
    it("does not reject a real title containing a single hash as ordinary punctuation", () => {
      expect(
        bestEventTitleSegment("Session # 3: Advanced Battery Chemistry Track"),
      ).toBe("Session # 3: Advanced Battery Chemistry Track");
    });

    // The matching must-survive case for the filename check: it keys on a
    // literal period immediately before a closed extension list, not on the
    // format word appearing anywhere. A real workshop about a file format
    // must survive.
    it("does not reject a real title merely because it names a file format", () => {
      expect(
        bestEventTitleSegment("Workshop on PDF Accessibility Standards 2026"),
      ).toBe("Workshop on PDF Accessibility Standards 2026");
    });
  });

  // B12-02 (round 12): ruggedthz.com, the host §1w Ruling 36's pre-set third
  // strike authorised a fix for. The whole adversarial matrix B built is
  // reproduced here, including the case that killed B's own first version —
  // that one is the reason the design has a stand-down step at all, so it is
  // the single most load-bearing test in this block.
  describe("narrative-segment name recovery (B12-02)", () => {
    const RUGGED_URL =
      "https://ruggedthz.com/ruggiero-group-attends-the-2026-crystal-engineering-grc";

    // FAILURE MODE 1, the real host's real <title> (round 9 A fetched it
    // directly). Before this fix the reader was told the event is called
    // "Ruggiero Research Lab" — a correct organisation name that is not an
    // event, and the ONLY name in the title lives inside the segment the
    // narrative guard rejects.
    it("recovers the event name from the rejected narrative segment", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Attends the 2026 Crystal Engineering GRC – Ruggiero Research Lab",
          "",
          RUGGED_URL,
        ),
      ).toBe("2026 Crystal Engineering GRC");
    });

    // THE counterexample. B built this to break its own V1 and it did: with no
    // stand-down step the recovery replaces a real event name with a label
    // ("2026 Call Deadline"). Here the SIBLING is the slug-corroborated one,
    // so the recovery must not fire and selection runs untouched. If a future
    // round removes step 6, this is the test that says what that costs.
    it("stands down when a surviving sibling is the slug-corroborated one", () => {
      expect(
        eventNameFrom(
          "SolarPACES Announces the 2026 Call Deadline – SolarPACES 2026",
          "",
          "https://solarpaces.org/solarpaces-announces-the-2026-call-deadline",
        ),
      ).toBe("SolarPACES 2026");
    });

    // FAILURE MODE 2, the same page on a different pull: the provider returned
    // a chrome-only title, so the title stage yields nothing and the URL-slug
    // stage correctly rejects its own narrative sentence (B10-04's casing fix
    // working). Without the second attachment point the snippet stage supplies
    // a mid-sentence prose fragment — A's fifth pull rendered exactly that.
    // Lowercase after the first character is nameFromUrlSlug's own convention.
    it("recovers from the URL slug when the title is chrome and the snippet is prose", () => {
      expect(
        eventNameFrom(
          "Home | Events",
          "sessions, even if breakfast occasionally became more of an aspiration than a reality.",
          RUGGED_URL,
        ),
      ).toBe("2026 crystal engineering grc");
    });

    // Chrome-only sibling: nothing survives the title stage at all, so before
    // this fix execution fell all the way to the honest URL host. The recovery
    // is strictly better than a hostname here.
    it("recovers even when the only sibling segment is chrome", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Attends the 2026 Crystal Engineering GRC – Home",
          "",
          RUGGED_URL,
        ),
      ).toBe("2026 Crystal Engineering GRC");
    });

    // An organisation name that legitimately IS the host org still loses to
    // the event the sentence actually names — the reader wants the event.
    it("prefers the named event over the organisation doing the attending", () => {
      expect(
        eventNameFrom(
          "Gordon Research Conferences Presents the 2026 Crystal Engineering GRC – Gordon Research Conferences",
          "",
          RUGGED_URL,
        ),
      ).toBe("2026 Crystal Engineering GRC");
    });

    // MUST-SURVIVE: no URL at all means no slug, so step 5 can never pass and
    // the recovery is unreachable by construction. This is what protects the
    // existing B8-06 assertion above, which passes no URL.
    it("does not fire when eventNameFrom is called without a URL", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Attends the 2026 Crystal Engineering GRC – Ruggiero Research Lab",
          "",
        ),
      ).toBe("Ruggiero Research Lab");
    });

    // MUST-SURVIVE: the narrative segment names no event. Step 4's two closed
    // tests (a 4-digit year, or this file's existing event-noun vocabulary)
    // both fail, so nothing is recovered and the sibling stands.
    it("does not recover a narrative tail that names no event", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Presents Its Annual Review – Ruggiero Research Lab",
          "",
          "https://ruggedthz.com/ruggiero-group-presents-its-annual-review",
        ),
      ).toBe("Ruggiero Research Lab");
    });

    // MUST-SURVIVE: the tail is a pair of place names. Same step-4 veto.
    it("does not recover a narrative tail that is only places", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Visits Berlin And Munich – Ruggiero Research Lab",
          "",
          "https://ruggedthz.com/ruggiero-group-visits-berlin-and-munich",
        ),
      ).toBe("Ruggiero Research Lab");
    });

    // MUST-SURVIVE, and this one isolates STEP 5 specifically: the tail clears
    // step 4 (it carries an event noun) and the short sibling is not
    // corroborated either, so step 6 cannot be what saves it. Only the slug
    // corroboration blocks the recovery here. B's own version of this case was
    // additionally blocked by steps 4 and 6; sharpened so the test can only
    // pass for the intended reason.
    it("does not recover a tail the page's own URL does not corroborate", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Attends The Big Crystal Engineering Symposium In Boston – SSI24",
          "",
          "https://ruggedthz.com/blog/annual-roundup",
        ),
      ).toBe("SSI24");
    });

    // MUST-SURVIVE: a real conference sibling beside a narrative tail that
    // names nothing.
    it("keeps a real conference sibling beside an empty narrative tail", () => {
      expect(
        eventNameFrom(
          "Acme Corp Presents Summer Fun – Acme Battery Symposium 2026",
          "",
          "https://acme.example.org/acme-corp-presents-summer-fun",
        ),
      ).toBe("Acme Battery Symposium 2026");
    });

    // MUST-SURVIVE: no narrative segment anywhere means the recovery never
    // gets a candidate in the first place.
    it("leaves a title with no narrative segment completely alone", () => {
      expect(
        eventNameFrom(
          "Call for papers - Battery Conference 2027",
          "",
          "https://battery.example.org/call-for-papers-battery-conference-2027",
        ),
      ).toBe("Battery Conference 2027");
    });

    // DOCUMENTED-KNOWN RESIDUAL, recorded rather than hidden — B constructed
    // it deliberately and could not build a plausible real-world instance. A
    // fully slug-corroborated narrative tail that carries a year but names no
    // real event is recovered as if it were a name. Both the old value
    // ("Ruggiero Research Lab") and the new one are wrong, so this is not a
    // regression in reader terms, but it IS a new wrong string and this test
    // exists so the next round that touches the design sees it immediately
    // rather than rediscovering it.
    it("recovers a year-bearing tail that names no real event (known residual)", () => {
      expect(
        eventNameFrom(
          "Ruggiero Group Attends A Long Series Of 2026 Meetings – Ruggiero Research Lab",
          "",
          "https://ruggedthz.com/ruggiero-group-attends-a-long-series-of-2026-meetings",
        ),
      ).toBe("Long Series Of 2026 Meetings");
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

    // B10-04 (round 10): ruggedthz.com's live repro — the SAME sentence as
    // above, sentence-cased instead of Title-Cased, reached via
    // nameFromUrlSlug (which capitalises only the string's first
    // character). Before this fix, casing alone flipped this from
    // correctly-rejected to wrongly-accepted; the check must reject it
    // regardless of casing now.
    it("rejects the identical narrative sentence when it is sentence-cased, not Title-Cased", () => {
      expect(
        looksLikeEventTitle("Ruggiero group attends the 2026 crystal engineering grc"),
      ).toBe(false);
    });

    // Must-not-break: the existing, load-bearing precedent this fix could
    // most plausibly widen into rejecting — a legitimate sentence-cased
    // slug-derived phrase (scoring.test.ts's own case) that contains none
    // of the closed verbs. Re-asserted here, at the unit level, alongside
    // the casing fix that touches the same regex.
    it("does not reject a legitimate sentence-cased slug-derived phrase with no narrative verb", () => {
      expect(
        looksLikeEventTitle("Emea2026 workshop on ion exchange membranes for energy applications"),
      ).toBe(true);
    });

    // Must-survive: proves the fix widened WHICH CASING reaches the verb
    // check, not WHICH VERBS the check itself accepts — a sentence-cased
    // subject followed by a verb-shaped word outside the closed list
    // ("builds") must still be treated as a real name, not narration.
    it("does not reject a sentence-cased subject followed by a verb outside the closed list", () => {
      expect(looksLikeEventTitle("Ruggiero group builds a new lab")).toBe(true);
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
    // B12-01 (round 12, §1aa Ruling 40): restated to the name inside the
    // sentence. What this test guards — that the narrative TITLE never becomes
    // the event name — is unchanged and still asserted on the line above.
    expect(item?.name).toBe("Rivertown Summit");
  });
});

// B13-03 (round 13): the BANNER LEAD-IN. `flogen.org` rendered
// `WELCOME TO SIPS 2026` — a page's greeting banner standing where its event
// name belongs — for five rounds.
//
// The mechanism, established by B through execution: the page's own <title>
// (`SIPS 2026 by FLOGEN Stars Outreach`) passes every guard untouched, so no
// stage ever HAS it. The provider hands Peer the og:title/<h1> instead, and
// the enrichment path reads JSON-LD name and og:title and never parses a
// <title> element at all. Both routes end at bestEventTitleSegment, which is
// why this one attachment point covers both.
//
// EXPECTED RENDER AFTER THIS FIX: `SIPS 2026`. NOT
// `SIPS 2026 by FLOGEN Stars Outreach` — that string is the page <title> and
// it never reaches the pipeline, so no fix at this layer can produce it.
//
// This is a REPAIR, not a selection: every check is a veto and the fallback is
// the segment unchanged. When it does not fire the render is byte-identical to
// today's, and there is no path by which it can produce a bare hostname or a
// placeholder.
describe("banner lead-in strip (B13-03)", () => {
  it("repairs the live flogen.org value", () => {
    expect(
      bestEventTitleSegment("WELCOME TO SIPS 2026", "https://www.flogen.org/sips2026/"),
    ).toBe("SIPS 2026");
  });

  it.each([
    ["Welcome to SIPS 2026", "SIPS 2026"],
    ["Welcome to the SIPS 2026", "SIPS 2026"],
    ["WELCOME TO THE 2027 BATTERY CONFERENCE", "2027 BATTERY CONFERENCE"],
    ["Welcome to the International Battery Symposium", "International Battery Symposium"],
  ])("repairs the banner variant %s", (title, expected) => {
    expect(bestEventTitleSegment(title, "https://example.org/event")).toBe(expected);
  });

  // MUST-SURVIVE, AND THE REASON `to` IS MANDATORY IN THE PATTERN.
  // B's FIRST DRAFT MADE `to` OPTIONAL AND THESE THREE REAL EVENT NAMES WERE
  // MUTILATED — `Welcome Reception and Poster Session` became `Reception and
  // Poster Session`, `Welcome Week Careers Fair 2026` became `Week Careers
  // Fair 2026`, `Welcome Home Veterans Summit 2026` became `Home Veterans
  // Summit 2026`. `Welcome` is an ordinary first word of a real event name;
  // `Welcome to` never is. DO NOT SIMPLIFY `to` TO OPTIONAL.
  it.each([
    "Welcome Reception and Poster Session",
    "Welcome Week Careers Fair 2026",
    "Welcome Home Veterans Summit 2026",
    "Welcome Center Open House",
  ])("leaves the Welcome-initial real event name untouched: %s", (title) => {
    expect(bestEventTitleSegment(title, "https://example.org/event")).toBe(title);
  });

  // MUST-SURVIVE: banners whose remainder nothing corroborates. Veto 2 (a year
  // OR an event-kind signal, the same disjunction recoverFromNarrative uses)
  // stops the strip firing, so the outcome is byte-identical to today's.
  it.each(["Welcome to Our Site", "Welcome to FLOGEN"])(
    "leaves an uncorroborated banner untouched: %s",
    (title) => {
      expect(bestEventTitleSegment(title, "https://example.org/page")).toBe(title);
    },
  );

  // `Welcome to the Department of Chemistry` is B's third uncorroborated
  // banner, asserted separately because its shipped outcome is `undefined`,
  // not the input string — the WHOLE segment is rejected upstream by
  // bestEventTitleSegment's own guards, before this strip is ever reached.
  // VERIFIED IDENTICAL BEFORE AND AFTER B13-03 (checked by stashing the source
  // change and re-running), so this is the status quo, not a regression. What
  // matters for this item is the same thing B's matrix recorded: the strip
  // does not fire, and in particular it never manufactures a name here.
  it("does not manufacture a name from an uncorroborated department banner", () => {
    const result = bestEventTitleSegment(
      "Welcome to the Department of Chemistry",
      "https://example.org/page",
    );
    expect(result).not.toBe("Department of Chemistry");
    expect(result).toBeUndefined();
  });

  // MUST-SURVIVE: live-confirmed correct names from earlier rounds' fixes.
  // `32nd SolarPACES Conference` is the value the enrich.test.ts regression
  // lock asserts; `The Battery Show North America`'s leading article must
  // survive per Ruling 39a point 4.
  it.each([
    "2026 Crystal Engineering GRC",
    "32nd SolarPACES Conference",
    "International Battery Seminar",
    "The Battery Show North America",
    "Advanced Battery Power Conference 2026",
  ])("leaves the live-confirmed correct name untouched: %s", (title) => {
    expect(bestEventTitleSegment(title, "https://example.org/event")).toBe(title);
  });

  it("reaches the reader through eventNameFrom, not only the segment helper", () => {
    expect(
      eventNameFrom("WELCOME TO SIPS 2026", "", "https://www.flogen.org/sips2026/"),
    ).toBe("SIPS 2026");
  });

  // The two strips compose: B12-03's welded label comes off first, then this
  // one. Neither vocabulary can undo the other.
  it("composes with the welded page-type label strip", () => {
    expect(
      bestEventTitleSegment(
        "Welcome to the Battery Conference 2026 Call for Papers",
        "https://example.org/event",
      ),
    ).toBe("Battery Conference 2026");
  });
});

// B18-01 (round 18, Rulings 50b + 51a): A COMPANY'S EARNINGS CALL WAS IN THE
// EVENT POOL. `specterfi.com/companies/1539/concalls/Feb2026` — a stock
// research page for "Ion Exchange (India) Limited Q3 & 9M FY26 Earnings
// Conference Call" — was in the live event pool on 5 pulls out of 5 and
// rendered as the event card `1539 Feb2026 Concall Summary`, where `1539` is
// the site's internal company ID.
//
// It is admitted because `looksLikeEvent` sees the word "conference" inside
// "Conference Call". The name extraction is FAITHFUL — this is a page-KIND
// defect, not a naming defect, which is why the fix is a gate and not a
// rename, and why Ruling 33's matcher is deliberately not reopened.
//
// EVERY END-TO-END `toBeNull()` HERE IS PAIRED WITH A CONTROL. C measured that
// several of these rows are dropped by `looksLikeEvent` for reasons that have
// nothing to do with this rule, which would make a bare `toBeNull()` pass
// VACUOUSLY (round 14's two vacuous tests are the precedent). The control is
// the identical row with the finance vocabulary removed from BOTH the title and
// the URL path: it must be ADMITTED. If a control ever stops being admitted the
// paired assertion has gone vacuous and this test says so by going red.
describe("earnings-call page gate (B18-01)", () => {
  const NOW = Date.parse("2026-01-01T00:00:00Z");

  function expectDroppedByThisRule(row: {
    title: string;
    url: string;
    snippet: string;
    controlTitle: string;
    controlUrl: string;
  }) {
    // The rule fires on the real row.
    expect(isEarningsCallPage(row.title, row.url)).toBe(true);
    // The control — same row, vocabulary removed — is genuinely admitted, so
    // the drop below cannot be attributed to any other check.
    expect(isEarningsCallPage(row.controlTitle, row.controlUrl)).toBe(false);
    expect(
      webResultToRawEventItem(
        { title: row.controlTitle, url: row.controlUrl, snippet: row.snippet },
        NOW,
      ),
    ).not.toBeNull();
    // And the real row leaves the pool at ingestion.
    expect(
      webResultToRawEventItem({ title: row.title, url: row.url, snippet: row.snippet }, NOW),
    ).toBeNull();
  }

  // `Feb2026` yields no year token — `\b(20\d{2})\b` cannot match inside it —
  // which is what let these rows survive the past-event anchor check in the
  // first place and reach a reader.
  it("drops the rendered og:title form", () => {
    expectDroppedByThisRule({
      title: "1539 Feb2026 Concall Summary",
      url: "https://specterfi.com/companies/1539/concalls/Feb2026",
      snippet: "Registration and investor conference details for the quarter.",
      controlTitle: "1539 Feb2026 Research Summary",
      controlUrl: "https://specterfi.com/companies/1539/quarters/Feb2026",
    });
  });

  // B's load-bearing correction to A: the string the INGESTION gate reads is
  // the PROVIDER's title, and the provider does not hand Peer the og:title.
  // The og:title form above is what RENDERS. Both are covered on purpose.
  it("drops the provider title form, which is the string the gate actually reads", () => {
    expectDroppedByThisRule({
      title: "1539 Feb2026 Conference Call Summary | Specter",
      url: "https://specterfi.com/companies/1539/concalls/Feb2026",
      snippet: "Home Companies Screeners Watchlist Login",
      controlTitle: "1539 Feb2026 Research Conference Summary | Specter",
      controlUrl: "https://specterfi.com/companies/1539/quarters/Feb2026",
    });
  });

  it("drops the form carrying the company's full legal name", () => {
    expectDroppedByThisRule({
      title: "Ion Exchange (India) Ltd Feb2026 Conference Call Summary",
      url: "https://specterfi.com/companies/1539/concalls/Feb2026",
      snippet: "Home Companies Screeners Watchlist Login",
      controlTitle: "Ion Exchange (India) Ltd Feb2026 Research Conference Summary",
      controlUrl: "https://specterfi.com/companies/1539/quarters/Feb2026",
    });
  });

  // THE PATH CLAUSE'S OWN ASSERTION. This provider title is truncated before
  // its vocabulary, so no title rule can reach it — only the URL path can.
  // Revert the path clause and this is the test that goes red.
  it("drops a title truncated before its vocabulary, by the URL path alone", () => {
    expectDroppedByThisRule({
      title: "Associated Alcohols & Breweries Ltd Nov2025 ... - SpecterFi",
      url: "https://specterfi.com/companies/303/concalls/Nov2025",
      snippet: "Registration and investor conference details for the quarter.",
      controlTitle: "Associated Alcohols & Breweries Ltd Nov2025 ... - SpecterFi",
      controlUrl: "https://specterfi.com/companies/303/quarters/Nov2025",
    });
  });

  // THE OCCASION-ON-TITLE CLAUSE'S OWN ASSERTION, added for the same measured
  // reason as the artefact one below: every real row carries the vocabulary in
  // BOTH its title and its URL path, so disabling the title clause alone turned
  // nothing red. This row is occasion-only — "Earnings Conference Call" has no
  // trailing artefact noun after it, so the artefact regex cannot match — and
  // its path is clean. THE THREE CLAUSES NOW EACH HAVE A TEST THAT ONLY THEY
  // SATISFY, so no later round can collapse them without failing a red test.
  it("drops an earnings-occasion title whose URL path carries no vocabulary", () => {
    expectDroppedByThisRule({
      title: "Adani Enterprises Q4 FY26 Earnings Conference Call",
      url: "https://www.adanienterprises.com/investors/quarterly-update",
      snippet: "A conference archive page for investors and analysts.",
      controlTitle: "Adani Enterprises Q4 FY26 Research Conference",
      controlUrl: "https://www.adanienterprises.com/investors/quarterly-update",
    });
  });

  // THE ARTEFACT CLAUSE'S OWN ASSERTION, AND IT EXISTS BECAUSE C MEASURED THAT
  // NOTHING ELSE PROTECTED IT. B disclosed that on the measured corpus the
  // artefact clause is REDUNDANT — the occasion clause alone reaches the same
  // 5/5 and 3/5 — and C reproduced that: with the artefact clause disabled and
  // this test absent, ZERO assertions went red, so a future round could have
  // deleted a clause Ruling 51a deliberately kept and no test would have said
  // so. This is the clause's REACHABLE case: a sibling site whose TITLE says
  // "Conference Call Summary" while its URL path carries none of the
  // vocabulary. "Conference Call" is not "Concall", so the occasion regex does
  // not match this title, and the path has nothing in it — only the artefact
  // clause can see this row.
  it("drops a call-artefact title whose URL path carries no vocabulary", () => {
    expectDroppedByThisRule({
      title: "Northwind Chemicals Q2 FY27 Conference Call Summary",
      url: "https://example.com/research/northwind-q2-fy27",
      snippet: "A conference archive page for investors and analysts.",
      controlTitle: "Northwind Chemicals Q2 FY27 Conference Programme Summary",
      controlUrl: "https://example.com/research/northwind-q2-fy27",
    });
  });

  // NOT A `specterfi.com` RULE. The class spans five other hosts the shipped
  // gate also admits (`scribd.com`, `adanienterprises.com`, `piindustries.com`,
  // `balchem.com`, `roberthalf.com`), which is why no host list and no bare
  // `/concalls/` path rule was offered — that would close one row and leave the
  // class open (Ruling 40).
  it("drops the same shape on an unrelated host", () => {
    expectDroppedByThisRule({
      title: "Acme Corp Q3 FY26 Earnings Call Transcript",
      url: "https://example.com/ir/earnings-call-transcript-q3",
      snippet: "A conference transcript archive for investors.",
      controlTitle: "Acme Corp Q3 FY26 Research Summit Transcript",
      controlUrl: "https://example.com/ir/research-summit-transcript-q3",
    });
  });

  // MUST-KEEPS. Every row is asserted `not.toBeNull()` explicitly and carries
  // no past date, so none of them can pass for the wrong reason.
  it.each([
    [
      // THE LIVE ROW THAT KILLED THE NAIVE RULE. Bare `conference call` catches
      // 12 of 12 positives and deletes this real scholarly event, where
      // "Conference" and "Call for Papers" are adjacent by accident. C
      // reproduced it on the real file: adding bare `conference call` destroys
      // THREE real events in this corpus to buy 2 extra catches. DO NOT ADD IT
      // IN ANY POSITION.
      "2026 YCC Conference Call for Papers (and Student Awards)",
      "https://ascl.org/meetings/ycc2026",
      "Abstract submissions open for the 2026 meeting.",
    ],
    [
      // WHY `quarterly results` IS NOT IN THE VOCABULARY. It earned zero on
      // real data and was the single term that failed the adversarial set.
      "Quarterly Results Review Seminar Series — Physics Dept",
      "https://example.edu/physics/seminars/quarterly-review",
      "Weekly seminar series hosted by the department.",
    ],
    [
      // A real scholarly event whose title names the very same company. The
      // fix must key on the page KIND, never on the company name.
      "Ion Exchange (India) Limited Sponsored Student Workshop",
      "https://example.edu/workshops/ion-exchange-student",
      "A sponsored hands-on workshop for graduate students.",
    ],
    [
      "Webcast: Live Conference Call with the Keynote Speakers",
      "https://example.org/summit/keynote-webcast",
      "Join the keynote session from anywhere.",
    ],
    [
      // `analysts meet` and `investor day` were both measured alone, earned
      // nothing on real data, and were cut.
      "Analyst Meeting on Molten Salt Corrosion Data",
      "https://example.org/meetings/molten-salt-analysis",
      "A technical meeting on corrosion measurements.",
    ],
    [
      "Investor Day for University Spin-out Founders Conference",
      "https://example.edu/entrepreneurship/investor-day",
      "A day of talks for founders and researchers.",
    ],
    [
      "Conference Calls for Abstracts Now Open — Materials Week",
      "https://example.org/materials-week/abstracts",
      "Abstract submission is open for Materials Week.",
    ],
  ])("keeps the real event %s", (title, url, snippet) => {
    expect(isEarningsCallPage(title, url)).toBe(false);
    expect(webResultToRawEventItem({ title, url, snippet }, NOW)).not.toBeNull();
  });

  // THE SNIPPET IS DELIBERATELY NOT AN INPUT. C measured the forbidden variant
  // on the real predicate: applied to `title + snippet` it false-fires on three
  // real admitted rows, on the three hosts B named. These are real events whose
  // snippet merely MENTIONS a company's earnings call.
  it.each([
    [
      "Samsung SDI Battery Technology Symposium 2027",
      "https://www.samsungsdi.com/events/battery-day",
      "Company news: the fourth quarter earnings call is scheduled separately.",
    ],
    [
      "Comcast NBCUniversal Research Symposium",
      "https://corporate.cmcsa.com/events/research-symposium",
      "See also the company's quarterly earnings conference call webcast.",
    ],
    [
      "Bank of America Sustainable Materials Forum",
      "https://investor.bankofamerica.com/events/materials-forum",
      "Investor relations also publishes the earnings call transcript.",
    ],
  ])("keeps an event whose SNIPPET mentions an earnings call: %s", (title, url, snippet) => {
    expect(isEarningsCallPage(title, url)).toBe(false);
    expect(webResultToRawEventItem({ title, url, snippet }, NOW)).not.toBeNull();
  });

  // THE NAMED UNDER-CATCH, asserted as documented-known rather than left to be
  // rediscovered. Both are reachable only by bare "conference call", the
  // rejected rule. The failure direction is deliberate: a miss leaves the row
  // exactly where it is today; a false fire deletes a real event.
  it.each([
    [
      "Conference Call for Fourth Quarter and Full Year 2026 Financial Results",
      "https://www.balchem.com/investors/news/conference-call-q4",
    ],
    [
      "Investor Center: Quarterly Conference Calls",
      "https://www.roberthalf.com/us/en/investor-center/quarterly-calls",
    ],
  ])("documents the accepted under-catch: %s", (title, url) => {
    expect(isEarningsCallPage(title, url)).toBe(false);
  });
});
