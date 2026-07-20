"use client";

import type { ReactNode } from "react";

// ── Callout (Notion-style colored info box) ──

type CalloutVariant = "accent" | "warm" | "ghost" | "success";

const CALLOUT_STYLES: Record<CalloutVariant, string> = {
  accent: "bg-accent-dim",
  warm: "bg-bg-secondary/80",
  ghost: "bg-surface shadow-well",
  success: "bg-tag-dim",
};

export function Callout({
  variant = "accent",
  icon,
  title,
  children,
}: {
  variant?: CalloutVariant;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={`rounded-2xl px-5 py-4 font-reading ${CALLOUT_STYLES[variant]}`}
    >
      {(title || icon) && (
        <header
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint mb-2"
        >
          {icon}
          {title}
        </header>
      )}
      <div className="text-[16.5px] text-text leading-[1.7]">{children}</div>
    </aside>
  );
}

// ── Property strip (Notion DB property panel) ──

export function PropertyStrip({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-3 sm:gap-x-5 sm:gap-y-4 py-4 border-y border-border"
    >
      {children}
    </div>
  );
}

export function Property({
  icon,
  label,
  children,
  accent = false,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-faint mb-1"
      >
        {icon}
        {label}
      </div>
      <div
        className={`text-[14px] font-medium truncate ${
          accent ? "text-accent" : "text-heading"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Pull quote (key sentence, left accent bar) ──

export function PullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote
      className="relative pl-5 my-6 text-[18px] leading-[1.65] text-heading italic font-reading"
    >
      <span
        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent/80"
        aria-hidden
      />
      {children}
    </blockquote>
  );
}

// ── Signal chip (binary indicator: ✓ available / × missing) ──

export function Signal({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] h-7 px-3 rounded-full transition-colors ${
        ok
          ? "bg-tag-dim text-tag"
          : "bg-surface/70 text-text-faint"
      }`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {ok ? <path d="M5 12l5 5L20 7" /> : <path d="M18 6 6 18M6 6l12 12" />}
      </svg>
      {children}
    </span>
  );
}

// ── Fact chip (neutral fact with icon, no ok/missing toggle) ──

// Use this when surfacing a property as a labeled fact ("Preprint",
// "23 days ago", "3 authors") — i.e. when the chip is only meaningful
// when the fact is present. Use Signal when ok/missing is itself the signal.

type FactChipTone = "neutral" | "accent" | "tag" | "link" | "muted";

const FACT_CHIP_TONE: Record<FactChipTone, string> = {
  neutral: "bg-bg-secondary/55 text-text",
  accent: "bg-accent-dim text-accent",
  tag: "bg-tag-dim text-tag",
  link: "bg-link-dim text-link",
  muted: "bg-surface/70 text-text-faint",
};

export function FactChip({
  icon,
  children,
  tone = "neutral",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: FactChipTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] h-7 px-3 rounded-full ${FACT_CHIP_TONE[tone]}`}
    >
      {icon && <span className="opacity-90 shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// ── Section heading ──

export function SectionHeading({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <h2
      className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mt-14 mb-5 flex items-baseline justify-between"
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="text-text-faint/60 tabular-nums">{count}</span>
      )}
    </h2>
  );
}

// ── Inline tag ──

export function Tag({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  const classes =
    "inline-block text-[11.5px] text-tag bg-tag-dim px-2 py-[3px] rounded-md tracking-wide transition-colors";
  if (href) {
    return (
      <a
        href={href}
        className={`${classes} hover:text-heading hover:bg-tag-dim/70 active:scale-[0.96]`}
      >
        {children}
      </a>
    );
  }
  return (
    <span className={classes}>
      {children}
    </span>
  );
}

// ── Link chip (pill button for external links) ──

export function LinkChip({
  href,
  label,
  icon,
}: {
  href?: string;
  label: string;
  icon?: ReactNode;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-surface shadow-card text-[12.5px] text-text-muted hover:text-heading hover:shadow-card-hover hover:bg-surface-hover transition-[color,background-color,box-shadow] duration-200 ease-out active:scale-[0.96]"
    >
      {icon}
      {label}
      <span className="text-[10px] opacity-60 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
        ↗
      </span>
    </a>
  );
}

// ── Action links ──

export function ActionBar({
  onSave,
  onUnsave,
  onDismiss,
  onMore,
  isSaved,
}: {
  onSave?: () => void;
  onUnsave?: () => void;
  onDismiss?: () => void;
  onMore?: () => void;
  isSaved?: boolean;
}) {
  const stop = (fn?: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };

  return (
    <div
      className="flex items-center justify-between mt-5 pt-4 border-t border-border"
    >
      <div className="flex items-center gap-1.5">
        {onSave && (
          <button
            type="button"
            onClick={isSaved ? stop(onUnsave) : stop(onSave)}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Remove from saved" : "Save"}
            className={`group/save inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3.5 rounded-full text-[12.5px] font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.94] ${
              isSaved
                ? "bg-accent text-bg shadow-card hover:bg-accent/90"
                : "bg-bg-secondary/60 shadow-card text-text-muted hover:text-heading hover:bg-surface-hover"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-300 ease-out ${
                isSaved ? "scale-100" : "group-hover/save:-translate-y-[1px]"
              }`}
              aria-hidden
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {isSaved ? (
              <>
                Saved
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70 group-hover/save:opacity-100 transition-opacity duration-150"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </>
            ) : (
              "Save"
            )}
          </button>
        )}

        {onMore && (
          <button
            type="button"
            onClick={stop(onMore)}
            aria-label="Like — show me more like this"
            title="Like — show me more like this"
            className="group/like inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] text-text-faint hover:text-accent hover:bg-accent-dim transition-colors duration-200 ease-out active:scale-[0.94]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 ease-out group-hover/like:-translate-y-[1.5px]"
              aria-hidden
            >
              <path d="M7 10v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3zM7 10l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 19H7" />
            </svg>
            Like
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={stop(onDismiss)}
            aria-label="Dislike — show me less like this"
            title="Dislike — show me less like this"
            className="group/dislike inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] text-text-faint hover:text-red hover:bg-red/10 transition-colors duration-200 ease-out active:scale-[0.94]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 ease-out group-hover/dislike:translate-y-[1.5px]"
              aria-hidden
            >
              <path d="M17 14V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zM17 14l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 5H17" />
            </svg>
            Dislike
          </button>
        )}
      </div>
    </div>
  );
}

// ── Feedback row: paired Like / Dislike for post-read taste signal ──
// Intentionally symmetric — Tinder-style "tell me more / less of this".

export function FeedbackRow({
  onLike,
  onDislike,
  index,
}: {
  onLike: () => void;
  onDislike: () => void;
  index?: number;
}) {
  return (
    <section
      className="mt-12 pt-6 border-t border-border animate-fade-in-up"
      style={{
        "--i": index,
        } as React.CSSProperties}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint mb-3">
        Was this worth your time?
      </p>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onLike}
          aria-label="Like — show me more like this"
          className="group inline-flex items-center gap-2 h-10 px-4 rounded-full bg-surface border border-border-strong text-[13.5px] text-text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-dim transition-colors duration-200 ease-out active:scale-[0.96]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 ease-out group-hover:-translate-y-[2px]"
            aria-hidden
          >
            <path d="M7 10v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3zM7 10l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 19H7" />
          </svg>
          More like this
        </button>

        <button
          type="button"
          onClick={onDislike}
          aria-label="Dislike — show me less like this"
          className="group inline-flex items-center gap-2 h-10 px-4 rounded-full bg-surface border border-border-strong text-[13.5px] text-text-muted hover:text-red hover:border-red/35 hover:bg-red/[0.06] transition-colors duration-200 ease-out active:scale-[0.96]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 ease-out group-hover:translate-y-[2px]"
            aria-hidden
          >
            <path d="M17 14V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zM17 14l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 5H17" />
          </svg>
          Less like this
        </button>
      </div>
    </section>
  );
}

// ── Detail section ──

export function DetailSection({
  title,
  children,
  index,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  index?: number;
}) {
  const style =
    index !== undefined
      ? ({ "--i": index } as React.CSSProperties)
      : undefined;
  return (
    <section className="mt-10 animate-fade-in-up" style={style}>
      <h3
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mb-3"
      >
        {title}
      </h3>
      <div className="text-text leading-relaxed">{children}</div>
    </section>
  );
}

// ── Link row ──

export function LinkRow({ label, href }: { label: string; href?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 text-link hover:text-link/75 underline decoration-link/25 hover:decoration-link/60 underline-offset-4 transition-all duration-200 ease-out active:scale-[0.97] mr-5 text-[15px]"
    >
      {label}
      <span className="text-[10px] opacity-60 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[2px]">↗</span>
    </a>
  );
}

// ── Empty state ──

export function EmptyState({
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-20 text-center flex flex-col items-center">
      <p
        className="text-heading text-[18px] font-medium tracking-[-0.01em]"
      >
        {title}
      </p>
      <p className="text-text-muted text-[14.5px] mt-2 leading-relaxed max-w-[40ch]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Loading ──

export function LoadingSkeleton() {
  // Per-card line widths so each placeholder reads as a distinct paper
  // rather than three identical bars. Small variation makes the stack
  // feel alive while the real fetch is in flight.
  const cards: Array<{
    titleA: string;
    titleB: string;
    author: string;
    body: [string, string, string];
  }> = [
    { titleA: "86%", titleB: "62%", author: "44%", body: ["100%", "96%", "70%"] },
    { titleA: "72%", titleB: "48%", author: "38%", body: ["98%",  "88%", "55%"] },
    { titleA: "92%", titleB: "70%", author: "52%", body: ["100%", "93%", "78%"] },
  ];

  return (
    <div
      className="space-y-3.5 py-6 sm:py-8"
      aria-busy="true"
      aria-label="Loading recommendations"
    >
      <div className="flex items-center gap-2 text-[11px] text-text-faint tracking-[0.16em] uppercase">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-accent/70 animate-pulse" />
          <span className="absolute inset-0 rounded-full bg-accent/30 motion-safe:animate-ping" />
        </span>
        <span>Brewing your daily briefing</span>
      </div>

      {cards.map((card, i) => (
        <div
          key={i}
          className="relative rounded-2xl bg-surface border border-border shadow-card p-5 sm:p-6 overflow-hidden animate-fade-in-up"
          style={{ "--i": i, animationDelay: `${i * 90}ms` } as React.CSSProperties}
        >
          {/* Kind stripe — matches PaperTile's left-edge accent */}
          <div className="absolute top-0 left-0 h-full w-[3px] bg-accent/15" />

          {/* Header: kind badge + score chip */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-16 rounded-full skeleton-shimmer" />
            <span className="flex-1" aria-hidden />
            <div className="h-5 w-12 rounded-full skeleton-shimmer" />
          </div>

          {/* Title — 2 lines */}
          <div className="h-[18px] rounded-md skeleton-shimmer mb-2" style={{ width: card.titleA }} />
          <div className="h-[18px] rounded-md skeleton-shimmer mb-3.5" style={{ width: card.titleB }} />

          {/* Author / venue line */}
          <div className="h-3 rounded-md skeleton-shimmer mb-4" style={{ width: card.author }} />

          {/* Relevance reason — 3 lines */}
          <div className="space-y-2">
            <div className="h-3 rounded-md skeleton-shimmer" style={{ width: card.body[0] }} />
            <div className="h-3 rounded-md skeleton-shimmer" style={{ width: card.body[1] }} />
            <div className="h-3 rounded-md skeleton-shimmer" style={{ width: card.body[2] }} />
          </div>

          {/* Footer — source label + action icons */}
          <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-1.5">
            <div className="h-2.5 w-14 rounded skeleton-shimmer" />
            <span className="flex-1" aria-hidden />
            <div className="h-6 w-6 rounded-md skeleton-shimmer" />
            <div className="h-6 w-6 rounded-md skeleton-shimmer" />
            <div className="h-6 w-6 rounded-md skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Relevance indicator ──
// Five-dot signal. Reads at a glance, no numerals to parse.

export function Relevance({ score }: { score?: number }) {
  if (!score) return null;
  const pct = Math.max(0, Math.min(1, score));
  const filled = Math.max(1, Math.round(pct * 5));
  return (
    <span
      className="inline-flex items-center gap-[3px] shrink-0 select-none"
      aria-label={`relevance ${Math.round(pct * 100)}%`}
      title={`${Math.round(pct * 100)}% match`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`block w-[5px] h-[5px] rounded-full transition-colors ${
            i < filled ? "bg-accent" : "bg-border-strong/40"
          }`}
        />
      ))}
    </span>
  );
}
