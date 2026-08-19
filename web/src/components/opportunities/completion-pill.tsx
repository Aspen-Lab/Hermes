"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";

export function CompletionPill({
  label,
  controlKey,
  checked,
  onChange,
  className,
}: {
  label: string;
  /**
   * The stable name of the control, independent of what it says on screen.
   *
   * This used to be derived as `label.toLowerCase()`, which quietly coupled
   * every test hook and stylesheet selector to display copy: relabelling
   * "Applied" to "Mark as applied" silently renamed the hook to
   * "mark as applied" and broke a passing test with no code near it changing.
   * Copy is expected to change; the identity of the control is not.
   */
  controlKey?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onChange(!checked);
  };

  return (
    <button
      type="button"
      aria-pressed={checked}
      data-completion-control={controlKey ?? label.toLowerCase()}
      onClick={handleClick}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-meta font-medium",
        "transition-[background-color,color,transform] duration-150 ease-snap active:scale-[0.96]",
        checked
          ? "bg-done-dim text-done"
          : "bg-bg-secondary/65 text-text-muted hover:bg-surface-hover hover:text-heading",
        className,
      )}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full border",
          checked
            ? "border-done bg-done text-bg"
            : "border-current/30 bg-transparent",
        )}
      >
        {checked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m2.5 6 2.1 2.1L9.5 3.5" />
          </svg>
        )}
      </span>
    </button>
  );
}
