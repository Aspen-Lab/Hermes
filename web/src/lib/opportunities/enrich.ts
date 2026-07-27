import type { OpportunityPlace } from "@/types";
import type { RawEventItem } from "@/lib/events/types";
import type { RawJobItem } from "@/lib/jobs/types";
import { fetchPagesConcurrently } from "./page-fetch";
import { extractOpportunityPageDetails } from "./structured-extract";

export const MAX_ENRICHMENT_CANDIDATES = 40;

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
    try {
      const details = extractOpportunityPageDetails(html, "event");
      const place = mergeOpportunityPlace(item.place, details.place);
      const location = formatOpportunityPlace(place) || item.location;
      return {
        ...item,
        startDate: item.startDate || details.startDate || "",
        endDate: item.endDate || details.endDate,
        place,
        location,
        isOnline: item.isOnline || details.isOnline,
      };
    } catch {
      return item;
    }
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
    try {
      const details = extractOpportunityPageDetails(html, "job");
      const place = mergeOpportunityPlace(item.place, details.place);
      return {
        ...item,
        place,
        location: formatOpportunityPlace(place) || item.location,
        // Web-discovered postings arrive with no date at all, which left the
        // jobs month facet permanently empty. schema.org JobPosting carries
        // datePosted; use it when the source gave us nothing.
        postedAt: item.postedAt || details.datePosted,
        // A web page being "online" does not prove that a job is remote.
        isRemote: item.isRemote,
      };
    } catch {
      return item;
    }
  });

  return [...enriched, ...items.slice(cappedLength)];
}
