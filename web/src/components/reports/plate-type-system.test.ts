import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CareerStage, Event, Job } from "@/types";
import { JobReport } from "@/app/jobs/[id]/page";
import { EventReport } from "@/app/events/[id]/page";
import { ReportFactTile } from "@/components/reports/fact-tile";

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

/**
 * **V26-E01 — THE HEADING HIERARCHY INVERSION.** (Plate 03 = pp. 4–9.)
 *
 * A reported the hierarchy as FLATTENED. B measured it as **INVERTED**, which is
 * worse and changes the fix from one patch to two moves:
 *
 * | plate level | plate treatment | member | build BEFORE |
 * |---|---|---|---|
 * | L2 | `Georgia 15.75` `#2b180a`, sentence case | the roster heading — the plates' ONLY L2 | the SMALLEST step, 11.5 px uppercase faint sans |
 * | L3 | `SegoeUI-Semibold 7.88`, letter-spaced upper, `#9c8b78` | `Organisations`, `People` | the LARGEST sub-head, 17.5 px semibold dark |
 *
 * So the plate's largest sub-head rendered at the build's smallest step and two
 * of its smallest labels at the build's largest. **Promoting one without
 * demoting the others leaves `Organisations` shouting over its own parent**,
 * which is why both moves are asserted together.
 */
describe("V26-E01 — the heading hierarchy is un-inverted", () => {
  const ROSTER_HEADING = "Who’ll be in the room";

  const rosterEvent = () =>
    plateEvent({
      organisations: [
        {
          name: "Toyota Research Institute",
          descriptor: "Solid-state cell research.",
          relevance: "Runs the interfaces programme you cite.",
        },
      ],
      people: [
        {
          name: "Dr Ada Okafor",
          role: "Principal Scientist",
          relevance: "Published the operando imaging method you use.",
        },
      ],
    } as Partial<Event>);

  it("PROMOTES the roster heading to the plate's L2 serif sub-head", () => {
    const classes = classesOfTagContaining(
      renderEvent(rosterEvent()),
      "h2",
      ROSTER_HEADING,
    );
    // all four properties that make it a LEVEL rather than a bigger label
    expect(classes).toContain("font-display"); // serif, not sans
    expect(classes).not.toContain("uppercase"); // sentence case
    expect(classes).not.toContain("tracking-["); // no letter-spacing
    expect(classes).toContain("text-heading"); // the plate's darkest text
    expect(classes).toContain("text-[22px]");
  });

  it("keeps the heading STRING untouched — the sentence case comes from CSS, not a re-cased literal", () => {
    // B-14's fixed-heading contract. Plate 03's wording, curly apostrophe and
    // all. A string edit here is what that contract forbids.
    expect(renderEvent(rosterEvent())).toContain(ROSTER_HEADING);
  });

  it("DEMOTES 'Organisations' and 'People' to the plate's L3 label step", () => {
    const html = renderEvent(rosterEvent());
    for (const label of ["Organisations", "People"]) {
      const classes = classesOfTagContaining(html, "h3", label);
      expect(classes).toContain("uppercase");
      expect(classes).toContain("tracking-[0.18em]");
      expect(classes).toContain("text-text-faint");
      // the build's largest sub-head step must be gone from these two
      expect(classes).not.toContain("text-title");
    }
  });

  it("keeps the L2 heading strictly larger than the L3 labels beneath it", () => {
    // The inversion in one assertion: whatever the steps are, the parent must
    // not be the smaller of the two.
    const html = renderEvent(rosterEvent());
    const parent = classesOfTagContaining(html, "h2", ROSTER_HEADING);
    const child = classesOfTagContaining(html, "h3", "Organisations");
    expect(parent).toContain("text-[22px]");
    expect(child).toContain("text-caption");
    expect(parent).not.toContain("text-caption");
  });

  it("leaves every other section heading at L3, so only ONE heading is promoted", () => {
    const html = renderEvent(rosterEvent()) + renderJob();
    const promoted = [...html.matchAll(/data-report-heading-level="group"/g)];
    expect(promoted).toHaveLength(1);
  });

  it("accepts one demoted label under the L2 heading as a complete shape", () => {
    // `Organisations` present, `People` absent — both are independently gated
    // and the demotion changed no gate.
    const html = renderEvent(
      plateEvent({
        organisations: [
          {
            name: "Toyota Research Institute",
            descriptor: "Solid-state cell research.",
            relevance: "Runs the interfaces programme you cite.",
          },
        ],
      } as Partial<Event>),
    );
    expect(html).toContain("Organisations");
    expect(classesOfTagContaining(html, "h3", "Organisations")).toContain(
      "uppercase",
    );
    expect(html).not.toContain("People</h3>");
  });
});

/**
 * **V26-J10 — THE PLATE HAS ONE LABEL STEP; THE BUILD HAD TWO.** Rows 14, 15,
 * 17 and 18 of B's heading table: the `What the role is` and `To apply, have
 * ready` headings, the fact-tile labels and the apply-row labels all used
 * `text-micro` 10.5 px at `0.14–0.16em` while every other section label used
 * `text-caption` 11.5 px at `0.18em`. The plate uses the same
 * `SegoeUI-Semibold 7.88` for all of them.
 *
 * **FIXED BY CHANGING WHICH TOKEN THE CALL SITES USE, NEVER WHAT THE TOKENS
 * MEAN** — `text-caption` and `text-micro` are used across the whole app.
 */
describe("V26-J10 — one label step, not two", () => {
  it("puts the job report's section headings on the single label step", () => {
    const html = renderJob();
    for (const label of [
      "What the role is",
      "Skills they ask for",
      "Why Peer sent this to you",
    ]) {
      const classes = classesOfTagContaining(html, "h2", label);
      expect(classes).toContain("text-caption");
      expect(classes).toContain("tracking-[0.18em]");
      expect(classes).not.toContain("text-micro");
    }
  });

  it("puts the fact-tile labels on the same step — one component, BOTH surfaces", () => {
    const classes = classesOfTagContaining(renderJob(), "dt", "Type");
    expect(classes).toContain("text-caption");
    expect(classes).toContain("tracking-[0.18em]");
    expect(classes).not.toContain("text-micro");
  });

  it("leaves no second label step on any section heading of either report", () => {
    const html = renderJob() + renderEvent();
    const sectionHeadings = [...html.matchAll(/<h2\b[^>]*class="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(sectionHeadings.length).toBeGreaterThan(0);
    for (const classes of sectionHeadings) {
      expect(classes).not.toContain("text-micro");
    }
  });
});

/** Standard 7 again — the hierarchy move must not touch a rendered value. */
describe("value stability across the heading hierarchy change", () => {
  it("still renders every roster value", () => {
    const html = renderEvent(
      plateEvent({
        organisations: [
          {
            name: "Toyota Research Institute",
            descriptor: "Solid-state cell research.",
            relevance: "Runs the interfaces programme you cite.",
          },
        ],
        people: [
          {
            name: "Dr Ada Okafor",
            role: "Principal Scientist",
            relevance: "Published the operando imaging method you use.",
          },
        ],
      } as Partial<Event>),
    );
    for (const value of [
      "Toyota Research Institute",
      "Solid-state cell research.",
      "Dr Ada Okafor",
      "Principal Scientist",
    ]) {
      expect(html).toContain(value);
    }
  });
});

/**
 * **V26-J04 / V26-E04 — THE FACT-TILE BAND.** Plate 02 = pp. 2–4 (row at
 * p2 y≈691.5); plate 03 = pp. 4–9 (row at p4 y≈691.5). **The two plates' vector
 * rectangles are identical to the tenth of a point:** one backing rect at
 * x 79.5, w 453.0, fill `#2a1709`, carrying FOUR lighter tiles (`#f1e8d9`) at
 * x 79.5 / 192.8 / 306.8 / 420.0 with **0.75 pt gaps**.
 *
 * **The gaps ARE the rules** — the dark backing showing through — so the honest
 * translation is `gap-px` over `bg-border`, not a border per tile and not a
 * divider element.
 *
 * **A's "the tiles have no fill" is the one detail B corrected: they ARE filled,
 * lighter than the page. What they lack is a border and a radius.**
 *
 * **THE BEST NEWS IN B's ROUND, RE-STATED HERE BECAUSE IT IS WHAT MAKES THIS
 * CHEAP:** B mapped both tile sets to their plate slots key by key, in source
 * order — **7 for 7 on plate 02 and 6 for 6 on plate 03, no reordering.** Not
 * one tile merges, splits or is orphaned, and there is no `POLICY` item here.
 * The data layer was already exactly right; only the column count and the tile
 * chrome were wrong.
 */
describe("V26-J04 / V26-E04 — the band is one framed surface with hairline rules", () => {
  it("frames the band once on the wrapper and gives no tile its own border", () => {
    for (const html of [renderJob(), renderEvent()]) {
      const band = /<dl[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
      expect(band).toContain("gap-px");
      expect(band).toContain("bg-border");
      expect(band).toContain("border-border");
      expect(band).toContain("overflow-hidden");
      expect(band).toContain("rounded-xl");
      // and no tile carries the old per-tile chrome
      expect(html).not.toContain("rounded-xl border border-border bg-surface");
    }
  });

  it("caps the band at the plate's FOUR columns on both surfaces", () => {
    for (const html of [renderJob(), renderEvent()]) {
      const band = /<dl[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
      expect(band).toContain("sm:grid-cols-4");
      // the build's old counts, on both surfaces
      expect(band).not.toContain("grid-cols-7");
      expect(band).not.toContain("grid-cols-6");
      expect(band).not.toContain("grid-cols-3");
      // DISCLOSED DEVIATION: 2-up at the narrowest width, because the plate has
      // no narrow breakpoint and one full-width column is not a band.
      expect(band).toContain("grid-cols-2");
    }
  });

  it("keeps the tile a BARE <div> with no nested wrapper — B's element-anchored boundary", () => {
    // Three assertions in `events/[id]/page.test.ts` capture a tile with
    // `/<div[^>]*data-event-fact="fee"[^>]*>[\s\S]*?<\/div>/` — terminated by
    // the FIRST `</div>`. A wrapper ends the capture early and reds them for a
    // reason that has nothing to do with the band.
    const html = renderJob();
    const tile =
      /<div[^>]*data-job-fact="employment-type"[^>]*>[\s\S]*?<\/div>/.exec(
        html,
      )?.[0] ?? "";
    expect(tile).toContain("<dt");
    expect(tile).toContain("<dd");
    expect(tile).toContain("Full time");
  });

  it("keeps every tile hook byte-identical", () => {
    expect(renderJob()).toContain('data-job-fact="employment-type"');
    expect(renderJob()).toContain('data-job-fact="work-mode"');
  });
});

/**
 * The empty and partial states, taken from the plate rather than invented: the
 * short second row carries NO backing rect on either plate, so rules must never
 * trail into empty slots.
 */
describe("the band's empty and partial states", () => {
  it("renders no band at all when there are no facts", () => {
    // Every tile is conditionally pushed, so this is a real shape.
    const html = renderJob(
      plateJob({
        employmentType: undefined,
        workMode: undefined,
        location: undefined,
        salary: undefined,
        visa: undefined,
      } as Partial<Job>),
    );
    expect(html).not.toContain("<dl");
  });

  it("draws no rule into an empty slot on a short row", () => {
    // A CSS grid with `gap-px` gets this right for free: a short final row
    // simply ends, because there is no next cell to gap against. The assertion
    // that matters is that no blank filler tile is rendered to square the grid.
    const html = renderJob();
    const tiles = [...html.matchAll(/data-job-fact="/g)];
    const cells = [...(/<dl[^>]*>([\s\S]*?)<\/dl>/.exec(html)?.[1] ?? "").matchAll(
      /<div\b/g,
    )];
    expect(cells).toHaveLength(tiles.length);
  });

  it("keeps a tile's sub-line when it has one and renders nothing when it does not", () => {
    const html = renderJob();
    const tile =
      /<div[^>]*data-job-fact="employment-type"[^>]*>[\s\S]*?<\/div>/.exec(
        html,
      )?.[0] ?? "";
    expect(tile).not.toContain("data-report-fact-detail");
    expect(tile).not.toContain("undefined");
  });
});

/**
 * **STANDARD 7 AND B's HARDEST BOUNDARY: NO TILE VALUE MAY CHANGE.** The fix
 * touches `className` strings and one grid class per surface; `ReportFact`'s
 * shape and every construction site are untouched.
 */
describe("value stability across the band change", () => {
  it("still renders every tile label and value", () => {
    const html = renderJob();
    for (const value of ["Type", "Full time", "Location", "Los Altos, CA"]) {
      expect(html).toContain(value);
    }
  });

  it("keeps the tone fills and DROPS the tone borders, on the shipped tile itself", () => {
    // C's first version of this case gated on a deadline tile the fixture
    // never produced, so it was VACUOUS — the mutation that re-added the tone
    // border came back GREEN. Caught by running the mutation. Fixed by
    // rendering the shipped tile directly with each tone, which cannot be
    // gated away by a fixture.
    for (const [tone, fill, border] of [
      ["accent", "bg-accent/5", "border-accent/25"],
      ["danger", "bg-red/5", "border-red/25"],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(ReportFactTile, {
          fact: { key: "deadline", label: "Apply by", value: "12 Sep", tone },
          attribute: "data-job-fact",
        }),
      );
      // the FILL stays — it is how the plate distinguishes the tile
      expect(html).toContain(fill);
      // the BORDER goes — one bordered tile inside a rule-divided band reads
      // as a mistake
      expect(html).not.toContain(border);
      expect(html).not.toContain("rounded-xl");
      // and the VALUE colour survives, because it carries the plate's own red
      // `APPLY BY` meaning
      expect(html).toMatch(/text-(accent|red)/);
    }
  });

  it("keeps the tile a single un-nested <div>, so element-anchored captures still work", () => {
    // B named this as the one place a purely cosmetic edit can red a green
    // test: three assertions in `events/[id]/page.test.ts` capture a tile
    // with a regex terminated by the FIRST `</div>`.
    const html = renderToStaticMarkup(
      createElement(ReportFactTile, {
        fact: { key: "fee", label: "Fee", value: "Free", detail: "student rate" },
        attribute: "data-event-fact",
      }),
    );
    const captured =
      /<div[^>]*data-event-fact="fee"[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
    // the capture must still reach BOTH the label and the value
    expect(captured).toContain("Fee");
    expect(captured).toContain("Free");
  });
});

/**
 * **V26-J07 / RULING 72b — THE SKILLS PROGRESS BAR.** Plate 02 = pp. 2–4; the
 * bar is at p3 y=283.5.
 *
 * **A RECORDED DECISION THAT RESTED ON A FALSE PREMISE.** The build's own
 * comment said *"a progress bar the plate does not have"* and *"the progress bar
 * is gone under say-it-once"*. Neither a page image nor a text-span dump can
 * settle that, **because a bar is a vector DRAWING** — which is why round 26 B
 * pulled the rectangles instead:
 *
 * ```
 * y 283.5  x 79.5  w 453.0  h 4.5  #e9dfcc   <- the track
 * y 283.5  x 79.5  w 303.8  h 4.5  #ff520d   <- the filled segment
 * ```
 *
 * **303.8 / 453.0 = 0.6706**, against the plate's OWN counter one line above
 * reading `6 of 9 you already have` = **0.6667**. They agree to within half a
 * percent, and the construction is identical to the timeline track on the same
 * plate. Per the §1b precedent — treat the plate as correct and the record as
 * wrong — **Ruling 72b reversed the removal.**
 */
describe("V26-J07 — the skills progress bar, restored on the plate's own geometry", () => {
  const withSkills = (matched: number, unmatched: number) =>
    plateJob({
      matchedTerms: Array.from({ length: matched }, (_, i) => `Matched ${i + 1}`),
      keyRequirements: [
        ...Array.from({ length: matched }, (_, i) => `Matched ${i + 1}`),
        ...Array.from({ length: unmatched }, (_, i) => `Gap ${i + 1}`),
      ],
    } as Partial<Job>);

  const fill = (html: string) => {
    const el = /<div[^>]*data-skills-progress-fill[^>]*>/.exec(html)?.[0];
    return el ? /width:\s*([^;"]+)/.exec(el)?.[1]?.trim() : undefined;
  };

  it("renders one track and one fill", () => {
    const html = renderJob(withSkills(6, 3));
    // `\b` would also match `data-skills-progress-fill`, because the hyphen is
    // a word boundary — a negative lookahead is what actually counts the track.
    expect([...html.matchAll(/data-skills-progress(?!-)/g)]).toHaveLength(1);
    expect([...html.matchAll(/data-skills-progress-fill/g)]).toHaveLength(1);
  });

  it("fills to the matched fraction — the plate's own 6 of 9", () => {
    // 6 / 9 = 0.6667, against the plate's measured 303.8 / 453.0 = 0.6706.
    const html = renderJob(withSkills(6, 3));
    expect(html).toContain("6 of 9 you already have");
    expect(fill(html)).toBe("66.66666666666666%");
  });

  it("renders the bar EMPTY rather than absent when nothing is matched", () => {
    // B's stated empty state: with zero matched the bar renders empty, which is
    // the honest reading of `0 of 9`.
    const html = renderJob(withSkills(0, 9));
    expect(html).toContain("data-skills-progress");
    expect(fill(html)).toBe("0%");
  });

  it("fills completely when everything is matched", () => {
    expect(fill(renderJob(withSkills(4, 0)))).toBe("100%");
  });

  /**
   * **ADMITTED CONTROL — GREEN BOTH WAYS, AND SAID SO.** The bar carries a
   * divide-by-zero guard, and C first wrote this as a lock. Running the mutation
   * that removes the guard came back **GREEN**, which is how the truth was
   * found: `skillComparison` returns `null` when zero requirements survive its
   * plausibility filter (`page.tsx:742`), and the whole section is gated on that
   * null. **So `matched + unmatched` is always at least 1 when the bar renders,
   * and the guard is UNREACHABLE BY CONSTRUCTION.**
   *
   * The guard is KEPT — it is free, and the timeline's own divide-by-zero
   * (item 4) was reachable, so the shape is worth defending — but it is
   * labelled defensive rather than dressed up as a lock. This case asserts the
   * REACHABLE fact instead: a report with no plausible requirements renders no
   * skills section at all, which is the plate's own "hide rather than show
   * empty" rule.
   */
  it("hides the whole section when no requirement survives, so the bar never divides by zero", () => {
    const html = renderJob(withSkills(0, 0));
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("data-skills-progress");
    expect(html).not.toContain("Skills they ask for");
  });

  it("hides the bar from screen readers, because the counter already says it in words", () => {
    const bar = /<div[^>]*data-skills-progress\b[^>]*>/.exec(
      renderJob(withSkills(6, 3)),
    )?.[0];
    expect(bar).toContain("aria-hidden");
  });

  it("puts the counter on the heading row, not on its own line beneath", () => {
    // V26-J07's second half, which was never policy-blocked. The plate
    // right-aligns `6 of 9 you already have` on the label line.
    const html = renderJob(withSkills(6, 3));
    expect(html).toContain("data-section-subtitle");
    const row =
      /<div class="flex flex-wrap items-baseline justify-between[^"]*">[\s\S]*?<\/div>/.exec(
        html.slice(html.indexOf("Skills they ask for") - 400),
      )?.[0] ?? "";
    expect(row).toContain("Skills they ask for");
    expect(row).toContain("you already have");
  });

  it("corrects the build's false comment rather than deleting it", () => {
    // Not a rendering assertion — a contract assertion. The reversal must stay
    // legible to the next reader, per Ruling 72b.
    const source = readFileSync(
      new URL("../../app/jobs/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("a progress bar the plate does not have");
    expect(source).toContain("303.8");
    expect(source).toContain("RULING 72b");
  });
});
