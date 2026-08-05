import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import type {
  EventEnrichment,
  OpportunityPageReadingReason,
} from "@/lib/opportunities/enrichment";
import { EventReport } from "./page";

// B-02. A fixed clock so the countdowns and the "Today" milestone render the
// same string on every run. Mirrors the job report's own test constant.
const NOW = Date.parse("2026-07-30T12:00:00Z");

function baseEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event:1",
    name: "Battery Interfaces Summit",
    type: "conference",
    date: "2027-07-20",
    location: "Chicago, IL",
    isOnline: false,
    shortDescription: "",
    relevanceReason: "",
    ...overrides,
  };
}

function renderReport(
  event: Event,
  careerStage = "PhD Year 3" as const,
  completion = { registered: false, submitted: false },
  enrichment: EventEnrichment | null = null,
  providerConfigured = false,
  isInterested = false,
  pageReadingReason?: OpportunityPageReadingReason,
  enrichmentLoading = false,
): string {
  return renderToStaticMarkup(
    createElement(EventReport, {
      event,
      careerStage,
      enrichment,
      pageReadingReason,
      enrichmentLoading,
      providerConfigured,
      isSaved: false,
      isRegistered: completion.registered,
      isSubmitted: completion.submitted,
      isInterested,
      nowMs: NOW,
      starredKeys: new Set<string>(),
      onToggleStar: () => undefined,
      onToggleSave: () => undefined,
      onRegisteredChange: () => undefined,
      onSubmittedChange: () => undefined,
      onDismiss: () => undefined,
    }),
  );
}

describe("EventReport", () => {
  it("renders one wrapping action row with the paired feedback controls", () => {
    const html = renderReport(
      baseEvent({ linkOfficial: "https://events.example.test" }),
      "PhD Year 3",
      { registered: false, submitted: false },
      null,
      false,
      true,
    );
    const actionRows = html.match(
      /<div[^>]*data-report-action-row="event"[^>]*>/g,
    );
    const interested = html.match(
      /<button[^>]*data-feedback-control="interested"[^>]*>/,
    )?.[0];

    expect(actionRows).toHaveLength(1);
    expect(actionRows?.[0]).toContain("flex flex-wrap items-center");
    expect(html).not.toContain("flex flex-col items-start");
    expect(html.match(/data-opportunity-feedback-pair="true"/g)).toHaveLength(1);
    expect(interested).toContain('aria-pressed="true"');
    expect(html).toContain("Interested");
    expect(html).toContain("Not interested");
  });

  it("renders every organisation in a 30-entry roster", () => {
    const organisations = Array.from({ length: 30 }, (_, index) => ({
      name: `Battery Organisation ${index + 1}`,
      descriptor: index % 2 === 0 ? "Exhibitor" : "Sponsor",
    }));
    const html = renderReport(baseEvent({ organisations }));

    expect(html.match(/data-roster-row="organisation"/g)).toHaveLength(30);
    expect(html).toContain("Battery Organisation 30");
    // B-07 rewrote the two assertions below. They used to forbid the strings
    // "+29" and "collapsed" outright, but plate 03's own footnote uses both
    // words to promise the reader that nothing is hidden. What they were
    // protecting is that no row is actually hidden — asserted by the count
    // above, which is every organisation in the roster.
    expect(html).toContain(
      "Nothing is collapsed behind a “+29” — Peer’s guess about what matters to you is not good enough to hide anything.",
    );
    expect(html).not.toMatch(/show more/i);
    const layout = html.match(
      /<div[^>]*data-roster-layout="full-width"[^>]*>/,
    )?.[0];
    expect(layout).toContain("w-full space-y-10");
    expect(layout).not.toContain("grid-cols-2");
    // B-14 replaced "Organisations at the event" with plate 03's heading and
    // its counts sub-line — how many of the room matter to YOU, not how many
    // the model processed.
    expect(html).toContain("Who’ll be in the room");
    expect(html).toContain("0 of 30 exhibitors concern you");
    expect(html).not.toContain("attendees");
    // B-07. The tail is its own titled block with a live count, a filter and
    // the star explainer — none of which the build had.
    expect(html).toContain("Every other organisation attending · 30");
    expect(html).toContain('placeholder="Filter this list"');
    expect(html).toContain(
      "Star anyone Peer got wrong. It moves to the top here, and every future event highlights them automatically.",
    );
  });

  it("moves a starred organisation out of the tail and shrinks its count", () => {
    // B-07. The tail count is the plain-list length computed live, so starring
    // someone visibly moves them from the tail into the Tier 0 cards.
    const organisations = Array.from({ length: 4 }, (_, index) => ({
      name: `Battery Organisation ${index + 1}`,
      descriptor: "Exhibitor",
    }));
    const html = renderToStaticMarkup(
      createElement(EventReport, {
        event: baseEvent({ organisations }),
        careerStage: "PhD Year 3" as const,
        enrichment: null,
        providerConfigured: false,
        isSaved: false,
        isRegistered: false,
        isSubmitted: false,
        isInterested: false,
        nowMs: NOW,
        starredKeys: new Set(["organisation:battery organisation 2"]),
        onToggleStar: () => undefined,
        onToggleSave: () => undefined,
        onRegisteredChange: () => undefined,
        onSubmittedChange: () => undefined,
        onDismiss: () => undefined,
      }),
    );

    expect(html).toContain("Every other organisation attending · 3");
    expect(html).toContain("1 of 4 exhibitors concern you");
    expect(html.match(/data-roster-card="true"/g)).toHaveLength(1);
    expect(html.match(/data-roster-row="organisation"/g)).toHaveLength(4);
  });

  it("repeats the cheapest line and renders the required four-column cost table", () => {
    const html = renderReport(
      baseEvent({
        deadline: "2027-01-28",
        registrationDeadline: "2027-06-15",
        fees: [
          {
            label: "Early bird",
            standard: "$500",
            student: "$250",
            online: "$150",
            deadline: "2027-04-15",
          },
          {
            label: "Regular",
            standard: "$650",
            student: "$325",
            online: "$225",
          },
        ],
      }),
    );

    // KEEP the count at 2. Both sites are on plate 03 — the written sentence
    // up top and a compressed restatement at the head of the table — and
    // HANDOFF-report-overhaul.md §P3.2 records the duplication as deliberate.
    expect(html.match(/Cheapest way in, for you/g)).toHaveLength(2);
    // B-11 rewrote this. The old assertion pinned a machine-assembled string,
    // "$250 student rate · Early bird · by Apr 15, 2027". It is now a sentence.
    expect(html).toContain("Student ticket in person before Apr 15, 2027 — $250.");
    for (const header of ["Item", "Standard", "Student", "Deadline"]) {
      expect(html).toContain(`>${header}</th>`);
    }
    expect(html).toContain("Online · $150");
    // B-08. §1c's order: the cost table sits after the roster and immediately
    // before "Why Peer sent this to you". It used to jump the queue ahead of
    // both the programme and the roster.
    expect(html.indexOf("Two deadlines, one event")).toBeLessThan(
      html.indexOf("What it costs you"),
    );
    // B-09 relabelled "Submit by" to the plate's "Abstract" and gave the strip
    // its missing heading, so the ordering anchors on the heading instead.
    expect(html.indexOf("Cheapest way in, for you")).toBeLessThan(
      html.indexOf("Two deadlines, one event"),
    );
    // B2-07 / Ruling 11. Plate 03 badges this heading TIER 0. The section has
    // no data attribute of its own to anchor a regex on, so this checks a
    // window right after the heading rather than the whole rest of the page.
    const costsIndex = html.indexOf("What it costs you");
    expect(html.slice(costsIndex, costsIndex + 500)).toContain("Tier 0");
  });

  it("names the travel grant and never signs off with the higher price", () => {
    // B-11. Three defects in the old generated string, all fixed here:
    //   1. field-concatenation rather than a sentence;
    //   2. it ended by quoting "$620 after" — the tail of the deadline text —
    //      so the one line whose job is to name the CHEAPEST way in finished
    //      with the most expensive number on the page;
    //   3. it never mentioned the travel grant sitting in the same record.
    const html = renderReport(
      baseEvent({
        deadline: "2026-10-30",
        travelGrant: "30 grants available, apply with your abstract",
        fees: [
          {
            label: "Early bird",
            standard: "$620",
            student: "$180",
            deadline: "Early bird ends Jan 9 · $620 after",
          },
        ],
      }),
    );

    expect(html).toContain(
      "Student ticket in person before Jan 9, with a travel grant — $180, applied for alongside the abstract you were going to write anyway.",
    );
    // The compressed restatement in the table head drops only the tail clause.
    expect(html).toContain(
      "Student ticket in person before Jan 9, with a travel grant — $180.",
    );
    // The callout must not end on the higher price.
    const callout = html.match(
      /Cheapest way in, for you<\/p>[\s\S]{0,400}?<\/aside>/,
    )?.[0];
    expect(callout).not.toContain("$620");
  });

  it("puts the travel grant and invitation letter in the cost table only", () => {
    // Manager's ruling 6. Both used to print as prose under "What actually
    // happens there" AND as rows in the table — the same fact twice, which
    // say-it-once forbids. Plate 03 has them in the table only.
    const html = renderReport(
      baseEvent({
        activities: ["poster session"],
        travelGrant: "30 grants available",
        invitationLetter: true,
        fees: [{ label: "Early bird", standard: "$620", student: "$180" }],
      }),
    );

    expect(html.match(/data-cost-support-row/g)).toHaveLength(2);
    expect(html.match(/30 grants available/g)).toHaveLength(1);
    expect(html).toContain("Visa invitation letter");
    expect(html).toContain("Available on request.");
    expect(html).not.toContain("<strong>Travel grant:</strong>");
    expect(html).not.toContain("Invitation letters are available.");
    // B-13. The plate's closing footnote.
    expect(html).toContain("Full price with no grant would be $620.");
    expect(html).toContain(
      "The gap between the two is the reason this line sits at the top of the report.",
    );
  });

  it("renders the plate's fact tiles and a venue-format-duration subtitle", () => {
    // B-05 + B-16. The build had no tile row at all — a two-cell When/Where
    // grid in the header, and SCALE appeared nowhere in the report.
    const html = renderReport(
      baseEvent({
        date: "2027-03-08",
        endDate: "2027-03-11",
        location: "San Diego, US",
        deadline: "2026-10-30",
        registrationDeadline: "2027-02-20",
        expectedSize: 2400,
        fees: [
          {
            label: "Early bird",
            standard: "$480",
            student: "$180",
            deadline: "Early bird ends Jan 9 · $620 after",
          },
        ],
      }),
    );

    expect(html.match(/data-event-fact=/g)).toHaveLength(6);
    // The date range collapses what the two ends share; the old header printed
    // "Monday, March 8, 2027 · Mar 11, 2027".
    expect(html).toContain("Mar 8 – 11, 2027");
    expect(html).toContain("Mon – Thu");
    expect(html).toContain("~2.4k");
    expect(html).toContain("last edition");
    // B2-12 (A: event 1a). The early-bird cutoff was two lines away in scope
    // and simply never read; cutoffPhrase reuses B-01's ISO guard so the
    // compound deadline string still yields a clean "Jan 9" with no invented
    // year and no trailing "$620 after". Scoped to the FEE tile itself: the
    // cost table further down legitimately prints the full deadline string,
    // "$620" included, in its own DEADLINE column.
    const feeTile = html.match(
      /<div[^>]*data-event-fact="fee"[^>]*>[\s\S]*?<\/div>/,
    )?.[0];
    expect(feeTile).toContain("student $180 · early bird to Jan 9");
    expect(feeTile).not.toContain("$620");
    expect(html).toContain("San Diego, US · in person · 4 days");
    // B2-01. ABSTRACT DUE: plate 03's own vocabulary is "92 days left", not
    // the feed's "in 3 months" — always days, never bucketed into months.
    // This fixture's deadline is 92 days from the fixed clock, the plate's
    // own illustrative number.
    expect(html).toContain("Oct 30");
    expect(html).toContain("92 days left");
  });

  it("hides the scale tile when no crowd size was extracted", () => {
    // B-05. expectedSize is declared on the type but no mapper writes it, so
    // on live data this tile never appears. It is left absent rather than
    // filled with a guessed crowd size.
    const html = renderReport(baseEvent());
    expect(html).not.toContain('data-event-fact="scale"');
    expect(html).not.toContain("last edition");
  });

  it("prints REGISTER BY with no invented sub-line", () => {
    // B2-13 / Ruling 10 (A: event 1c). The plate's sub-line here is a fixed
    // qualitative note ("on-site registration available") — whether walk-in
    // registration stays open — not a countdown. Peer does not track that
    // fact, and a countdown implies the deadline is hard, which we do not
    // know. Suppressed rather than substituted; excluded from parity scoring
    // (exclusion 7 in §1e).
    const html = renderReport(
      baseEvent({ registrationDeadline: "2027-02-20" }),
    );
    const registerTile = html.match(
      /<div[^>]*data-event-fact="register-by"[^>]*>[\s\S]*?<\/div>/,
    )?.[0];

    expect(registerTile).toContain("Feb 20");
    expect(registerTile).not.toContain("data-report-fact-detail");
  });

  it("gives the deadline strip its heading and a Today milestone", () => {
    // B-09. The strip was rendered bare — no ReportSection, so no heading —
    // and had only three points. Plate 03 opens it with Today so the two
    // deadlines read as distances, exactly as the job report's timeline does.
    const html = renderReport(
      baseEvent({ deadline: "2027-01-28", registrationDeadline: "2027-06-15" }),
    );

    expect(html).toContain("Two deadlines, one event");
    // Anchored on the milestone keys, not the visible words: B-05's fact row
    // sits above the strip and legitimately repeats "Abstract" and
    // "Register by", so a text search finds the tile first.
    expect(
      html.match(/data-deadline-milestone="[a-z]+"/g),
    ).toEqual([
      'data-deadline-milestone="today"',
      'data-deadline-milestone="submission"',
      'data-deadline-milestone="registration"',
      'data-deadline-milestone="event"',
    ]);
    expect(html).not.toContain("Submit by");
    // The clock is the injected one, never Date.now(). B2-01 dropped the year
    // (Today sits inside the report's own horizon, same rule as the job
    // report's Timeline), so the month/day pair is now the whole signal.
    expect(html).toContain("Jul 30");
    expect(html).not.toContain("Jul 30, 2026");
  });

  it("keeps real activity vocabulary title-cased and leaves prose alone", () => {
    // B2-09 / Ruling 16. The old rule asked "does this look like a slug?"
    // (short, lowercase, only spaces/hyphens) and ordinary prose passed just
    // as easily as a real vocabulary value: "vendor exhibition" and
    // "early-career mixer" both qualified and both came out title-cased and
    // de-hyphenated — the same bug class B-12 fixed, triggered by different
    // strings than B-12's own fixture used. The fix is a membership test:
    // only an actual EventType value or one of the extractor's own fixed
    // activity labels goes through formatEventType; everything else keeps its
    // own words and hyphens, with only its first letter raised.
    const html = renderReport(
      baseEvent({
        activities: ["poster session", "vendor exhibition", "early-career mixer"],
      }),
    );

    // Real vocabulary (from ACTIVITY_LABELS): title-cased, as before.
    expect(html).toContain(">Poster Session<");
    // Prose the extractor never emits: first letter only, hyphen intact.
    expect(html).toContain(">Vendor exhibition<");
    expect(html).toContain(">Early-career mixer<");
    expect(html).not.toContain("Vendor Exhibition");
    expect(html).not.toContain("Early Career Mixer");
  });

  it("does not print a separate in-person/online header chip", () => {
    // B2-10 / Ruling 7. §1c's line for this row was a transcription error —
    // the plate's chip row is kind · secondary kind · rank · match %, with no
    // separate online/in-person chip. The subtitle (and the WHERE tile)
    // already state the format; a header chip said it a second time.
    const html = renderReport(baseEvent({ rank: "CCF-B", relevanceScore: 0.88 }));
    const header = html.match(
      /<div class="mb-4 flex flex-wrap gap-2">[\s\S]*?<\/div>/,
    )?.[0];

    expect(header).not.toContain("In person");
    expect(header).not.toContain(">Online<");
    // The subtitle keeps the fact — this is what B2-10 leaves alone.
    expect(html).toContain("Chicago, IL · in person");
  });

  it("builds a secondary kind chip from a recognised fair activity", () => {
    // B2-11 / Ruling 14. event.type is one coarse enum value and cannot carry
    // a second, more specific kind — but the activities list sometimes names
    // one in plain prose. "Recruiting fair, day 3" is the plate's own example
    // activity string.
    const html = renderReport(
      baseEvent({ type: "summit", activities: ["Recruiting fair, day 3"] }),
    );
    const header = html.match(
      /<div class="mb-4 flex flex-wrap gap-2">[\s\S]*?<\/div>/,
    )?.[0];

    expect(header).toContain("+ recruiting fair");
    // The "Industry" qualifier has no honest source anywhere in the data
    // model (POLICY — manager decides, per the round-2 loop log) and is not
    // invented here: the primary chip stays exactly what formatEventType
    // produces from the raw enum value.
    expect(header).toContain(">Summit<");
    expect(header).not.toContain("Industry");
  });

  it("omits the secondary kind chip when no activity names a fair", () => {
    const html = renderReport(
      baseEvent({ activities: ["poster session", "keynote"] }),
    );
    const header = html.match(
      /<div class="mb-4 flex flex-wrap gap-2">[\s\S]*?<\/div>/,
    )?.[0];

    expect(header).not.toContain("+ ");
  });

  it("does not restate the primary kind as its own secondary chip", () => {
    // A career-fair event whose activities also say "career fair" would
    // otherwise get "Career Fair · + career fair" — the same fact twice.
    const html = renderReport(
      baseEvent({ type: "career-fair", activities: ["career fair"] }),
    );
    const header = html.match(
      /<div class="mb-4 flex flex-wrap gap-2">[\s\S]*?<\/div>/,
    )?.[0];

    expect(header).not.toContain("+ career fair");
  });

  it("never invents a year for a free-text fee deadline", () => {
    // B-01. Plate 03's DEADLINE column is prose and carries no year. The old
    // formatFeeDeadline handed every string to `new Date()`, whose legacy
    // parser defaults a missing year to 2001 — "Rate held until Feb 6" printed
    // as "Feb 6, 2001", a fabricated fact. Free text now round-trips verbatim;
    // only a whole ISO date is reformatted.
    const html = renderReport(
      baseEvent({
        fees: [
          {
            label: "Hotel block",
            standard: "$210 / night",
            deadline: "Rate held until Feb 6",
          },
          { label: "Abstract", standard: "—", deadline: "Oct 30" },
          { label: "Travel grant", standard: "—", deadline: "Allow 3 weeks" },
          {
            label: "Early bird",
            standard: "$500",
            student: "$250",
            deadline: "2027-04-15",
          },
        ],
      }),
    );

    expect(html).not.toContain("2001");
    expect(html).toContain("Rate held until Feb 6");
    expect(html).toContain(">Oct 30</td>");
    expect(html).toContain("Allow 3 weeks");
    // A whole machine date is still formatted for the reader.
    expect(html).toContain("Apr 15, 2027");
  });

  it("renders Why Peer sent this to you before the locked block", () => {
    // B-03 / §1b Correction 2. Same Tier 0 block as the job report, restored
    // after P10.4 deleted it. §1c puts it after the cost table and before the
    // locked block.
    const html = renderReport(
      baseEvent({
        relevanceReason:
          "Matches 3 required topics and the abstract deadline is 92 days out",
        facetPreferenceReason: "Because you often view battery summits",
      }),
    );

    const why = html.indexOf("Why Peer sent this to you");
    expect(why).toBeGreaterThan(-1);
    expect(html).toContain(
      "Matches 3 required topics and the abstract deadline is 92 days out",
    );
    // B2-08 / Ruling 12. Plate prints ONE sentence, not two paragraphs;
    // facetReason's "Because ..." lower-cases into a trailing clause.
    expect(html).toContain("because you often view battery summits.");
    expect(html).not.toContain("Because you often view battery summits");
    expect(why).toBeLessThan(html.indexOf("Also in this report with an AI key"));
    // B2-07 / Ruling 11. Plate 03 badges this heading TIER 0, same as the job report.
    const whySection = html.match(
      /<section[^>]*data-report-section="why-peer-sent-this"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    expect(whySection).toContain("Tier 0");
  });

  it("hides Why Peer sent this to you when there is no reason to show", () => {
    // B-03. baseEvent leaves relevanceReason empty on purpose.
    expect(renderReport(baseEvent())).not.toContain("Why Peer sent this to you");
  });

  it("keeps Registered and Submitted independent", () => {
    const html = renderReport(baseEvent(), "PhD Year 3", {
      registered: true,
      submitted: false,
    });
    const registeredButton = html.match(
      /<button[^>]*data-completion-control="registered"[^>]*>/,
    )?.[0];
    const submittedButton = html.match(
      /<button[^>]*data-completion-control="submitted"[^>]*>/,
    )?.[0];

    expect(registeredButton).toContain('aria-pressed="true"');
    expect(registeredButton).toContain("bg-done-dim");
    expect(submittedButton).toContain('aria-pressed="false"');
    expect(html).toContain(">Registered<");
    expect(html).toContain(">Submitted<");
  });

  it("moves five judged attendees into cards and leaves the other 25 as plain rows", () => {
    const organisations = Array.from({ length: 30 }, (_, index) => ({
      name: `Battery Organisation ${index + 1}`,
      descriptor: "Exhibitor",
    }));
    const enrichment: EventEnrichment = {
      judgedAttendees: organisations.slice(0, 5).map((item, index) => ({
        name: item.name,
        worthIt: index < 3,
        why: `Judgment ${index + 1}`,
      })),
    };
    const html = renderReport(
      baseEvent({ organisations }),
      "PhD Year 3",
      { registered: false, submitted: false },
      enrichment,
    );

    expect(html.match(/data-roster-row="organisation"/g)).toHaveLength(30);
    expect(html.match(/data-roster-card="true"/g)).toHaveLength(5);
    expect(html.match(/data-roster-plain="true"/g)).toHaveLength(25);
    for (let index = 1; index <= 30; index += 1) {
      expect(html.match(new RegExp(`Battery Organisation ${index}(?!\\d)`, "g"))).toHaveLength(2);
    }
  });

  it("renders the AI sections in order and hides the locked block", () => {
    const html = renderReport(
      baseEvent({
        activities: ["poster session"],
        organisations: [{ name: "Volta Lab", descriptor: "Exhibitor" }],
      }),
      "PhD Year 3",
      { registered: false, submitted: false },
      {
        judgedAttendees: [
          { name: "Volta Lab", worthIt: true, why: "Relevant interface work." },
        ],
        talkSummaries: [
          {
            title: "Interface Stability in Solid-State Cells",
            about: "A focused session on interphase stability.",
          },
        ],
        posterFit: {
          fits: true,
          points: ["The supplied scope overlaps with the current project."],
        },
      },
    );

    // B-14 repointed this anchor: the roster heading is now plate 03's
    // "Who'll be in the room", and the "· N judged" suffix is gone.
    const attendees = html.indexOf("Who’ll be in the room");
    const talks = html.indexOf("What each talk is actually about");
    const poster = html.indexOf("Is your work a fit for the poster call");
    expect(attendees).toBeGreaterThan(-1);
    expect(attendees).toBeLessThan(talks);
    expect(html).toContain("Interface Stability in Solid-State Cells");
    expect(html).toContain("A focused session on interphase stability.");
    // B-04 rewrote this. It asserted P10.3's deletion of the day-by-day plan;
    // §1b Correction 1 reverses that — the plate does show it. The section now
    // renders when the model returns a verified plan, and sits between the
    // talks and the poster fit, matching the locked block's promise order.
    // This fixture returns no plan, so nothing renders here.
    expect(talks).toBeLessThan(poster);
    expect(html).not.toContain("A day-by-day plan for you");
    expect(html).not.toContain("Also in this report with an AI key");
  });

  it("renders the day plan in order, between the talks and the poster fit", () => {
    // B-04 / §1b Correction 1. Plate 03: "Which sessions to attend and who to
    // find, in order." Ordering is the feature, so the rows render exactly as
    // the parser accepted them — no day names anywhere.
    const html = renderReport(
      baseEvent({ organisations: [{ name: "Volta Lab", descriptor: "Exhibitor" }] }),
      "PhD Year 3",
      { registered: false, submitted: false },
      {
        talkSummaries: [
          { title: "Interface Stability", about: "On interphase stability." },
        ],
        plan: [
          { kind: "session", label: "Interface Stability", when: "09:00" },
          { kind: "person", label: "Volta Lab" },
        ],
        posterFit: { fits: true, points: ["Overlaps the current project."] },
      },
    );

    const plan = html.indexOf("A day-by-day plan for you");
    expect(plan).toBeGreaterThan(-1);
    expect(html.indexOf("What each talk is actually about")).toBeLessThan(plan);
    expect(plan).toBeLessThan(html.indexOf("Is your work a fit for the poster call"));
    expect(html.match(/data-plan-entry="session"/g)).toHaveLength(1);
    expect(html.match(/data-plan-entry="person"/g)).toHaveLength(1);
    expect(html).toContain("Person to find");
    expect(html).toContain("Session · 09:00");
    expect(html).not.toMatch(/Day 1|Day 2/);
  });

  it("survives a cached enrichment written before the day plan existed", () => {
    // B-04. The cache holds entries for seven days and is still at v4, so a
    // report must tolerate an entry with no plan field rather than crash —
    // the failure mode the v4 bump was made to fix.
    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      {
        talkSummaries: [
          { title: "Interface Stability", about: "On interphase stability." },
        ],
      },
    );

    expect(html).toContain("Interface Stability");
    expect(html).not.toContain("A day-by-day plan for you");
  });

  it("never sells a key to someone who already has one", () => {
    // P10.9. Three states, three screens. A configured key that produced
    // nothing gets an explanation, never an upgrade pitch — the old behaviour
    // told the reader to connect a key on the exact screen where they were
    // checking whether the key they had was working.
    const withKeyNoResult = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      null,
      true,
      false,
      "read-failed",
    );
    expect(withKeyNoResult).not.toContain("Also in this report with an AI key");
    expect(withKeyNoResult).toContain(
      "Peer could not finish reading the programme page this time.",
    );

    const withoutKey = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      null,
      false,
      false,
      "no-provider",
    );
    expect(withoutKey).toContain("Also in this report with an AI key");
    // The block already says it. Do not say it twice.
    expect(withoutKey).not.toContain("data-page-reading-note");
  });

  it.each([
    [
      "no-quotable-details",
      "Peer read the page but found no talk titles it could quote.",
    ],
    [
      "read-failed",
      "Peer could not finish reading the programme page this time.",
    ],
  ] as const)(
    "renders only the %s programme-reading note",
    (pageReadingReason, sentence) => {
      const html = renderReport(
        baseEvent(),
        "PhD Year 3",
        { registered: false, submitted: false },
        {
          posterFit: {
            fits: true,
            points: ["The supplied scope overlaps."],
          },
        },
        true,
        false,
        pageReadingReason,
      );
      const allSentences = [
        "Peer read the page but found no talk titles it could quote.",
        "Peer could not finish reading the programme page this time.",
      ];

      expect(html.match(/data-page-reading-note="event"/g)).toHaveLength(1);
      expect(html).toContain(sentence);
      for (const other of allSentences.filter((item) => item !== sentence)) {
        expect(html).not.toContain(other);
      }
    },
  );

  it("hides the programme-reading note when a real talk renders", () => {
    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      {
        talkSummaries: [
          {
            title: "Interface Stability in Solid-State Cells",
            about: "A focused session on interphase stability.",
          },
        ],
      },
      false,
      false,
      "read-failed",
    );

    expect(html).toContain("Interface Stability in Solid-State Cells");
    expect(html).not.toContain("data-page-reading-note");
  });

  it("leads poster fit with the verdict and caps cached long reasoning", () => {
    const reasoning = Array.from(
      { length: 180 },
      (_, index) => `reason${index + 1}`,
    ).join(" ");
    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      { posterFit: { fits: true, points: [reasoning, "Second point."] } },
    );

    expect(html).toContain("Overlaps your topics");
    expect(html.indexOf("Overlaps your topics")).toBeLessThan(html.indexOf("reason1"));
    expect(html).toContain("reason60\u2026");
    expect(html).not.toContain("reason61");
  });

  it("does not revive stale cached refusals or generic talk definitions", () => {
    const html = renderReport(
      baseEvent({
        activities: ["tutorial"],
        organisations: [{ name: "Download Brochure" }],
      }),
      "PhD Year 3",
      { registered: false, submitted: false },
      {
        judgedAttendees: [
          {
            name: "Download Brochure",
            worthIt: false,
            why: "This is a navigation link rather than an attendee.",
          },
        ],
        talkSummaries: [
          { title: "tutorial", about: "A guided learning experience." },
        ],
      },
      true,
      false,
      "read-failed",
    );

    expect(html).not.toContain("navigation link rather than an attendee");
    expect(html).not.toMatch(
      /<h2[^>]*>What each talk is actually about<\/h2>/,
    );
    expect(html).not.toContain("A guided learning experience");
    expect(html).not.toContain("Download Brochure");
    // P10.9: a configured key that produced nothing gets the explanation, not
    // an upgrade pitch.
    expect(html).not.toContain("Also in this report with an AI key");
    expect(html.match(/data-page-reading-note="event"/g)).toHaveLength(1);
  });

  it("cleans a stale cached measured description before rendering", () => {
    const html = renderReport(
      baseEvent({
        shortDescription:
          "than a quarter of a century. It will review the criteria necessary to achieve such extended life in commercially manufactured Li-ion cells. [...] This work presents an in situ diagnosis system of large capacity lithium-ion battery based on a sponge-type battery swelling sensor, w",
      }),
    );

    expect(html).toContain("It will review");
    expect(html).not.toContain("than a quarter of a century");
    expect(html).not.toContain("[...]");
    expect(html).not.toMatch(/sensor, w/);
  });

  it("uses the condensed description when enrichment provides one", () => {
    const html = renderReport(
      baseEvent({
        shortDescription:
          "The source repeats a long marketing introduction. A second source sentence follows.",
      }),
      "PhD Year 3",
      { registered: false, submitted: false },
      {
        condensedDescription:
          "Researchers present interface results. Workshops compare cell-design methods.",
      },
    );

    expect(html).toContain("Researchers present interface results.");
    expect(html).toContain("Workshops compare cell-design methods.");
    expect(html).not.toContain("long marketing introduction");
  });
});

describe("stale cached enrichment shapes", () => {
  // A seven-day cache means a shape change ships alongside entries written by
  // the previous shape. posterFit.reasoning became posterFit.points[], and the
  // old entry had no `points` — the report crashed on `.map` and the reader got
  // "This view hit a snag." The cache key is bumped, but the render must not
  // trust the shape it is handed either.
  it("renders instead of crashing when posterFit has no points", () => {
    const legacy = {
      posterFit: { fits: true, reasoning: "Written by the previous shape." },
    } as unknown as EventEnrichment;

    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      legacy,
      true,
    );

    expect(html).toContain("Battery Interfaces Summit");
    expect(html).not.toContain("Is your work a fit for the poster call");
  });

  it("survives an empty points array", () => {
    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      { posterFit: { fits: true, points: [] } },
      true,
    );
    expect(html).toContain("Battery Interfaces Summit");
    expect(html).not.toContain("Is your work a fit for the poster call");
  });

  it("shows a reading indicator while the model is still working", () => {
    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      null,
      true,
      false,
      undefined,
      true,
    );
    expect(html).toContain('data-enrichment-loading="event"');
    expect(html).toContain("Peer is reading the programme page");
    // The explanation line must not race the spinner.
    expect(html).not.toContain("data-page-reading-note");
  });
});
