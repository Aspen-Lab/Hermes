import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ReportTimelineTrack,
  type ReportTimelineMilestone,
} from "./timeline-track";

/**
 * **V26-J03 / V26-E03 — THE TIMELINE TRACK.** Plate 02 = pp. 2–4 (track at
 * p3 y=213.0); plate 03 = pp. 4–9 (track at p5 y=276.8).
 *
 * **THE GEOMETRY IS FROM THE PDF's VECTOR RECTANGLES, NOT FROM READING THE
 * PLATE AS A PICTURE** — a rule and a bar are drawings, so neither an image nor
 * a text-span dump can see them. Both plates: track x 79.5 w 453.0 h 4.5
 * `#e9dfcc`; fill starts at 79.5; four dot pairs, ring 12.8, inner 8.2.
 *
 * **THE ONE RULE BOTH PLATES SHARE:** the fill runs from the track's left end to
 * the CENTRE of the `Today` dot. Plate 02: fill ends 161.3, dot centre 161.2.
 * Plate 03: fill ends 133.5, dot centre 133.5.
 *
 * **A's "`Today` carries a LARGER dot" IS CORRECTED BY B's MEASUREMENT** — every
 * inner dot is 8.2 × 8.2 on both plates. `Today` differs in COLOUR ONLY, and the
 * size-parity test below is what stops a later round re-adding the emphasis.
 */

function render(milestones: ReportTimelineMilestone[]): string {
  return renderToStaticMarkup(
    createElement(ReportTimelineTrack, { milestones }),
  );
}

/** The job surface's own order: posted -> today -> deadline -> start. */
const JOB_MILESTONES: ReportTimelineMilestone[] = [
  { key: "posted", label: "Posted", value: "8 days ago" },
  { key: "today", label: "Today", accent: true },
  { key: "deadline", label: "Apply by", value: "12 Sep" },
  { key: "start", label: "Starts", value: "6 Jan" },
];

/** The event surface's own order: today FIRST. */
const EVENT_MILESTONES: ReportTimelineMilestone[] = [
  { key: "today", label: "Today", accent: true },
  { key: "submission", label: "Abstract due", value: "2 Aug" },
  { key: "registration", label: "Register by", value: "1 Sep" },
  { key: "event", label: "Event", value: "20 Sep" },
];

function fillWidth(html: string): string | undefined {
  const el = /<span[^>]*data-timeline-fill[^>]*>/.exec(html)?.[0];
  return el ? /width:\s*([^;"]+)/.exec(el)?.[1]?.trim() : undefined;
}

describe("the track replaces four bordered boxes with one continuous rule", () => {
  it("renders exactly one track and one fill, not a box per milestone", () => {
    const html = render(JOB_MILESTONES);
    expect([...html.matchAll(/data-timeline-track/g)]).toHaveLength(1);
    expect([...html.matchAll(/data-timeline-fill/g)]).toHaveLength(1);
    // the old shape: `rounded-xl border border-border bg-surface` per <li>
    expect(html).not.toContain("rounded-xl border border-border");
  });

  it("keeps one milestone hook per milestone, on both surfaces' shapes", () => {
    for (const set of [JOB_MILESTONES, EVENT_MILESTONES]) {
      const html = render(set);
      expect([...html.matchAll(/data-deadline-milestone="/g)]).toHaveLength(
        set.length,
      );
    }
  });
});

describe("the fill ends at the centre of the accent dot — the plates' one rule", () => {
  it("fills to the second of four on the job surface (plate 02's shape)", () => {
    // accentIndex 1 of 4 milestones -> 1/(4-1) = 33.33%
    expect(fillWidth(render(JOB_MILESTONES))).toBe("33.33333333333333%");
  });

  it("leaves the track UNFILLED when Today is first — the event surface's normal case", () => {
    // plate 03 puts `Today` first. Nothing has happened yet, and this must NOT
    // be special-cased into "fill a little so it looks alive".
    expect(fillWidth(render(EVENT_MILESTONES))).toBe("0%");
  });

  it("fills the whole track when the accent milestone is last", () => {
    expect(
      fillWidth(
        render([
          { key: "posted", label: "Posted", value: "8 days ago" },
          { key: "today", label: "Today", accent: true },
        ]),
      ),
    ).toBe("100%");
  });

  it("leaves the track unfilled when no milestone is accented", () => {
    expect(
      fillWidth(
        render([
          { key: "posted", label: "Posted", value: "8 days ago" },
          { key: "start", label: "Starts", value: "6 Jan" },
        ]),
      ),
    ).toBe("0%");
  });

  it("puts each dot at its evenly-distributed position, first and last pinned to the ends", () => {
    const html = render(JOB_MILESTONES);
    const lefts = [...html.matchAll(/data-timeline-dot[^>]*left:\s*([^;"]+)/g)].map(
      (m) => m[1].trim(),
    );
    expect(lefts[0]).toBe("0%");
    expect(lefts[lefts.length - 1]).toBe("100%");
    // and the fill lands exactly on the accent dot's own position
    const accentDot = /<span[^>]*data-timeline-dot="accent"[^>]*>/.exec(html)?.[0];
    expect(/left:\s*([^;"]+)/.exec(accentDot ?? "")?.[1].trim()).toBe(
      fillWidth(html),
    );
  });
});

describe("B's CORRECTION to A — Today differs in COLOUR only, never in size", () => {
  it("gives every dot the same size classes", () => {
    const html = render(JOB_MILESTONES);
    const dots = [...html.matchAll(/<span[^>]*data-timeline-dot[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(dots).toHaveLength(4);
    for (const dot of dots) {
      expect(dot).toContain("h-2.5");
      expect(dot).toContain("w-2.5");
    }
  });

  it("paints exactly one dot accent and the rest faint", () => {
    const html = render(JOB_MILESTONES);
    expect([...html.matchAll(/data-timeline-dot="accent"/g)]).toHaveLength(1);
    expect([...html.matchAll(/data-timeline-dot="plain"/g)]).toHaveLength(3);
    // ASSERT THE COLOUR CLASS, NOT ONLY THE HOOK. C's first version of this
    // case checked only the `data-timeline-dot` attribute, which is derived
    // from the same flag as the colour — so a mutation that painted EVERY dot
    // `bg-accent` left it green. Caught by running that mutation; the fix is to
    // read what the reader actually sees.
    const dots = [...html.matchAll(/<span[^>]*data-timeline-dot[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(dots.filter((d) => d.includes("bg-accent"))).toHaveLength(1);
    expect(dots.filter((d) => d.includes("bg-text-faint/40"))).toHaveLength(3);
  });
});

/**
 * **THE EMPTY AND PARTIAL STATES.** B named the one-milestone divide-by-zero as
 * the single most likely way a naive implementation ships broken, and it is not
 * hypothetical: on the job surface `posted`, `deadline` and `start` are each
 * conditional while `today` is unconditional.
 */
describe("empty and partial states", () => {
  it("renders NO track and NO fill for a single milestone, and never emits NaN", () => {
    const html = render([{ key: "today", label: "Today", accent: true }]);
    expect(html).not.toContain("data-timeline-track");
    expect(html).not.toContain("data-timeline-fill");
    expect(html).not.toContain("NaN");
    // the dot and its label still render — the milestone is not swallowed
    expect(html).toContain('data-deadline-milestone="today"');
    expect(html).toContain("Today");
  });

  it("renders nothing at all for zero milestones", () => {
    expect(render([])).toBe("");
  });

  it("renders a label with no value without a placeholder or a dash", () => {
    // `today` is exactly this on both surfaces.
    const html = render(JOB_MILESTONES);
    const todayItem =
      /<li[^>]*data-deadline-milestone="today"[\s\S]*?<\/li>/.exec(html)?.[0] ??
      "";
    expect(todayItem).toContain("Today");
    expect(todayItem).not.toContain("<p");
    expect(todayItem).not.toContain("—");
    expect(todayItem).not.toContain("undefined");
  });

  it("still works with two milestones", () => {
    const html = render([
      { key: "today", label: "Today", accent: true },
      { key: "event", label: "Event", value: "20 Sep" },
    ]);
    expect(html).toContain("data-timeline-track");
    expect(fillWidth(html)).toBe("0%");
  });
});

/** Standard 7 — the track must not change a rendered value. */
describe("value stability", () => {
  it("still renders every milestone label and value", () => {
    const html = render(JOB_MILESTONES);
    for (const value of [
      "Posted",
      "8 days ago",
      "Today",
      "Apply by",
      "12 Sep",
      "Starts",
      "6 Jan",
    ]) {
      expect(html).toContain(value);
    }
  });
});
