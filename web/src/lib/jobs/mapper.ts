import type { Job, PreferenceConcept } from "@/types";
import {
  normalizePreferenceConcepts,
  preferenceKey,
} from "@/lib/preferences/ledger";
import { summarizeJob } from "@/lib/jobs/summarize";
import { locationFit } from "@/lib/opportunities/shared";
import { ownedTextHasPostingSubstance } from "@/lib/opportunities/job-posting-scope";
import { normalizeVisaCountry } from "@/lib/opportunities/visa";
import {
  cleanJobDescription,
  cleanJobSubtitlePart,
  cleanJobTitle,
} from "@/lib/opportunities/job-cleanup";
import { stripRedundantEmployerClause } from "./employer-clause";
import { rendersRemoteClaim } from "./remote-claim";
import type { ScoredJobItem } from "./types";

const MAX_SIGNALS = 8;
const MAX_REQUIREMENTS = 4;

/**
 * Concepts the ledger learns from when the user saves/dismisses this job:
 * the matched profile topics (bridging to paper-side concepts by label) plus
 * the posting's own tags.
 */
export function jobPreferenceSignals(item: ScoredJobItem): PreferenceConcept[] {
  const company = cleanJobSubtitlePart(item.company) ?? "";
  return normalizePreferenceConcepts([
    // Employer identity first, so feedback tunes toward/away from specific
    // companies and labs, not just their topic tags.
    ...(company
      ? [
          {
            key: preferenceKey(company, "job_tag"),
            label: company,
            source: "job_tag" as const,
          },
        ]
      : []),
    ...item.matchedKeywords.map((label) => ({
      key: preferenceKey(label, "job_tag"),
      label,
      source: "job_tag" as const,
    })),
    ...item.tags.map((label) => ({
      key: preferenceKey(label, "job_tag"),
      label,
      source: "job_tag" as const,
    })),
  ]).slice(0, MAX_SIGNALS);
}

function keyRequirements(item: ScoredJobItem): string[] {
  const requirements: string[] = [];
  const seen = new Set<string>();
  for (const tag of item.tags) {
    const cleaned = tag.trim();
    if (!cleaned || cleaned.length > 60) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push(cleaned);
    if (requirements.length >= MAX_REQUIREMENTS) break;
  }
  if (requirements.length === 0) {
    for (const keyword of item.matchedKeywords.slice(0, MAX_REQUIREMENTS)) {
      requirements.push(keyword);
    }
  }
  return requirements;
}

/**
 * B2-06, layer 2. Job carries only `isRemote`; the plate needs a three-state
 * work mode. Only ever set from a signal the posting actually gave:
 * `isRemote` is already a real extracted fact, and "hybrid" / "on-site" here
 * come from the posting's own location text saying so — the same detection
 * `opportunityFormat()` (`web/src/lib/opportunities/facets.ts`) already uses
 * for the facet/filter system, reused rather than re-invented. A location
 * that says neither returns `undefined`; inferring "probably on-site" from
 * silence is the exact dishonesty Phase 7 removed.
 *
 * B4-11. This cheap check only ever sees `item.location`, which is always
 * `""` for a `jobweb`-sourced posting (Tavily/Brave results carry no
 * structured location field) — so it can never resolve "hybrid" or
 * "on-site" for that source no matter what the real posting says. See
 * `scoredJobToJob` below: `item.workMode`, extracted upstream from the
 * fetched page's own free text during enrichment, now takes precedence over
 * this function's result when present, and this function still runs exactly
 * as before whenever it is absent.
 */
function jobWorkMode(location: string, isRemote: boolean): Job["workMode"] {
  if (/\bhybrid\b/i.test(location)) return "hybrid";
  if (/\bon[\s-]?site\b|\bin[\s-]?person\b/i.test(location)) return "on-site";
  return isRemote ? "remote" : undefined;
}

function visaForAuthorisedCountries(
  item: ScoredJobItem,
  authorisedCountries: string[] | undefined,
): Job["visa"] {
  if (!item.visa || !authorisedCountries?.length) return item.visa;
  const country = normalizeVisaCountry(
    item.visa.country ?? item.place?.country,
  );
  if (!country) return item.visa;
  const authorised = new Set(
    authorisedCountries
      .map((candidate) => normalizeVisaCountry(candidate))
      .filter((candidate): candidate is string => Boolean(candidate)),
  );
  return authorised.has(country) ? undefined : item.visa;
}

export function scoredJobToJob(
  item: ScoredJobItem,
  locationPreferences?: string[],
  authorisedCountries?: string[],
): Job {
  const salary =
    item.salaryMin !== undefined &&
    item.salaryMax !== undefined &&
    item.salaryCurrency !== undefined &&
    item.salaryPeriod !== undefined
      ? {
          min: item.salaryMin,
          max: item.salaryMax,
          currency: item.salaryCurrency,
          period: item.salaryPeriod,
        }
      : undefined;
  // B5-07/R4. roleTitle now computed before summary (was after) so its
  // value can be threaded into summarizeJob()'s title-echo check.
  const roleTitle = cleanJobTitle(item.title) || item.title.trim();
  // A22-03(a) (round 22 C): FAIL-CLOSED. `fetchedPostingScope` has THREE
  // states, not two — `"owned"`, `"unproven"`, and `undefined` — and the gate
  // used to name only `"unproven"`. So `undefined`, which is precisely the
  // state where the page could not be fetched AT ALL (`enrich.ts:382`'s
  // `if (!html) return item;`, reached when `lensa.com` answered 403), fell to
  // the right-hand branch and published `item.description`: the provider's
  // PAGE-SCOPED search snippet, which on an aggregator page belongs to
  // whichever posting the provider chose to show. The failure ran exactly
  // backwards — a page Peer could not read was trusted MORE than one it read
  // and could not attribute. Publication now requires proven ownership, and
  // ownership must also carry a body (Ruling 60d's floor), because `owned`
  // proves whose text it is and not that there is any.
  //
  // B measured the whole live pool: ONE summary existed, it was the wrong
  // posting's, and this removes exactly it. Correct summaries lost: ZERO. The
  // card falls back to the `Matches your …` line A21-04 already shipped, so no
  // new rendering shape appears.
  //
  // The `?? item.description` tail is kept untouched and is unreachable under
  // `owned`: enrichment always sets `pageText` from `scope.text` on that
  // branch. Narrowing it would be an unearned edit.
  const ownedBody =
    item.fetchedPostingScope === "owned" ? item.pageText ?? item.description : undefined;
  const summarySource =
    ownedBody && ownedTextHasPostingSubstance(ownedBody) ? ownedBody : undefined;
  const summary = summarySource
    ? summarizeJob(cleanJobDescription(summarySource), item.matchedKeywords, roleTitle) || undefined
    : undefined;
  // B6-03 (round 6): absence is more honest than a hostname or placeholder.
  const company = cleanJobSubtitlePart(item.company);
  // A22-03(b) (round 22 C): a snippet-derived `remote` may not be RENDERED.
  // `jobweb` sets `isRemote` at ingestion from the same page-scoped snippet
  // (`jobweb.ts:1244`, tested against `title + snippet`) and nothing revisits
  // it — `enrich.ts:511` restates it unchanged. `lensa.com`'s snippet carried
  // another posting's `Remote Alameda, CA`, so an Albuquerque internship
  // rendered as remote. Every other source sets `isRemote` from a structured
  // field of the item's OWN record, where it is owned, and is untouched.
  //
  // THIS IS A RENDER-BOUNDARY EDIT, NOT AN INGESTION ONE. `item.isRemote` is
  // left exactly as it was and still feeds `locationFit` below and
  // `scoring.ts`'s own, so no score moves. What changes is only what the
  // reader is shown. `item.workMode`, which enrichment derives from OWNED page
  // text, still wins outright when present — the honest source is unaffected.
  // A25-01 / RULING 68b: the expression that used to sit inline here is now the
  // shared predicate in `./remote-claim`, so the reason line built at scoring
  // time draws the same boundary instead of a second copy of it. Same value,
  // same behaviour — `rendersRemoteClaim` IS this expression, moved.
  const rendersRemote = rendersRemoteClaim(item);
  const location =
    cleanJobSubtitlePart(item.location) ??
    (rendersRemote ? "Remote" : "See posting");

  return {
    id: item.id,
    // A26-01 (round 26 C, item 1). The employer is stated twice on two adjacent
    // lines — title `… at Tesla` over subtitle `Tesla` — on three hosts this
    // window (`ev.careers`, `grad.wisc.edu`, `careers.jnj.com`). The strip lands
    // HERE, at the field, and NOT on `roleTitle` itself: `summarizeJob(...)`
    // above takes `roleTitle` as its title-echo check, an ordering B5-07/R4
    // established deliberately and which is commented at :132. Shortening that
    // input would weaken a check nobody asked to weaken.
    roleTitle: stripRedundantEmployerClause(roleTitle, company),
    companyOrLab: company,
    location,
    place: item.place,
    // A22-03(b): the RENDERED flag, gated with `location` above. Four view
    // layers read this field directly and each turns it into the word
    // "Remote" — `cards/feed-tile.tsx`, `cards/briefing-hero.tsx`,
    // `cards/briefing-quick-hit.tsx` and `jobs/card.ts` — so gating only
    // `location`/`workMode` would have left the wrong value on the card B
    // actually measured. The raw `item.isRemote` above is untouched.
    isRemote: rendersRemote,
    // B4-11. item.workMode is only ever set upstream, during enrichment, from
    // the posting's own fetched-page text (see job-details.ts's
    // extractWorkMode). When present it wins; otherwise this is exactly the
    // pre-B4-11 expression, unchanged.
    workMode: item.workMode ?? jobWorkMode(item.location, rendersRemote),
    keyRequirements: keyRequirements(item),
    matchReason: item.matchReason,
    facetPreferenceReason: item.facetPreferenceReason,
    linkPosting: item.url,
    postedDate: item.postedAt,
    applicationDeadline: item.applicationDeadline,
    startDate: item.startDate,
    // B3-06. A plain passthrough, not a derived field like `workMode` above
    // — by the time the mapper runs, extraction has already happened
    // upstream (`extractJobDetails` / `enrichJobCandidates`); there is
    // nothing left for the mapper itself to derive.
    startDateFlexible: item.startDateFlexible,
    contractLength: item.contractLength,
    applicationMaterials: item.applicationMaterials,
    // V26-J06 / Ruling 74. Plain passthroughs, like the three fields above:
    // extraction already happened upstream in `extractJobDetails`.
    eligibility: item.eligibility,
    team: item.team,
    roleKind: item.roleKind,
    visa: visaForAuthorisedCountries(item, authorisedCountries),
    relevanceScore: item.score,
    isSaved: false,
    preferenceSignals: jobPreferenceSignals(item),
    salary,
    salaryIsEstimated: salary ? item.salaryIsEstimated : undefined,
    employmentType: item.employmentType,
    sourceId: item.source,
    summary,
    matchedTerms: item.matchedKeywords.length > 0 ? item.matchedKeywords : undefined,
    locationFit: locationPreferences
      ? locationFit(location, item.isRemote, locationPreferences)
      : undefined,
  };
}
