import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractEventDetails } from "./event-details";

const icmlFixture = readFileSync(
  new URL("./__fixtures__/icml-event-details.html", import.meta.url),
  "utf8",
);

describe("extractEventDetails", () => {
  it("extracts the ICML-shaped attendance details without using its submission deadline", () => {
    expect(extractEventDetails(icmlFixture)).toEqual({
      registrationDeadline: "2027-06-15",
      activities: [
        "tutorial",
        "workshop",
        "poster session",
        "keynote",
        "networking",
      ],
      travelGrant:
        "Student travel grants support attendees who would otherwise be unable to participate.",
      invitationLetter: true,
    });
  });

  it("extracts fee tiers and normalizes the early-bird cutoff", () => {
    const html = `
      <table>
        <tr>
          <th>Registration type</th><th>Standard</th><th>Student</th>
          <th>Online</th><th>Deadline</th>
        </tr>
        <tr>
          <td>Early bird</td><td>$500</td><td>$250</td>
          <td>$150</td><td>15 April 2027</td>
        </tr>
        <tr>
          <td>Regular</td><td>$650</td><td>$325</td>
          <td>$225</td><td></td>
        </tr>
      </table>
    `;

    expect(extractEventDetails(html).fees).toEqual([
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
    ]);
  });

  it("keeps an explicit refusal distinct from no invitation-letter statement", () => {
    expect(
      extractEventDetails(
        "<p>The organisers cannot provide invitation letters for visa applications.</p>",
      ),
    ).toEqual({ invitationLetter: false });
    expect(extractEventDetails("<p>Hotel rooms are available nearby.</p>")).toEqual(
      {},
    );
  });

  it("deduplicates the fixed vocabulary and rejects nearby lookalikes", () => {
    expect(
      extractEventDetails(`
        <p>Workshops, a workshop, an exhibition, and an industry panel session.</p>
        <p>Exhibitor applications are open. A frequency mixer circuit is discussed.</p>
      `).activities,
    ).toEqual(["workshop", "exhibition", "panel"]);
  });

  it("normalizes a yearless registration date relative to the supplied date", () => {
    expect(
      extractEventDetails(
        "<p>Last day to register: September 12.</p>",
        new Date("2026-10-01T00:00:00Z"),
      ).registrationDeadline,
    ).toBe("2027-09-12");
  });

  it("returns an empty object for empty or unrelated pages", () => {
    expect(extractEventDetails("")).toEqual({});
    expect(extractEventDetails("<html><body><p>Welcome.</p>")).toEqual({});
  });
});
