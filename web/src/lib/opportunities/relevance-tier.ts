export type OpportunityRelevanceTier = "low" | "medium" | "high";

export const OPPORTUNITY_RELEVANCE_THRESHOLDS = {
  medium: 0.5,
  high: 0.6,
} as const;

export interface OpportunityRelevanceTone {
  tier: OpportunityRelevanceTier;
  tintPercent: number;
  barPercent: number;
}

const TONES: Record<OpportunityRelevanceTier, OpportunityRelevanceTone> = {
  low: { tier: "low", tintPercent: 3, barPercent: 38 },
  medium: { tier: "medium", tintPercent: 7, barPercent: 64 },
  high: { tier: "high", tintPercent: 12, barPercent: 92 },
};

export function opportunityRelevanceTone(
  score: number | undefined,
): OpportunityRelevanceTone | null {
  if (score === undefined || !Number.isFinite(score)) return null;
  if (score >= OPPORTUNITY_RELEVANCE_THRESHOLDS.high) return TONES.high;
  if (score >= OPPORTUNITY_RELEVANCE_THRESHOLDS.medium) return TONES.medium;
  return TONES.low;
}
