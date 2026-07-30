import { cn } from "@/lib/cn";
import type { EventPrestige, JobPrestige } from "@/lib/opportunities/prestige";

type PrestigeTier = EventPrestige["tier"] | JobPrestige["tier"];

const TIER_STYLES: Record<PrestigeTier, string> = {
  top: "bg-accent-dim text-accent border-accent/20",
  bigTech: "bg-accent-dim text-accent border-accent/20",
  strong: "bg-tag-dim text-tag border-tag/20",
  nationalLab: "bg-tag-dim text-tag border-tag/20",
  academic: "bg-tag-dim text-tag border-tag/20",
  solid: "bg-surface-hover text-text-muted border-border",
  startup: "bg-surface-hover text-text-muted border-border",
  unranked: "bg-bg/50 text-text-faint border-border",
  unknown: "bg-bg/50 text-text-faint border-border",
};

export function PrestigeBadge({
  tier,
  label,
  className,
}: {
  tier: PrestigeTier;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.14em]",
        TIER_STYLES[tier],
        className,
      )}
    >
      {label}
    </span>
  );
}
