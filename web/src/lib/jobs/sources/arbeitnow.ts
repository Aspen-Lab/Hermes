import { sourceFetch } from "@/lib/sources/_fetch";
import { routeSafeId, stripHtml, truncateText } from "@/lib/opportunities/shared";
import { parseStructuredLocation } from "@/lib/opportunities/structured-extract";
import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";

// Arbeitnow's free job-board API (EU/DACH-heavy, no auth, no search param) —
// we pull the newest page and let the keyword gate filter for relevance.
const REVALIDATE_SECONDS = 3 * 60 * 60;

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
}

export function arbeitnowJobToRawItem(job: ArbeitnowJob): RawJobItem | null {
  const title = job.title?.trim();
  const url = job.url?.trim();
  if (!title || !url || !job.slug) return null;
  const location = job.location?.trim() || (job.remote ? "Remote" : "");
  return {
    id: `arbeitnow:${routeSafeId(String(job.slug))}`,
    source: "arbeitnow",
    title,
    company: job.company_name?.trim() || "Unknown company",
    location,
    place: parseStructuredLocation(location),
    isRemote: Boolean(job.remote),
    description: truncateText(stripHtml(job.description)),
    url,
    postedAt:
      typeof job.created_at === "number"
        ? new Date(job.created_at * 1000).toISOString()
        : undefined,
    employmentType: job.job_types?.[0],
    tags: (job.tags ?? []).filter((t) => Boolean(t && t.trim())),
  };
}

async function fetchImpl(query: JobsQuery): Promise<RawJobItem[]> {
  const res = await sourceFetch("https://www.arbeitnow.com/api/job-board-api", {
    revalidate: REVALIDATE_SECONDS,
  });
  if (!res.ok) {
    console.error("[jobs/arbeitnow] non-ok response:", res.status);
    return [];
  }
  const data = (await res.json()) as ArbeitnowResponse;
  return (data.data ?? [])
    .map(arbeitnowJobToRawItem)
    .filter((item): item is RawJobItem => item !== null)
    .slice(0, query.limit);
}

export const arbeitnow: JobSourceAdapter = {
  id: "arbeitnow",
  enabled: () => true,
  fetch: fetchImpl,
};
