import { sourceFetch } from "@/lib/sources/_fetch";
import { routeSafeId, stripHtml, truncateText } from "@/lib/opportunities/shared";
import { parseStructuredLocation } from "@/lib/opportunities/structured-extract";
import { normalizeSalary } from "@/lib/opportunities/salary";
import { resolveEmployerIdentity } from "@/lib/opportunities/employer-identity";
import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";

// Himalayas free remote-jobs API (no auth). The keyword param is not honored
// server-side, so we pull the newest page and rely on the Tier-0 keyword gate.
const REVALIDATE_SECONDS = 3 * 60 * 60;

interface HimalayasJob {
  title?: string;
  excerpt?: string;
  companyName?: string;
  employmentType?: string;
  seniority?: string[];
  locationRestrictions?: string[];
  categories?: string[];
  parentCategories?: string[];
  description?: string;
  pubDate?: number;
  applicationLink?: string;
  guid?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  salaryPeriod?: string | null;
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
}

export function himalayasJobToRawItem(job: HimalayasJob): RawJobItem | null {
  const title = job.title?.trim();
  const url = job.applicationLink?.trim() || job.guid?.trim();
  if (!title || !url) return null;
  const locations = (job.locationRestrictions ?? []).filter(Boolean);
  const location =
    locations.length > 0 ? `Remote (${locations.join(", ")})` : "Remote";
  const salary = normalizeSalary({
    min: job.minSalary,
    max: job.maxSalary,
    currency: job.currency,
    period: job.salaryPeriod,
  });
  const description = truncateText(stripHtml(job.description || job.excerpt));
  // An API excerpt is display/scoring copy, not proof that it belongs to this
  // selected record's employer identity. Only the full record description is.
  const ownedEmployerDescription = job.description
    ? truncateText(stripHtml(job.description))
    : undefined;
  // B8-04 (round 8): pass the listing's own host so a declared candidate
  // that is itself the page's site brand gets rejected. Himalayas has no
  // structured tier (no JSON-LD here), so this only guards ownedTexts, but
  // it keeps both resolveEmployerIdentity call sites consistent.
  let host: string | undefined;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = undefined;
  }
  const employer = resolveEmployerIdentity({
    catalogLabel: job.companyName,
    ownedTexts: ownedEmployerDescription ? [ownedEmployerDescription] : [],
    host,
  });
  return {
    id: `himalayas:${routeSafeId(url)}`,
    source: "himalayas",
    title,
    // B8-03 (round 8): the "none" branch was "|| Unknown company" - a
    // fabricated placeholder Ruling 26 already rejected in jobweb.ts, copy-
    // pasted here unaudited. `company` is already optional; absence is
    // honest, a made-up string is not.
    company: employer.status === "ambiguous"
      ? undefined
      : employer.status === "none"
        ? job.companyName?.trim() || undefined
        : employer.company,
    location,
    place: parseStructuredLocation(locations.join(", ")),
    isRemote: true,
    description,
    url,
    postedAt:
      typeof job.pubDate === "number"
        ? new Date(job.pubDate * 1000).toISOString()
        : undefined,
    employmentType: job.employmentType,
    salaryMin: salary?.min,
    salaryMax: salary?.max,
    salaryCurrency: salary?.currency,
    salaryPeriod: salary?.period,
    tags: [
      ...(job.categories ?? []).map((c) => c.replace(/-/g, " ")),
      ...(job.seniority ?? []),
    ].filter((t) => Boolean(t && t.trim())),
  };
}

async function fetchImpl(query: JobsQuery): Promise<RawJobItem[]> {
  // The API caps at 20 rows per request regardless of `limit` — pull three
  // pages in parallel for a useful newest-first window.
  const offsets = [0, 20, 40];
  const pages = await Promise.all(
    offsets.map(async (offset) => {
      try {
        const res = await sourceFetch(
          `https://himalayas.app/jobs/api?limit=20&offset=${offset}`,
          { revalidate: REVALIDATE_SECONDS },
        );
        if (!res.ok) {
          console.error("[jobs/himalayas] non-ok response:", res.status);
          return [] as HimalayasJob[];
        }
        const data = (await res.json()) as HimalayasResponse;
        return data.jobs ?? [];
      } catch (err) {
        console.error("[jobs/himalayas] fetch error:", err);
        return [] as HimalayasJob[];
      }
    }),
  );
  return pages
    .flat()
    .map(himalayasJobToRawItem)
    .filter((item): item is RawJobItem => item !== null)
    .slice(0, query.limit);
}

export const himalayas: JobSourceAdapter = {
  id: "himalayas",
  enabled: () => true,
  fetch: fetchImpl,
};
