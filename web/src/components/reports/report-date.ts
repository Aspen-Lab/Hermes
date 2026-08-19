import { daysUntil, formatDate } from "@/lib/format";

/**
 * B2-01 / Ruling 8. Plate 02 and 03 print a report date with no year when it
 * sits inside the report's own one-year horizon — "Sep 15", not
 * "Sep 15, 2026" — but a date more than ~12 months out must keep its year, or
 * "Mar 8" is ambiguous between two adjacent years. Suppressing a year that is
 * genuinely needed is a correctness bug, not parity.
 *
 * This is a report display policy, not a formatting fact, so it does not
 * live in `format.ts` (shared by the feed, papers and cards). Only the job
 * and event reports call it.
 */
const YEAR_GUARD_DAYS = 365;

export function reportShortDate(
  iso: string | null | undefined,
  nowMs: number,
): string | undefined {
  if (!iso) return undefined;
  const distance = Math.abs(daysUntil(iso, nowMs));
  return (
    formatDate(iso, distance > YEAR_GUARD_DAYS ? "medium" : "short") ??
    undefined
  );
}
