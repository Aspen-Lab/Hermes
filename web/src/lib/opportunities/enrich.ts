import type { OpportunityPlace } from "@/types";
import type { RawEventItem } from "@/lib/events/types";
import type { RawJobItem } from "@/lib/jobs/types";
import { classifyRoleKind } from "@/lib/jobs/role-kind";
import { extractEventDetails } from "./event-details";
import { extractEventRoster } from "./event-roster";
import { extractJobDetails } from "./job-details";
import { fetchPagesConcurrently } from "./page-fetch";
import { stripHtml } from "./shared";
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
    const roster = tryExtract(() => extractEventRoster(html));
    const place = mergeOpportunityPlace(item.place, structured?.place);
    const location = formatOpportunityPlace(place) || item.location;
    return {
      ...item,
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
    const structured = tryExtract(() =>
      extractOpportunityPageDetails(html, "job"),
    );
    const details = tryExtract(() => extractJobDetails(html));
    const place = mergeOpportunityPlace(item.place, structured?.place);
    const roleKind =
      item.roleKind ??
      tryExtract(() => classifyRoleKind(item.title, stripHtml(html)));
    const visa =
      item.visa ??
      tryExtract(() => extractVisaState(html, place?.country));
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
      contractLength: item.contractLength ?? details?.contractLength,
      applicationMaterials:
        item.applicationMaterials ?? details?.applicationMaterials,
      roleKind,
      visa,
      // A web page being "online" does not prove that a job is remote.
      isRemote: item.isRemote,
    };
  });

  return [...enriched, ...items.slice(cappedLength)];
}
