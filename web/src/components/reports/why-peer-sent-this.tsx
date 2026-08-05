"use client";

import { ReportBadge } from "@/components/reports/report-badge";

/**
 * B-03. "Why Peer sent this to you" — a Tier 0 block on both plate 02 and
 * plate 03, restored after P10.4 deleted it from both reports.
 *
 * Shared rather than written twice because the heading string is load-bearing:
 * two job tests assert the *old* wording ("Why Peer sent it") never comes back,
 * and the plate's wording is the longer sentence. One component, one spelling.
 *
 * It renders only what the scoring layer actually produced. The plate's
 * paragraph also names a region and a filtering count that no field carries
 * today; padding the sentence with invented specifics is the exact dishonesty
 * Phase 7 existed to remove, so the block prints what exists and stops.
 */
export function WhyPeerSentThis({
  reason,
  facetReason,
  sectionKey,
}: {
  reason: string | undefined;
  facetReason: string | undefined;
  /** Marks the section for the ordering assertions on the job report. */
  sectionKey?: string;
}) {
  const body = reason?.replace(/\s+/g, " ").trim();
  const facet = facetReason?.replace(/\s+/g, " ").trim();
  if (!body && !facet) return null;

  return (
    <section
      data-report-section="why-peer-sent-this"
      data-job-section={sectionKey}
      className="mt-12 print:break-inside-avoid"
    >
      <h2 className="text-caption font-semibold uppercase tracking-[0.18em] text-text-faint">
        Why Peer sent this to you
      </h2>
      {/* B2-07 / Ruling 11. Plate 02 and 03 both badge this heading TIER 0.
          The badge component already existed and worked — the Skills section
          used it correctly — it simply wasn't applied here. */}
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <ReportBadge tone="accent">Tier 0</ReportBadge>
      </p>
      <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
        {body && (
          <p className="text-body-lg leading-8 text-text">{body}</p>
        )}
        {facet && (
          <p
            data-why-facet-reason
            className={`text-body leading-7 text-text-muted${body ? " mt-3" : ""}`}
          >
            {facet}
          </p>
        )}
      </div>
    </section>
  );
}
