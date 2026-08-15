import type { JobSourceId } from "./types";

/**
 * A22-03(b) / A25-01 / RULING 68b — **THE ONE SHARED REMOTE-CLAIM PREDICATE.**
 *
 * A `jobweb` row's `isRemote` is set at ingestion (`jobweb.ts:1244`) from a
 * page-scoped search snippet, tested against `title + snippet`, and nothing
 * revisits it. That snippet can carry a NEIGHBOURING posting's text: A22-03(b)'s
 * named row, `lensa.com`, is an Albuquerque internship whose snippet leaked
 * another posting's `Remote Alameda, CA`. Every other source sets `isRemote`
 * from a structured field of the item's OWN record, where it is owned.
 *
 * So the boundary is: **a `jobweb` row does not get to make a remote CLAIM to
 * the reader.** A22-03(b) drew that boundary once, inline, at `mapper.ts`.
 * A25-01 then measured it being crossed at a SIXTH consumer — the deep report's
 * "Why Peer sent this to you" line, assembled at scoring time from the raw flag
 * — and Ruling 68b commissioned this module so the boundary has ONE name that
 * both callers import, rather than a second inline copy that can drift.
 * Ruling 32 asks for exactly this: name the predicate, do not re-derive it.
 *
 * **WHAT THIS IS NOT.** It is not an ingestion edit and it is not a scoring
 * edit. `item.isRemote` is left exactly as it was, and the three DELIBERATE raw
 * readers A22-03(b) recorded stay raw and stay out of this module's reach:
 * `mapper.ts`'s `locationFit(location, item.isRemote, …)`, `scoring.ts`'s
 * `locationFit(item.location, item.isRemote, …)`, and `enrich.ts`'s
 * `isRemote: item.isRemote` passthrough. **The score depends on those and no
 * score may move.**
 *
 * **THREE MORE RAW READERS EXIST AND ARE DELIBERATELY NOT CONVERTED HERE**
 * (round 25 B's sweep; Ruling 68b commissions them, PRICED, to round 26 B):
 * the preference-ledger write in `scoring.ts`, the `facetCounts` built in
 * `jobs/pipeline.ts`, and the server-side facet filter in `jobs/pipeline.ts` —
 * the last of which makes the server and the client disagree about the same
 * row, because `facets.ts`'s `opportunityFormat` is duck-typed and reads the
 * RAW flag from the server pipeline and the GATED flag from the page. Those are
 * facet and ledger surfaces, not the deep report, and no census has measured
 * them. **Converting them is a one-line change against this module when round
 * 26 B has priced it. Doing it before then is scope violation, not tidiness.**
 *
 * A standalone module rather than an export from `mapper.ts`: `scoring.ts` does
 * not import `mapper.ts` today and vice versa, so exporting from there would
 * drag summarize/visa/job-cleanup/job-posting-scope/ledger into the scorer's
 * import graph for one boolean. This file's only import is a TYPE, so its
 * runtime dependency count is zero and so is the cycle risk.
 */
export function rendersRemoteClaim(item: {
  isRemote: boolean;
  source: JobSourceId;
}): boolean {
  return item.isRemote && item.source !== "jobweb";
}
