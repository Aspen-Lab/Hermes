import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// The uppercase kicker — "DAILY BRIEFING", "SIGNALS", "PROPOSAL"… It was
// retyped 30+ times with drifting tracking values; the letterspacing tiers
// live here now.

export const sectionLabel = cva("font-semibold uppercase", {
  variants: {
    size: {
      micro: "text-micro",
      caption: "text-caption",
    },
    tracking: {
      tight: "tracking-[0.14em]",
      normal: "tracking-[0.16em]",
      wide: "tracking-[0.18em]",
      wider: "tracking-[0.22em]",
    },
    tone: {
      faint: "text-text-faint",
      muted: "text-text-muted",
      accent: "text-accent",
    },
  },
  defaultVariants: {
    size: "micro",
    tracking: "normal",
    tone: "faint",
  },
});

type SectionLabelProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof sectionLabel> & {
    as?: "p" | "h2" | "h3" | "span" | "div";
  };

export function SectionLabel({
  className,
  size,
  tracking,
  tone,
  as: Tag = "p",
  ...props
}: SectionLabelProps) {
  return (
    <Tag
      className={cn(sectionLabel({ size, tracking, tone }), className)}
      {...props}
    />
  );
}
