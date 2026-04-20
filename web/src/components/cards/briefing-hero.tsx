"use client";

import Link from "next/link";
import type { Paper, Event, Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Tag, Relevance, ActionBar } from "@/components/ui";

export type HeroItem =
  | { kind: "paper"; data: Paper }
  | { kind: "event"; data: Event }
  | { kind: "job"; data: Job };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BriefingHero({ item }: { item: HeroItem }) {
  const {
    savePaper,
    notInterestedPaper,
    moreLikePaper,
    saveEvent,
    notInterestedEvent,
    saveJob,
    notInterestedJob,
  } = useFeedStore();

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

  const relevanceReason =
    item.kind === "paper"
      ? item.data.relevanceReason
      : item.kind === "event"
        ? item.data.relevanceReason
        : item.data.matchReason;

  return (
    <Link
      href={detail}
      className="group relative block rounded-3xl bg-surface shadow-card p-8 lg:p-10 animate-fade-in-up transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover hover:-translate-y-[2px] active:translate-y-0 active:shadow-card overflow-hidden"
    >
      <span
        className="absolute left-0 top-8 bottom-8 w-[3px] rounded-r-full bg-accent/80"
        aria-hidden
      />

      <p
        className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent mb-4"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Top pick today
      </p>

      <div className="flex items-start justify-between gap-5">
        <h2
          className="text-[26px] lg:text-[30px] font-semibold text-heading leading-[1.15] tracking-[-0.015em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {title}
        </h2>
        <Relevance score={score} />
      </div>

      {item.kind === "paper" && (
        <>
          <p
            className="text-[14px] text-text-muted mt-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {item.data.authors.slice(0, 3).join(", ")}
            {item.data.authors.length > 3 && ` +${item.data.authors.length - 3}`}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-4">
            <Tag>Paper</Tag>
            <Tag>{item.data.venue}</Tag>
          </div>
          <p className="text-[17px] text-text mt-5 leading-[1.7]">
            {item.data.relevanceReason}
          </p>
          <p className="text-[15.5px] text-text-muted mt-3 leading-[1.65] line-clamp-3">
            {item.data.summaryIntro}
          </p>
        </>
      )}

      {item.kind === "event" && (
        <>
          <p
            className="text-[14px] text-text-muted mt-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {fmtDate(item.data.date)} · {item.data.isOnline ? "Online" : item.data.location}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-4">
            <Tag>Event</Tag>
            <Tag>{item.data.type}</Tag>
          </div>
          <p className="text-[17px] text-text mt-5 leading-[1.7]">
            {item.data.relevanceReason}
          </p>
          <p className="text-[15.5px] text-text-muted mt-3 leading-[1.65] line-clamp-2">
            {item.data.shortDescription}
          </p>
        </>
      )}

      {item.kind === "job" && (
        <>
          <p
            className="text-[14px] text-text-muted mt-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {item.data.companyOrLab} · {item.data.isRemote ? "Remote" : item.data.location}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-4">
            <Tag>Role</Tag>
            {item.data.keyRequirements.slice(0, 3).map((req) => (
              <span
                key={req}
                className="text-[11.5px] text-text-muted bg-bg-secondary/70 px-2 py-[3px] rounded-md"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {req}
              </span>
            ))}
          </div>
          <p className="text-[17px] text-text mt-5 leading-[1.7]">
            {relevanceReason}
          </p>
        </>
      )}

      {item.kind === "paper" && (
        <ActionBar
          onSave={() => savePaper(item.data)}
          onDismiss={() => notInterestedPaper(item.data)}
          onMore={() => moreLikePaper(item.data)}
          isSaved={item.data.isSaved}
        />
      )}
      {item.kind === "event" && (
        <ActionBar
          onSave={() => saveEvent(item.data)}
          onDismiss={() => notInterestedEvent(item.data)}
        />
      )}
      {item.kind === "job" && (
        <ActionBar
          onSave={() => saveJob(item.data)}
          onDismiss={() => notInterestedJob(item.data)}
        />
      )}
    </Link>
  );
}
