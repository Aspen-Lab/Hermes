"use client";

import { cn } from "@/lib/cn";

// Controlled switch — soft-UI track with a floating thumb. Replaces the
// hand-rolled role="switch" spans that were duplicated per settings panel.

export function Toggle({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full",
        "transition-[background-color] duration-150 ease-snap",
        "disabled:opacity-50 disabled:cursor-wait",
        checked ? "bg-accent" : "bg-heading/15",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute h-4 w-4 rounded-full bg-bg shadow-card",
          "transition-transform duration-150 ease-snap",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
