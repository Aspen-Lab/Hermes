import type { Job, PreferenceConcept } from "@/types";
import {
  normalizePreferenceConcepts,
  preferenceKey,
} from "@/lib/preferences/ledger";
import { summarizeJob } from "@/lib/jobs/summarize";
import { locationFit } from "@/lib/opportunities/shared";
import { normalizeVisaCountry } from "@/lib/opportunities/visa";
import {
  cleanJobDescription,
  cleanJobSubtitlePart,
  cleanJobTitle,
} from "@/lib/opportunities/job-cleanup";
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
  const summary =
    summarizeJob(cleanJobDescription(item.description), item.matchedKeywords, roleTitle) ||
    undefined;
  const fallbackCompany = (() => {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return "Employer not stated";
    }
  })();
  const company = cleanJobSubtitlePart(item.company) ?? fallbackCompany;
  const location =
    cleanJobSubtitlePart(item.location) ??
    (item.isRemote ? "Remote" : "See posting");

  return {
    id: item.id,
    roleTitle,
    companyOrLab: company,
    location,
    place: item.place,
    isRemote: item.isRemote,
    // B4-11. item.workMode is only ever set upstream, during enrichment, from
    // the posting's own fetched-page text (see job-details.ts's
    // extractWorkMode). When present it wins; otherwise this is exactly the
    // pre-B4-11 expression, unchanged.
    workMode: item.workMode ?? jobWorkMode(item.location, item.isRemote),
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
