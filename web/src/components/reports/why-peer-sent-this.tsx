"use client";

import { ReportBadge } from "@/components/reports/report-badge";
import { highlightSegments } from "@/lib/jobs/summarize";

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
  surface = "event",
  matchedTerms,
}: {
  reason: string | undefined;
  facetReason: string | undefined;
  /** Marks the section for the ordering assertions on the job report. */
  sectionKey?: string;
  /**
   * V27-01 / Ruling 73. THE VARIANT INPUT — and the default is the load-bearing
   * half. An unpassed `surface` renders exactly what this component rendered
   * before this item, so a future third call site is safe by DEFAULT rather
   * than by review.
   */
  surface?: "job" | "event";
  /**
   * V27-01. The job row's own matched terms. `matchedKeywords` and
   * `matchReason` are written from the SAME array in `jobs/scoring.ts`, so
   * these words are already in the prose verbatim.
   */
  matchedTerms?: string[];
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
        {/* V26-J02 / V26-E02, element 3 — ONE edit, BOTH surfaces, because this
            component is shared. Plate 02 and plate 03 both set this prose in
            `Georgia 12.75` `#4d3a28`.

            V27-01 / RULING 73 — THE ITALIC IS PLATE-02-ONLY AND IS NOW GATED ON
            THE SURFACE, NOT ON THE DATA. Plate 02 carries `Georgia-Italic`
            spans on its matched topic names; **plate 03 carries ZERO.** Both
            surfaces' scoring layers produce `matchedTerms`, so gating on the
            data would italicise the event report too — which is why the gate is
            `surface === "job"` and why the event path's byte-identity has its
            own test.

            B's CORRECTION, CARRIED: plate 02 has FOUR italic spans but only
            THREE terms — `interfacial resistance` is one term wrapped across a
            line, the `, ` separators sit outside both halves, and the plate's
            own sentence reads `Matches 3 of your required topics`. Italicising
            TERMS gets the wrap for free, because an inline element wraps
            natively. **Unlike `HighlightedText`'s background chip, italic needs
            no `box-decoration-clone`** — do not add one.

            ITALIC ONLY: the plate's italic spans carry the SAME size (12.75)
            and the SAME colour (`#4d3a28`) as the prose around them. No tint,
            no size step.

            NO NEW MATCHER. `highlightSegments` is the build's own segmenter and
            already handles case-insensitive matching against the original text,
            word boundaries that still admit `R&D`, longest-first overlap
            MERGING (so nested emphasis is impossible), de-duplication, regex
            escaping, and the empty case — which is what satisfies Ruling 73's
            "empty `matchedTerms` means no italic" without a second branch. */}
        <p className="font-reading text-body-lg leading-8 text-text">
          {surface === "job"
            ? highlightSegments(sentence, matchedTerms ?? []).map((segment, index) =>
                segment.matched ? (
                  <em key={`match-${index}`} className="italic">
                    {segment.text}
                  </em>
                ) : (
                  segment.text
                ),
              )
            : sentence}
        </p>
      </div>
    </section>
  );
}
