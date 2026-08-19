"use client";

import { cn } from "@/lib/cn";
import { REPORT_LABEL_CLASS } from "@/components/reports/report-section";

/**
 * B-05 / B-06. The tile shape both reports' fact rows use: a label, a value,
 * and plate 02/03's second grey line.
 *
 * Shared rather than written twice — the job report had this shape without the
 * sub-line and the event report had no fact row at all, so building it once was
 * the cheaper of the two orders.
 */
export interface ReportFact {
  key: string;
  label: string;
  value: string;
  /** The plate's grey sub-line: a countdown, a qualifier, a source. */
  detail?: string;
  tone?: "accent" | "danger";
}

export function ReportFactTile({
  fact,
  attribute,
}: {
  fact: ReportFact;
  /** Which data attribute names the tile, so each report keeps its own hooks. */
  attribute: "data-job-fact" | "data-event-fact";
}) {
  return (
    <div
      {...{ [attribute]: fact.key }}
      /*
        V26-J04 / V26-E04 (round 26 C). THE TILE LOST ITS OWN BORDER AND RADIUS.
        Plates 02 and 03 both draw the fact row as ONE dark backing rectangle
        (x 79.5, w 453.0, `#2a1709`) with four LIGHTER tiles laid on it
        (`#f1e8d9`), separated by 0.75 pt gaps — the backing surface showing
        through as hairline rules. There is no per-tile border and no rounding.
        The band's frame and rules now live on the WRAPPER `<dl>`; this tile is
        just a fill.

        A's "the tiles have no fill" is the one detail B corrected: they ARE
        filled, lighter than the page. What they lack is a border and a radius.

        THE TONE VARIANTS BECOME FILL-ONLY. A border on one tile inside a
        rule-divided band reads as a mistake. The `text-accent` / `text-red`
        VALUE colours below are untouched — those are the plate's own red
        `APPLY BY` and blue `VISA` values and they carry the meaning.

        THIS ELEMENT MUST STAY A BARE `<div>` WITH NO NESTED WRAPPER BEFORE ITS
        `<dd>`s. Three assertions in `events/[id]/page.test.ts` capture a tile
        with `/<div[^>]*data-event-fact="fee"[^>]*>[\s\S]*?<\/div>/` — anchored
        on the element and terminated by the FIRST `</div>`. Adding a wrapper
        ends the captured block early and reds those tests for a reason that has
        nothing to do with the band.
      */
      className={cn(
        "min-w-0 bg-surface px-4 py-3",
        fact.tone === "accent" && "bg-accent/5",
        fact.tone === "danger" && "bg-red/5",
      )}
    >
      {/* V26-J10 (round 26 C). Plates 02 and 03 use the SAME
          `SegoeUI-Semibold 7.88` label step for tile labels as for section
          labels; the build used a second, smaller one here. Unified onto the
          shared constant. One component, so this lands on BOTH surfaces. */}
      <dt className={REPORT_LABEL_CLASS}>{fact.label}</dt>
      <dd
        className={cn(
          "mt-1 break-words text-body-sm font-semibold text-heading",
          fact.tone === "accent" && "text-accent",
          fact.tone === "danger" && "text-red",
        )}
      >
        {fact.value}
      </dd>
      {fact.detail && (
        <dd
          data-report-fact-detail
          className="mt-0.5 break-words text-caption leading-5 text-text-faint"
        >
          {fact.detail}
        </dd>
      )}
    </div>
  );
}
