"use client";

import { useEffect, useState } from "react";
import type { Paper, Event, Job } from "@/types";
import { useFeedStore } from "@/store/feed";

function titleOf(
  kind: "paper" | "event" | "job",
  item: Paper | Event | Job,
): string {
  if (kind === "paper") return (item as Paper).title;
  if (kind === "event") return (item as Event).name;
  return (item as Job).roleTitle;
}

export function UndoToast() {
  const pending = useFeedStore((s) => s.pendingDismissal);
  const undoDismiss = useFeedStore((s) => s.undoDismiss);
  const commitDismiss = useFeedStore((s) => s.commitDismiss);

  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!pending) {
      setProgress(100);
      return;
    }
    const start = Date.now();
    const total = Math.max(1, pending.expiresAt - start);

    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / total) * 100));
    };
    tick();
    const interval = window.setInterval(tick, 50);
    const timeout = window.setTimeout(() => commitDismiss(), total);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [pending, commitDismiss]);

  if (!pending) return null;

  const title = titleOf(pending.kind, pending.item);
  const shortTitle = title.length > 48 ? `${title.slice(0, 46)}…` : title;

  return (
    <div
      className="fixed inset-x-0 bottom-6 flex justify-center pointer-events-none z-[70] px-4 lg:pl-52"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex items-stretch gap-0 rounded-full bg-heading text-bg shadow-card-hover overflow-hidden animate-fade-in-up"
        style={{
          fontFamily: "var(--font-sans)",
          "--i": 0,
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 pl-5 pr-3 py-2.5">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-bg/55">
            Dismissed
          </span>
          <span className="text-[13px] max-w-[260px] truncate">
            {shortTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={undoDismiss}
          className="group relative inline-flex items-center gap-1.5 pl-3.5 pr-4 py-2.5 border-l border-bg/15 hover:bg-accent/85 active:bg-accent/70 transition-colors"
        >
          <span
            className="absolute inset-x-0 bottom-0 h-[2px] bg-accent/70"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 ease-out group-hover:-translate-x-[1px]"
            aria-hidden
          >
            <path d="M3 12h13a5 5 0 0 1 0 10h-3" />
            <path d="m7 8-4 4 4 4" />
          </svg>
          <span className="text-[13px] font-medium">Undo</span>
        </button>
      </div>
    </div>
  );
}
