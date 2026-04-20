"use client";

import Link from "next/link";
import type { Paper, Event, Job } from "@/types";
import { Relevance } from "@/components/ui";

export type QuickHitItem =
  | { kind: "paper"; data: Paper }
  | { kind: "event"; data: Event }
  | { kind: "job"; data: Job };

function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const KIND_LABEL: Record<QuickHitItem["kind"], string> = {
  paper: "Paper",
  event: "Event",
  job: "Role",
};

export function BriefingQuickHit({ item }: { item: QuickHitItem }) {
  const detail =
    item.kind === "paper"
      ? `/papers/${item.data.id}`
      : item.kind === "event"
        ? `/events/${item.data.id}`
        : `/jobs/${item.data.id}`;

  const title =
    item.kind === "paper"
      ? item.data.title
      : item.kind === "event"
        ? item.data.name
        : item.data.roleTitle;

  const score =
    item.kind === "paper"
      ? item.data.relevanceScore
      : item.kind === "event"
        ? item.data.relevanceScore
        : item.data.relevanceScore;

  const meta =
    item.kind === "paper"
      ? item.data.venue
      : item.kind === "event"
        ? `${fmtShortDate(item.data.date)} · ${item.data.isOnline ? "Online" : item.data.location}`
        : `${item.data.companyOrLab}${item.data.isRemote ? " · Remote" : ""}`;

  return (
    <Link
      href={detail}
      className="group flex items-center gap-4 py-3.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-surface/70 active:bg-surface"
    >
      <span
        className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint w-[46px]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {KIND_LABEL[item.kind]}
      </span>

      <span
        className="flex-1 min-w-0 text-[15.5px] text-heading truncate group-hover:text-accent transition-colors"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {title}
      </span>

      <span
        className="hidden sm:inline text-[12.5px] text-text-faint truncate max-w-[38%]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {meta}
      </span>

      <Relevance score={score} />
    </Link>
  );
}
