"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * B-10 / B-14. Plates 02 and 03 mark some headings with a small `NEW` or
 * provenance badge. Nothing shared existed, and two reports needed the same
 * shape, so it lives here rather than being written twice.
 */

/**
 * ABC-freemium 1-24 · R-UI-1, D6 — **the provenance label, chosen once.**
 *
 * The badge used to read `Tier 0`, which is internal vocabulary D6 removes from
 * every rendered string. What it *means* is that the block was built from the
 * event or posting's own data and needed no model — the reader sees it whether
 * or not they have AI at all.
 *
 * **One constant, seven call sites.** Seven near-synonyms would be worse than
 * the tier number they replaced, and `ui-vocabulary.test.ts` asserts the label
 * is used rather than re-typed.
 */
export const NO_MODEL_BADGE = "No model used";

/**
 * Its counterpart, for the two places that contrast a model-written judgement
 * with a computed one.
 */
export const MODEL_WRITTEN_BADGE = "AI written";
export function ReportBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent";
  children: ReactNode;
}) {
  return (
    <span
      data-report-badge
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.14em]",
        tone === "accent"
          ? "bg-accent/10 text-accent"
          : "bg-bg-secondary text-text-faint",
      )}
    >
      {children}
    </span>
  );
}
