import { describe, expect, it } from "vitest";
import { dedupEvents, dedupScoredEvents, eventDedupKey } from "./dedup";
import { scoreEvents } from "./scoring";
import type { RawEventItem, ScoredEventItem } from "./types";

// A34-01 (round 34 A, traced to the exact mechanism) / round 35 B (design) /
// round 35 C (Ruling 96a, this file): `events.evwire.com` and
// `www.advancedautobat.com` both offer a page for the SAME real conference
// (AABC 2026, Dec 7-10, San Diego) and were never merged, because
// `eventDedupKey` ran BEFORE enrichment, and the two derived names differed
// by an ordinal ("26th") and a short all-caps acronym parenthetical
// ("(AABC)") while the two dates ALSO differed pre-enrichment (one title
// states a parseable date, the other doesn't, until enrichment recovers it).
//
// There was no `events/dedup.test.ts` before this round — unlike the job
// side, which has had one since round 22 (`jobs/dedup.test.ts`). This file
// mirrors that one's structure (round 35 B §2.6's own asymmetry note).

function event(overrides: Partial<RawEventItem> & { id: string }): RawEventItem {
  return {
    source: "eventweb",
    name: "Some Conference",
    type: "conference",
    startDate: "",
    location: "",
    isOnline: false,
    description: "",
    url: "https://example.test/event",
    tags: [],
    ...overrides,
  };
}

function scoredEvent(
  overrides: Partial<ScoredEventItem> & { id: string },
): ScoredEventItem {
  return {
    source: "eventweb",
    name: "Some Conference",
    type: "conference",
    startDate: "",
    location: "",
    isOnline: false,
    description: "",
    url: "https://example.test/event",
    tags: [],
    score: 0.5,
    matchedKeywords: [],
    relevanceReason: "",
    ...overrides,
  };
}

// The A34-01 pair, real derived names from round 34 A's own trace
// (`eventNameFrom`/`bestEventTitleSegment` on the two real recorded titles —
// `eventweb.ts:1687-1830`). Both constructed here SIMULATED POST-ENRICHMENT:
// round 34 A's trace claims only the DATE is recovered by enrichment, so the
// name is left exactly as ingested and both carry the same December 2026
// date, matching round 35 B §2.0/§2.4's own replay.
const AABC_EVWIRE = event({
  id: "eventweb:evwire",
  name: "Advanced Automotive Battery Conference",
  startDate: "2026-12-07T12:00:00.000Z",
  url: "https://events.evwire.com/events/aabc-2026",
});
const AABC_ADVANCEDAUTOBAT = event({
  id: "eventweb:advancedautobat",
  name: "26th Advanced Automotive Battery Conference (AABC)",
  startDate: "2026-12-07T12:00:00.000Z",
  url: "https://www.advancedautobat.com/us",
});

describe("eventDedupKey — normalization (round 35 B §2.1)", () => {
  it("strips an ordinal number word from the name half only", () => {
    const withOrdinal = event({ id: "a", name: "26th Advanced Automotive Battery Conference" });
    const without = event({ id: "b", name: "Advanced Automotive Battery Conference" });
    expect(eventDedupKey(withOrdinal)).toBe(eventDedupKey(without));
  });

  it("strips a short all-caps acronym parenthetical from the name half only", () => {
    const withParen = event({ id: "a", name: "Advanced Automotive Battery Conference (AABC)" });
    const without = event({ id: "b", name: "Advanced Automotive Battery Conference" });
    expect(eventDedupKey(withParen)).toBe(eventDedupKey(without));
  });

  it("leaves a MIXED-CASE acronym parenthetical untouched (checked, not assumed)", () => {
    // Real title, round 34's own artefact table (pyro.byu.edu): "(MoSES)" has
    // a lowercase o/E/S mix, so it does NOT match the deliberately narrow
    // `[A-Z0-9]{2,8}` shape. The "moses" token must still be present in the
    // key's name half, proving the parenthetical was NOT stripped.
    const key = eventDedupKey(
      event({ id: "a", name: "Molten Salt Electrochemistry Symposium (MoSES)" }),
    );
    expect(key.split("::")[0]).toContain("moses");
  });

  it("never lets ordinal-stripping touch the YEAR half — a genuine multi-edition series still discriminates", () => {
    // "32nd SolarPACES Conference" (real title) vs an adjacent-year
    // constructed "33rd SolarPACES Conference". Round 35 B §2.5, row 1.
    const y2026 = event({
      id: "a",
      name: "32nd SolarPACES Conference",
      startDate: "2026-10-01T00:00:00.000Z",
    });
    const y2027 = event({
      id: "b",
      name: "33rd SolarPACES Conference",
      startDate: "2027-10-01T00:00:00.000Z",
    });
    // The name half DOES collide once ordinals are stripped from both...
    expect(eventDedupKey(y2026).split("::")[0]).toBe(eventDedupKey(y2027).split("::")[0]);
    // ...but the full key still does not, because the year is untouched.
    expect(eventDedupKey(y2026)).not.toBe(eventDedupKey(y2027));
  });
});

describe("eventDedupKey / dedupScoredEvents — must MERGE", () => {
  it("the AABC pair's keys match once simulated post-enrichment", () => {
    expect(eventDedupKey(AABC_EVWIRE)).toBe(eventDedupKey(AABC_ADVANCEDAUTOBAT));
  });

  it("the existing locked collide-control still merges under the new key (scoring.test.ts:352-364, replayed)", () => {
    // Byte-identical name, no ordinal or parenthetical present — the
    // normalization must be a no-op here, and the pre-existing
    // `SOURCE_PRIORITY` tie-break (ccfddl beats eventweb) must still hold.
    const web = event({
      id: "eventweb:x",
      source: "eventweb",
      name: "Machine Learning Conf 2026",
    });
    const curated = event({
      id: "ccfddl:mlconf26",
      source: "ccfddl",
      name: "Machine Learning Conf 2026",
    });
    const out = dedupEvents([web, curated]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("ccfddl");
  });
});

describe("eventDedupKey — must NOT merge (round 35 B §2.5, the seven-row corpus)", () => {
  it("same series, different location, same year (Battery Show North America vs South)", () => {
    const north = event({
      id: "a",
      name: "The Battery Show North America",
      startDate: "2026-09-01T00:00:00.000Z",
    });
    const south = event({
      id: "b",
      name: "The Battery Show South",
      startDate: "2026-09-01T00:00:00.000Z",
    });
    expect(eventDedupKey(north)).not.toBe(eventDedupKey(south));
  });

  it("IEX 2026 training course vs a constructed IEX 2026 conference (same series root)", () => {
    const course = event({
      id: "a",
      name:
        "IEX 2026 technical training introductory course: Introduction to ion exchange design and operation for industrial water treatment",
      startDate: "2026-05-01T00:00:00.000Z",
    });
    const conference = event({
      id: "b",
      name: "45th IEX 2026 International Conference on Ion Exchange",
      startDate: "2026-05-01T00:00:00.000Z",
    });
    expect(eventDedupKey(course)).not.toBe(eventDedupKey(conference));
  });

  // EUCHEMSIL (euchemsil2026.com) vs its rsc.org twin: N/A, MOOT BY
  // CONSTRUCTION (round 35 B §2.2/§2.5, confirmed by direct execution of
  // `webResultToRawEventItem` there). The rsc.org copy's own recorded date
  // ("31 July 2026") is already past by the time either dedup pass could ever
  // run, so it dies at INGESTION — a different, older guard entirely
  // (`eventweb.ts`'s expiry check inside `webResultToRawEventItem`), never a
  // `RawEventItem` at all. Not re-tested here: it is not a key-comparison
  // case, and re-deriving it would duplicate `eventweb.test.ts`'s own
  // ingestion-stage coverage rather than this file's dedup-key scope.

  it("same organizer-family root, both carry an ordinal, genuinely different real events (EuChemS Congress vs EUCHEMSIL Meeting)", () => {
    const congress = event({
      id: "a",
      name: "10th EuChemS Chemistry Congress",
      startDate: "2026-07-01T00:00:00.000Z",
    });
    const meeting = event({
      id: "b",
      name: "EUCHEMSIL 2026: 30th EUCHEMS Meeting",
      startDate: "2026-07-01T00:00:00.000Z",
    });
    expect(eventDedupKey(congress)).not.toBe(eventDedupKey(meeting));
  });

  it("two constructed titles sharing five of six tokens, differing only in the trailing word", () => {
    // A pre-existing property of the shipped six-token slice, unrelated to
    // this item — recorded to show the candidate key does not widen the
    // existing coincidence-collision surface.
    const meetingTitle = event({
      id: "a",
      name: "International Battery Materials Research Association Meeting",
      startDate: "2026-06-01T00:00:00.000Z",
    });
    const workshopTitle = event({
      id: "b",
      name: "International Battery Materials Research Association Workshop",
      startDate: "2026-06-01T00:00:00.000Z",
    });
    expect(eventDedupKey(meetingTitle)).not.toBe(eventDedupKey(workshopTitle));
  });
});

describe("dedupScoredEvents (round 35 B §2.2/§2.3, inserted after scoreEvents' stage 2)", () => {
  it("merges the AABC pair to exactly ONE survivor, and the higher-.score row wins the SOURCE_PRIORITY tie", () => {
    const low = scoredEvent({ ...AABC_EVWIRE, score: 0.42 });
    const high = scoredEvent({ ...AABC_ADVANCEDAUTOBAT, score: 0.61 });

    const forward = dedupScoredEvents([low, high]);
    expect(forward).toHaveLength(1);
    expect(forward[0].id).toBe("eventweb:advancedautobat");

    // Order-independent: the same survivor whichever copy arrives first.
    const reversed = dedupScoredEvents([high, low]);
    expect(reversed).toHaveLength(1);
    expect(reversed[0].id).toBe("eventweb:advancedautobat");
  });

  it("passes an item with no usable key through untouched, without colliding it against another blank-keyed row", () => {
    const blank1 = scoredEvent({ id: "eventweb:blank1", name: "", startDate: "" });
    const blank2 = scoredEvent({ id: "eventweb:blank2", name: "", startDate: "" });
    const result = dedupScoredEvents([blank1, blank2]);
    expect(result).toHaveLength(2);
  });

  // THE MANAGER'S ADDED REQUIREMENT (Ruling 96a): a pool-ordering invariance
  // check for non-merged rows. The `Map`'s iteration order follows each KEY's
  // FIRST insertion, and `.set` on an already-present key updates the value
  // in place without moving it — so a later-arriving, higher-scoring winner
  // of a tie surfaces in the SLOT of its key's first occurrence, not at its
  // own original arrival position. Subtle enough to lock with an assertion,
  // not trust.
  it("keeps non-merged rows in their original relative order through dedupScoredEvents", () => {
    const a = scoredEvent({
      id: "eventweb:a",
      name: "Northern Solar Workshop",
      startDate: "2026-03-01T00:00:00.000Z",
      score: 0.5,
    });
    const bLow = scoredEvent({
      id: "eventweb:b-low",
      name: "Advanced Battery Recycling Summit",
      startDate: "2026-04-01T00:00:00.000Z",
      score: 0.3,
    });
    const c = scoredEvent({
      id: "eventweb:c",
      name: "Fusion Energy Roundtable",
      startDate: "2026-05-01T00:00:00.000Z",
      score: 0.5,
    });
    const bHigh = scoredEvent({
      id: "eventweb:b-high",
      name: "Advanced Battery Recycling Summit",
      startDate: "2026-04-01T00:00:00.000Z",
      score: 0.9,
    });
    const d = scoredEvent({
      id: "eventweb:d",
      name: "Quantum Sensing Retreat",
      startDate: "2026-06-01T00:00:00.000Z",
      score: 0.5,
    });

    // Premise: bLow and bHigh really do share a key, so the merge below is
    // real, not assumed.
    expect(eventDedupKey(bLow)).toBe(eventDedupKey(bHigh));

    const result = dedupScoredEvents([a, bLow, c, bHigh, d]);
    // a, c, d were never duplicated and keep their original relative order.
    // The merged survivor (bHigh, the tie-break winner) lands in bLow's
    // FIRST-SEEN slot — between a and c — not at bHigh's own arrival index.
    expect(result.map((item) => item.id)).toEqual([
      "eventweb:a",
      "eventweb:b-high",
      "eventweb:c",
      "eventweb:d",
    ]);
  });
});

describe("second dedup pass positioning — the expired-sibling structural case (documentation)", () => {
  // Round 35 B §2.2's own positioning proof, replayed here against the real,
  // unmodified `scoreEvents`: an expired sibling can never reach
  // `dedupScoredEvents`, because `scoreEvents`' own expiry gate
  // (scoring.ts:206-222) already removed it one step earlier. No hand-rolled
  // expiry predicate is written anywhere in this item.
  const NOW = Date.parse("2026-08-19T00:00:00.000Z");

  it("scoreEvents' own expiry gate removes an expired sibling before the second dedup pass ever runs", () => {
    const expiredSibling = event({
      id: "eventweb:expired-twin",
      name: "Molten Salt Chemistry Symposium",
      // Same YEAR as its live sibling (so the keys genuinely match) but a
      // month already past `NOW` below, so it fails scoreEvents' own expiry
      // gate.
      startDate: "2026-01-01T00:00:00.000Z",
    });
    const liveSibling = event({
      id: "eventweb:live-twin",
      name: "Molten Salt Chemistry Symposium",
      startDate: "2026-12-01T00:00:00.000Z",
    });
    // Premise: sharing a key is what would make a resurrection possible if
    // the second pass ran on unfiltered candidates — it does not.
    expect(eventDedupKey(expiredSibling)).toBe(eventDedupKey(liveSibling));

    const scored = scoreEvents([expiredSibling, liveSibling], { topics: [] }, NOW, {
      applyFloor: false,
    });
    expect(scored).toHaveLength(1);
    expect(scored[0].id).toBe("eventweb:live-twin");

    // The second pass is a structural no-op here: the expired row was never
    // a candidate it could see in the first place.
    const deduped = dedupScoredEvents(scored);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("eventweb:live-twin");
  });
});
