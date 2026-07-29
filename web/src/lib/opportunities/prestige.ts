export type EventPrestige = {
  tier: "top" | "strong" | "solid" | "unranked";
  label: string;
};

export function eventPrestige(rank: string | null | undefined): EventPrestige {
  const label = rank?.trim();
  if (!label) return { tier: "unranked", label: "Unranked" };

  // Keep these rank boundaries aligned with events/scoring.ts#scoreRank.
  if (/A\*/i.test(label) || /\bA\b/i.test(label)) return { tier: "top", label };
  if (/\bB\b/i.test(label)) return { tier: "strong", label };
  if (/\bC\b/i.test(label)) return { tier: "solid", label };
  return { tier: "unranked", label: "Unranked" };
}
