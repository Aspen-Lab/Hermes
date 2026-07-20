import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Flat tinted chips + THE tone system. This map is the single source for
// "text-X on X-dim" pairings — FactChip, badges, and kind labels all pull
// from here instead of declaring their own tone records.

export const chipTones = {
  neutral: "bg-bg-secondary/55 text-text",
  accent: "bg-accent-dim text-accent",
  tag: "bg-tag-dim text-tag",
  link: "bg-link-dim text-link",
  peach: "bg-peach-dim text-peach",
  yellow: "bg-yellow-dim text-yellow",
  muted: "bg-surface/70 text-text-faint",
} as const;

export type ChipTone = keyof typeof chipTones;

export const chipVariants = cva("inline-flex items-center rounded-full", {
  variants: {
    tone: chipTones,
    size: {
      sm: "gap-1 h-5 px-2 text-caption font-medium",
      md: "gap-1.5 h-7 px-3 text-meta",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "md",
  },
});

type ChipProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chipVariants>;

export function Chip({ className, tone, size, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone, size }), className)} {...props} />
  );
}
