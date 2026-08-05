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
 *
 * B2-08 / Ruling 12. The plate shows ONE flowing sentence; `reason` and
 * `facetReason` used to render as two separate paragraphs. Fusing them here
 * is only half the fix — `reason` itself was dot-separated fragments from the
 * scoring layer's own join, which Ruling 12 also authorised changing (see
 * `joinReasonClauses` in `web/src/lib/jobs/scoring.ts` and
 * `web/src/lib/events/scoring.ts`). `facetReason` already reads "Because you
 * often view <label>" as its own sentence, so trailing it onto `reason`
 * needs lower-casing its first word and a connector.
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

  const sentence =
    body && facet
      ? `${body} — ${facet.charAt(0).toLowerCase()}${facet.slice(1)}.`
      : `${(body ?? facet)!}.`;

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
        <p className="text-body-lg leading-8 text-text">{sentence}</p>
      </div>
    </section>
  );
}
