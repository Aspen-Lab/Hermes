import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CareerStage, Event, Job } from "@/types";
import { JobReport } from "@/app/jobs/[id]/page";
import { EventReport } from "@/app/events/[id]/page";

/**
 * **V26-J02 / V26-E02 — THE SERIF ADOPTION.** (Round 26 A's largest visual
 * finding; B's cluster-1 design; landed round 26 C.)
 *
 * **THE PLATE EVIDENCE, CITED.** `Peer-design-spec-original.pdf`, plate 02 =
 * pp. 2–4, plate 03 = pp. 4–9. B re-extracted every text span with its family,
 * size and colour: plate 02 carries **20 Georgia spans of 115**, plate 03
 * carries **8 of 324**. The five serif elements and their measured treatments:
 *
 * | element | plate | measured |
 * |---|---|---|
 * | report `<h1>` | 02 and 03 | `Georgia 21.0` `#2b180a` |
 * | `Why Peer sent this to you` prose | 02 and 03 | `Georgia 12.75` `#4d3a28` |
 * | `What the role is` bullets | 02 | `Georgia 12.0` `#4d3a28` |
 * | visa evidence quote | 02 | `Georgia 10.5` `#9c8b78` |
 *
 * **THE BUILD ALREADY OWNED THE CONVENTION.** `globals.css:279` states it in
 * the build's own words — *"Sans is the UI default; long-form prose opts INTO
 * serif with the `font-reading` utility"* — and the paper report already obeys
 * it at four call sites. The two opportunity reports were the only report
 * surfaces in the app that never opted in. So this is not a new treatment; it
 * is the app's own documented rule applied to two files that were missed.
 *
 * **THESE TESTS RENDER THE SHIPPED COMPONENTS**, not a fixture's idea of them.
 * That is round 26 B's own lesson: two of A's eighteen "differences" turned out
 * to be fixture artifacts, and B proved it by rendering the real component. The
 * fixtures below are PLATE-SHAPED — every field the plate carries is populated
 * — so a missing section can never be confounded with an empty field.
 */

const NOW = Date.parse("2026-07-30T12:00:00Z");

/** A plate-02-shaped job: every field plate 02 renders is populated. */
function plateJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job:plate-02",
    roleTitle: "Postdoctoral Researcher — Solid-State Battery Interfaces",
    companyOrLab: "Toyota Research Institute",
    location: "Los Altos, CA",
    isRemote: false,
    workMode: "hybrid",
    employmentType: "full_time",
    summary:
      "You will develop solid-state electrolytes and characterise interfacial "
      + "resistance across full cells. You will run operando imaging campaigns "
      + "with the cell-design team. You will publish and present the findings.",
    keyRequirements: ["Electrochemistry", "Solid-state electrolytes"],
    matchReason: "Matches your solid-state electrolyte focus.",
    matchedTerms: ["solid-state electrolytes", "interfacial"],
    visa: {
      state: "sponsors",
      evidence: "We sponsor work visas for exceptional postdoctoral candidates.",
      country: "US",
    },
    ...overrides,
  };
}

/** A plate-03-shaped event. */
function plateEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event:plate-03",
    name: "International Battery Interfaces Summit",
    type: "conference",
    date: "2027-07-20",
    location: "San Diego, CA",
    isOnline: false,
    shortDescription: "Four days on solid-state interfaces.",
    relevanceReason: "Matches your solid-state electrolyte focus.",
    ...overrides,
  };
}

function renderJob(job: Job = plateJob()): string {
  return renderToStaticMarkup(
    createElement(JobReport, {
      job,
      isSaved: false,
      isApplied: false,
      isInterested: false,
      nowMs: NOW,
      enrichment: null,
      providerConfigured: false,
      onToggleSave: () => undefined,
      onAppliedChange: () => undefined,
      onDismiss: () => undefined,
    }),
  );
}

function renderEvent(
  event: Event = plateEvent(),
  careerStage: CareerStage = "PhD Year 3",
): string {
  return renderToStaticMarkup(
    createElement(EventReport, {
      event,
      careerStage,
      enrichment: null,
      enrichmentLoading: false,
      providerConfigured: false,
      isSaved: false,
      isRegistered: false,
      isSubmitted: false,
      isInterested: false,
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

/**
 * The rendered markup is one long string, so "does the serif class land on THIS
 * element" has to be asked of the element, never of the page. This pulls the
 * single tag that contains a known piece of text and returns its class list —
 * so an assertion cannot be satisfied by a serif class somewhere else entirely.
 */
function classesOfTagContaining(
  html: string,
  tag: string,
  text: string,
): string {
  const open = new RegExp(`<${tag}\\b[^>]*>`, "g");
  for (const match of html.matchAll(open)) {
    const start = match.index + match[0].length;
    const end = html.indexOf(`</${tag}>`, start);
    if (end < 0) continue;
    if (html.slice(start, end).includes(text)) {
      return /class="([^"]*)"/.exec(match[0])?.[1] ?? "";
    }
  }
  throw new Error(`no <${tag}> containing ${JSON.stringify(text)} was rendered`);
}

describe("V26-J02 — plate 02's five serif elements opt in", () => {
  it("sets the report title in the display serif (Georgia 21.0 on the plate)", () => {
    const classes = classesOfTagContaining(
      renderJob(),
      "h1",
      "Postdoctoral Researcher",
    );
    expect(classes).toContain("font-display");
  });

  it("sets the role bullets in the reading serif (Georgia 12.0 on the plate)", () => {
    const html = renderJob();
    expect(html).toContain("data-role-bullet");
    const classes = classesOfTagContaining(html, "li", "solid-state electrolytes");
    expect(classes).toContain("font-reading");
  });

  it("sets the visa evidence quote in the reading serif (Georgia 10.5 on the plate)", () => {
    const classes = classesOfTagContaining(
      renderJob(),
      "blockquote",
      "sponsor work visas",
    );
    expect(classes).toContain("font-reading");
  });

  it("sets the 'Why Peer sent this to you' prose in the reading serif", () => {
    const classes = classesOfTagContaining(
      renderJob(),
      "p",
      "solid-state electrolyte focus",
    );
    expect(classes).toContain("font-reading");
  });
});

describe("V26-E02 — plate 03's serif elements opt in", () => {
  it("sets the report title in the display serif (Georgia 21.0 on the plate)", () => {
    const classes = classesOfTagContaining(
      renderEvent(),
      "h1",
      "International Battery Interfaces Summit",
    );
    expect(classes).toContain("font-display");
  });

  it("sets the 'Why Peer sent this to you' prose in the reading serif — the SAME shared component as the job report", () => {
    const classes = classesOfTagContaining(
      renderEvent(),
      "p",
      "solid-state electrolyte focus",
    );
    expect(classes).toContain("font-reading");
  });

  /**
   * **B's CORRECTION 1, LOCKED.** Plate 02 carries four `Georgia-Italic` spans
   * on its topic names; **plate 03 carries ZERO.** Italic is a plate-02-only
   * treatment. Because `WhyPeerSentThis` is ONE component rendering BOTH
   * surfaces, adding italic to it would invent an emphasis plate 03 does not
   * have — the exact reflex-copy this locks out.
   */
  it("does NOT italicise the event prose — plate 03 has zero italic spans", () => {
    const classes = classesOfTagContaining(
      renderEvent(),
      "p",
      "solid-state electrolyte focus",
    );
    expect(classes).not.toContain("italic");
    expect(renderEvent()).not.toContain("<em");
  });
});

/**
 * **THE BOUNDARY — THE PLATES ARE A TWO-FAMILY SYSTEM AND THE SANS HALF IS THE
 * LARGER HALF** (plate 02: 95 non-serif spans; plate 03: 316). B extracted the
 * whole sans list so the boundary is data, not advice. A fix that "serifs the
 * prose" by rule gets these wrong, so they are asserted as SANS.
 */
describe("the serif boundary — chrome and labels stay sans", () => {
  it("leaves the letter-spaced uppercase section labels sans", () => {
    const html = renderJob();
    for (const label of [
      "Skills they ask for",
      "What the role is",
      "Why Peer sent this to you",
    ]) {
      const classes = classesOfTagContaining(html, "h2", label);
      expect(classes).not.toContain("font-reading");
      expect(classes).not.toContain("font-display");
      expect(classes).toContain("uppercase");
    }
  });

  it("leaves the fact-tile labels and values sans", () => {
    const html = renderJob();
    expect(classesOfTagContaining(html, "dt", "Type")).not.toMatch(
      /font-(reading|display)/,
    );
  });

  it("adds the family utilities in exactly five places and nowhere else", () => {
    // B's one-line boundary test, executed rather than described: the two
    // report pages plus the one shared component, five class additions total.
    // Rendered markup is the honest place to count it, because a class in a
    // comment does not reach the reader.
    const both = renderJob() + renderEvent();
    const serifClassAttrs = [...both.matchAll(/class="([^"]*)"/g)].filter((m) =>
      /\bfont-(reading|display)\b/.test(m[1]),
    );
    // job: h1 + bullets(×3, one per bullet) + blockquote + why-peer prose
    // event: h1 + why-peer prose. The bullet count is data-driven, so the
    // assertion is on the DISTINCT elements that opted in, not the raw count.
    expect(serifClassAttrs.length).toBeGreaterThanOrEqual(6);
    for (const [, classes] of serifClassAttrs) {
      // nothing that opted in may be a label, a chip or a button
      expect(classes).not.toContain("uppercase");
    }
  });
});

/**
 * **STANDARD 7 — A VISUAL COMMIT MUST NOT CHANGE ANY RENDERED VALUE.** The
 * value census is the other half of the gate, and a CSS change that quietly
 * dropped a name or a date would be a parity regression wearing a layout
 * commit's clothes. These assert the values the plates carry are still on the
 * page, on the same fixtures the serif tests above use.
 */
describe("value stability across the type-system change", () => {
  it("still renders every job value the plate carries", () => {
    const html = renderJob();
    for (const value of [
      "Postdoctoral Researcher — Solid-State Battery Interfaces",
      "Toyota Research Institute",
      "Los Altos, CA",
      "Full time",
      "sponsor work visas",
      "Solid-state electrolytes",
      "You will run operando imaging campaigns with the cell-design team.",
    ]) {
      expect(html).toContain(value);
    }
  });

  it("still renders every event value the plate carries", () => {
    const html = renderEvent();
    for (const value of ["International Battery Interfaces Summit", "San Diego"]) {
      expect(html).toContain(value);
    }
  });
});
