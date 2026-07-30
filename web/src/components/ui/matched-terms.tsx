import { cn } from "@/lib/cn";

export function MatchedTerms({
  terms,
  limit = 3,
  className,
}: {
  terms: string[];
  limit?: number;
  className?: string;
}) {
  if (terms.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {terms.slice(0, limit).map((term) => (
        <span
          key={term}
          className="rounded-md bg-accent-dim px-2 py-[3px] text-caption text-text"
        >
          {term}
        </span>
      ))}
      {terms.length > limit && (
        <span className="px-1 py-[3px] text-caption text-text-faint">
          +{terms.length - limit}
        </span>
      )}
    </div>
  );
}
