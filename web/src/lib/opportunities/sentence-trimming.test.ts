import { describe, expect, it } from "vitest";
import { parseEventEnrichment } from "@/lib/opportunities/enrichment";
import type { Event } from "@/types";

// Guards P10.1. The condensed description is capped at two
// sentences by scanning for a full stop followed by whitespace. Abbreviations
// and initials contain exactly that, so this checks the cap cannot end the
// text on a dangling "Dr." / "e.g." / "L." — which is the mid-sentence cut the
// task was written to eliminate.

const EVENT = {
  id: "eventweb:probe10",
  source: "eventweb",
  name: "Probe Symposium",
  type: "conference",
  date: "2026-09-09",
  location: "Chicago, IL",
  isOnline: false,
  shortDescription: "A symposium.",
  relevanceReason: "Matches the declared topic.",
} as Event;

function condensed(text: string): string | undefined {
  return parseEventEnrichment(
    JSON.stringify({ condensedDescription: text }),
    EVENT,
    "page text",
    [],
  )?.condensedDescription;
}

describe("sentence trimming — two-sentence cap on clean prose", () => {
  it("caps three clean sentences at two", () => {
    expect(condensed("First one here. Second one here. Third one here.")).toBe(
      "First one here. Second one here.",
    );
  });

  it("leaves a single sentence alone", () => {
    expect(condensed("Only one sentence here.")).toBe("Only one sentence here.");
  });
});

describe("sentence trimming — abbreviations must not be treated as sentence ends", () => {
  const CASES: Array<[string, string]> = [
    [
      "author initials",
      "Organised by Y. Nakamura and L. Ferreira of the battery group. Four tracks run in parallel. The exhibition opens on day one.",
    ],
    [
      "title",
      "Dr. Chen opens the meeting on molten salts. The programme runs three parallel tracks. A poster session closes day two.",
    ],
    [
      "country abbreviation",
      "The symposium is held in the U.S. and streamed worldwide. Registration opens in March. Fees rise after the early deadline.",
    ],
    [
      "latin abbreviation",
      "Contributions on electrolytes, e.g. sulfide and oxide systems, are welcome. Abstracts are due in October. Travel grants exist.",
    ],
  ];

  for (const [name, text] of CASES) {
    it(`[${name}] never ends on a dangling abbreviation`, () => {
      const out = condensed(text) ?? "";
      expect(out.length).toBeGreaterThan(0);
      // The failure this catches: output ending "… and L." or "… e.g."
      expect(out).not.toMatch(/(?:^|\s)(?:[A-Z]|Dr|Mr|Prof|e\.g|i\.e|U\.S)\.$/);
    });
  }
});
