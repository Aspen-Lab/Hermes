import { sourceFetch } from "@/lib/sources/_fetch";
import { routeSafeId, stripHtml, truncateText } from "@/lib/opportunities/shared";
import { parseStructuredLocation } from "@/lib/opportunities/structured-extract";
import type { JobSourceAdapter, JobsQuery, RawJobItem } from "../types";

// Adzuna aggregates postings across 19 countries — the strongest industry-side
// source. Free tier; requires ADZUNA_APP_ID + ADZUNA_APP_KEY.
const REVALIDATE_SECONDS = 3 * 60 * 60;

interface AdzunaJob {
  id?: string | number;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  created?: string;
  category?: { label?: string };
  contract_time?: string;
}

interface AdzunaResponse {
  results?: AdzunaJob[];
}

// Country slug for the Adzuna endpoint, guessed from location preferences.
const COUNTRY_SLUGS: Array<[RegExp, string]> = [
  [/\b(united states|usa|us|america|california|new york|boston|seattle)\b/i, "us"],
  [/\b(united kingdom|uk|england|london|scotland|cambridge|oxford)\b/i, "gb"],
  [/\b(germany|deutschland|berlin|munich)\b/i, "de"],
  [/\b(canada|toronto|vancouver|montreal)\b/i, "ca"],
  [/\b(australia|sydney|melbourne)\b/i, "au"],
  [/\b(netherlands|amsterdam)\b/i, "nl"],
  [/\b(france|paris)\b/i, "fr"],
  [/\b(switzerland|zurich|geneva|lausanne)\b/i, "ch"],
  [/\b(singapore)\b/i, "sg"],
  [/\b(india|bangalore|bengaluru|delhi|mumbai)\b/i, "in"],
];

const COUNTRY_NAMES_BY_SLUG: Record<string, string> = {
  au: "Australia",
  ca: "Canada",
  ch: "Switzerland",
  de: "Germany",
  fr: "France",
  gb: "United Kingdom",
  in: "India",
  nl: "Netherlands",
  sg: "Singapore",
  us: "United States",
};

export function adzunaCountries(locations: string[]): string[] {
  const matched = new Set<string>();
  for (const location of locations) {
    for (const [re, slug] of COUNTRY_SLUGS) {
      if (re.test(location)) matched.add(slug);
    }
  }
  if (matched.size === 0) matched.add("us");
  return Array.from(matched).slice(0, 2);
}

export function adzunaJobToRawItem(job: AdzunaJob, country: string): RawJobItem | null {
  const title = job.title?.trim();
  const url = job.redirect_url?.trim();
  if (!title || !url || job.id === undefined) return null;
  const location = job.location?.display_name?.trim() || country.toUpperCase();
  const extractedPlace = parseStructuredLocation(location);
  const countryName = COUNTRY_NAMES_BY_SLUG[country.toLowerCase()];
  return {
    id: `adzuna:${routeSafeId(String(job.id))}`,
    source: "adzuna",
    title: stripHtml(title),
    company: job.company?.display_name?.trim() || "Unknown company",
    location,
    place:
      extractedPlace || countryName
        ? {
            ...extractedPlace,
            country: extractedPlace?.country ?? countryName,
          }
        : undefined,
    isRemote: /\bremote\b/i.test(`${job.title} ${job.description ?? ""}`),
    description: truncateText(stripHtml(job.description)),
    url,
    postedAt: job.created,
    employmentType: job.contract_time,
    tags: [job.category?.label].filter((t): t is string => Boolean(t && t.trim())),
  };
}

function adzunaCreds(query: JobsQuery): { appId?: string; appKey?: string } {
  return {
    appId: query.apiKeys?.adzunaAppId?.trim() || process.env.ADZUNA_APP_ID,
    appKey: query.apiKeys?.adzunaAppKey?.trim() || process.env.ADZUNA_APP_KEY,
  };
}

async function fetchImpl(query: JobsQuery): Promise<RawJobItem[]> {
  const { appId, appKey } = adzunaCreds(query);
  if (!appId || !appKey) return [];

  const countries = adzunaCountries(query.locations);
  const what = query.queries[0] ?? query.topics[0] ?? "";
  if (!what) return [];

  const all: RawJobItem[] = [];
  for (const country of countries) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what,
      results_per_page: "50",
      max_days_old: "30",
      "content-type": "application/json",
    });
    try {
      const res = await sourceFetch(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
        { revalidate: REVALIDATE_SECONDS },
      );
      if (!res.ok) {
        console.error("[jobs/adzuna] non-ok response:", res.status, country);
        continue;
      }
      const data = (await res.json()) as AdzunaResponse;
      for (const job of data.results ?? []) {
        const item = adzunaJobToRawItem(job, country);
        if (item) all.push(item);
      }
    } catch (err) {
      console.error("[jobs/adzuna] fetch error:", err);
    }
  }
  return all.slice(0, query.limit);
}

export const adzuna: JobSourceAdapter = {
  id: "adzuna",
  enabled: (query) => {
    const { appId, appKey } = adzunaCreds(query);
    return Boolean(appId && appKey);
  },
  fetch: fetchImpl,
};
