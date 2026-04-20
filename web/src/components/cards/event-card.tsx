"use client";

import Link from "next/link";
import type { Event } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Tag, Relevance, ActionBar } from "@/components/ui";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EventCard({ event }: { event: Event }) {
  const { saveEvent, notInterestedEvent } = useFeedStore();

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-2xl bg-surface shadow-card p-7 animate-fade-in-up transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover hover:-translate-y-[2px] active:translate-y-0 active:shadow-card"
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-[19px] font-semibold text-heading leading-snug tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {event.name}
        </h3>
        <Relevance score={event.relevanceScore} />
      </div>

      <p
        className="text-[13.5px] text-text-muted mt-2.5"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {fmtDate(event.date)} · {event.isOnline ? "Online" : event.location}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3.5">
        <Tag>{event.type}</Tag>
      </div>

      <p className="text-[15.5px] text-text-muted mt-4 leading-[1.65] line-clamp-2">
        {event.relevanceReason}
      </p>

      <ActionBar
        onSave={() => saveEvent(event)}
        onDismiss={() => notInterestedEvent(event)}
      />
    </Link>
  );
}
