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
    <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-text-faint mt-12 mb-5 flex items-baseline justify-between">
      <span>{children}</span>
      {count !== undefined && (
        <span className="text-text-faint/60">{count}</span>
      )}
    </h2>
  );
}

// ── Inline tag ──

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block font-mono text-[12px] text-tag/80 bg-tag-dim px-2 py-0.5 rounded">
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
    <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border font-mono text-[12px]">
      {onSave && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(); }}
          className={`transition-colors ${
            isSaved ? "text-tag" : "text-text-faint hover:text-tag"
          }`}
        >
          {isSaved ? "saved" : "bookmark"}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
          className="text-text-faint hover:text-red transition-colors"
        >
          dismiss
        </button>
      )}
      {onMore && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMore(); }}
          className="text-text-faint hover:text-link transition-colors"
        >
          more like this
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
    <section className="mt-8">
      <h3 className="font-mono text-xs uppercase tracking-widest text-text-faint mb-3">{title}</h3>
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
      className="inline-flex items-center gap-1.5 text-link hover:text-link/80 transition-colors mr-5 text-[15px]"
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
    <div className="py-24 text-center">
      <p className="text-text-muted text-lg">{title}</p>
      <p className="text-text-faint text-sm mt-2">{description}</p>
    </div>
  );
}

// ── Loading ──

export function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse py-12">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface p-6">
          <div className="h-5 bg-surface-hover rounded w-3/4 mb-3" />
          <div className="h-4 bg-surface-hover rounded w-1/2 mb-4" />
          <div className="h-3 bg-surface-hover rounded w-full" />
        </div>
      ))}
    </div>
  );
}

// ── Relevance indicator ──

export function Relevance({ score }: { score?: number }) {
  if (!score) return null;
  return (
    <span className="font-mono text-[12px] text-yellow whitespace-nowrap">
      {Math.round(score * 100)}%
    </span>
  );
}
