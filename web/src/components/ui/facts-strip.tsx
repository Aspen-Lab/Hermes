import type { ReactNode } from "react";
import { chipTones, type ChipTone } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

export type FactItem = {
  icon?: ReactNode;
  label: string;
  tone?: ChipTone;
};

export function FactsStrip({
  facts,
  className,
}: {
  facts: FactItem[];
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {facts.map((fact, index) => (
        <span
          key={`${fact.label}-${index}`}
          className={cn(
            "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-meta",
            chipTones[fact.tone ?? "neutral"],
          )}
        >
          {fact.icon && <span className="shrink-0 opacity-90">{fact.icon}</span>}
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{fact.label}</span>
        </span>
      ))}
    </div>
  );
}
