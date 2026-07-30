export type EventPrestige = {
  tier: "top" | "strong" | "solid" | "unranked";
  label: string;
};

export type JobPrestige = {
  tier: "bigTech" | "nationalLab" | "academic" | "startup" | "unknown";
  label: string;
};

// Deliberately duplicated from jobs/scoring.ts while that file is owned by the
// relevance-refactor branch. Reconcile the shared patterns after both land.
const ACADEMIC_RE =
  /\b(universit(y|ies)|college|institute|academy|professor|faculty|postdoc|lecturer|phd|doctoral|national lab(oratory)?|research council|max planck|cnrs|riken)\b/i;
const BIG_TECH_RE =
  /\b(google|deepmind|meta|apple|microsoft|amazon|aws|nvidia|openai|anthropic|ibm|intel|samsung|bytedance|tencent|alibaba|baidu|huawei|netflix|adobe|salesforce|oracle|qualcomm|tesla)\b/i;
const STARTUP_RE = /\b(startup|start-up|seed[- ]stage|series [ab]|early[- ]stage|founding)\b/i;

const NATIONAL_LAB_RE =
  /\b(national lab(oratory)?|argonne|brookhaven|fermilab|lawrence berkeley|lawrence livermore|los alamos|oak ridge|pacific northwest|sandia|nrel)\b/i;

export function eventPrestige(rank: string | null | undefined): EventPrestige {
  const label = rank?.trim();
  if (!label) return { tier: "unranked", label: "Unranked" };

  // Keep these rank boundaries aligned with events/scoring.ts#scoreRank.
  if (/A\*/i.test(label) || /\bA\b/i.test(label)) return { tier: "top", label };
  if (/\bB\b/i.test(label)) return { tier: "strong", label };
  if (/\bC\b/i.test(label)) return { tier: "solid", label };
  return { tier: "unranked", label: "Unranked" };
}

export function jobPrestige(
  company: string | null | undefined,
  source: string | null | undefined,
  description: string | null | undefined,
): JobPrestige {
  const companyName = company?.trim() ?? "";
  const excerpt = description?.slice(0, 500) ?? "";
  const text = `${companyName} ${excerpt}`;

  if (BIG_TECH_RE.test(companyName)) return { tier: "bigTech", label: "Big tech" };
  if (NATIONAL_LAB_RE.test(text)) return { tier: "nationalLab", label: "National lab" };
  if (source === "jobweb" || ACADEMIC_RE.test(text)) {
    return { tier: "academic", label: "Academic" };
  }
  if (STARTUP_RE.test(text)) return { tier: "startup", label: "Startup" };
  return { tier: "unknown", label: "Type unknown" };
}
