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

  it.each([
    ["plenary", "The plenary opens the scientific programme."],
    ["awards ceremony", "The awards ceremony closes the final day."],
    ["competition", "The programme includes a competition session for students."],
    ["short course", "A short course runs before the main programme."],
    ["demo session", "Live demos are scheduled after lunch."],
    ["doctoral consortium", "The doctoral consortium meets on Monday."],
    ["banquet", "The conference banquet begins at 19:00."],
    ["social event", "A social event welcomes first-time attendees."],
    ["lightning talk", "Lightning talks introduce emerging projects."],
    ["field trip", "Field trips depart from the venue on Friday."],
    ["school", "A summer school precedes the conference."],
    ["town hall", "The community town hall is open to all attendees."],
    ["meet the expert", "A meet the expert session follows the plenary."],
    ["hands-on session", "The hands-on session uses the teaching lab."],
  ])("detects the researched %s type", (label, sentence) => {
    expect(extractEventDetails(`<p>${sentence}</p>`).activities).toContain(label);
  });

  it.each([
    ["banquet", "The gala dinner begins at 19:00."],
    ["lightning talk", "Flash talks introduce emerging projects."],
    ["lightning talk", "Short talks introduce emerging projects."],
    ["field trip", "The programme includes an afternoon excursion."],
    ["field trip", "A technical tour visits the laboratory."],
    ["school", "A winter school precedes the conference."],
    ["school", "A methods school precedes the conference."],
    ["school", "A doctoral school precedes the conference."],
    ["town hall", "The community townhall is open to all attendees."],
  ])("folds researched wording into the %s tag", (label, sentence) => {
    expect(extractEventDetails(`<p>${sentence}</p>`).activities).toContain(label);
  });

  it("requires programme context for the three mis-firing existing labels", () => {
    expect(
      extractEventDetails(`
        <h1>International Symposium on Photovoltaic Networking Protocols</h1>
        <p>Research covers wireless networking, network-on-chip design, solar panels,
        panel data, control panels, and flat-panel displays.</p>
      `).activities,
    ).toBeUndefined();

    expect(
      extractEventDetails(`
        <h2>Panels</h2>
        <p>An expert panel leads a panel discussion before the networking reception.</p>
        <p>The programme includes two symposia.</p>
      `).activities,
    ).toEqual(["panel", "networking", "symposium"]);
  });

  it("rejects every false-positive phrase from the vocabulary study", () => {
    expect(
      extractEventDetails(`
        <h1>Keystone Symposia: International Symposium on Materials</h1>
        <p>RF mixer, static mixer, concrete mixer.</p>
        <p>Networking protocols, wireless networking, network-on-chip.</p>
        <p>Solar panel, panel data, control panel, flat-panel display.</p>
        <p>The sample exhibits high conductivity.</p>
        <p>A tutorial paper, a tutorial review, and a website help-page tutorial.</p>
        <p>School of Engineering, graduate school, high school.</p>
        <p>Challenges in energy storage, grand challenges, the key challenge is scale.</p>
        <p>Award-winning, grant award, NSF award number, supported by award funding.</p>
        <p>Signal reception and reception studies.</p>
        <p>Social sciences, social media, social determinants.</p>
        <p>We demonstrate a novel method in the course of the reaction; of course,
        it also applies to a watercourse.</p>
        <p>Magnetic field, field theory, field-effect transistor, in the field of optics.</p>
        <p>Tour de force, detour, contour.</p>
        <p>Lightning strike, lightning detection.</p>
        <p>Flash memory, flash sintering, flash point, flash chromatography.</p>
        <p>The ENCODE Consortium and consortium partners.</p>
        <p>Temperature excursion and pH excursion.</p>
        <p>Hands-on experience and a seminar series.</p>
      `).activities,
    ).toBeUndefined();
  });

  it("does not emit mixer even for a programme mixer", () => {
    expect(
      extractEventDetails("<p>The conference mixer starts after the final session.</p>")
        .activities,
    ).toBeUndefined();
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

  // B4-10 (round 4). expectedSize (the SCALE tile) was declared on the
  // type with no producer anywhere -- genuinely never attempted, confirmed
  // by grep before writing this. Three independent phrasings.
  describe("expected attendance (SCALE tile)", () => {
    it("reads a labelled expected-attendance figure", () => {
      expect(
        extractEventDetails("<p>Expected attendance: 2,400 professionals.</p>")
          .expectedSize,
      ).toBe(2400);
    });

    it("reads a bare count next to the word itself", () => {
      expect(
        extractEventDetails("<p>Over 1,800 attendees are expected this year.</p>")
          .expectedSize,
      ).toBe(1800);
    });

    it("reads a past edition's own figure", () => {
      // Phrased so only the history pattern can fire (no digit immediately
      // adjacent to "attendees/participants/delegates/registrants"), rather
      // than incidentally also matching the bare-count pattern above.
      expect(
        extractEventDetails(
          "<p>The previous edition drew a crowd of 950 people from around the world.</p>",
        ).expectedSize,
      ).toBe(950);
    });

    it("stays absent when the page states no figure at all", () => {
      expect(
        extractEventDetails(
          "<p>Registered attendees may request an invitation letter.</p>",
        ).expectedSize,
      ).toBeUndefined();
    });
  });
});
