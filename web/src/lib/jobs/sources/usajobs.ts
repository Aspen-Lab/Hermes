import { stripHtml, truncateText } from "@/lib/opportunities/shared";
import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";

// USAJobs: US federal research positions (NIH, NSF, national labs). Free key
// from developer.usajobs.gov. Requires USAJOBS_API_KEY + USAJOBS_USER_AGENT
// (the registered email address).

interface UsaJobsDescriptor {
  PositionID?: string;
  PositionTitle?: string;
  OrganizationName?: string;
  PositionLocationDisplay?: string;
  PositionURI?: string;
  PublicationStartDate?: string;
  UserArea?: { Details?: { JobSummary?: string; MajorDuties?: string[] } };
  PositionSchedule?: Array<{ Name?: string }>;
  JobCategory?: Array<{ Name?: string }>;
}

interface UsaJobsResponse {
  SearchResult?: {
    SearchResultItems?: Array<{ MatchedObjectDescriptor?: UsaJobsDescriptor }>;
  };
}

export function usaJobsDescriptorToRawItem(
  descriptor: UsaJobsDescriptor,
): RawJobItem | null {
  const title = descriptor.PositionTitle?.trim();
  const url = descriptor.PositionURI?.trim();
  const id = descriptor.PositionID?.trim();
  if (!title || !url || !id) return null;
  const details = descriptor.UserArea?.Details;
  const summary = [details?.JobSummary, ...(details?.MajorDuties ?? [])]
    .filter(Boolean)
    .join("\n");
  return {
    id: `usajobs:${id}`,
    source: "usajobs",
    title,
    company: descriptor.OrganizationName?.trim() || "U.S. Federal Government",
    location: descriptor.PositionLocationDisplay?.trim() || "United States",
    isRemote: /\bremote\b/i.test(descriptor.PositionLocationDisplay ?? ""),
    description: truncateText(stripHtml(summary)),
    url,
    postedAt: descriptor.PublicationStartDate,
    employmentType: descriptor.PositionSchedule?.[0]?.Name,
    tags: (descriptor.JobCategory ?? [])
      .map((c) => c.Name)
      .filter((t): t is string => Boolean(t && t.trim())),
  };
}

async function fetchImpl(query: JobsQuery): Promise<RawJobItem[]> {
  const apiKey = process.env.USAJOBS_API_KEY;
  const userAgent = process.env.USAJOBS_USER_AGENT;
  if (!apiKey || !userAgent) return [];

  const keyword = query.queries[0] ?? query.topics[0] ?? "";
  if (!keyword) return [];
  const params = new URLSearchParams({
    Keyword: keyword,
    ResultsPerPage: "50",
  });
  try {
    const res = await fetch(`https://data.usajobs.gov/api/search?${params}`, {
      headers: {
        Host: "data.usajobs.gov",
        "User-Agent": userAgent,
        "Authorization-Key": apiKey,
      },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 3 * 60 * 60 },
    });
    if (!res.ok) {
      console.error("[jobs/usajobs] non-ok response:", res.status);
      return [];
    }
    const data = (await res.json()) as UsaJobsResponse;
    return (data.SearchResult?.SearchResultItems ?? [])
      .map((item) =>
        item.MatchedObjectDescriptor
          ? usaJobsDescriptorToRawItem(item.MatchedObjectDescriptor)
          : null,
      )
      .filter((item): item is RawJobItem => item !== null)
      .slice(0, query.limit);
  } catch (err) {
    console.error("[jobs/usajobs] fetch error:", err);
    return [];
  }
}

export const usajobs: JobSourceAdapter = {
  id: "usajobs",
  enabled: () =>
    Boolean(process.env.USAJOBS_API_KEY && process.env.USAJOBS_USER_AGENT),
  fetch: fetchImpl,
};
