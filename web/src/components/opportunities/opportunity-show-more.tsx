"use client";

interface OpportunityShowMoreProps {
  remaining: number;
  onClick: () => void;
}

export function OpportunityShowMore({
  remaining,
  onClick,
}: OpportunityShowMoreProps) {
  if (remaining <= 0) return null;

  return (
    <div className="col-span-full flex justify-center py-3">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Show up to 10 more opportunities, ${remaining} remaining`}
        className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-body-sm font-medium text-heading shadow-card transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-accent/45 hover:shadow-card-hover active:scale-[0.97]"
      >
        Show 10 more
        <span className="text-caption font-normal text-text-faint">
          {remaining} left in today&apos;s pool
        </span>
      </button>
    </div>
  );
}
