"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { REPORT_LABEL_CLASS } from "@/components/reports/report-section";

/**
 * **V26-J03 / V26-E03 — THE TIMELINE TRACK.** (Round 26 A found it on both
 * surfaces; B extracted the plates' vector geometry and designed it; landed
 * round 26 C.)
 *
 * **PLATE CITATION AND GEOMETRY.** `Peer-design-spec-original.pdf`, plate 02 =
 * pp. 2–4 (track at p3 y=213.0), plate 03 = pp. 4–9 (track at p5 y=276.8).
 * A read the plates as images and as text spans, and **neither instrument can
 * see a rule or a bar — those are vector drawings.** B pulled the rectangles,
 * so these numbers are exact rather than described, and **they are IDENTICAL on
 * both plates**:
 *
 * | | plate 02 | plate 03 |
 * |---|---|---|
 * | track | x 79.5, w 453.0, h 4.5, `#e9dfcc` | x 79.5, w 453.0, h 4.5, `#e9dfcc` |
 * | filled segment | x 79.5, w 81.8, `#ff520d` | x 79.5, w 54.0, `#ff520d` |
 * | dots | 4 pairs: ring 12.8×12.8, inner 8.2×8.2 | 4 pairs, same sizes |
 * | the orange dot | 2nd (`Today`) | 1st (`Today`) |
 *
 * **THE ONE RULE BOTH PLATES SHARE:** the orange segment runs **from the track's
 * left end to the CENTRE of the `Today` dot.** Plate 02's fill ends at 161.3 and
 * its `Today` dot centre is 161.2; plate 03's fill ends at 133.5 and its dot
 * centre is 133.5. **Exact on both.**
 *
 * **CORRECTION TO A, ON BOTH SURFACES.** A wrote that `Today` carries a LARGER
 * orange dot. Measured, **every inner dot is 8.2 × 8.2 and every ring is
 * 12.8 × 12.8 on both plates — `Today` differs in COLOUR ONLY.** No size variant
 * is built here; that would add emphasis the plate does not have.
 *
 * **NO DATE LOGIC LIVES HERE, AND NONE MOVED TO GET IT.** The fill state was
 * already in the data: `accent === true` marks `today` on both surfaces
 * (`jobs:683`, `events:730`), and `today` is the only milestone pushed
 * unconditionally. **This component reads that flag and nothing else — no date
 * is read, none is compared, none is formatted, and `nowMs` is never consulted.**
 * Both milestone builders are untouched.
 *
 * **WHY ONE COMPONENT.** The timeline was written TWICE — inline at
 * `app/jobs/[id]/page.tsx` and as `DeadlineTimeline` at
 * `app/events/[id]/page.tsx` — and diffed, the copies were the same shape down
 * to the class strings; the only differences were the `data-deadline-milestone`
 * hook (event only) and the connector stub's breakpoint. Leaving one behind
 * would produce two surfaces that disagree, which is the exact defect class this
 * loop exists to catch.
 *
 * **DISCLOSED DEVIATION 1 — EVEN DOT SPACING.** The plates' own spacing is
 * neither even nor date-proportional: plate 02's centres are 79.5 / 161.2 /
 * 341.9 / 532.2 (gaps 81.7, 180.7, 190.3) against intervals of ~17 / 38 / 108
 * days. B checked for proportionality and found none — it is hand-placement,
 * which is not a buildable rule. **Even distribution preserves the plate's
 * visual grammar and needs no date maths**, which is what the boundary demands.
 *
 * **DISCLOSED DEVIATION 2 — THE NARROW WIDTH.** The deck has no narrow variant,
 * so the plate cannot settle it. A track cannot wrap, so below `sm` the
 * milestones become a **vertical rail**: the track rotated to a left-hand line
 * with the dots down it and the labels to the right. That is the only shape that
 * keeps "one continuous track" true on a phone, and B recommended exactly it.
 */
export interface ReportTimelineMilestone {
  key: string;
  label: string;
  /** Optional: `Today` prints the bare word with nothing beneath it. */
  value?: string;
  accent?: boolean;
}

export function ReportTimelineTrack({
  milestones,
}: {
  milestones: ReportTimelineMilestone[];
}) {
  if (milestones.length === 0) return null;

  const count = milestones.length;
  const accentIndex = milestones.findIndex((point) => point.accent);

  /**
   * **THE ONE-MILESTONE CASE, WHICH B NAMED AS THE MOST LIKELY WAY A NAIVE
   * IMPLEMENTATION SHIPS BROKEN — AND IT IS NOT HYPOTHETICAL.** On the job
   * surface `posted`, `deadline` and `start` are each conditional while `today`
   * is unconditional, so a row carrying none of the three renders a ONE-dot
   * timeline. `accentIndex / (count - 1)` **divides by zero at count = 1** and
   * writes `NaN%` into a style attribute.
   *
   * The rule, from the plate's own logic: **with one milestone, render the dot
   * and its label with NO track and NO fill.** A track between one point and
   * itself is meaningless. It has its own test.
   */
  const hasTrack = count > 1;

  /**
   * The plate's rule, in one expression: fill from the track's left end to the
   * CENTRE of the accent dot. With dots evenly distributed and the first and
   * last pinned to the ends, the accent dot's centre sits at
   * `accentIndex / (count - 1)` of the width.
   *
   * `accentIndex < 0` (no accent milestone) leaves the track entirely unfilled,
   * which is the honest reading of "nothing has happened yet". So does
   * `accentIndex === 0`, which is the EVENT surface's normal case because
   * `today` is pushed first there — **and it must not be special-cased into
   * "fill a little so it looks alive".**
   */
  const fillPercent =
    hasTrack && accentIndex > 0 ? (accentIndex / (count - 1)) * 100 : 0;

  const dotClass = (accent: boolean | undefined) =>
    cn(
      // ONE SIZE FOR EVERY DOT — the plate's own measurement. The ring is the
      // page background showing through, which is how the plate draws its
      // 12.8 / 8.2 pair.
      "block h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-bg",
      accent ? "bg-accent" : "bg-text-faint/40",
    );

  return (
    <div className="relative mt-2">
      {/*
        THE TRACK ROW. Rendered from `sm` up only — below that the rail on the
        list takes over. `aria-hidden` throughout: it is decoration, and every
        milestone is already announced by the list below it.
      */}
      {hasTrack && (
        <div aria-hidden className="relative mb-3 hidden h-2.5 sm:block">
          <span
            data-timeline-track
            className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border"
          />
          <span
            data-timeline-fill
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
            // The width is DATA — the accent milestone's index — not a design
            // constant, which is the one case where a style attribute is more
            // honest than a class.
            style={{ width: `${fillPercent}%` }}
          />
          {milestones.map((point, index) => (
            <span
              key={point.key}
              data-timeline-dot={point.accent ? "accent" : "plain"}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
                dotClass(point.accent),
              )}
              style={{ left: `${(index / (count - 1)) * 100}%` }}
            />
          ))}
        </div>
      )}

      <ol
        className={cn(
          "grid gap-4",
          // Below `sm`: the vertical rail — the track rotated onto the list's
          // left edge, with the dots sitting on it.
          hasTrack && "border-l border-border pl-4 sm:border-l-0 sm:gap-0 sm:pl-0",
          // From `sm`: one column per milestone, evenly distributed, so each
          // label sits under its own dot.
          hasTrack &&
            "sm:grid-cols-[repeat(var(--timeline-count),minmax(0,1fr))]",
        )}
        style={
          hasTrack
            ? ({ "--timeline-count": count } as CSSProperties)
            : undefined
        }
      >
        {milestones.map((point) => (
          <li
            key={point.key}
            data-deadline-milestone={point.key}
            className="relative flex min-w-0 items-start gap-2 sm:block"
          >
            {/*
              The rail's own dot, below `sm` only — pulled onto the border so
              the rail reads as one continuous line through the dots. From `sm`
              up the track row above carries the dots instead.
            */}
            {hasTrack && (
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[21px] top-0.5 sm:hidden",
                  dotClass(point.accent),
                )}
              />
            )}
            {!hasTrack && (
              <span aria-hidden className={cn("mt-0.5", dotClass(point.accent))} />
            )}
            <div className="min-w-0">
              <span className={cn("block", REPORT_LABEL_CLASS)}>
                {point.label}
              </span>
              {/*
                A milestone with a label but NO value — `today` is exactly this
                on both surfaces. The guard is carried over from both original
                copies unchanged: the dot and label render, the value line does
                not, and NOTHING renders a placeholder or a dash.
              */}
              {point.value && (
                <p className="mt-1 text-body-sm font-semibold text-heading">
                  {point.value}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
