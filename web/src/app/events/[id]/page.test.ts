import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import type { EventEnrichment } from "@/lib/opportunities/enrichment";
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
): string {
  return renderToStaticMarkup(
    createElement(EventReport, {
      event,
      careerStage,
      enrichment,
      providerConfigured,
      isSaved: false,
      isRegistered: completion.registered,
      isSubmitted: completion.submitted,
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

  it("renders all four AI sections in order and hides the locked block", () => {
    const html = renderReport(
      baseEvent({
        activities: ["Interface stability session"],
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
            title: "Interface stability session",
            about: "A focused session on interphase stability.",
          },
        ],
        dayPlan: [
          { day: "Day 1", items: ["Attend the interface stability session."] },
        ],
        posterFit: {
          fits: true,
          reasoning: "The supplied scope overlaps with the current project.",
        },
      },
    );

    const attendees = html.indexOf("The other 1 attendees, judged");
    const talks = html.indexOf("What each talk is actually about");
    const plan = html.indexOf("A day-by-day plan");
    const poster = html.indexOf("Is your work a fit for the poster call");
    expect(attendees).toBeGreaterThan(-1);
    expect(attendees).toBeLessThan(talks);
    expect(talks).toBeLessThan(plan);
    expect(plan).toBeLessThan(poster);
    expect(html).not.toContain("Also in this report with an AI key");
  });

  it("keeps the locked block when provider availability produced no enrichment", () => {
    const html = renderReport(
      baseEvent(),
      "PhD Year 3",
      { registered: false, submitted: false },
      null,
      true,
    );

    expect(html).toContain("Also in this report with an AI key");
  });
});
