import type { Job, PreferenceConcept } from "@/types";
import {
  normalizePreferenceConcepts,
  preferenceKey,
} from "@/lib/preferences/ledger";
import type { ScoredJobItem } from "./types";

const MAX_SIGNALS = 8;
const MAX_REQUIREMENTS = 4;

/**
 * Concepts the ledger learns from when the user saves/dismisses this job:
 * the matched profile topics (bridging to paper-side concepts by label) plus
 * the posting's own tags.
 */
export function jobPreferenceSignals(item: ScoredJobItem): PreferenceConcept[] {
  const company = item.company.trim();
  return normalizePreferenceConcepts([
    // Employer identity first, so feedback tunes toward/away from specific
    // companies and labs, not just their topic tags.
    ...(company
      ? [
          {
            key: preferenceKey(company, "job_tag"),
            label: company,
            source: "job_tag" as const,
          },
        ]
      : []),
    ...item.matchedKeywords.map((label) => ({
      key: preferenceKey(label, "job_tag"),
      label,
      source: "job_tag" as const,
    })),
    ...item.tags.map((label) => ({
      key: preferenceKey(label, "job_tag"),
      label,
      source: "job_tag" as const,
    })),
  ]).slice(0, MAX_SIGNALS);
}

function keyRequirements(item: ScoredJobItem): string[] {
  const requirements: string[] = [];
  const seen = new Set<string>();
  for (const tag of item.tags) {
    const cleaned = tag.trim();
    if (!cleaned || cleaned.length > 60) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push(cleaned);
    if (requirements.length >= MAX_REQUIREMENTS) break;
  }
  if (requirements.length === 0) {
    for (const keyword of item.matchedKeywords.slice(0, MAX_REQUIREMENTS)) {
      requirements.push(keyword);
    }
  }
  return requirements;
}

export function scoredJobToJob(item: ScoredJobItem): Job {
  return {
    id: item.id,
    roleTitle: item.title,
    companyOrLab: item.company,
    location: item.location || (item.isRemote ? "Remote" : "See posting"),
    isRemote: item.isRemote,
    keyRequirements: keyRequirements(item),
    matchReason: item.matchReason,
    linkPosting: item.url,
    postedDate: item.postedAt,
    relevanceScore: item.score,
    isSaved: false,
    preferenceSignals: jobPreferenceSignals(item),
  };
}
