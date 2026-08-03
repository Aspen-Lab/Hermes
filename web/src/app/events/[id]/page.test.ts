import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import type {
  EventEnrichment,
  OpportunityPageReadingReason,
} from "@/lib/opportunities/enrichment";
import { EventReport } from "./page";

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
    expect(html).not.toContain("+29");
    expect(html).not.toMatch(/show more|collapsed/i);
    const layout = html.match(
      /<div[^>]*data-roster-layout="full-width"[^>]*>/,
    )?.[0];
    expect(layout).toContain("w-full space-y-10");
    expect(layout).not.toContain("grid-cols-2");
    expect(html).toContain("Organisations at the event");
    expect(html).not.toContain("attendees");
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

    expect(html.match(/Cheapest way in, for you/g)).toHaveLength(2);
    expect(html).toContain("$250 student rate · Early bird · by Apr 15, 2027");
    for (const header of ["Item", "Standard", "Student", "Deadline"]) {
      expect(html).toContain(`>${header}</th>`);
    }
    expect(html).toContain("Online · $150");
    expect(html.indexOf("Cheapest way in, for you")).toBeLessThan(
      html.indexOf("Submit by"),
    );
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

    const attendees = html.indexOf("Organisations at the event · 1 judged");
    const talks = html.indexOf("What each talk is actually about");
    const poster = html.indexOf("Is your work a fit for the poster call");
    expect(attendees).toBeGreaterThan(-1);
    expect(attendees).toBeLessThan(talks);
    expect(html).toContain("Interface Stability in Solid-State Cells");
    expect(html).toContain("A focused session on interphase stability.");
    // P10.3 deleted the day-by-day plan.
    expect(talks).toBeLessThan(poster);
    expect(html).not.toContain("A day-by-day plan");
    expect(html).not.toContain("Also in this report with an AI key");
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
