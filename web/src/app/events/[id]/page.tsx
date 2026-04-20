"use client";

import { use, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Event } from "@/types";
import { useFeedStore } from "@/store/feed";
import { mockEvents } from "@/data/mock";
import { Tag, DetailSection } from "@/components/ui";
import { BriefingQuickHit } from "@/components/cards/briefing-quick-hit";

function fmtFullDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(target: string): number {
  const ms = new Date(target).getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

function formatRelative(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0 && days < 14) return `in ${days} days`;
  if (days < 0 && days > -14) return `${Math.abs(days)} days ago`;
  if (days >= 14 && days < 60) return `in ${Math.floor(days / 7)} weeks`;
  if (days <= -14 && days > -60) return `${Math.floor(Math.abs(days) / 7)} weeks ago`;
  if (days >= 60 && days < 365) return `in ${Math.floor(days / 30)} months`;
  if (days <= -60 && days > -365) return `${Math.floor(Math.abs(days) / 30)} months ago`;
  if (days >= 365) return `in ${Math.floor(days / 365)} years`;
  return `${Math.floor(Math.abs(days) / 365)} years ago`;
}

function urgencyColor(days: number): {
  text: string;
  bg: string;
  border: string;
  dot: string;
  label: string;
} {
  if (days < 0) {
    return {
      text: "text-text-faint",
      bg: "bg-surface/80",
      border: "border-border",
      dot: "bg-text-faint/50",
      label: "Closed",
    };
  }
  if (days <= 14) {
    return {
      text: "text-red",
      bg: "bg-red/[0.06]",
      border: "border-red/25",
      dot: "bg-red",
      label: "Soon",
    };
  }
  if (days <= 60) {
    return {
      text: "text-accent",
      bg: "bg-accent-dim",
      border: "border-accent/30",
      dot: "bg-accent",
      label: "Coming up",
    };
  }
  return {
    text: "text-text-muted",
    bg: "bg-surface",
    border: "border-border-strong",
    dot: "bg-text-muted",
    label: "Upcoming",
  };
}

function pickRelatedEvents(current: Event, pool: Event[], limit = 3): Event[] {
  const others = pool.filter((e) => e.id !== current.id);
  return others
    .map((e) => ({
      e,
      score:
        (e.type === current.type ? 1 : 0) +
        (e.relevanceScore ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const feedEvents = useFeedStore((s) => s.events);
  const savedEvents = useFeedStore((s) => s.savedEvents);
  const markRead = useFeedStore((s) => s.markRead);
  const { saveEvent, notInterestedEvent } = useFeedStore();

  const event =
    feedEvents.find((e) => e.id === id) ??
    savedEvents.find((e) => e.id === id) ??
    mockEvents.find((e) => e.id === id);

  useEffect(() => {
    if (event) markRead(event.id);
  }, [event, markRead]);

  const related = useMemo(() => {
    if (!event) return [];
    const pool = feedEvents.length > 0 ? feedEvents : mockEvents;
    return pickRelatedEvents(event, pool, 3);
  }, [event, feedEvents]);

  if (!event) {
    return (
      <article className="mx-auto max-w-[720px] px-6 py-20">
        <p className="text-text-muted italic">Event not found.</p>
        <Link href="/" className="text-link text-[14px] mt-3 inline-block">
          ← Back to feed
        </Link>
      </article>
    );
  }

  const isSaved = savedEvents.some((e) => e.id === event.id);
  const daysToEvent = daysBetween(event.date);
  const daysToDeadline = event.deadline ? daysBetween(event.deadline) : null;
  const deadlineStyle =
    daysToDeadline !== null ? urgencyColor(daysToDeadline) : null;
  const eventUrgency = urgencyColor(daysToEvent);

  const matchPct = event.relevanceScore
    ? Math.round(Math.max(0, Math.min(1, event.relevanceScore)) * 100)
    : null;
  const primaryUrl = event.linkRegistration || event.linkOfficial;
  const primaryLabel = event.linkRegistration ? "Register" : "Visit site";

  const handleDismiss = () => {
    notInterestedEvent(event);
    window.history.back();
  };

  return (
    <article className="mx-auto max-w-[720px] px-6 py-14">
      <Link
        href="/"
        className="group inline-flex items-center gap-1 text-[13px] text-text-faint hover:text-link transition-all duration-200 ease-out active:scale-95"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="transition-transform duration-200 ease-out group-hover:-translate-x-[2px]">
          ←
        </span>
        Back
      </Link>

      {/* ── Hero ── */}
      <header
        className="mt-8 animate-fade-in-up"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div
          className="flex items-center flex-wrap gap-x-2.5 gap-y-1.5 text-[12px] uppercase tracking-[0.14em] text-text-faint mb-3"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <span className={`inline-flex items-center gap-1.5 ${eventUrgency.text}`}>
            <span className={`block w-[6px] h-[6px] rounded-full ${eventUrgency.dot}`} />
            {event.type}
          </span>
          <span className="text-border-strong">·</span>
          <span>{formatRelative(daysToEvent)}</span>
          {matchPct !== null && (
            <>
              <span className="text-border-strong">·</span>
              <span
                className="inline-flex items-center gap-1.5 text-accent normal-case tracking-normal"
                title="Algorithmic match based on your profile"
              >
                <span className="block w-[6px] h-[6px] rounded-full bg-accent" />
                {matchPct}% match
              </span>
            </>
          )}
        </div>

        <h1
          className="text-[32px] lg:text-[38px] font-semibold text-heading leading-[1.1] tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {event.name}
        </h1>

        <div
          className="mt-5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[14px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <FactRow icon="calendar" label="When">
            <span className="text-heading font-medium">
              {fmtFullDate(event.date)}
              {event.endDate ? ` – ${fmtShortDate(event.endDate)}` : ""}
            </span>
          </FactRow>

          <FactRow icon="pin" label="Where">
            <span className="text-heading font-medium">
              {event.isOnline ? "Online" : event.location}
            </span>
            <span className="ml-2 text-text-faint text-[12.5px]">
              {event.isOnline ? "Remote participation" : "In person"}
            </span>
          </FactRow>
        </div>
      </header>

      {/* ── Primary action row ── */}
      <ActionRow
        primaryHref={primaryUrl}
        primaryLabel={primaryLabel}
        isSaved={isSaved}
        onSave={() => saveEvent(event)}
        onDismiss={handleDismiss}
      />

      {/* ── Deadline callout ── */}
      {event.deadline && deadlineStyle && (
        <section
          className={`mt-8 rounded-2xl border px-5 py-4 animate-fade-in-up ${deadlineStyle.bg} ${deadlineStyle.border}`}
          style={{ "--i": 2, fontFamily: "var(--font-sans)" } as React.CSSProperties}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                className={`text-[10.5px] font-semibold uppercase tracking-[0.18em] ${deadlineStyle.text}`}
              >
                Submission deadline · {deadlineStyle.label}
              </p>
              <p className="mt-1.5 text-[17px] text-heading font-semibold">
                {fmtFullDate(event.deadline)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[22px] font-semibold tabular-nums ${deadlineStyle.text}`}>
                {daysToDeadline !== null && daysToDeadline >= 0
                  ? daysToDeadline
                  : daysToDeadline !== null
                    ? Math.abs(daysToDeadline)
                    : "—"}
              </p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-faint mt-0.5">
                {daysToDeadline !== null && daysToDeadline >= 0
                  ? "days left"
                  : "days ago"}
              </p>
            </div>
          </div>

          {/* Timeline bar: deadline → event */}
          {daysToDeadline !== null && daysToDeadline >= 0 && (
            <Timeline
              deadline={event.deadline}
              eventDate={event.date}
            />
          )}
        </section>
      )}

      {/* ── About ── */}
      <DetailSection title="About" index={3}>
        <p className="text-[17px] leading-[1.75]">{event.shortDescription}</p>
      </DetailSection>

      {/* ── Why this fits you ── */}
      <DetailSection title="Why this fits you" index={4}>
        <p className="text-[17px] leading-[1.75]">{event.relevanceReason}</p>
      </DetailSection>

      {/* ── Quick facts ── */}
      <DetailSection title="Quick facts" index={5}>
        <div
          className="flex flex-wrap gap-2"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <Tag>{event.type}</Tag>
          <Tag>{event.isOnline ? "Online" : "In person"}</Tag>
          {!event.isOnline && <Tag>{event.location}</Tag>}
          {event.endDate && <Tag>Multi-day</Tag>}
        </div>
      </DetailSection>

      {/* ── Links as pill chips (not underlined blue) ── */}
      {(event.linkOfficial || event.linkRegistration) && (
        <DetailSection title="Links" index={6}>
          <div className="flex flex-wrap gap-2">
            <LinkChip href={event.linkOfficial} label="Official site" />
            <LinkChip href={event.linkRegistration} label="Registration" />
          </div>
        </DetailSection>
      )}

      {/* ── Related events ── */}
      {related.length > 0 && (
        <section
          className="mt-16 animate-fade-in-up"
          style={{ "--i": 7 } as React.CSSProperties}
        >
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mb-2"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Related from your feed
          </h2>
          <div className="divide-y divide-border">
            {related.map((e) => (
              <BriefingQuickHit key={e.id} item={{ kind: "event", data: e }} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

// ── Fact row: icon + label + value ──

function FactRow({
  icon,
  label,
  children,
}: {
  icon: "calendar" | "pin";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-text-faint">
        <Icon name={icon} />
        <span className="text-[11px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="text-text">{children}</div>
    </>
  );
}

// ── Inline icons ──

function Icon({ name }: { name: "calendar" | "pin" }) {
  if (name === "calendar") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// ── Link chip (pill style, not underlined blue) ──

function LinkChip({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-surface border border-border-strong text-[12.5px] text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover transition-colors duration-200 ease-out active:scale-[0.96]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {label}
      <span className="text-[10px] opacity-60 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
        ↗
      </span>
    </a>
  );
}

// ── Timeline bar ──

function Timeline({
  deadline,
  eventDate,
}: {
  deadline: string;
  eventDate: string;
}) {
  const start = new Date(deadline).getTime();
  const end = new Date(eventDate).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return null;
  const pct = Math.max(0, Math.min(100, ((now - start) / total) * 100));

  return (
    <div className="mt-4">
      <div className="relative h-[6px] rounded-full bg-border">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent/60"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-accent border-2 border-bg shadow-card"
          style={{ left: `calc(${pct}% - 5px)` }}
          aria-hidden
        />
      </div>
      <div
        className="flex items-center justify-between mt-2 text-[10.5px] uppercase tracking-[0.14em] text-text-faint"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span>Deadline · {fmtShortDate(deadline)}</span>
        <span>Event · {fmtShortDate(eventDate)}</span>
      </div>
    </div>
  );
}

// ── Prominent action row ──

function ActionRow({
  primaryHref,
  primaryLabel,
  isSaved,
  onSave,
  onDismiss,
}: {
  primaryHref?: string;
  primaryLabel: string;
  isSaved: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex items-center flex-wrap gap-2.5 mt-7 animate-fade-in-up"
      style={{ "--i": 1, fontFamily: "var(--font-sans)" } as React.CSSProperties}
    >
      {primaryHref && (
        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 h-11 px-5 rounded-full bg-accent text-bg text-[14px] font-semibold shadow-card hover:shadow-card-hover hover:bg-accent/90 transition-all duration-200 ease-out active:scale-[0.97]"
        >
          {primaryLabel}
          <span className="text-[11px] opacity-90 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
            ↗
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={onSave}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Saved" : "Save"}
        className={`group inline-flex items-center gap-1.5 h-11 pl-3.5 pr-4 rounded-full text-[13.5px] font-medium transition-all duration-200 ease-out active:scale-[0.96] ${
          isSaved
            ? "bg-accent/10 text-accent border border-accent/40"
            : "bg-transparent border border-border-strong text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={isSaved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-300 ease-out ${
            isSaved ? "scale-100" : "group-hover:-translate-y-[1px]"
          }`}
          aria-hidden
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {isSaved ? "Saved" : "Save"}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Not interested — hide this"
        className="group inline-flex items-center justify-center w-11 h-11 rounded-full text-text-faint hover:text-red hover:bg-red/10 transition-colors duration-200 ease-out active:scale-[0.9] ml-auto"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300 ease-out group-hover:rotate-90"
          aria-hidden
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
