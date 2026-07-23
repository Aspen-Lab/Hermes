import { sourceFetch } from "@/lib/sources/_fetch";
import { routeSafeId, stripHtml, truncateText } from "@/lib/opportunities/shared";
import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";

// Remotive ToS: attribute + link back to the Remotive URL (we do — linkPosting
// points at the Remotive listing) and fetch at most a few times a day. The
// 6h revalidate keeps us at ≤4 origin hits/day per query.
const REVALIDATE_SECONDS = 6 * 60 * 60;

interface RemotiveJob {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

export function remotiveJobToRawItem(job: RemotiveJob): RawJobItem | null {
  const title = job.title?.trim();
  const url = job.url?.trim();
  if (!title || !url || !job.id) return null;
  return {
    id: `remotive:${routeSafeId(String(job.id))}`,
    source: "remotive",
    title,
    company: job.company_name?.trim() || "Unknown company",
    location: job.candidate_required_location?.trim() || "Remote",
    isRemote: true,
    description: truncateText(stripHtml(job.description)),
    url,
    postedAt: job.publication_date,
    employmentType: job.job_type,
    tags: [job.category, ...(job.tags ?? [])].filter(
      (t): t is string => Boolean(t && t.trim()),
    ),
  };
}

async function fetchImpl(query: JobsQuery): Promise<RawJobItem[]> {
  // One request per load (rate-limit friendly): search on the primary topic,
  // let the Tier-0 keyword gate do the narrowing.
  const search = query.topics[0] ?? query.queries[0] ?? "";
  const params = new URLSearchParams({ limit: "80" });
  if (search) params.set("search", search);
  const res = await sourceFetch(
    `https://remotive.com/api/remote-jobs?${params}`,
    { revalidate: REVALIDATE_SECONDS },
  );
  if (!res.ok) {
    console.error("[jobs/remotive] non-ok response:", res.status);
    return [];
  }
  const data = (await res.json()) as RemotiveResponse;
  return (data.jobs ?? [])
    .map(remotiveJobToRawItem)
    .filter((item): item is RawJobItem => item !== null)
    .slice(0, query.limit);
}

export const remotive: JobSourceAdapter = {
  id: "remotive",
  enabled: () => true,
  fetch: fetchImpl,
};
