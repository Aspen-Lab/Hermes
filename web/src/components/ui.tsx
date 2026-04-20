"use client";

import type { ReactNode } from "react";

// ── Callout (Notion-style colored info box) ──

type CalloutVariant = "accent" | "warm" | "ghost" | "success";

const CALLOUT_STYLES: Record<CalloutVariant, string> = {
  accent: "bg-accent-dim border-accent/25",
  warm: "bg-bg-secondary/80 border-border-strong",
  ghost: "bg-surface border-border-strong",
  success: "bg-tag-dim border-tag/25",
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
      className={`rounded-2xl border px-5 py-4 ${CALLOUT_STYLES[variant]}`}
      style={{ fontFamily: "var(--font-reading)" }}
    >
      {(title || icon) && (
        <header
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint mb-2"
          style={{ fontFamily: "var(--font-sans)" }}
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
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-4 py-4 border-y border-border"
      style={{ fontFamily: "var(--font-sans)" }}
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
      className="relative pl-5 my-6 text-[18px] leading-[1.65] text-heading italic"
      style={{ fontFamily: "var(--font-reading)" }}
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
      className={`inline-flex items-center gap-1.5 text-[12px] h-7 px-3 rounded-full border transition-colors ${
        ok
          ? "bg-tag-dim text-tag border-tag/20"
          : "bg-surface/70 text-text-faint border-border"
      }`}
      style={{ fontFamily: "var(--font-sans)" }}
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
      style={{ fontFamily: "var(--font-sans)" }}
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
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {children}
      </a>
    );
  }
  return (
    <span className={classes} style={{ fontFamily: "var(--font-sans)" }}>
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
      className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-surface border border-border-strong text-[12.5px] text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover transition-colors duration-200 ease-out active:scale-[0.96]"
      style={{ fontFamily: "var(--font-sans)" }}
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
  onDismiss,
  onMore,
  isSaved,
}: {
  onSave?: () => void;
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
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center gap-1.5">
        {onSave && (
          <button
            type="button"
            onClick={stop(onSave)}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Saved" : "Save"}
            className={`group/save inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3.5 rounded-full text-[12.5px] font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.94] ${
              isSaved
                ? "bg-accent text-bg shadow-card hover:bg-accent/90"
                : "bg-transparent border border-border-strong text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover"
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
            {isSaved ? "Saved" : "Save"}
          </button>
        )}

        {onMore && (
          <button
            type="button"
            onClick={stop(onMore)}
            aria-label="More like this"
            className="group/more inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] text-text-faint hover:text-accent hover:bg-accent-dim transition-colors duration-200 ease-out active:scale-[0.94]"
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
              className="transition-transform duration-300 ease-out group-hover/more:rotate-12"
              aria-hidden
            >
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
              <path d="M19 3l.6 1.6L21 5l-1.4.4L19 7l-.6-1.6L17 5l1.4-.4z" />
            </svg>
            More like this
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={stop(onDismiss)}
          aria-label="Dismiss"
          title="Dismiss"
          className="group/dismiss inline-flex items-center justify-center w-8 h-8 rounded-full text-text-faint hover:text-red hover:bg-red/10 transition-colors duration-200 ease-out active:scale-[0.88]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 ease-out group-hover/dismiss:rotate-90"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
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
        style={{ fontFamily: "var(--font-sans)" }}
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
      <span
        className="inline-flex w-16 h-16 rounded-full items-center justify-center bg-surface shadow-card mb-5"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt=""
          width={48}
          height={48}
          className="w-[48px] h-[48px] object-contain opacity-80"
        />
      </span>
      <p
        className="text-heading text-[18px] font-medium tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-sans)" }}
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
  return (
    <div
      className="space-y-4 py-10"
      aria-busy="true"
      aria-label="Loading recommendations"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface shadow-card p-7 overflow-hidden"
          style={{ "--i": i - 1 } as React.CSSProperties}
        >
          <div className="h-5 skeleton-shimmer w-3/4 mb-3" />
          <div className="h-4 skeleton-shimmer w-1/2 mb-5" />
          <div className="h-3 skeleton-shimmer w-full mb-2" />
          <div className="h-3 skeleton-shimmer w-5/6" />
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
