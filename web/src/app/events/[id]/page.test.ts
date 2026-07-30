import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
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
): string {
  return renderToStaticMarkup(
    createElement(EventReport, {
      event,
      careerStage,
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
});
