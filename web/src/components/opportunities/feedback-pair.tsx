"use client";

interface OpportunityFeedbackPairProps {
  isInterested: boolean;
  isNotInterested?: boolean;
  onInterested: () => void;
  onNotInterested: () => void;
}

const BASE_CLASS =
  "group inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-body-sm font-medium shadow-card transition-all duration-200 ease-out active:scale-[0.96]";

export function OpportunityFeedbackPair({
  isInterested,
  isNotInterested = false,
  onInterested,
  onNotInterested,
}: OpportunityFeedbackPairProps) {
  return (
    <div
      data-opportunity-feedback-pair="true"
      className="inline-flex shrink-0 items-center gap-2"
    >
      <button
        type="button"
        data-feedback-control="interested"
        onClick={onInterested}
        aria-pressed={isInterested}
        aria-label="Interested"
        title="Interested"
        className={`${BASE_CLASS} ${
          isInterested
            ? "bg-accent-dim text-accent"
            : "bg-bg-secondary/60 text-text-muted hover:bg-accent-dim hover:text-accent"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={isInterested ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M7 10v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3zM7 10l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 19H7" />
        </svg>
        Interested
      </button>

      <button
        type="button"
        data-feedback-control="not-interested"
        onClick={onNotInterested}
        aria-pressed={isNotInterested}
        aria-label="Not interested"
        title="Not interested"
        className={`${BASE_CLASS} ${
          isNotInterested
            ? "bg-red/10 text-red"
            : "bg-bg-secondary/60 text-text-muted hover:bg-red/5 hover:text-red"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={isNotInterested ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M17 14V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zM17 14l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 5H17" />
        </svg>
        Not interested
      </button>
    </div>
  );
}
