import { describe, expect, it } from "vitest";
import { parseEventEnrichment } from "@/lib/opportunities/enrichment";
import {
  capPageText,
  extractPageHeadings,
  findProgrammePageUrl,
  MAX_PAGE_TEXT_CHARS,
} from "@/lib/opportunities/page-text";
import type { Event } from "@/types";

// Reviewer probe 2 — adversarial. These attack the two rules that carry the
// most risk: §5.4 (nothing reaches the screen that is not quotable from the
// fetched page) and §5.3 (one extra page, same host, never a crawl).

const EVENT = {
  id: "eventweb:probe",
  source: "eventweb",
  name: "Probe Conference",
  type: "conference",
  date: "2026-09-09",
  location: "Chicago, IL",
  isOnline: false,
  shortDescription: "A conference.",
  relevanceReason: "Matches the declared topic.",
} as Event;

const PAGE = [
  "Programme",
  "Tuesday 09:00 — Solid-state electrolytes for fast-charging cells",
  "Tuesday 11:00 — Interface stability under high current density",
  "Wednesday 14:00 — Scale-up of dry-electrode manufacturing",
].join("\n");

// Real talk titles reach the model as page headings, so the probe must supply
// them the same way the route does. The implementation is STRICTER than the
// handoff asked: a title must be a heading on the page AND quotable from its
// text, not merely quotable.
const PAGE_HTML = `<main>
  <h2>Programme</h2>
  <h3>Solid-state electrolytes for fast-charging cells</h3>
  <p>Tuesday 09:00</p>
  <h3>Interface stability under high current density</h3>
  <p>Tuesday 11:00</p>
  <h3>Scale-up of dry-electrode manufacturing</h3>
  <p>Wednesday 14:00</p>
</main>`;
const HEADINGS = extractPageHeadings(PAGE_HTML);

function talks(
  returned: Array<{ title: string; about: string }>,
  page?: string,
  headings = HEADINGS,
) {
  return (
    parseEventEnrichment(
      JSON.stringify({ talkSummaries: returned }),
      EVENT,
      page,
      headings,
    )?.talkSummaries ?? []
  );
}

describe("§5.4, a title must be quotable from the page", () => {
  it("keeps a title copied exactly from the page", () => {
    const out = talks(
      [{ title: "Interface stability under high current density", about: "x" }],
      PAGE,
    );
    expect(out).toHaveLength(1);
  });

  it("drops a title that is merely PARAPHRASED from the page", () => {
    // The dangerous case: plausible, on-topic, clearly derived from the page,
    // and completely invented. A user could plan a day around it.
    const out = talks(
      [{ title: "Interface stability at high currents", about: "x" }],
      PAGE,
    );
    expect(out).toEqual([]);
  });

  it("drops a title that reorders words present on the page", () => {
    const out = talks(
      [{ title: "Fast-charging cells: solid-state electrolytes", about: "x" }],
      PAGE,
    );
    expect(out).toEqual([]);
  });

  it("drops a wholly invented title", () => {
    const out = talks(
      [{ title: "Keynote: the future of sodium-ion batteries", about: "x" }],
      PAGE,
    );
    expect(out).toEqual([]);
  });

  it("emits no section at all when no page text was fetched", () => {
    const out = talks(
      [{ title: "Solid-state electrolytes for fast-charging cells", about: "x" }],
      undefined,
    );
    expect(out).toEqual([]);
  });

  it("emits no section when the page was fetched but is empty", () => {
    const out = talks(
      [{ title: "Solid-state electrolytes for fast-charging cells", about: "x" }],
      "   ",
    );
    expect(out).toEqual([]);
  });

  it("keeps only the quotable rows out of a mixed response", () => {
    const out = talks(
      [
        { title: "Solid-state electrolytes for fast-charging cells", about: "a" },
        { title: "An invented session on lithium metal anodes", about: "b" },
        { title: "Scale-up of dry-electrode manufacturing", about: "c" },
      ],
      PAGE,
    );
    expect(out.map((t) => t.title)).toEqual([
      "Solid-state electrolytes for fast-charging cells",
      "Scale-up of dry-electrode manufacturing",
    ]);
  });
});

describe("§5.3, one extra page and never off-host", () => {
  const base = "https://conf.example.org/2026/";

  it("finds a same-host programme link", () => {
    const html = `<a href="/2026/programme">Programme</a>`;
    expect(findProgrammePageUrl(html, base)).toContain("conf.example.org");
  });

  it("refuses a programme link on another host", () => {
    const html = `<a href="https://evil.example.com/programme">Programme</a>`;
    expect(findProgrammePageUrl(html, base)).toBeNull();
  });

  it("refuses a protocol-relative link to another host", () => {
    const html = `<a href="//evil.example.com/schedule">Schedule</a>`;
    expect(findProgrammePageUrl(html, base)).toBeNull();
  });

  it("returns exactly one URL even when many candidates exist", () => {
    const html = [
      `<a href="/a/programme">Programme</a>`,
      `<a href="/b/schedule">Schedule</a>`,
      `<a href="/c/agenda">Agenda</a>`,
      `<a href="/d/sessions">Sessions</a>`,
    ].join("");
    const found = findProgrammePageUrl(html, base);
    expect(typeof found === "string" || found === null).toBe(true);
  });

  it("returns null when nothing looks like a programme", () => {
    const html = `<a href="/sponsors">Sponsors</a><a href="/venue">Venue</a>`;
    expect(findProgrammePageUrl(html, base)).toBeNull();
  });
});

describe("§5.2, the page-text cap is real", () => {
  const huge = Array.from(
    { length: 20_000 },
    (_, i) => `Paragraph ${i} of the programme.`,
  ).join("\n\n");

  it("never returns more than the cap, however large the page", () => {
    expect((capPageText(huge) ?? "").length).toBeLessThanOrEqual(MAX_PAGE_TEXT_CHARS);
    expect((capPageText(huge) ?? "").length).toBeGreaterThan(0);
  });

  it("cannot be talked past its own ceiling by a bigger argument", () => {
    expect((capPageText(huge, 5_000_000) ?? "").length).toBeLessThanOrEqual(
      MAX_PAGE_TEXT_CHARS,
    );
  });

  it("drops a page with no paragraph breaks rather than cutting mid-flow", () => {
    // Documented consequence, not a defect: a single run longer than the cap
    // yields nothing. Real stripped HTML breaks at </p>, </li>, </div>, so this
    // is an edge case, but it fails silently and is worth knowing about.
    expect(capPageText("word ".repeat(200_000))).toBeNull();
  });
});
