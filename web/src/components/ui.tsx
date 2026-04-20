"use client";

import type { ReactNode } from "react";

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

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block text-[11.5px] text-tag bg-tag-dim px-2 py-[3px] rounded-md tracking-wide"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {children}
    </span>
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
  return (
    <div
      className="flex items-center gap-5 mt-5 pt-4 border-t border-border text-[12.5px]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {onSave && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(); }}
          className={`transition-all duration-200 ease-out active:scale-95 ${
            isSaved ? "text-tag" : "text-text-faint hover:text-tag"
          }`}
        >
          {isSaved ? "Saved" : "Bookmark"}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
          className="text-text-faint hover:text-red transition-all duration-200 ease-out active:scale-95"
        >
          Dismiss
        </button>
      )}
      {onMore && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMore(); }}
          className="text-text-faint hover:text-link transition-all duration-200 ease-out active:scale-95"
        >
          More like this
        </button>
      )}
    </div>
  );
}

// ── Detail section ──

export function DetailSection({
  title,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
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
      className="inline-flex items-center gap-1.5 text-link hover:text-link/75 underline decoration-link/25 underline-offset-4 transition-colors mr-5 text-[15px]"
    >
      {label}
      <span className="text-[10px] opacity-60">↗</span>
    </a>
  );
}

// ── Empty state ──

export function EmptyState({
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="py-28 text-center">
      <p className="text-text-muted text-lg">{title}</p>
      <p className="text-text-faint text-[14px] mt-2">{description}</p>
    </div>
  );
}

// ── Loading ──

export function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse py-10">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface shadow-card p-7">
          <div className="h-5 bg-border-strong/60 rounded w-3/4 mb-3" />
          <div className="h-4 bg-border/80 rounded w-1/2 mb-5" />
          <div className="h-3 bg-border/80 rounded w-full mb-2" />
          <div className="h-3 bg-border/80 rounded w-5/6" />
        </div>
      ))}
    </div>
  );
}

// ── Relevance indicator ──
// A quiet horizontal bar — no % number, nothing to stare at while reading.

export function Relevance({ score }: { score?: number }) {
  if (!score) return null;
  const pct = Math.max(0, Math.min(1, score));
  return (
    <span
      className="inline-flex items-center gap-1.5 shrink-0 select-none"
      aria-label={`relevance ${Math.round(pct * 100)}%`}
      title={`${Math.round(pct * 100)}% match`}
    >
      <span className="relative block h-[3px] w-10 rounded-full bg-border">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
          style={{ width: `${pct * 100}%` }}
        />
      </span>
    </span>
  );
}
