import { describe, expect, it } from "vitest";
import {
  dedupEvents,
  dedupScoredEvents,
  eventDedupKey,
  mergeContainedEventNames,
} from "./dedup";
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

// Round 36 B (A35-01, Ruling 99b's "genuinely different wording" duplicate
// class) / Ruling 100 (this file, this section): a THIRD, additive dedup
// pass, `mergeContainedEventNames`, wired one line after `dedupScoredEvents`
// at `pipeline.ts:126-127`. `eventDedupKey`/`dedupEvents`/`dedupScoredEvents`
// above are untouched by this item — none of the tests above needed
// changing, and none did.

describe("mergeContainedEventNames — round 36 B (A35-01, Ruling 99b's containment class)", () => {
  // The real recorded titles round 35 A traced and round 36 B replayed
  // (§3.0): both describe the SAME real event (Solid-State Battery Summit
  // 2026, Chicago) but `eventDedupKey` never matches them — djk's title
  // tokenizes to 19 significant tokens against quintus's clean 4, a
  // token-SET SUBSET relationship (proven by construction, §3.1: no
  // stopword list or reordering can equalize two token sets of different
  // SIZE), not a scrambled equal set the key could ever catch.
  const DJK = scoredEvent({
    id: "eventweb:djk",
    source: "eventweb",
    name:
      'Exhibition "Solid-State Battery Summit 2026" in Chicago ~Showcasing Products and Technologies for Next-Generation Battery Development and Mass Production~',
    startDate: "",
    score: 0.4,
  });
  const QUINTUS = scoredEvent({
    id: "eventweb:quintus",
    source: "eventweb",
    name: "Solid-State Battery Summit 2026",
    startDate: "",
    score: 0.7,
  });

  it("the exact key does NOT match this pair (premise, confirmed by execution — this is why the new pass exists)", () => {
    expect(eventDedupKey(DJK)).not.toBe(eventDedupKey(QUINTUS));
  });

  it("merges to exactly ONE survivor, the higher-score row on a SOURCE_PRIORITY tie, either arrival order", () => {
    const forward = mergeContainedEventNames([DJK, QUINTUS]);
    expect(forward).toHaveLength(1);
    expect(forward[0].id).toBe("eventweb:quintus");

    const reversed = mergeContainedEventNames([QUINTUS, DJK]);
    expect(reversed).toHaveLength(1);
    expect(reversed[0].id).toBe("eventweb:quintus");
  });
});

describe("mergeContainedEventNames — the AABC pair (round 34/35's own must-merge pair), regression", () => {
  it("does NOT merge the AABC pair by containment alone — normalized, their texts are byte-identical, excluded by the textA !== textB guard", () => {
    // AABC_EVWIRE/AABC_ADVANCEDAUTOBAT's names differ only by the ordinal
    // ("26th") and the acronym parenthetical ("(AABC)") that
    // normalizedEventText strips with the SAME regexes eventDedupKey uses —
    // so after normalization the two texts are IDENTICAL, not one contained
    // in the other. Confirms the containment pass is not silently doing
    // this pair's work a second time; the key-based dedupScoredEvents below
    // is what actually closes it, exactly as it already did before this
    // item existed.
    const evwire = scoredEvent({ ...AABC_EVWIRE, score: 0.42 });
    const advancedautobat = scoredEvent({ ...AABC_ADVANCEDAUTOBAT, score: 0.61 });
    const result = mergeContainedEventNames([evwire, advancedautobat]);
    expect(result).toHaveLength(2);
  });

  it("still merges to exactly ONE survivor through the FULL pass 2 + pass 3 chain — the new pass changes nothing here (the new pass 'must not be needed for it')", () => {
    const low = scoredEvent({ ...AABC_EVWIRE, score: 0.42 });
    const high = scoredEvent({ ...AABC_ADVANCEDAUTOBAT, score: 0.61 });
    const afterPass2 = dedupScoredEvents([low, high]);
    expect(afterPass2).toHaveLength(1);
    const afterPass3 = mergeContainedEventNames(afterPass2);
    expect(afterPass3).toHaveLength(1);
    expect(afterPass3[0].id).toBe("eventweb:advancedautobat");
  });
});

describe("mergeContainedEventNames — round 35's must-NOT-merge floor, replayed through the FULL pipeline (dedupEvents -> scoreEvents -> dedupScoredEvents -> mergeContainedEventNames)", () => {
  const NOW = Date.parse("2026-08-19T00:00:00.000Z");

  it("zero merges introduced by the new pass among the five must-NOT-merge pairs; the locked collide-control still correctly merges to one", () => {
    const batteryNorth = event({
      id: "eventweb:battery-north",
      name: "The Battery Show North America",
      startDate: "2026-09-01T00:00:00.000Z",
    });
    const batterySouth = event({
      id: "eventweb:battery-south",
      name: "The Battery Show South",
      startDate: "2026-09-01T00:00:00.000Z",
    });
    const iexCourse = event({
      id: "eventweb:iex-course",
      name:
        "IEX 2026 technical training introductory course: Introduction to ion exchange design and operation for industrial water treatment",
      // Round 35's own corpus used 2026-05-01 for this pair — moved forward
      // here only because this test's own NOW (2026-08-19) makes that date
      // already past, which would trip scoreEvents' UNRELATED expiry gate
      // before the dedup passes under test ever ran. Same year, same
      // relative pairing preserved.
      startDate: "2026-09-15T00:00:00.000Z",
    });
    const iexConference = event({
      id: "eventweb:iex-conference",
      name: "45th IEX 2026 International Conference on Ion Exchange",
      startDate: "2026-09-15T00:00:00.000Z",
    });
    const euchemsCongress = event({
      id: "eventweb:euchems",
      name: "10th EuChemS Chemistry Congress",
      // Same forward-date note as the IEX pair above (round 35's corpus used
      // 2026-07-01).
      startDate: "2026-09-20T00:00:00.000Z",
    });
    const euchemsilMeeting = event({
      id: "eventweb:euchemsil",
      name: "EUCHEMSIL 2026: 30th EUCHEMS Meeting",
      startDate: "2026-09-20T00:00:00.000Z",
    });
    const solarpaces2026 = event({
      id: "eventweb:solarpaces-32",
      name: "32nd SolarPACES Conference",
      startDate: "2026-10-01T00:00:00.000Z",
    });
    const solarpaces2027 = event({
      id: "eventweb:solarpaces-33",
      name: "33rd SolarPACES Conference",
      startDate: "2027-10-01T00:00:00.000Z",
    });
    const meetingTitle = event({
      id: "eventweb:meeting",
      name: "International Battery Materials Research Association Meeting",
      // Same forward-date note as the IEX pair above (round 35's corpus used
      // 2026-06-01).
      startDate: "2026-09-25T00:00:00.000Z",
    });
    const workshopTitle = event({
      id: "eventweb:workshop",
      name: "International Battery Materials Research Association Workshop",
      startDate: "2026-09-25T00:00:00.000Z",
    });
    // The locked collide-control (scoring.test.ts:352-364), given a real
    // future date here so this replay exercises scoreEvents' own expiry
    // gate rather than tripping its unrelated dateless-non-eventweb-source
    // rule (scoring.ts:206-222) — a concern outside this item's scope. The
    // ORIGINAL zero-date version in the "must MERGE" describe block above is
    // untouched.
    const collideWeb = event({
      id: "eventweb:collide",
      source: "eventweb",
      name: "Machine Learning Conf 2026",
      startDate: "2026-11-01T00:00:00.000Z",
    });
    const collideCurated = event({
      id: "ccfddl:collide",
      source: "ccfddl",
      name: "Machine Learning Conf 2026",
      startDate: "2026-11-01T00:00:00.000Z",
    });

    const raw = [
      batteryNorth,
      batterySouth,
      iexCourse,
      iexConference,
      euchemsCongress,
      euchemsilMeeting,
      solarpaces2026,
      solarpaces2027,
      meetingTitle,
      workshopTitle,
      collideWeb,
      collideCurated,
    ];

    const afterPass1 = dedupEvents(raw);
    // The collide-control pair shares a key and merges here (ccfddl wins on
    // SOURCE_PRIORITY); every other pair keeps both rows distinct.
    expect(afterPass1).toHaveLength(11);
    expect(afterPass1.find((item) => item.id.startsWith("eventweb:collide") || item.id.startsWith("ccfddl:collide"))?.source).toBe("ccfddl");

    const scored = scoreEvents(afterPass1, { topics: [] }, NOW, {
      applyFloor: false,
    });
    // Every row above carries a real future date and topics is empty, so
    // scoreEvents' own expiry/required-topic gate drops nothing here.
    expect(scored).toHaveLength(11);

    const afterPass2 = dedupScoredEvents(scored);
    expect(afterPass2).toHaveLength(11); // no NEW collisions introduced by scoring

    const afterPass3 = mergeContainedEventNames(afterPass2);
    // The floor holds through the full three-pass path: zero merges beyond
    // the one already-correct collide-control merge from pass 1.
    expect(afterPass3).toHaveLength(11);
  });
});

describe("mergeContainedEventNames — four boundary adversarials (round 36 B §3.4, probing the design's OWN named danger)", () => {
  it("a 2-token generic phrase, contiguously present inside an unrelated longer title, is BLOCKED BY THE FLOOR", () => {
    const short = scoredEvent({ id: "eventweb:short-generic", name: "Battery Conference" });
    const long = scoredEvent({
      id: "eventweb:long-unrelated",
      name: "The Annual Battery Conference on Grid-Scale Energy Storage Systems",
    });
    expect(mergeContainedEventNames([short, long])).toHaveLength(2);
  });

  it("a 3-token short title (real title, ibatterysummit.com) that IS a literal substring of a longer one is BLOCKED BY THE FLOOR ALONE — defense in depth", () => {
    const short = scoredEvent({ id: "eventweb:ibs-short", name: "International Battery Summit" });
    const long = scoredEvent({
      id: "eventweb:ibs-long",
      name: "International Battery Summit and Trade Exhibition 2026",
    });
    expect(mergeContainedEventNames([short, long])).toHaveLength(2);
  });

  it("a scrambled same-bag-of-words pair (round 36 B's own adversarial construction) is NOT merged — only a genuine contiguous PHRASE matches, never scattered vocabulary", () => {
    const a = scoredEvent({
      id: "eventweb:bag-a",
      name: "Battery Materials Advanced Research Symposium",
    });
    const b = scoredEvent({
      id: "eventweb:bag-b",
      name: "Symposium on Advanced Materials for Battery Research",
    });
    expect(mergeContainedEventNames([a, b])).toHaveLength(2);
  });

  it("a near-vocabulary family sharing 'battery'/'summit' tokens stays fully distinct, mirroring B's own real Molten-Salt/Battery-Summit family checks", () => {
    // B's own §3.4 ran this exact property against two REAL host families
    // (a 7-title "Molten Salt" family, a 3-title "Battery Summit" family)
    // that round 35 A's artefact tables this entry cites only by hostname,
    // not full title. Reproduced here with constructed titles carrying the
    // same scattered-vocabulary shape, matching this file's existing
    // convention of constructed (not scraped) fixture names elsewhere
    // (e.g. "Northern Solar Workshop", "Fusion Energy Roundtable" above).
    const family = [
      scoredEvent({ id: "eventweb:fam-1", name: "Battery Innovation Summit Americas" }),
      scoredEvent({ id: "eventweb:fam-2", name: "Global Summit on Advanced Battery Technology" }),
      scoredEvent({ id: "eventweb:fam-3", name: "Battery Storage and Grid Summit Europe" }),
    ];
    expect(mergeContainedEventNames(family)).toHaveLength(3);
  });
});

describe("mergeContainedEventNames — ordering invariance for non-merged rows", () => {
  it("keeps non-merged rows in their original relative order; the merged winner lands in the FIRST-seen slot", () => {
    const a = scoredEvent({ id: "eventweb:a", name: "Northern Solar Workshop", score: 0.5 });
    const bContainer = scoredEvent({
      id: "eventweb:b-container",
      name: "International Advanced Battery Recycling Summit Special Edition",
      score: 0.3,
    });
    const c = scoredEvent({ id: "eventweb:c", name: "Fusion Energy Roundtable", score: 0.5 });
    const bContained = scoredEvent({
      id: "eventweb:b-contained",
      name: "Advanced Battery Recycling Summit",
      score: 0.9,
    });
    const d = scoredEvent({ id: "eventweb:d", name: "Quantum Sensing Retreat", score: 0.5 });

    // Premise: the two b-rows really are a contained pair, so the merge
    // below is real, not assumed.
    expect(mergeContainedEventNames([bContainer, bContained])).toHaveLength(1);

    const result = mergeContainedEventNames([a, bContainer, c, bContained, d]);
    // a, c, d were never duplicated and keep their original relative order.
    // The merged survivor (bContained, the score-tie-break winner) lands in
    // bContainer's FIRST-SEEN slot — between a and c — not at bContained's
    // own arrival index. Mirrors dedupScoredEvents' own ordering-invariance
    // test above.
    expect(result.map((item) => item.id)).toEqual([
      "eventweb:a",
      "eventweb:b-contained",
      "eventweb:c",
      "eventweb:d",
    ]);
  });
});

describe("mergeContainedEventNames — the winner-chain case (round 36 B §3.3's own disclosed harness bug)", () => {
  it("a later, higher-priority/score row wins the merged slot, and is not pushed a second time when the outer loop naturally reaches its own index", () => {
    // Round 36 B §3.3: the FIRST version of this function tracked
    // dropped-ids and marked only the LOSER of each pairwise tie-break.
    // When the running winner switched to a LATER item mid-chain, that
    // later row's OWN id was never marked dropped, so the outer loop's
    // later natural pass over its own index pushed it a SECOND time as an
    // undeduped copy. This three-row nested-containment chain reproduces
    // exactly that shape: row0 loses to row1, then row1 (now the running
    // winner) loses to row2 — row2 must end up FINALIZED too, or it would
    // be double-counted when the outer loop reaches index 2 on its own.
    // The fixed implementation tracks finalized INDICES, not ids, which is
    // what the assertion below actually exercises.
    const row0 = scoredEvent({
      id: "eventweb:core",
      name: "Advanced Battery Recycling Summit",
      score: 0.2,
    });
    const row1 = scoredEvent({
      id: "eventweb:core-asia",
      name: "Advanced Battery Recycling Summit Asia",
      score: 0.5,
    });
    const row2 = scoredEvent({
      id: "eventweb:core-asia-pacific",
      name: "Advanced Battery Recycling Summit Asia Pacific Forum",
      score: 0.9,
    });

    // Premises: each consecutive pair really is a contained pair, so the
    // chain below is real, not assumed.
    expect(mergeContainedEventNames([row0, row1])).toHaveLength(1);
    expect(mergeContainedEventNames([row1, row2])).toHaveLength(1);

    const result = mergeContainedEventNames([row0, row1, row2]);
    // NOT 2 (the dropped-id bug's signature: the eventual winner reached by
    // switching mid-chain gets pushed again at its own original index).
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("eventweb:core-asia-pacific");
  });
});

describe("mergeContainedEventNames — the enrich.test.ts fixture's non-collision claim (round 36 B §3.4)", () => {
  it("a 'Battery Event NN'-shaped 3-token name is BLOCKED BY THE FLOOR even when literally, contiguously embedded in a longer title", () => {
    // enrich.test.ts's 42-row fixture generator (round 35 C, Ruling 97)
    // names every synthetic row "Battery Event NN" (zero-padded index) —
    // every one of those names normalizes to exactly 3 tokens (battery,
    // event, NN), one short of this item's 4-token floor. That is the
    // property that keeps that locked fixture untouched by this item;
    // replayed here directly against the shape most likely to expose it —
    // a fixture-style short name literally, contiguously embedded inside a
    // longer, unrelated title, which the floor alone must still block.
    const short = scoredEvent({ id: "eventweb:fixture-shape", name: "Battery Event 00" });
    const long = scoredEvent({
      id: "eventweb:fixture-shape-long",
      name: "Battery Event 00 Highlights Reel and Recap",
    });
    expect(mergeContainedEventNames([short, long])).toHaveLength(2);
  });
});
