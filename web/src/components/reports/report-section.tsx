"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * **V26-E01 / V26-J10 — THE REPORT HEADING HIERARCHY.** (Round 26 A found it;
 * round 26 B upgraded the finding and designed the fix; landed round 26 C.)
 *
 * **PLATE CITATION.** `Peer-design-spec-original.pdf`, plate 03 = pp. 4–9
 * (plate 02 = pp. 2–4). B re-extracted every span with its family, size and
 * colour. **Plate 03 has THREE heading levels:**
 *
 * | level | plate treatment | members |
 * |---|---|---|
 * | **L1** | `Georgia 21` `#2b180a` | the report title |
 * | **L2** | `Georgia 15.75` `#2b180a`, sentence case, serif | **`Who'll be in the room` — the ONLY member, on either plate** |
 * | **L3** | `SegoeUI-Semibold 7.88`, letter-spaced UPPERCASE, `#9c8b78` | **everything else**, including `Organisations` and `People` |
 *
 * **A CALLED THIS FLATTENED. B MEASURED IT AS INVERTED, WHICH IS WORSE AND
 * CHANGES THE FIX.** The build did not have one sub-title level — it had two,
 * assigned backwards: the plate's LARGEST sub-head (`Who'll be in the room`)
 * rendered at the build's SMALLEST step (11.5 px uppercase faint sans), while
 * two of the plate's SMALLEST labels (`Organisations`, `People`) rendered at
 * the build's LARGEST sub-head step (17.5 px semibold dark). **Promoting the
 * one heading without demoting the other two would have left `Organisations`
 * still shouting over it**, so this is a hierarchy, not a patch.
 *
 * **THE L2 STEP WAS DERIVED TWO INDEPENDENT WAYS AND THEY AGREE WITHIN 2%:**
 * against the title, `15.75 / 21 = 0.750` × the build's 30 px L1 ⇒ **22.5 px**;
 * against the label, `15.75 / 7.88 = 2.00` × the build's 11.5 px L3 ⇒
 * **23.0 px**. B recommends 22 px, and 22 px is what ships — as an arbitrary
 * value, the same technique both report `<h1>`s already use (`text-[30px]`,
 * `text-[32px]`), so **no token is added and no token's meaning changes.**
 * (The nearest existing token, `text-title-lg` at 19.5 px, is 13% under both
 * derivations; B named it as the fallback and said so rather than pretending it
 * was the measured answer.)
 *
 * **THE L2 TREATMENT DIFFERS FROM L3 IN ALL FOUR PROPERTIES**, which is what
 * makes it a level rather than a bigger label: serif (not sans), sentence case
 * (not uppercase), no letter-spacing (not `0.18em`), and `text-heading` — the
 * plate's `#2b180a`, its darkest text — rather than L3's faint `#9c8b78`.
 *
 * **WHY THIS COMPONENT EXISTS AT ALL.** `ReportSection` was DEFINED TWICE, as
 * two independent copies, at `app/jobs/[id]/page.tsx` and
 * `app/events/[id]/page.tsx`. `Who'll be in the room` reaches its `<h2>` through
 * the event copy, so **a `level` prop added to one copy would silently do
 * nothing on the other surface.** One component, one spelling — the same
 * argument `why-peer-sent-this.tsx`'s own doc comment already makes, so this is
 * the codebase's convention rather than a preference.
 *
 * **`level` DEFAULTS TO `"section"`, SO EVERY EXISTING CALL SITE KEEPS ITS
 * EXACT CURRENT OUTPUT.** Only `Who'll be in the room` passes `"group"`.
 *
 * **DELIBERATELY NOT CHANGED: 19.5 px is NOT a heading step.** B's CORRECTION 2
 * — the two `Georgia 19.5` spans on plate 03 read `Event report` and `Events
 * widen past conferences` and sit exactly on the plate boundaries. They are the
 * DECK's own slide titles, the same class as Ruling 71a's route kicker: deck
 * chrome, not report content. **No 19.5 step is built here.**
 */
export function ReportSection({
  title,
  subtitle,
  children,
  className,
  sectionKey,
  level = "section",
}: {
  title: string;
  /** Plate 03's sub-line under the roster heading. */
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** Marks the section for the job report's ordering assertions. */
  sectionKey?: string;
  /**
   * `"section"` = the plate's L3 label step, and the default, so nothing moves
   * unless a call site asks. `"group"` = the plate's L2 serif sub-head.
   */
  level?: "section" | "group";
}) {
  const isGroup = level === "group";
  const heading = (
    <h2
      data-report-heading-level={level}
      className={
        isGroup
          ? // L2 — plate `Georgia 15.75` `#2b180a`. Sentence case comes from
            // the ABSENCE of `uppercase`, so the heading STRING is never
            // re-cased in markup and B-14's fixed-heading contract holds.
            "font-display text-[22px] font-semibold leading-tight text-heading"
          : // L3 — plate `SegoeUI-Semibold 7.88`, letter-spaced uppercase.
            // Byte-identical to what both copies rendered before extraction.
            "text-caption font-semibold uppercase tracking-[0.18em] text-text-faint"
      }
    >
      {title}
    </h2>
  );

  return (
    <section
      data-job-section={sectionKey}
      className={cn("mt-12 print:break-inside-avoid", className)}
    >
      {/* B-14 / V26-J07 (round 26 C). **ONE HEADING-ROW TREATMENT, BOTH
          LEVELS.** Both plates put a section's counter RIGHT-ALIGNED ON THE
          HEADING'S OWN LINE — plate 03's `5 of 34 exhibitors and 3 of 18
          speakers concern you` beside `Who’ll be in the room`, and plate 02's
          `6 of 9 you already have` beside `SKILLS THEY ASK FOR`. The build put
          both on their own line beneath, left-aligned. B priced the L2 case with
          the promotion and noted the L3 case (V26-J07's second half) is an
          ordinary layout fix that ships regardless — and that ONE shared
          treatment lands both, which is what this is.

          It WRAPS at narrow widths rather than truncating: a counter reading
          "5 of 34 exhibitors" is useless clipped. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {heading}
        {subtitle && (
          <p data-section-subtitle className="text-body-sm text-text-muted">
            {subtitle}
          </p>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * **THE PLATE'S ONE LABEL STEP (V26-J10).** The plate uses the SAME
 * `SegoeUI-Semibold 7.88` with one tracking for section labels AND fact-tile
 * labels AND the apply-row labels; the build had TWO steps — `text-caption`
 * 11.5 px at `0.18em` and `text-micro` 10.5 px at `0.14–0.16em`.
 *
 * Exported as a constant rather than fixed by editing the tokens, because
 * **`text-caption` and `text-micro` are used across the whole app**: V26-J10 is
 * fixed by changing which token these call sites USE, never by changing what
 * the tokens MEAN.
 *
 * **NEVER PASS THIS THROUGH `cn()`. IT SILENTLY LOSES ITS SIZE.** `cn` is
 * `twMerge(clsx(...))`, and `tailwind-merge` does not know `text-caption` is a
 * font size — it reads it as a text COLOUR, sees `text-text-faint` later in the
 * same string, and drops `text-caption` as the loser of a conflict that is not
 * real. Executed, not guessed:
 *
 * ```
 * twMerge("text-caption font-semibold uppercase tracking-[0.18em] text-text-faint")
 *   -> "font-semibold uppercase tracking-[0.18em] text-text-faint"
 * ```
 *
 * Round 26 C hit this on three call sites at once and caught it only because a
 * test asserted the size was present. **Compose with a template literal**
 * (`` `pt-0.5 ${REPORT_LABEL_CLASS}` ``), which is why every call site below
 * does. The pre-existing code avoided the trap by writing these as literal
 * strings and never routing them through `cn` — the trap is new only to callers
 * that reach for `cn` by habit.
 *
 * **ROUND 28 ITEM 2 (V28-01): SPLIT OFF THE COLOUR.** `REPORT_LABEL_CLASS`
 * bundled five things — size, weight, case, tracking AND colour — but two
 * call sites (`app/events/[id]/page.tsx`'s "Cheapest way in, for you",
 * `app/jobs/[id]/page.tsx`'s "Posting evidence") carry `text-accent`
 * DELIBERATELY: they are tinted callouts, and the plate's own callout is
 * tinted. Dropping this constant onto them verbatim would repaint them
 * `text-text-faint` and destroy a real distinction while fixing a size.
 * `REPORT_LABEL_STEP` is the step alone; `REPORT_LABEL_CLASS`'s VALUE stays
 * byte-identical to what shipped before this split, so every existing call
 * site renders byte-for-byte unchanged and no existing assertion moves.
 * **The `cn()` trap above applies to `REPORT_LABEL_STEP` too, more sharply**
 * — a bare step has no colour in it to make a `twMerge` conflict visible, so
 * losing it is even easier to miss. Compose it with a template literal, same
 * as the full class.
 */
export const REPORT_LABEL_STEP =
  "text-caption font-semibold uppercase tracking-[0.18em]";
export const REPORT_LABEL_CLASS = `${REPORT_LABEL_STEP} text-text-faint`;
