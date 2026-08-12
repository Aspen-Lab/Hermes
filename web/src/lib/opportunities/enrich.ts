import type { OpportunityPlace } from "@/types";
import type { RawEventItem } from "@/lib/events/types";
import { bestEventTitleSegment, looksLikeEventTitle } from "@/lib/events/sources/eventweb";
import type { RawJobItem } from "@/lib/jobs/types";
import { classifyRoleKind } from "@/lib/jobs/role-kind";
import { extractDeclaredEventName, extractEventDetails } from "./event-details";
import { extractEventRoster } from "./event-roster";
import { extractJobDetails } from "./job-details";
import { resolveEmployerIdentity } from "./employer-identity";
import { resolveJobPostingScope } from "./job-posting-scope";
import { fetchPagesConcurrently } from "./page-fetch";
import { extractOpportunityPageDetails } from "./structured-extract";
import { extractVisaState } from "./visa";

export const MAX_ENRICHMENT_CANDIDATES = 40;

function tryExtract<T>(extractor: () => T): T | undefined {
  try {
    return extractor();
  } catch {
    return undefined;
  }
}

function hasExtractedEventSignal(
  structured: ReturnType<typeof extractOpportunityPageDetails> | undefined,
  details: ReturnType<typeof extractEventDetails> | undefined,
  roster: ReturnType<typeof extractEventRoster> | undefined,
): boolean {
  return Boolean(
    structured?.typedOpportunityName ||
      structured?.startDate ||
      structured?.endDate ||
      structured?.place ||
      structured?.isOnline ||
      details?.registrationDeadline ||
      details?.fees?.length ||
      details?.activities?.length ||
      details?.travelGrant ||
      details?.invitationLetter ||
      details?.expectedSize ||
      roster?.organisations?.length ||
      roster?.people?.length,
  );
}

function hasExtractedJobSignal(
  structured: ReturnType<typeof extractOpportunityPageDetails> | undefined,
  details: ReturnType<typeof extractJobDetails> | undefined,
  visa: RawJobItem["visa"] | undefined,
  pageText: string | undefined,
): boolean {
  return Boolean(
    structured?.datePosted ||
      structured?.place ||
      details?.applicationDeadline ||
      details?.startDate ||
      // B3-06. Without this, a posting where flexibility is the only new
      // signal found would cause enrichJobCandidates to discard the whole
      // enrichment below, silently throwing away the extracted flag.
      details?.startDateFlexible ||
      details?.contractLength ||
      details?.applicationMaterials?.length ||
      // B4-11. Same reasoning as startDateFlexible above: a posting whose
      // only new signal is salary, employment type, or work mode must not be
      // discarded by this gate.
      details?.salary ||
      details?.employmentType ||
      details?.workMode ||
      pageText ||
      (visa &&
        (visa.state !== "not-stated" || visa.evidence || visa.country)),
  );
}

export function formatOpportunityPlace(
  place: OpportunityPlace | undefined,
): string {
  if (!place) return "";
  return [place.city, place.region, place.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(", ");
}

export function mergeOpportunityPlace(
  current: OpportunityPlace | undefined,
  extracted: OpportunityPlace | undefined,
): OpportunityPlace | undefined {
  const merged = {
    city: extracted?.city || current?.city,
    region: extracted?.region || current?.region,
    country: extracted?.country || current?.country,
  };
  return merged.city || merged.region || merged.country ? merged : undefined;
}

export async function enrichEventCandidates(
  items: RawEventItem[],
  limit = MAX_ENRICHMENT_CANDIDATES,
): Promise<RawEventItem[]> {
  if (items.length === 0) return [];
  const cappedLength = Math.min(
    items.length,
    Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : MAX_ENRICHMENT_CANDIDATES,
  );
  const candidates = items.slice(0, cappedLength);

  let pages: Array<string | null>;
  try {
    pages = await fetchPagesConcurrently(
      candidates.map((item) => item.url),
    );
  } catch {
    return items;
  }

  const enriched = candidates.map((item, index) => {
    const html = pages[index];
    if (!html) return item;
    const structured = tryExtract(() =>
      extractOpportunityPageDetails(html, "event"),
    );
    const details = tryExtract(() => extractEventDetails(html));
    const declaredEventName = tryExtract(() => extractDeclaredEventName(html));
    const roster = tryExtract(() => extractEventRoster(html));
    if (!hasExtractedEventSignal(structured, details, roster) && !declaredEventName) return item;
    const place = mergeOpportunityPlace(item.place, structured?.place);
    const location = formatOpportunityPlace(place) || item.location;
    // B6-01: reuse the guarded ingestion title segment. A fetched title can
    // improve the name only when it contains its own non-chrome event title.
    const typedName = structured?.typedOpportunityName;
    const name = typedName
      ? bestEventTitleSegment(typedName, item.url) ??
        (looksLikeEventTitle(typedName) ? typedName : undefined) ??
        declaredEventName ??
        (structured?.openGraphTitle
          ? bestEventTitleSegment(structured.openGraphTitle, item.url)
          : undefined) ??
        item.name
      : declaredEventName ??
        (structured?.openGraphTitle
          ? bestEventTitleSegment(structured.openGraphTitle, item.url)
          : undefined) ??
        item.name;
    return {
      ...item,
      name,
      startDate: item.startDate || structured?.startDate || "",
      endDate: item.endDate || structured?.endDate,
      place,
      location,
      isOnline: item.isOnline || structured?.isOnline || false,
      registrationDeadline:
        item.registrationDeadline ?? details?.registrationDeadline,
      fees: item.fees ?? details?.fees,
      activities: item.activities ?? details?.activities,
      organisations: item.organisations ?? roster?.organisations,
      people: item.people ?? roster?.people,
      travelGrant: item.travelGrant ?? details?.travelGrant,
      invitationLetter: item.invitationLetter ?? details?.invitationLetter,
      expectedSize: item.expectedSize ?? details?.expectedSize,
    };
  });

  return [...enriched, ...items.slice(cappedLength)];
}

export async function enrichJobCandidates(
  items: RawJobItem[],
  limit = MAX_ENRICHMENT_CANDIDATES,
): Promise<RawJobItem[]> {
  if (items.length === 0) return [];
  const cappedLength = Math.min(
    items.length,
    Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : MAX_ENRICHMENT_CANDIDATES,
  );
  const candidates = items.slice(0, cappedLength);

  let pages: Array<string | null>;
  try {
    pages = await fetchPagesConcurrently(
      candidates.map((item) => item.url),
    );
  } catch {
    return items;
  }

  const enriched = candidates.map((item, index) => {
    const html = pages[index];
    if (!html) return item;
    const scope = tryExtract(() => resolveJobPostingScope(html, { url: item.url, title: item.title })) ?? { status: "unproven" as const };
    if (scope.status === "unproven") {
      return { ...item, fetchedPostingScope: "unproven" as const };
    }
    const structured = scope.status === "owned" ? scope.structured : undefined;
    const structuredDetails = structured
      ? { ...structured, isOnline: false }
      : undefined;
    const details = scope.status === "owned"
      ? tryExtract(() => extractJobDetails(scope.text, new Date(), structured))
      : undefined;
    const pageText = scope.status === "owned" ? scope.text : undefined;
    const place = mergeOpportunityPlace(item.place, structured?.place);
    const roleKind =
      item.roleKind ??
      tryExtract(() =>
        classifyRoleKind(item.title, pageText ?? ""),
      );
    const visa = item.visa ?? (pageText
      ? tryExtract(() => extractVisaState(pageText, place?.country))
      : undefined);
    const employer = resolveEmployerIdentity({
      catalogLabel: item.company,
      structuredOrganizations: structured?.hiringOrganization,
      ownedTexts: [item.description, pageText].filter((text): text is string => Boolean(text)),
    });
    const company = employer.status === "ambiguous"
      ? undefined
      : employer.status === "none"
        ? item.company
        : employer.company;
    if (!hasExtractedJobSignal(structuredDetails, details, visa, pageText) && company === item.company) return item;
    return {
      ...item,
      place,
      location: formatOpportunityPlace(place) || item.location,
      // Web-discovered postings arrive with no date at all, which left the
      // jobs month facet permanently empty. schema.org JobPosting carries
      // datePosted; use it when the source gave us nothing.
      postedAt: item.postedAt || structured?.datePosted,
      applicationDeadline:
        item.applicationDeadline ?? details?.applicationDeadline,
      startDate: item.startDate ?? details?.startDate,
      startDateFlexible: item.startDateFlexible ?? details?.startDateFlexible,
      contractLength: item.contractLength ?? details?.contractLength,
      applicationMaterials:
        item.applicationMaterials ?? details?.applicationMaterials,
      // B4-11. JSON-LD JobPosting.baseSalary/employmentType, extracted
      // upstream in extractJobDetails alongside every other field this merge
      // already prefers-existing-then-falls-back-to. Adzuna/USAJobs already
      // populate these four from their own structured fields before
      // enrichment runs, so `item.X ?? details?.X` only ever fills a gap a
      // source left empty -- it cannot overwrite a real value with a worse
      // one, and the four always arrive together or not at all on either
      // side (see B4-11's own note on normalizeSalary's all-or-nothing
      // return).
      salaryMin: item.salaryMin ?? details?.salary?.min,
      salaryMax: item.salaryMax ?? details?.salary?.max,
      salaryCurrency: item.salaryCurrency ?? details?.salary?.currency,
      salaryPeriod: item.salaryPeriod ?? details?.salary?.period,
      employmentType: item.employmentType ?? details?.employmentType,
      // B4-11. Free-text hybrid/on-site signal from the fetched page;
      // scoredJobToJob() prefers this over its own cheap location-string
      // check when present (mapper.ts's jobWorkMode).
      workMode: item.workMode ?? details?.workMode,
      roleKind,
      visa,
      company,
      // B6-07: retain full furniture-stripped text separately so only the
      // report summary upgrades; scoring continues to use source snippets.
      pageText: item.pageText ?? pageText,
      fetchedPostingScope: scope.status,
      // A web page being "online" does not prove that a job is remote.
      isRemote: item.isRemote,
    };
  });

  return [...enriched, ...items.slice(cappedLength)];
}
