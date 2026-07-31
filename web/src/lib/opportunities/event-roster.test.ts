import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractEventRoster } from "./event-roster";

const structuredFixture = readFileSync(
  new URL("./__fixtures__/structured-event-roster.html", import.meta.url),
  "utf8",
);
const proseFixture = readFileSync(
  new URL("./__fixtures__/prose-event-roster.html", import.meta.url),
  "utf8",
);
const aabcPageFurnitureFixture = readFileSync(
  new URL(
    "./__fixtures__/aabc-roster-page-furniture.html",
    import.meta.url,
  ),
  "utf8",
);

describe("extractEventRoster", () => {
  it("returns every structured organisation and full speaker triple", () => {
    expect(extractEventRoster(structuredFixture)).toEqual({
      organisations: [
        {
          name: "QuantumScape",
          descriptor: "Platinum sponsor",
          atEvent: "Booth 214",
        },
        {
          name: "Solid Power",
          descriptor: "Exhibitor",
          atEvent: "Booth 118",
        },
      ],
      people: [
        {
          name: "Dr. Maya Chen",
          role: "Chief Scientist",
          institution: "Argonne National Laboratory",
          speaking: "Interfaces for durable solid-state cells",
        },
        {
          name: "Prof. Luis García",
          role: "Professor of Materials Science",
          institution: "Universidad de Sevilla",
          speaking: "Operando views of lithium transport",
        },
        {
          name: "Aisha Khan",
          role: "Research Director",
          institution: "Volta Institute",
          speaking: "Scaling sulfide electrolyte production",
        },
      ],
    });
  });

  it("returns every prose-listed speaker without inventing titles", () => {
    expect(extractEventRoster(proseFixture)).toEqual({
      people: [
        { name: "Ada Lovelace" },
        { name: "Grace Hopper" },
        { name: "Fei-Fei Li" },
      ],
    });
  });

  it("does not truncate a long organisation roster", () => {
    const cards = Array.from(
      { length: 36 },
      (_, index) => `
        <article class="sponsor-card">
          <h3 class="sponsor-name">Research Partner ${index + 1}</h3>
        </article>
      `,
    ).join("");
    const organisations = extractEventRoster(
      `<h2>Sponsors</h2>${cards}`,
    ).organisations;

    expect(organisations).toHaveLength(36);
    expect(organisations?.at(-1)).toEqual({ name: "Research Partner 36" });
  });

  it("rejects calls to action and unrelated programme prose", () => {
    expect(
      extractEventRoster(`
        <h2>Sponsorship opportunities</h2>
        <a href="/prospectus">Become a sponsor</a>
        <h2>Programme</h2>
        <p>09:00 — Room 4 — Battery degradation panel data tutorial.</p>
        <h2>Organising committee</h2>
        <p><strong>Committee enquiries</strong></p>
      `),
    ).toEqual({});
  });

  it("drops conference navigation, footer, aside, and stop-list furniture", () => {
    const roster = extractEventRoster(aabcPageFurnitureFixture);
    const names = [
      ...(roster.organisations ?? []).map(({ name }) => name),
      ...(roster.people ?? []).map(({ name }) => name),
    ];

    expect(roster).toEqual({
      organisations: [
        { name: "Battery Power Online" },
        { name: "Lithium Battery Power" },
        { name: "Battery Safety" },
      ],
    });
    for (const furniture of [
      "Download Brochure",
      "Companies A-K",
      "Executive Team",
      "Mailing List",
      "Request Information",
      "Privacy Policy",
      "Contact Us",
      "Terms",
      "Sitemap",
    ]) {
      expect(names).not.toContain(furniture);
    }
  });

  it("returns an empty object for malformed or unrelated pages", () => {
    expect(extractEventRoster("")).toEqual({});
    expect(extractEventRoster("<h1>About the conference")).toEqual({});
  });
});
