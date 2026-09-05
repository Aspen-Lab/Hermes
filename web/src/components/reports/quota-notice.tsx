"use client";

import Link from "next/link";
import { REPORT_LABEL_STEP } from "./report-section";
import { quotaMessage, type QuotaSignal } from "@/lib/usage/deep-report-quota";

/**
 * ABC-freemium 2-07 · R-QUOTA-1 · Ruling 3 point 1 · Ruling 4 point 2 ·
 * Ruling 6 point 2.
 *
 * **The half of R-QUOTA-1 that nothing rendered.** The requirement's own
 * sentence is "the UI shows an English message … and an upgrade prompt", and
 * for a whole round the server computed a correct message, tested it three
 * ways, and showed it to nobody: `quotaMessage` had **zero** production callers
 * and all three client fetchers dropped the `quota` field on the floor.
 *
 * ── WHAT IT SAYS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────────
 *
 *  - **`exhausted`** — the sentence plus an upgrade prompt. This reader has
 *    spent their allowance, and a plan is the thing that changes that.
 *  - **`unavailable`** — the sentence and **no upgrade prompt**. Nothing the
 *    reader buys fixes a counter-store outage, so an upsell here would be a
 *    second lie on top of the one 2-02 removed.
 *  - **no `quota` at all** — `null`. Nothing is rendered, not an empty box and
 *    not a heading over nothing: the overwhelmingly common case is a reader
 *    with allowance left, and a report that grows a permanent empty panel is
 *    worse than one that says nothing.
 *
 * The reader still has their complete deterministic report either way — that is
 * the existing degraded payload, and this component sits beside it rather than
 * replacing anything.
 *
 * **D7's price is display only** and there is no checkout link, for the same
 * reason `TierUpgradeBlock` has none: spec §3 puts payment out of scope and a
 * dead link is worse than no link. The prompt points at the key panel, which is
 * a real thing a reader can act on today.
 */
export function QuotaNotice({
  quota,
  className = "",
}: {
  /** From the report response. Absent whenever the reader was served. */
  quota?: QuotaSignal;
  className?: string;
}) {
  if (!quota) return null;

  const exhausted = quota.reason === "exhausted";

  return (
    <aside
      className={`mt-10 overflow-hidden rounded-2xl border border-border bg-bg-secondary/50 ${className}`}
      data-testid="quota-notice"
      data-quota-reason={quota.reason}
    >
      <div className="px-5 py-4 sm:px-6">
        <p className={`${REPORT_LABEL_STEP} text-accent`}>
          {exhausted ? "Deep reports" : "Deep reports unavailable"}
        </p>
        <p className="mt-2 text-body-sm leading-6 text-text-muted">
          {quotaMessage(quota)}
        </p>
        {exhausted ? (
          <p className="mt-3 text-caption leading-5 text-text-faint">
            Peer Pro lifts the monthly limit.{" "}
            <Link
              href="/settings"
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              Add your own key
            </Link>{" "}
            to keep going now.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
