import type { CSSProperties } from "react";
import {
  opportunityRelevanceTone,
  type OpportunityRelevanceTier,
} from "@/lib/opportunities/relevance-tier";

interface OpportunityRelevanceCardProps {
  style?: CSSProperties;
  "data-relevance-tier"?: OpportunityRelevanceTier;
}

export function opportunityRelevanceCardProps(
  score: number | undefined,
): OpportunityRelevanceCardProps {
  const tone = opportunityRelevanceTone(score);
  if (!tone) return {};
  return {
    "data-relevance-tier": tone.tier,
    style: {
      background: `color-mix(in srgb, var(--color-relevance) ${tone.tintPercent}%, var(--color-surface))`,
    },
  };
}

export function OpportunityRelevanceBar({
  score,
}: {
  score: number | undefined;
}) {
  const tone = opportunityRelevanceTone(score);
  if (!tone) return null;

  return (
    <span
      aria-hidden
      data-relevance-accent={tone.tier}
      className="absolute inset-y-3 left-0 w-1 rounded-r-full"
      style={{
        background: `color-mix(in srgb, var(--color-relevance) ${tone.barPercent}%, transparent)`,
      }}
    />
  );
}
