"use client";

import { cn } from "@/lib/cn";

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
      className={cn(
        "min-w-0 rounded-xl border border-border bg-surface px-4 py-3",
        fact.tone === "accent" && "border-accent/25 bg-accent/5",
        fact.tone === "danger" && "border-red/25 bg-red/5",
      )}
    >
      <dt className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
        {fact.label}
      </dt>
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
