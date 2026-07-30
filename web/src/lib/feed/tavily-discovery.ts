import { webSearch } from "@/lib/sources";
import type { RawItem } from "@/lib/sources/types";
import type { SearchBrief } from "./profile-compiler";
import type { FeedRequest } from "./types";

const ACADEMIC_INCLUDE_DOMAINS = [
  "arxiv.org",
  "openreview.net",
  "semanticscholar.org",
  "doi.org",
  "nature.com",
  "science.org",
  "sciencedirect.com",
  "springer.com",
  "link.springer.com",
  "cell.com",
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "biorxiv.org",
  "medrxiv.org",
  "acm.org",
  "ieeexplore.ieee.org",
  "dl.acm.org",
  "onlinelibrary.wiley.com",
  "frontiersin.org",
  "mdpi.com",
  "pubs.acs.org",
  "pnas.org",
];

const ACADEMIC_HOST_MATCHERS = ACADEMIC_INCLUDE_DOMAINS.map((domain) =>
  domain.toLowerCase(),
);

export interface TavilyDiscoveryResult {
  queryBoosts: string[];
  resultCount: number;
}

export function canRunTavilyDiscovery(req: FeedRequest): boolean {
  const connector = req.searchConnectors?.tavily;
  if (!connector?.enabled) return false;
  return Boolean(connector.apiKey?.trim() || process.env.TAVILY_API_KEY);
}

export async function runTavilyDiscovery(
  req: FeedRequest,
  brief: SearchBrief,
): Promise<TavilyDiscoveryResult> {
  if (!canRunTavilyDiscovery(req)) {
    return { queryBoosts: [], resultCount: 0 };
  }
  const connector = req.searchConnectors!.tavily!;

  const limit = brief.controls.sourceMix === "web" ? 12 : 8;
  const rawResults = await webSearch.fetch({
    topics: req.topics,
    queries: brief.generatedQueries,
    limit,
    timeWindow: brief.timeWindow,
    webSearch: {
      provider: "tavily",
      tavilyApiKey: connector.apiKey,
      includeDomains: ACADEMIC_INCLUDE_DOMAINS,
    },
  });

  const academicResults = rawResults.filter(isAcademicLead);
  const queryBoosts = buildQueryBoosts(academicResults, brief.generatedQueries);

  return {
    queryBoosts,
    resultCount: academicResults.length,
  };
}

function isAcademicLead(item: RawItem): boolean {
  try {
    const host = new URL(item.url).hostname.toLowerCase();
    return ACADEMIC_HOST_MATCHERS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function buildQueryBoosts(results: RawItem[], existingQueries: string[]): string[] {
  const existing = new Set(existingQueries.map((query) => query.trim().toLowerCase()));
  const boosts: string[] = [];

  for (const result of results) {
    const normalizedTitle = normalizeLeadTitle(result.title);
    if (!looksLikePaperTitle(normalizedTitle)) continue;
    const key = normalizedTitle.toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    boosts.push(normalizedTitle);
    if (boosts.length >= 4) break;
  }

  return boosts;
}

function normalizeLeadTitle(title: string): string {
  return title
    .replace(/\s+\|\s+(arxiv|nature|science|pubmed|semantic scholar).*$/i, "")
    .replace(/\s+-\s+(arxiv|nature|science|pubmed|semantic scholar).*$/i, "")
    .trim();
}

function looksLikePaperTitle(title: string): boolean {
  if (!title) return false;
  if (title.length < 18 || title.length > 240) return false;
  const wordCount = title.split(/\s+/).length;
  if (wordCount < 4 || wordCount > 32) return false;
  if (/^(home|about|news|blog)\b/i.test(title)) return false;
  return /[A-Za-z]/.test(title);
}
