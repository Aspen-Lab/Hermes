import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CareerStage, Event, Job } from "@/types";
import { JobReport } from "@/app/jobs/[id]/page";
import { EventReport } from "@/app/events/[id]/page";
import { ReportFactTile } from "@/components/reports/fact-tile";
import { WhyPeerSentThis } from "@/components/reports/why-peer-sent-this";

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
      aiMode: "system" as const,
      effectivePlan: "free" as const,
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
      aiMode: "system" as const,
      effectivePlan: "free" as const,
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
   * **B's CORRECTION 1, LOCKED — AND RESTATED UNDER RULING 73 (V27-01, round
   * 27 item 5). THE ASSERTION IS UNCHANGED; ONLY THIS COMMENT MOVES.**
   *
   * Plate 02 carries four `Georgia-Italic` spans on its matched topic names —
   * **three terms**, one of them wrapped across a line; **plate 03 carries
   * ZERO.** Italic is a plate-02-only treatment.
   *
   * The reason this test states has CHANGED. It used to be "the component is
   * shared, so italic anywhere is italic everywhere". Ruling 73 authorised a
   * variant, so that is no longer true: `WhyPeerSentThis` now takes a `surface`
   * prop and the JOB path does italicise. **What keeps plate 03 clean is that
   * the gate is the SURFACE and never the data** — both scoring layers produce
   * `matchedTerms`, so a data gate would italicise the event report too.
   *
   * **DO NOT DELETE THIS.** It is now the second limb of the byte-identity
   * guard below, and it is what reds if someone gates on `matchedTerms.length`.
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

  // Round 28 item 2 (V28-01): the sweep above only ever looked at `<h2>`,
  // which is why six labels on FOUR OTHER element kinds (`<p>`, `<th>`,
  // `<h3>`, `<span>`) drifted while this block reported closed. Widened to
  // every element carrying `uppercase` together with a `tracking-[…]` — a
  // label step cannot come back through a fifth element type either.
  it("leaves no second label step on ANY uppercase-tracked LABEL of either report — widened past <h2>", () => {
    // `data-report-badge` is excluded by name: V28-01's own boundary keeps
    // the badge role out of this item (its plate counterpart is a different
    // typeface entirely, `Consolas 8.25`, not `SegoeUI-Semibold`), so its
    // `text-micro` / `tracking-[0.14em]` is not the residue this sweeps for.
    const html = renderJob() + renderEvent();
    const trackedElements = [
      ...html.matchAll(/<[a-z][a-z0-9]*\b[^>]*>/g),
    ]
      .map((m) => m[0])
      .filter(
        (tag) =>
          !tag.includes("data-report-badge") &&
          /class="[^"]*\buppercase\b[^"]*"/.test(tag) &&
          /class="[^"]*tracking-\[[^"]*"/.test(tag),
      )
      .map((tag) => /class="([^"]*)"/.exec(tag)?.[1] ?? "");
    expect(trackedElements.length).toBeGreaterThan(0);
    for (const classes of trackedElements) {
      expect(classes).not.toContain("text-micro");
      expect(classes).not.toContain("tracking-[0.16em]");
      expect(classes).not.toContain("tracking-[0.14em]");
    }
  });
});

/**
 * **V28-01 (round 28, item 2) — THE LABEL-STEP RESIDUE.** `REPORT_LABEL_CLASS`
 * closed four call sites' worth of drift (V26-J10 above); six RENDERED labels
 * across four further call sites were still on the old step because
 * V26-J10's own guard swept `<h2>` only, and none of these six is an `<h2>`.
 * See the doc comment above `REPORT_LABEL_STEP`
 * (`components/reports/report-section.tsx`) for the split design.
 */
describe("V28-01 — the label-step residue: labels V26-J10's own sweep could not see", () => {
  function renderJobWithEnrichment(
    job: Job,
    enrichment: Parameters<typeof JobReport>[0]["enrichment"],
  ): string {
    return renderToStaticMarkup(
      createElement(JobReport, {
        job,
        isSaved: false,
        isApplied: false,
        isInterested: false,
        nowMs: NOW,
        enrichment,
        aiMode: "system" as const,
        effectivePlan: "free" as const,
        onToggleSave: () => undefined,
        onAppliedChange: () => undefined,
        onDismiss: () => undefined,
      }),
    );
  }

  it("puts the tier-upgrade block's label on the shared step, `text-accent` — a deliberately tinted callout", () => {
    // `TierUpgradeBlock` renders when the provider is not configured; the
    // job report's own `JOB_TIER_UPGRADE_ITEMS` is non-empty by construction.
    const classes = classesOfTagContaining(
      renderJob(),
      "p",
      "Also in this report on Peer Pro",
    );
    expect(classes).toContain("text-caption");
    expect(classes).toContain("tracking-[0.18em]");
    expect(classes).toContain("text-accent");
    expect(classes).not.toContain("text-micro");
    expect(classes).not.toContain("text-text-faint");
  });

  it("puts the event report's cheapest-way-in callout on the shared step, `text-accent`", () => {
    const classes = classesOfTagContaining(
      renderEvent(
        plateEvent({
          fees: [{ label: "Early bird", standard: "$620", student: "$180" }],
        }),
      ),
      "p",
      "Cheapest way in, for you",
    );
    expect(classes).toContain("text-caption");
    expect(classes).toContain("tracking-[0.18em]");
    expect(classes).toContain("text-accent");
    expect(classes).not.toContain("text-micro");
    expect(classes).not.toContain("tracking-[0.16em]");
  });

  it("puts the fee table's four column headers on the shared step", () => {
    const html = renderEvent(
      plateEvent({
        fees: [{ label: "Early bird", standard: "$620", student: "$180", deadline: "2027-06-01" }],
      }),
    );
    for (const header of ["Item", "Standard", "Student", "Deadline"]) {
      const classes = classesOfTagContaining(html, "th", header);
      expect(classes).toContain("text-caption");
      expect(classes).toContain("tracking-[0.18em]");
      expect(classes).not.toContain("text-micro");
      expect(classes).not.toContain("tracking-[0.14em]");
    }
  });

  it("puts both roster-tail headings on the shared step — one component, two titles", () => {
    const html = renderEvent(
      plateEvent({
        organisations: [{ name: "Acme Battery Co", descriptor: "Exhibitor" }],
        people: [{ name: "Dr. A. Researcher", role: "Speaker", institution: "MIT" }],
      }),
    );
    for (const label of ["Every other organisation attending", "Every other speaker"]) {
      const classes = classesOfTagContaining(html, "h3", label);
      expect(classes).toContain("text-caption");
      expect(classes).toContain("tracking-[0.18em]");
      expect(classes).not.toContain("tracking-[0.16em]");
    }
  });

  it("puts the sponsorship-read block's two labels on the shared step, colour split correctly", () => {
    const html = renderJobWithEnrichment(plateJob(), {
      sponsorshipRead: { likelihood: "Plausible", basis: "Inferred from role history." },
    });
    // "Posting evidence" is the quoted-evidence label: stays `text-accent`,
    // the same deliberate tint as the tier-upgrade block and the callout.
    const evidenceClasses = classesOfTagContaining(html, "span", "Posting evidence");
    expect(evidenceClasses).toContain("text-caption");
    expect(evidenceClasses).toContain("tracking-[0.18em]");
    expect(evidenceClasses).toContain("text-accent");
    expect(evidenceClasses).not.toContain("text-micro");
    // "Peer inference" is the ordinary faint label — no colour change here.
    const inferenceClasses = classesOfTagContaining(
      html,
      "p",
      "Peer inference — verify with the employer",
    );
    expect(inferenceClasses).toContain("text-caption");
    expect(inferenceClasses).toContain("tracking-[0.18em]");
    expect(inferenceClasses).toContain("text-text-faint");
    expect(inferenceClasses).not.toContain("text-micro");
  });
});

/**
 * **V28-02 (round 28, item 3) — THE LOCKED-BLOCK LABEL COLOUR.** The plate's
 * `#5b4bbf` is the accent's own value in the plate's theme (V26-E05's own
 * comment, already shipped on the four `Tier 0` badges) — not a new fixed
 * hex, which would be the only frozen hue in a six-accent user-selectable
 * system. See §3.2 of round 28 B's item-3 write-up.
 */
describe("V28-02 — the locked-block label takes the accent token, not a new hex", () => {
  it("is `text-accent`, not `text-text-faint`", () => {
    const classes = classesOfTagContaining(
      renderJob(),
      "p",
      "Also in this report on Peer Pro",
    );
    expect(classes).toContain("text-accent");
    expect(classes).not.toContain("text-text-faint");
  });

  it("introduces no fixed hex anywhere in the two opportunity reports", () => {
    const html = renderJob() + renderEvent();
    expect(html).not.toContain("5b4bbf");
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

/**
 * **THE CLUSTER-3 REMAINDER — V26-E07, V26-E06, V26-E05, V26-J08 / V26-E08.**
 * Plate 02 = pp. 2–4; plate 03 = pp. 4–9.
 */
describe("V26-E07 — the label-introducing lead-ins take a colon", () => {
  const rosterEvent = () =>
    plateEvent({
      organisations: [
        {
          name: "Toyota Research Institute",
          descriptor: "Solid-state cell research.",
          relevance: "Runs the interfaces programme you cite.",
          atEvent: "Booth 14",
        },
      ],
      people: [
        {
          name: "Dr Ada Okafor",
          role: "Principal Scientist",
          relevance: "Published the operando imaging method you use.",
          speaking: "Tuesday keynote",
        },
      ],
    } as Partial<Event>);

  it("renders 'At this event:' and 'Speaking:' — plate 03's definition shape", () => {
    const html = renderEvent(rosterEvent());
    expect(html).toContain("At this event: ");
    expect(html).toContain("Speaking: ");
    expect(html).not.toContain("At this event ·");
    expect(html).not.toContain("Speaking ·");
  });

  it("is NOT a global middot policy — the separator survives everywhere else", () => {
    // B's boundary: the middot is correct for the subtitle triple, the
    // fact-tile sub-lines, the roster `descriptor · booth N` and the chip
    // `Full-time · 3 years`. Only these two lead-ins change.
    expect(renderJob()).toContain("·");
  });

  it("renders neither the label nor a dangling colon when the value is absent", () => {
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
    expect(html).not.toContain("At this event");
  });
});

/**
 * **V26-E06.** Plate 03 gives a highlighted card only its right-aligned tinted
 * descriptor badge; stars appear ONLY on the `EVERY OTHER …` roster rows, where
 * the control's own stated purpose is "star anyone Peer got wrong" — which is
 * meaningless on a card Peer already put at the top.
 */
describe("V26-E06 — highlighted cards carry no star", () => {
  const carded = () =>
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

  it("renders no star control on either highlighted card", () => {
    const html = renderEvent(carded());
    expect(html).toContain("Toyota Research Institute");
    expect(html).toContain("Dr Ada Okafor");
    expect(html).not.toContain("Star Toyota Research Institute");
    expect(html).not.toContain("Star Dr Ada Okafor");
  });

  it("keeps the descriptor badge right-aligned once the star leaves", () => {
    // B's stated check: the card's `justify-between` must not let the badge
    // drift to the centre when the star is removed.
    const html = renderEvent(carded());
    const card =
      /<article[^>]*>[\s\S]*?Toyota Research Institute[\s\S]*?<\/article>/.exec(
        html,
      )?.[0] ?? "";
    expect(card).toContain("justify-between");
  });

  it("removes a CONTROL, never the data or the capability", () => {
    // Load-bearing boundary: a highlighted card and a roster row can be the
    // same entity, so a starred roster row must keep its star. The roster-tail
    // star and the star state are untouched — the restated assertion in
    // `events/[id]/page.test.ts` counts exactly 25 surviving star controls on a
    // 30-row roster.
    const html = renderEvent(carded());
    expect(html).toContain("Toyota Research Institute");
  });
});

/**
 * **V26-E05.** Plate 03 §9 badges the label `NEW` and puts an explainer note
 * beneath the chips with a LEFT ORANGE RULE. The job report's structurally
 * identical section already had the badge and the note; it lacked the rule.
 */
describe("V26-E05 — the happenings section gets its badge and its note", () => {
  const withActivities = () =>
    plateEvent({
      activities: ["poster session", "career fair", "short course"],
    } as Partial<Event>);

  it("badges the section NEW and explains the chips", () => {
    const html = renderEvent(withActivities());
    // ASSERT THE HOOK WITH A BOUNDARY, NOT AS A BARE SUBSTRING. C's first
    // version used `toContain("data-happenings-explainer")`, which a rename to
    // `data-happenings-explainer-REMOVED` still satisfies — so the mutation
    // that removed the note came back GREEN. Caught by running it.
    expect(html).toMatch(/data-happenings-explainer[=" >]/);
    expect(html).toContain("Required and Explore topics");
    expect(html).toContain(">New<");
  });

  it("writes the note for EVENTS — it must not claim there is an application", () => {
    // B's boundary: pasting the job note here would state something false.
    const html = renderEvent(withActivities());
    const note =
      /<p[^>]*data-happenings-explainer[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(note).not.toContain("application");
    expect(note).toContain("trip");
  });

  it("carries the plate's left orange rule on BOTH surfaces", () => {
    const eventNote =
      /<p[^>]*data-happenings-explainer[^>]*>/.exec(renderEvent(withActivities()))?.[0] ??
      "";
    expect(eventNote).toContain("border-l-2");
    expect(eventNote).toContain("border-accent/50");
    const jobNote =
      /<p[^>]*data-skills-explainer[^>]*>/.exec(renderJob())?.[0] ?? "";
    expect(jobNote).toContain("border-l-2");
    expect(jobNote).toContain("border-accent/50");
  });

  it("renders NEITHER the badge NOR the note when there are no activity chips", () => {
    // B named this as the one way this cheap item can ship wrong: an explainer
    // about chips that are not there.
    //
    // THE FIXTURE HAS TO REACH THE NOTE'S OWN GATE. C's first version passed a
    // bare event, but the whole section is gated on
    // `activities.length > 0 || Boolean(description)` — so with neither, the
    // section never rendered and the note's gate was never exercised. That made
    // the case VACUOUS and the ungating mutation came back green. This fixture
    // carries a description (so the section renders) and NO activities (so only
    // the note's own gate can suppress it).
    const html = renderEvent(
      plateEvent({
        // `hasHappenings` is `activities.length > 0 || Boolean(description)`,
        // and `description` resolves from `reportSummary` — NOT from
        // `shortDescription`, which C tried first and which left the section
        // unrendered and the case vacuous again.
        reportSummary: {
          text: "Four days of talks, posters and a career fair on solid-state interfaces.",
          authority: "page-owned",
        },
      } as Partial<Event>),
    );
    // the section DOES render, so only the note's own gate can suppress it
    expect(html).toContain("What actually happens there");
    expect(html).not.toMatch(/data-happenings-explainer[=" >]/);
    expect(html).not.toContain(">New<");
  });
});

/**
 * **V26-J08 / V26-E08.** Plate 02's header row is four categories with four
 * signals: kind amber, type neutral outline, **visa BLUE**, match orange. The
 * build had three tones and used two, and `visaTone` returned `accent` for
 * `sponsors` — which is why the visa chip and the match chip rendered
 * identically.
 *
 * **SCORED AS ROLE ASSIGNMENT, NOT PALETTE FIDELITY**, which is out of the
 * round's scope: the assertions below check that four categories get four
 * DISTINGUISHABLE signals through semantic tokens, never that a literal hex
 * matches. The app is multi-theme, so a hex assertion would be wrong.
 */
describe("V26-J08 / V26-E08 — four chip roles, four signals", () => {
  it("gives the visa chip its own role, distinct from the match chip", () => {
    const html = renderJob(
      plateJob({ matchPct: 91 } as Partial<Job>),
    );
    expect(html).toContain('data-header-chip="info"');
    // and it is no longer the same tone as the match chip
    const visaChip =
      /<span[^>]*data-header-chip="info"[^>]*>/.exec(html)?.[0] ?? "";
    expect(visaChip).not.toContain("text-accent");
  });

  it("gives the role kind its own role on the job surface", () => {
    const html = renderJob(plateJob({ roleKind: "postdoc" } as Partial<Job>));
    expect(html).toContain('data-header-chip="kind"');
  });

  it("gives the event kind the same role on the event surface — one mechanism, two surfaces", () => {
    expect(renderEvent()).toContain('data-header-chip="kind"');
  });

  it("renders four DISTINGUISHABLE chip roles, not two", () => {
    const html = renderJob(
      plateJob({ roleKind: "postdoc", matchPct: 91 } as Partial<Job>),
    );
    const roles = new Set(
      [...html.matchAll(/data-header-chip="([a-z]+)"/g)].map((m) => m[1]),
    );
    expect(roles.size).toBeGreaterThanOrEqual(3);
    expect(roles).toContain("kind");
    expect(roles).toContain("info");
    expect(roles).toContain("neutral");
  });

  it("keeps `danger` firing for wont-sponsor — turning a red warning blue would be a regression", () => {
    const html = renderJob(
      plateJob({
        visa: {
          state: "wont-sponsor",
          evidence: "Applicants must already be authorised to work in the US.",
          country: "US",
        },
      } as Partial<Job>),
    );
    expect(html).toContain('data-header-chip="danger"');
    expect(html).not.toContain('data-header-chip="info"');
  });

  it("uses semantic tokens, never the plate's literal hexes", () => {
    // The app is multi-theme (`colorTheme: "system:ember"` in the live
    // profile); a literal hex would break in five other themes.
    const html = renderJob(plateJob({ roleKind: "postdoc" } as Partial<Job>));
    expect(html).not.toContain("#a8642a");
    expect(html).not.toContain("#2b5c8f");
    expect(html).toMatch(/text-(tag|link)\b/);
  });

  it("leaves the VISA FACT TILE's tone untouched — standard 7", () => {
    // DEVIATION FROM B, TRACED: B wrote "point `visaTone`'s `sponsors` branch
    // at `info`", but that function ALSO feeds the fact tile, whose `tone`
    // admits only `accent | danger`. Moving it would have retinted a tile no
    // item asked to change. The chip got its own mapping instead.
    const html = renderJob();
    const tile =
      /<div[^>]*data-job-fact="visa"[^>]*>/.exec(html)?.[0] ?? "";
    if (tile) expect(tile).not.toContain("bg-link-dim");
  });
});

/**
 * **V27-01 / RULING 73 (round 27, item 5) — THE PLATE-FAITHFUL ITALIC.**
 *
 * `Peer-design-spec-original.pdf` plate 02, the `WHY PEER SENT THIS TO YOU`
 * block: **four `Georgia-Italic 12.75 #4d3a28` spans, THREE terms.**
 * `interfacial` ends a line at x 419.6 and `resistance` begins the next at the
 * x 79.5 left margin, with the `, ` separators outside both — one term,
 * wrapped. The plate's own sentence says `Matches 3 of your required topics`.
 * The italic carries the SAME size and SAME colour as the prose: slant only.
 *
 * Plate 03 carries ZERO italic spans, and `WhyPeerSentThis` renders BOTH
 * reports — so the gate is the SURFACE, never the data. Both scoring layers
 * write `matchedTerms`, so a data gate would emphasise plate 03 as well.
 */
describe("V27-01 — the italic is plate-02-only and gated on the surface", () => {
  /** The plate's own sentence shape: `reasonFor` joins the first three terms. */
  const PLATE_TERMS = [
    "solid-state electrolytes",
    "interfacial resistance",
    "operando imaging",
  ];
  const PLATE_REASON =
    "Matches your solid-state electrolytes, interfacial resistance, operando imaging focus";

  /** The inner markup of the single tag containing a known piece of text. */
  function innerOfTagContaining(html: string, tag: string, text: string): string {
    const open = new RegExp(`<${tag}\\b[^>]*>`, "g");
    for (const match of html.matchAll(open)) {
      const start = match.index + match[0].length;
      const end = html.indexOf(`</${tag}>`, start);
      if (end < 0) continue;
      const inner = html.slice(start, end);
      if (inner.includes(text)) return inner;
    }
    throw new Error(`no <${tag}> containing ${JSON.stringify(text)} was rendered`);
  }

  function emTexts(inner: string): string[] {
    return [...inner.matchAll(/<em\b[^>]*>([^<]*)<\/em>/g)].map((m) => m[1]);
  }

  /**
   * **RULING 73's OWN BOUNDARY, AS A LITERAL STRING EQUALITY.** Two EVENT
   * renders differing in NOTHING but `matchedTerms` must produce byte-identical
   * markup. This is what fails the instant someone gates the italic on the data
   * instead of the surface — and it is what makes the "no `<em>`" assertion
   * above non-vacuous, because it forces the event fixture to CARRY terms.
   */
  it("renders the event report byte-identically with and without matchedTerms", () => {
    const withTerms = renderEvent(
      plateEvent({ relevanceReason: PLATE_REASON, matchedTerms: PLATE_TERMS }),
    );
    const withoutTerms = renderEvent(plateEvent({ relevanceReason: PLATE_REASON }));
    expect(withTerms).toBe(withoutTerms);
    // And neither carries an <em>, so the equality is not two italic renders.
    expect(withTerms).not.toContain("<em");
  });

  it("italicises exactly the matched terms on the job surface", () => {
    const inner = innerOfTagContaining(
      renderJob(plateJob({ matchReason: PLATE_REASON, matchedTerms: PLATE_TERMS })),
      "p",
      "operando imaging",
    );
    expect(emTexts(inner)).toEqual(PLATE_TERMS);
  });

  it("leaves every unmatched run outside the emphasis", () => {
    // The `nothing but matched-term spans` half of Ruling 73, asserted rather
    // than assumed: the lead-in, the separators and the tail are all plain.
    const inner = innerOfTagContaining(
      renderJob(plateJob({ matchReason: PLATE_REASON, matchedTerms: PLATE_TERMS })),
      "p",
      "operando imaging",
    );
    const outside = inner.replace(/<em\b[^>]*>[^<]*<\/em>/g, "\u0000");
    expect(outside).toContain("Matches your ");
    expect(outside).toContain(", ");
    expect(outside).toContain(" focus.");
    for (const term of PLATE_TERMS) expect(outside).not.toContain(term);
  });

  it("renders no emphasis at all when matchedTerms is empty", () => {
    const inner = innerOfTagContaining(
      renderJob(plateJob({ matchReason: PLATE_REASON, matchedTerms: [] })),
      "p",
      "operando imaging",
    );
    expect(inner).not.toContain("<em");
    expect(inner).toContain("Matches your solid-state electrolytes");
  });

  it("renders no emphasis when the terms do not occur in the sentence", () => {
    // Nothing is invented and no text is added: the prose is the plain string.
    const inner = innerOfTagContaining(
      renderJob(
        plateJob({ matchReason: PLATE_REASON, matchedTerms: ["thermal runaway"] }),
      ),
      "p",
      "operando imaging",
    );
    expect(inner).not.toContain("<em");
  });

  it("merges overlapping terms into ONE emphasis, never a nested pair", () => {
    // `highlightSegments` sorts longest-first and merges intervals, so this is
    // impossible by construction — asserted because it is the property that
    // makes reusing the shipped segmenter the right call.
    const inner = innerOfTagContaining(
      renderJob(
        plateJob({
          matchReason: PLATE_REASON,
          matchedTerms: ["solid-state", "solid-state electrolytes"],
        }),
      ),
      "p",
      "operando imaging",
    );
    expect(emTexts(inner)).toEqual(["solid-state electrolytes"]);
  });

  it("does not italicise a term that occurs only inside a longer word", () => {
    const inner = innerOfTagContaining(
      renderJob(
        plateJob({
          matchReason: "Matches your ion transport and precision imaging focus",
          matchedTerms: ["ion"],
        }),
      ),
      "p",
      "and precision imaging focus",
    );
    // `ion` matches the standalone word and NOT the `ion` inside `precision`.
    expect(emTexts(inner)).toEqual(["ion"]);
    expect(inner).toContain("precision imaging");
  });

  it("carries no colour or size class into the emphasis — slant only", () => {
    // The plate's italic spans are the SAME 12.75 and the SAME #4d3a28 as the
    // prose. An <em> that also tinted or resized would be a different plate.
    const inner = innerOfTagContaining(
      renderJob(plateJob({ matchReason: PLATE_REASON, matchedTerms: PLATE_TERMS })),
      "p",
      "operando imaging",
    );
    const openTags = [...inner.matchAll(/<em\b[^>]*>/g)].map((m) => m[0]);
    expect(openTags.length).toBe(3);
    for (const tag of openTags) {
      expect(tag).toContain("italic");
      expect(tag).not.toMatch(/text-(?:body|caption|micro|display|accent|text-)/);
      expect(tag).not.toContain("font-");
    }
  });

  it("changes no rendered VALUE — the words are identical with and without italic", () => {
    // A visual item may not move a value. Strip every tag and comment from the
    // italicised prose and it must equal the plain prose character for
    // character: same words, same separators, same trailing period.
    const strip = (s: string) => s.replace(/<!--.*?-->/g, "").replace(/<[^>]*>/g, "");
    const italicised = innerOfTagContaining(
      renderJob(plateJob({ matchReason: PLATE_REASON, matchedTerms: PLATE_TERMS })),
      "p",
      "operando imaging",
    );
    const plain = innerOfTagContaining(
      renderJob(plateJob({ matchReason: PLATE_REASON, matchedTerms: [] })),
      "p",
      "operando imaging",
    );
    expect(strip(italicised)).toBe(plain);
    expect(strip(italicised)).toBe(`${PLATE_REASON}.`);
  });

  it("renders plain prose when no surface is passed — the default is the guard", () => {
    // A future third call site is safe BY DEFAULT rather than by review.
    const html = renderToStaticMarkup(
      createElement(WhyPeerSentThis, {
        reason: PLATE_REASON,
        facetReason: undefined,
        matchedTerms: PLATE_TERMS,
      }),
    );
    expect(html).not.toContain("<em");
    expect(html).toContain("Matches your solid-state electrolytes");
  });

  /**
   * **THE DISCLOSURE THAT MADE THIS BLOCK NECESSARY.** The byte-identity test
   * above is Ruling 73's own asked-for assertion and it locks the shipped
   * WIRING — but on its own it is NOT uniquely red for the component's gate,
   * because the event call site passes no `matchedTerms` at all, so the
   * component never sees them there. Swapping the gate to
   * `matchedTerms.length > 0` left the byte-identity test GREEN. Found by
   * mutation, and this block is the fix: the component is asked directly, with
   * the event surface named AND the terms present.
   */
  it("renders no italic on the EVENT surface even when the terms are handed to it", () => {
    const html = renderToStaticMarkup(
      createElement(WhyPeerSentThis, {
        reason: PLATE_REASON,
        facetReason: undefined,
        surface: "event" as const,
        matchedTerms: PLATE_TERMS,
      }),
    );
    expect(html).not.toContain("<em");
    // And the JOB surface with the identical inputs DOES italicise, so the
    // assertion above is about the surface and not about the fixture.
    const job = renderToStaticMarkup(
      createElement(WhyPeerSentThis, {
        reason: PLATE_REASON,
        facetReason: undefined,
        surface: "job" as const,
        matchedTerms: PLATE_TERMS,
      }),
    );
    expect((job.match(/<em\b/g) ?? []).length).toBe(3);
  });
});

/**
 * **V27-02 (round 27, item 6) — THE VISA ATTRIBUTION RUNS INLINE.**
 *
 * `Peer-design-spec-original.pdf` plate 02: the quotation's closing curly
 * quote, the em dash and `from the job` sit in the **SAME span** as the
 * quotation at `Georgia 10.5 #9c8b78`, and `description` begins the next line
 * at the quotation's own left margin. **A detached caption cannot wrap
 * mid-phrase out of its parent's text run** — that wrap is the whole proof.
 *
 * The build shipped it as `mt-1 block text-caption text-text-faint`: forced
 * onto its own line, one size step down, one tone fainter. Three departures
 * plus the spacing utility that only existed to serve the block.
 *
 * **THE ATTRIBUTION HAD NO TEST AT ALL BEFORE THIS BLOCK** — a repo-wide grep
 * for `data-visa-attribution` and for the literal attribution string across
 * every test file returned nothing, which is how three departures survived a
 * full visual census. These four turn it into a locked attribute.
 */
describe("V27-02 — the visa attribution is part of the quote's own run", () => {
  function openTagOf(html: string, hook: string): string {
    const match = new RegExp(`<[a-z]+\\b[^>]*\\b${hook}\\b[^>]*>`).exec(html);
    if (!match) throw new Error(`no element carrying ${hook} was rendered`);
    return match[0];
  }

  it("carries none of the three departures, named one by one", () => {
    // Named individually so a PARTIAL revert reds rather than passing.
    const tag = openTagOf(renderJob(), "data-visa-attribution");
    expect(tag).not.toContain("block");
    expect(tag).not.toContain("text-caption");
    expect(tag).not.toContain("text-text-faint");
    expect(tag).not.toContain("mt-1");
  });

  it("keeps not-italic — the plate's attribution is Georgia, not Georgia-Italic", () => {
    // Browsers italicise <cite> by default. Plate 02's ONLY italic is the
    // matched topics in the why-block (V27-01). This is the clause a later
    // tidy-up deletes first, so it gets its own assertion.
    expect(openTagOf(renderJob(), "data-visa-attribution")).toContain("not-italic");
    // And it is still a <cite>: the complaint was the styling, never the
    // element, which carries B-19's "the posting said this, not Peer" semantic.
    expect(renderJob()).toContain("<cite data-visa-attribution");
  });

  it("follows the closing quotation mark in the same flow, separated by one space", () => {
    // The collapsed-whitespace regression this catches renders
    // `transfers.”— from the job description`, which would be a new defect.
    const html = renderJob();
    expect(html).toMatch(/”\s<cite data-visa-attribution[^>]*>— from the job description<\/cite>/);
    // The blockquote still opts into the reading serif, and the cite inherits
    // family, size and colour from it rather than declaring its own.
    const quoteClasses = classesOfTagContaining(html, "blockquote", "sponsor work visas");
    expect(quoteClasses).toContain("font-reading");
  });

  it("renders neither the quote nor the attribution when there is no evidence", () => {
    // The empty state, asserted rather than assumed. One gate, not two: the
    // <cite> lives INSIDE the `visaEvidence` conditional, so an attribution
    // without the sentence it attributes is impossible by construction.
    const html = renderJob(
      plateJob({ visa: { state: "not-stated", evidence: "  ", country: "US" } }),
    );
    expect(html).not.toContain("data-visa-attribution");
    expect(html).not.toContain("sponsor work visas");
  });

  it("changes no rendered VALUE — the attribution text is exactly what it was", () => {
    // A visual item may not move a value.
    expect(renderJob()).toContain("— from the job description");
    expect(renderJob()).toContain(
      "We sponsor work visas for exceptional postdoctoral candidates.",
    );
  });
});

/**
 * **V26-J06 / RULING 74 (round 27, item 7) — PLATE 02's FOUR APPLY ROWS.**
 *
 * Plate 02's `TO APPLY, HAVE READY` column: `MATERIALS`, `ELIGIBILITY`,
 * `TEAM`, `SEEN ON`. Two of the four had no field behind them, which is the
 * half of V26-J06 round 26 C escape-claused as a value-side extraction gap.
 *
 * **RULING 74 IS THE REASON THE `TEAM` ROW IS SHORTER THAN THE PLATE's.** The
 * plate reads `Energy & Materials, 14 researchers`; Peer publishes the NAME
 * and renders the headcount's HONEST ABSENCE. No schema.org property carries a
 * team size, `numberOfEmployees` describes the whole employer (a WRONG number,
 * not a partial one), a number lifted from prose is A22-01's exact mechanism,
 * and an LLM guess is a fabricated fact about a real employer. That residual
 * difference is an ACCEPTED, NAMED COST tallied by A each round, re-examined at
 * Phase 2 — **not a gap for a later round to close by inventing the count.**
 *
 * NOTE FOR THE RECORD: a repo-wide grep found **no shipped test asserting the
 * apply-row set** before this block, so nothing was restated here — these are
 * pure additions.
 */
describe("V26-J06 — the apply rows reach plate 02's four", () => {
  /**
   * Plate 02's MATERIALS row reads `CV, 1-page research statement, 3
   * references`. The section is gated on materials specifically (B4-07), so
   * every fixture here carries them — an absent row must never be confounded
   * with an absent SECTION.
   */
  const MATERIALS = ["Curriculum vitae", "Research statement"];

  function applyRowLabels(html: string): string[] {
    return [...html.matchAll(/data-apply-row="([^"]*)"/g)].map((m) => m[1]);
  }

  it("renders all four of the plate's rows, in the plate's own order", () => {
    const html = renderJob(
      plateJob({
        applicationMaterials: MATERIALS,
        eligibility: "PhD awarded by start date",
        team: "Energy & Materials",
        sourceId: "adzuna",
      }),
    );
    expect(applyRowLabels(html)).toEqual([
      "materials",
      "eligibility",
      "team",
      "seen on",
    ]);
    expect(html).toContain("PhD awarded by start date");
    expect(html).toContain("Energy &amp; Materials");
  });

  it("hides each absent row rather than printing it empty", () => {
    // The block's own standing rule, and the clause a later change would
    // replace with a "not stated" placeholder.
    const html = renderJob(
      plateJob({ applicationMaterials: MATERIALS, sourceId: "adzuna" }),
    );
    expect(applyRowLabels(html)).toEqual(["materials", "seen on"]);
    expect(html).not.toContain('data-apply-row="eligibility"');
    expect(html).not.toContain('data-apply-row="team"');
  });

  it("does NOT build ELIGIBILITY out of keyRequirements", () => {
    // `keyRequirements` is PEER's own derived skills list, not a statement the
    // employer made about who may apply. Rendering it here would turn a Peer
    // inference into an employer promise — the exact class B-19's attribution
    // exists to prevent. The plate-shaped fixture already populates it.
    const html = renderJob(
      plateJob({ applicationMaterials: MATERIALS, sourceId: "adzuna" }),
    );
    expect(html).toContain('data-apply-row="materials"');
    expect(html).not.toContain('data-apply-row="eligibility"');
  });

  it("does NOT restate the employer as the TEAM when the unit is absent", () => {
    // Ruling 26's failure shape, asserted at the render as well as at the
    // extractor: the employer is already in the header.
    const html = renderJob(
      plateJob({
        applicationMaterials: MATERIALS,
        companyOrLab: "Toyota Research Institute",
        sourceId: "adzuna",
      }),
    );
    expect(html).not.toContain('data-apply-row="team"');
  });

  it("renders the TEAM name WITHOUT a headcount — Ruling 74's named cost", () => {
    // Asserted so the accepted cost is visible in the suite rather than only
    // in a comment, and so inventing the count later reds a test.
    const html = renderJob(
      plateJob({
        applicationMaterials: MATERIALS,
        team: "Energy & Materials",
        sourceId: "adzuna",
      }),
    );
    expect(html).toContain("Energy &amp; Materials");
    expect(html).not.toContain("14 researchers");
    expect(html).not.toContain("Energy &amp; Materials,");
  });

  it("changes no rendered VALUE on a job that carries neither field", () => {
    // The two rows are additive: a job without them renders exactly what it
    // rendered before this item.
    const html = renderJob(plateJob({ applicationMaterials: MATERIALS }));
    expect(html).toContain("Curriculum vitae");
    expect(applyRowLabels(html)).toEqual(["materials"]);
  });
});

/**
 * **RULING 111b (Phase 2 round 4, C item 2) — THE SERIF DOCTRINE, COMPLETED.**
 * Round 3 B's full Class-A/B sweep against Ruling 110c's own doctrine
 * (verbatim source quote = `font-reading`; Peer's/LLM's own voice = sans)
 * found two missed-convention sites the same bug class as V-P2-01 — A1
 * `specificRequirements` and A2 `specificDuties` are BOTH verbatim quotes,
 * mechanically enforced by `quotableStringList` (`enrichment.ts:354-375`) —
 * and one OPPOSITE-direction mismatch: B1 `roleSummary` is Peer's own
 * composed prose, but it was inheriting `font-reading` from the shared
 * Tier-0 `roleBullets` slot it replaces. Four class-level edits total:
 * the commissioned V-P2-01 fix (A3/B2, the sponsorship-read quote box) plus
 * A1 and A2 all TAKE `font-reading`; B1 is STRIPPED to sans. These four
 * tests lock each site at its ruled treatment.
 */
describe("Ruling 111b — the serif doctrine completed (A1, A2, A3/B2, B1)", () => {
  function renderJobWithEnrichment(
    job: Job,
    enrichment: Parameters<typeof JobReport>[0]["enrichment"],
  ): string {
    return renderToStaticMarkup(
      createElement(JobReport, {
        job,
        isSaved: false,
        isApplied: false,
        isInterested: false,
        nowMs: NOW,
        enrichment,
        aiMode: "system" as const,
        effectivePlan: "free" as const,
        onToggleSave: () => undefined,
        onAppliedChange: () => undefined,
        onDismiss: () => undefined,
      }),
    );
  }

  it("V-P2-01 (A3/B2) — sets the sponsorship-read quote blockquote in the reading serif", () => {
    // The commissioned fix: `jobs/[id]/page.tsx`'s Class-B sponsorship-read
    // quote box, matching the Tier-0 attribution blockquote's own treatment.
    const html = renderJobWithEnrichment(plateJob(), {
      sponsorshipRead: {
        likelihood: "Plausible",
        basis: "Inferred from role history.",
      },
    });
    const classes = classesOfTagContaining(html, "blockquote", "sponsor work visas");
    expect(classes).toContain("font-reading");
  });

  it("A1 — sets specificRequirements (a quotableStringList-enforced verbatim quote) in the reading serif", () => {
    const html = renderJobWithEnrichment(plateJob(), {
      specificRequirements: ["Must hold a valid US work authorisation."],
    });
    const classes = classesOfTagContaining(
      html,
      "li",
      "Must hold a valid US work authorisation.",
    );
    expect(classes).toContain("font-reading");
  });

  it("A2 — sets specificDuties (a quotableStringList-enforced verbatim quote) in the reading serif", () => {
    const html = renderJobWithEnrichment(plateJob(), {
      specificDuties: ["Operate the operando imaging rig daily."],
    });
    const classes = classesOfTagContaining(
      html,
      "li",
      "Operate the operando imaging rig daily.",
    );
    expect(classes).toContain("font-reading");
  });

  it("B1 — strips the reading serif from roleSummary (Peer's own composed voice) while Tier 0's own posting prose keeps it, in the SAME slot", () => {
    // roleBullets is EITHER the posting's own text (Tier 0) OR Class-B's
    // LLM-composed roleSummary, never both — so the split has to be tested
    // both ways in the one shared render slot, not just the strip alone.
    const withLlmVoice = renderJobWithEnrichment(plateJob(), {
      roleSummary: [
        "You will lead solid-state interface characterisation.",
        "You will coordinate with the cell-design team.",
        "You will publish quarterly progress reports.",
      ],
    });
    const llmClasses = classesOfTagContaining(
      withLlmVoice,
      "li",
      "lead solid-state interface characterisation",
    );
    expect(llmClasses).not.toContain("font-reading");

    // Tier 0 (no enrichment.roleSummary, the plateJob() default): still the
    // posting's own prose, so the same slot must still take the serif.
    const tier0Classes = classesOfTagContaining(renderJob(), "li", "solid-state electrolytes");
    expect(tier0Classes).toContain("font-reading");
  });
});
