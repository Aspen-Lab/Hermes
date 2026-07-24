// Profile-driven search-query generation for the jobs & events web-discovery
// adapters. Tier 0 builds template queries from the profile; when an LLM
// provider is available (Tier 2 / BYOK) it rewrites them into sharper,
// persona-aware queries. Always degrades to the templates — never throws.

import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import { truncateText } from "@/lib/opportunities/shared";
import type { CareerStage, IndustryAcademiaPreference } from "@/types";

export interface QueryGenProfile {
  topics: string[];
  careerStage?: CareerStage;
  industryVsAcademia?: IndustryAcademiaPreference;
  locationPreferences?: string[];
  currentProject?: string;
}

const MAX_QUERIES = 5;

// Best-effort in-process cache of LLM-generated queries. The two query-gen
// calls fire on every feed build; the profile inputs rarely change between
// loads, so caching avoids re-billing the model for identical output. Keyed by
// kind + current year + exactly the profile fields the prompt reads, so it
// invalidates automatically when any of them (or the year) changes.
const QUERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const queryCache = new Map<string, { queries: string[]; ts: number }>();

function queryCacheKey(kind: string, profile: QueryGenProfile): string {
  return JSON.stringify({
    kind,
    year: new Date().getFullYear(),
    topics: profile.topics,
    stage: profile.careerStage ?? "",
    dir: profile.industryVsAcademia ?? "",
    loc: profile.locationPreferences ?? [],
    proj: (profile.currentProject ?? "").slice(0, 500),
  });
}

export function stageRoleTerms(stage: CareerStage | undefined): string[] {
  switch (stage) {
    case "PhD Year 1":
    case "PhD Year 2":
    case "PhD Year 3":
      return ["research intern", "PhD internship"];
    case "PhD Year 4":
    case "PhD Year 5":
    case "PhD Year 6":
      return ["research scientist", "research intern", "postdoc"];
    case "Postdoc":
      return ["postdoc", "research fellow", "research scientist"];
    case "Research Scientist":
      return ["research scientist", "senior research scientist"];
    default:
      return ["research scientist", "postdoc"];
  }
}

export function templateJobQueries(profile: QueryGenProfile): string[] {
  const topics = profile.topics.slice(0, 3);
  const roles = stageRoleTerms(profile.careerStage);
  const queries: string[] = [];
  for (const topic of topics) {
    for (const role of roles) {
      queries.push(`${topic} ${role}`);
      if (queries.length >= MAX_QUERIES) return queries;
    }
  }
  return queries;
}

export function templateEventQueries(profile: QueryGenProfile): string[] {
  const year = new Date().getFullYear();
  const topics = profile.topics.slice(0, 3);
  const queries: string[] = [];
  for (const topic of topics) {
    queries.push(`${topic} conference ${year} call for papers`);
    queries.push(`${topic} workshop symposium ${year}`);
    if (queries.length >= MAX_QUERIES) break;
  }
  return queries.slice(0, MAX_QUERIES);
}

function parseQueryArray(raw: string): string[] {
  const unfenced = raw.replace(/```(?:json)?/gi, "").trim();
  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length > 3 && q.length < 120)
      .slice(0, MAX_QUERIES);
  } catch {
    return [];
  }
}

/**
 * LLM-refined queries for a surface. `kind` shapes the prompt; the result is
 * a plain string[] of web-search queries. Returns the template queries when
 * no provider resolves, the provider lacks generateJsonText, or output is
 * unparseable.
 */
export async function generateSearchQueries(
  kind: "jobs" | "events",
  profile: QueryGenProfile,
  llmOverride?: ProviderOverrideConfig,
): Promise<string[]> {
  const fallback =
    kind === "jobs" ? templateJobQueries(profile) : templateEventQueries(profile);

  let provider;
  try {
    provider = resolveProvider(llmOverride);
  } catch {
    return fallback;
  }
  if (!provider?.generateJsonText) return fallback;

  const cacheKey = queryCacheKey(kind, profile);
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < QUERY_CACHE_TTL_MS) return cached.queries;

  const persona = [
    `Research topics: ${profile.topics.join(", ") || "unknown"}`,
    profile.careerStage ? `Career stage: ${profile.careerStage}` : "",
    profile.industryVsAcademia
      ? `Career direction: ${profile.industryVsAcademia}`
      : "",
    (profile.locationPreferences ?? []).length > 0
      ? `Preferred locations: ${profile.locationPreferences!.join(", ")}`
      : "",
    // Cap the project blurb so a long paste can't bloat the prompt; query
    // quality is driven by topics + role terms, not the full description.
    profile.currentProject
      ? `Current project: ${truncateText(profile.currentProject, 500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const target =
    kind === "jobs"
      ? "job openings this researcher would apply to (matching their seniority and academia/industry direction)"
      : "academic conferences, workshops, summer schools, and seminars this researcher would want to submit to or attend (any discipline, not just computer science)";

  try {
    const raw = await provider.generateJsonText({
      systemPrompt:
        "You write web search queries. Reply with ONLY a JSON array of query strings, no prose.",
      userPrompt: `Researcher profile:\n${persona}\n\nWrite ${MAX_QUERIES} diverse, specific web search queries to find ${target}. Include the current year where useful. JSON array only.`,
      maxTokens: 300,
      tier: "small",
    });
    const queries = parseQueryArray(raw);
    const result = queries.length > 0 ? queries : fallback;
    queryCache.set(cacheKey, { queries: result, ts: Date.now() });
    return result;
  } catch {
    return fallback;
  }
}
