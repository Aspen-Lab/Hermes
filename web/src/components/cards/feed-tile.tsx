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
    "group relative block rounded-xl bg-surface shadow-card p-4",
    "animate-fade-in-up",
    "transition-[box-shadow,transform] duration-200 ease-out",
    "hover:shadow-card-hover hover:-translate-y-[1px]",
    isRead ? "opacity-70 hover:opacity-100" : "",
  ].join(" ");
}

type BadgeKind = "paper" | "event" | "job" | "discussion";

// "Paper" is reserved for items from academic APIs (arXiv, OpenAlex).
// Anything else (HN today, future blog/social adapters) renders as
// "Discussion" so users don't mistake a thread for a peer-reviewed work.
// Allowlist by id prefix — strict on purpose.
const ACADEMIC_ID_PREFIXES = ["arxiv:", "openalex:"];

function paperBadgeKind(paper: Paper): BadgeKind {
  const isAcademic = ACADEMIC_ID_PREFIXES.some((p) => paper.id.startsWith(p));
  return isAcademic ? "paper" : "discussion";
}

// ── Category icons (12px line, currentColor) ──────────────────

function PaperIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function DiscussionIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z" />
      <circle cx="9" cy="12" r="0.6" fill="currentColor" />
      <circle cx="13" cy="12" r="0.6" fill="currentColor" />
      <circle cx="17" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

function EventIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

function JobIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

// ── Inline metadata icons (10px) ──────────────────────────────

function CalendarMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PinMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function GlobeMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function BuildingMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M16 9h3a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </svg>
  );
}

function AuthorMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
}

// ── Badge / chip ──────────────────────────────────────────────

const KIND_ICON: Record<BadgeKind, () => React.ReactElement> = {
  paper: PaperIcon,
  event: EventIcon,
  job: JobIcon,
  discussion: DiscussionIcon,
};

const KIND_LABEL: Record<BadgeKind, string> = {
  paper: "Paper",
  event: "Event",
  job: "Job",
  discussion: "Discussion",
};

const KIND_TONE: Record<BadgeKind, string> = {
  paper: "text-accent bg-accent-dim",
  event: "text-tag bg-tag-dim",
  job: "text-link bg-link-dim",
  discussion: "text-text-muted bg-bg-secondary/70",
};

// Vertical accent stripe on the left edge — at-a-glance category cue.
const KIND_STRIPE: Record<BadgeKind, string> = {
  paper: "bg-accent/55",
  event: "bg-tag/55",
  job: "bg-link/55",
  discussion: "bg-text-faint/40",
};

function KindBadge({ kind }: { kind: BadgeKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] pl-1.5 pr-2 py-[3px] rounded-md ${KIND_TONE[kind]}`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <Icon />
      {KIND_LABEL[kind]}
    </span>
  );
}

function KindStripe({ kind }: { kind: BadgeKind }) {
  return (
    <span
      aria-hidden
      className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r ${KIND_STRIPE[kind]}`}
    />
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

function MetaItem({ icon: Icon, children }: { icon: () => React.ReactElement; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="text-text-faint/80 shrink-0">
        <Icon />
      </span>
      <span className="truncate">{children}</span>
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

const SELECTED_BG = "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))";

function PaperTile({ paper, isRead, selected }: { paper: Paper; isRead: boolean; selected?: boolean }) {
  const savePaper = useFeedStore((s) => s.savePaper);
  const moreLikePaper = useFeedStore((s) => s.moreLikePaper);
  const notInterestedPaper = useFeedStore((s) => s.notInterestedPaper);

  const isLiked = paper.feedback === "moreLikeThis" || paper.feedback === "liked";

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const kind = paperBadgeKind(paper);
  const authorLine =
    paper.authors.slice(0, 2).join(", ") +
    (paper.authors.length > 2 ? ` +${paper.authors.length - 2}` : "") +
    (paper.venue ? ` · ${paper.venue}` : "");

  return (
    <Link
      href={`/papers/${paper.id}`}
      className={tileShellClass(isRead)}
      style={{
        fontFamily: "var(--font-sans)",
        ...(selected ? { background: SELECTED_BG, transition: "background 0.3s" } : { transition: "background 0.3s" }),
      }}
    >
      <KindStripe kind={kind} />
      <div className="flex items-center gap-2 mb-2.5">
        <KindBadge kind={kind} />
        <span className="flex-1" aria-hidden />
        <ScoreChip scored={paper} />
      </div>
      <h3 className="text-[15.5px] font-semibold text-heading leading-[1.3] tracking-[-0.005em] line-clamp-2 min-h-[40px]">
        {paper.title}
      </h3>
      <div className="text-[11.5px] text-text-faint mt-2 flex items-center gap-1 min-w-0">
        <MetaItem icon={AuthorMini}>{authorLine}</MetaItem>
      </div>
      <p
        className="text-[13.5px] sm:text-[12.5px] text-text-muted mt-2.5 leading-[1.6] sm:leading-[1.55] line-clamp-3"
        style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
      >
        {paper.relevanceReason}
      </p>
      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center gap-1">
        <span className="text-[10px] text-text-faint uppercase tracking-[0.14em] truncate mr-1">
          {paper.source}
        </span>
        <span className="flex-1" aria-hidden />

        {/* Like */}
        <button
          type="button"
          onClick={stop(() => moreLikePaper(paper))}
          aria-pressed={isLiked}
          aria-label="Like — show more like this"
          title="Like"
          className={[
            "p-1.5 rounded-md transition-colors active:scale-90",
            isLiked
              ? "text-accent bg-accent-dim/60"
              : "text-text-faint hover:text-accent hover:bg-accent-dim/60",
          ].join(" ")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 10v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3zM7 10l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 19H7" />
          </svg>
        </button>

        {/* Dislike */}
        <button
          type="button"
          onClick={stop(() => notInterestedPaper(paper))}
          aria-label="Not interested — show less like this"
          title="Not interested"
          className="p-1.5 rounded-md text-text-faint hover:text-red hover:bg-red/10 transition-colors active:scale-90"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 14V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zM17 14l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 5H17" />
          </svg>
        </button>

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
      <KindStripe kind="event" />
      <div className="flex items-center gap-2 mb-2.5">
        <KindBadge kind="event" />
        <span className="flex-1" aria-hidden />
        <ScoreChip scored={event} />
      </div>
      <h3 className="text-[15.5px] font-semibold text-heading leading-[1.3] tracking-[-0.005em] line-clamp-2 min-h-[40px]">
        {event.name}
      </h3>
      <div className="text-[11.5px] text-text-faint mt-2 flex items-center gap-2.5 min-w-0">
        <MetaItem icon={CalendarMini}>{fmtDate(event.date)}</MetaItem>
        {(event.isOnline || event.location) && (
          <MetaItem icon={event.isOnline ? GlobeMini : PinMini}>
            {event.isOnline ? "Online" : event.location}
          </MetaItem>
        )}
      </div>
      <p
        className="text-[13.5px] sm:text-[12.5px] text-text-muted mt-2.5 leading-[1.6] sm:leading-[1.55] line-clamp-3"
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
      <KindStripe kind="job" />
      <div className="flex items-center gap-2 mb-2.5">
        <KindBadge kind="job" />
        <span className="flex-1" aria-hidden />
        <ScoreChip scored={job} />
      </div>
      <h3 className="text-[15.5px] font-semibold text-heading leading-[1.3] tracking-[-0.005em] line-clamp-2 min-h-[40px]">
        {job.roleTitle}
      </h3>
      <div className="text-[11.5px] text-text-faint mt-2 flex items-center gap-2.5 min-w-0">
        <MetaItem icon={BuildingMini}>{job.companyOrLab}</MetaItem>
        {(job.isRemote || job.location) && (
          <MetaItem icon={job.isRemote ? GlobeMini : PinMini}>
            {job.isRemote ? "Remote" : job.location}
          </MetaItem>
        )}
      </div>
      <p
        className="text-[13.5px] sm:text-[12.5px] text-text-muted mt-2.5 leading-[1.6] sm:leading-[1.55] line-clamp-3"
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

export function FeedTile({ item, selected }: { item: FeedItem; selected?: boolean }) {
  const isRead = useFeedStore((s) => !!s.readItems[item.data.id]);
  if (item.kind === "paper") return <PaperTile paper={item.data} isRead={isRead} selected={selected} />;
  if (item.kind === "event") return <EventTile event={item.data} isRead={isRead} />;
  return <JobTile job={item.data} isRead={isRead} />;
}
