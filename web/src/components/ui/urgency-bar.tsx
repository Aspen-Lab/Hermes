import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { UrgencyBucket } from "@/lib/opportunities/urgency";

export function UrgencyBar({
  bucket,
  label,
  progress,
  className,
}: {
  bucket: UrgencyBucket;
  label: string;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl px-3 py-2.5", bucket.bg, className)}>
      <div className="flex items-center justify-between gap-3 text-meta">
        <span className={cn("inline-flex min-w-0 items-center gap-2 font-medium", bucket.text)}>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", bucket.dot)} aria-hidden />
          <span>{label}</span>
        </span>
        <span className={cn("shrink-0 text-micro uppercase tracking-[0.14em]", bucket.text)}>
          {bucket.label}
        </span>
      </div>
      {progress !== undefined && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span
            className={cn("block h-full rounded-full transition-[width] duration-300", bucket.dot)}
            style={{ width: `${progress}%` } as CSSProperties}
          />
        </div>
      )}
    </div>
  );
}
