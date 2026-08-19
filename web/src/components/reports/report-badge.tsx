"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * B-10 / B-14. Plates 02 and 03 mark some headings with a small `NEW` or
 * `TIER 0` badge. Nothing shared existed, and two reports needed the same
 * shape, so it lives here rather than being written twice.
 *
 * `TIER 0` means the block is built from the event or posting's own data and
 * needs no AI key — the reader sees it whether or not they have one.
 */
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
