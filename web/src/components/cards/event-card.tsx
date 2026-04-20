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
      className="block rounded-xl bg-surface border border-border p-6 hover:border-border-strong hover:bg-surface-hover transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[17px] font-semibold text-heading leading-snug tracking-tight">
          {event.name}
        </h3>
        <Relevance score={event.relevanceScore} />
      </div>

      <p className="text-[14px] text-text-muted mt-2">
        {fmtDate(event.date)} · {event.isOnline ? "Online" : event.location}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3">
        <Tag>{event.type}</Tag>
        {event.isOnline && <Tag>online</Tag>}
      </div>

      <p className="text-[15px] text-text-muted mt-4 leading-relaxed line-clamp-2" style={{ fontFamily: "var(--font-reading)" }}>
        {event.relevanceReason}
      </p>

      <ActionBar
        onSave={() => saveEvent(event)}
        onDismiss={() => notInterestedEvent(event)}
      />
    </Link>
  );
}
