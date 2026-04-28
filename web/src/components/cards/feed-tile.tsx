"use client";

// Compact tile for the dense feed grid (Xiaohongshu-PC density).
// One component that switches on item kind. Rendered in a 1/2/3/4-col
// grid; designed for ~280–340px wide cards.

import Link from "next/link";
import type { Paper, Event, Job } from "@/types";
import { useFeedStore } from "@/store/feed";

type FeedItem =
  | { kind: "paper"; data: Paper }
  | { kind: "event"; data: Event }
  | { kind: "job"; data: Job };

interface RelevanceScored {
  relevanceScore?: number;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function tileShellClass(isRead: boolean) {
  return [
    "group block rounded-xl bg-surface shadow-card p-4",
    "animate-fade-in-up",
    "transition-[box-shadow,transform] duration-200 ease-out",
    "hover:shadow-card-hover hover:-translate-y-[1px]",
    isRead ? "opacity-70 hover:opacity-100" : "",
  ].join(" ");
}

type BadgeKind = "paper" | "event" | "job" | "discussion";

function paperBadgeKind(paper: Paper): BadgeKind {
  // HN posts come through the same Paper pipeline but they're not papers —
  // surface them as "Discussion" so users don't think a Show HN thread is
  // an academic paper.
  if (paper.id.startsWith("hn:")) return "discussion";
  return "paper";
}

function KindBadge({ kind }: { kind: BadgeKind }) {
  const tone =
    kind === "paper"
      ? "text-accent bg-accent-dim"
      : kind === "event"
        ? "text-tag bg-tag-dim"
        : kind === "job"
          ? "text-link bg-link-dim"
          : "text-text-muted bg-bg-secondary/60";
  const label =
    kind === "paper"
      ? "Paper"
      : kind === "event"
        ? "Event"
        : kind === "job"
          ? "Job"
          : "Discussion";
  return (
    <span
      className={`inline-flex items-center text-[9.5px] font-semibold uppercase tracking-[0.16em] px-1.5 py-[3px] rounded ${tone}`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {label}
    </span>
  );
}

function ScoreChip({ scored }: { scored: RelevanceScored }) {
  if (scored.relevanceScore == null) return null;
  const pct = Math.round(scored.relevanceScore * 100);
  return (
    <span
      className="text-[10.5px] tabular-nums text-text-faint shrink-0"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {pct}%
    </span>
  );
}

function SaveButton({
  isSaved,
  onSave,
}: {
  isSaved: boolean;
  onSave: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSave();
      }}
      aria-label={isSaved ? "Unsave" : "Save"}
      className={[
        "p-1.5 rounded-md transition-colors active:scale-90",
        isSaved
          ? "text-accent bg-accent-dim/60 hover:bg-accent-dim"
          : "text-text-faint hover:text-heading hover:bg-bg-secondary/60",
      ].join(" ")}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    </button>
  );
}

// ── Paper tile ────────────────────────────────────────────────

function PaperTile({ paper, isRead }: { paper: Paper; isRead: boolean }) {
  const savePaper = useFeedStore((s) => s.savePaper);
  return (
    <Link
      href={`/papers/${paper.id}`}
      className={tileShellClass(isRead)}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <KindBadge kind={paperBadgeKind(paper)} />
        <span className="flex-1" aria-hidden />
        <ScoreChip scored={paper} />
      </div>
      <h3 className="text-[15.5px] font-semibold text-heading leading-[1.3] tracking-[-0.005em] line-clamp-2 min-h-[40px]">
        {paper.title}
      </h3>
      <p className="text-[11.5px] text-text-faint mt-2 line-clamp-1">
        {paper.authors.slice(0, 2).join(", ")}
        {paper.authors.length > 2 ? ` +${paper.authors.length - 2}` : ""}
        {paper.venue ? ` · ${paper.venue}` : ""}
      </p>
      <p
        className="text-[12.5px] text-text-muted mt-2.5 leading-[1.55] line-clamp-3"
        style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
      >
        {paper.relevanceReason}
      </p>
      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center gap-2">
        <span className="text-[10px] text-text-faint uppercase tracking-[0.14em] truncate">
          {paper.source}
        </span>
        <span className="flex-1" aria-hidden />
        <SaveButton
          isSaved={!!paper.isSaved}
          onSave={() => savePaper(paper)}
        />
      </div>
    </Link>
  );
}

// ── Event tile ────────────────────────────────────────────────

function EventTile({ event, isRead }: { event: Event; isRead: boolean }) {
  const saveEvent = useFeedStore((s) => s.saveEvent);
  const isSaved = useFeedStore((s) =>
    s.savedEvents.some((e) => e.id === event.id),
  );
  return (
    <Link
      href={`/events/${event.id}`}
      className={tileShellClass(isRead)}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <KindBadge kind="event" />
        <span className="flex-1" aria-hidden />
        <ScoreChip scored={event} />
      </div>
      <h3 className="text-[15.5px] font-semibold text-heading leading-[1.3] tracking-[-0.005em] line-clamp-2 min-h-[40px]">
        {event.name}
      </h3>
      <p className="text-[11.5px] text-text-faint mt-2 line-clamp-1">
        {fmtDate(event.date)}
        {event.isOnline ? " · Online" : event.location ? ` · ${event.location}` : ""}
      </p>
      <p
        className="text-[12.5px] text-text-muted mt-2.5 leading-[1.55] line-clamp-3"
        style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
      >
        {event.relevanceReason}
      </p>
      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center gap-2">
        <span className="text-[10px] text-text-faint uppercase tracking-[0.14em] truncate">
          {event.type}
        </span>
        <span className="flex-1" aria-hidden />
        <SaveButton isSaved={isSaved} onSave={() => saveEvent(event)} />
      </div>
    </Link>
  );
}

// ── Job tile ──────────────────────────────────────────────────

function JobTile({ job, isRead }: { job: Job; isRead: boolean }) {
  const saveJob = useFeedStore((s) => s.saveJob);
  const isSaved = useFeedStore((s) =>
    s.savedJobs.some((j) => j.id === job.id),
  );
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={tileShellClass(isRead)}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <KindBadge kind="job" />
        <span className="flex-1" aria-hidden />
        <ScoreChip scored={job} />
      </div>
      <h3 className="text-[15.5px] font-semibold text-heading leading-[1.3] tracking-[-0.005em] line-clamp-2 min-h-[40px]">
        {job.roleTitle}
      </h3>
      <p className="text-[11.5px] text-text-faint mt-2 line-clamp-1">
        {job.companyOrLab}
        {job.isRemote ? " · Remote" : job.location ? ` · ${job.location}` : ""}
      </p>
      <p
        className="text-[12.5px] text-text-muted mt-2.5 leading-[1.55] line-clamp-3"
        style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
      >
        {job.matchReason}
      </p>
      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center gap-2">
        <span className="text-[10px] text-text-faint uppercase tracking-[0.14em] truncate">
          {job.keyRequirements[0] || "Role"}
        </span>
        <span className="flex-1" aria-hidden />
        <SaveButton isSaved={isSaved} onSave={() => saveJob(job)} />
      </div>
    </Link>
  );
}

// ── Public ────────────────────────────────────────────────────

export function FeedTile({ item }: { item: FeedItem }) {
  const isRead = useFeedStore((s) => !!s.readItems[item.data.id]);
  if (item.kind === "paper") return <PaperTile paper={item.data} isRead={isRead} />;
  if (item.kind === "event") return <EventTile event={item.data} isRead={isRead} />;
  return <JobTile job={item.data} isRead={isRead} />;
}
