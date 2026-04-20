"use client";

import { use } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { mockEvents } from "@/data/mock";
import { Tag, DetailSection, LinkRow, ActionBar } from "@/components/ui";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const feedEvents = useFeedStore((s) => s.events);
  const savedEvents = useFeedStore((s) => s.savedEvents);
  const { saveEvent, notInterestedEvent } = useFeedStore();

  const event =
    feedEvents.find((e) => e.id === id) ??
    savedEvents.find((e) => e.id === id) ??
    mockEvents.find((e) => e.id === id);

  if (!event) {
    return (
      <article className="mx-auto max-w-[720px] px-6 py-16">
        <p className="text-text-muted italic">Event not found.</p>
        <Link href="/" className="text-link text-sm mt-2 inline-block">← Back to feed</Link>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-[720px] px-6 py-12">
      <Link href="/" className="text-sm text-text-faint hover:text-link transition-colors">
        ← Back
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-bold text-heading leading-tight">
          {event.name}
        </h1>
        <p className="text-text-muted mt-2">
          {fmtDate(event.date)} · {event.isOnline ? "Online" : event.location}
        </p>
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <Tag>{event.type}</Tag>
          {event.isOnline && <Tag>online</Tag>}
          {event.relevanceScore && (
            <span className="font-mono text-xs text-yellow">
              {Math.round(event.relevanceScore * 100)}% match
            </span>
          )}
        </div>
      </header>

      <DetailSection title="Why this fits you">
        {event.relevanceReason}
      </DetailSection>

      <DetailSection title="About">
        {event.shortDescription}
      </DetailSection>

      {event.deadline && (
        <DetailSection title="Submission deadline">
          <span className="text-peach font-semibold">{fmtDate(event.deadline)}</span>
        </DetailSection>
      )}

      <DetailSection title="Links">
        <div className="flex flex-wrap">
          <LinkRow label="Official site" href={event.linkOfficial} />
          <LinkRow label="Registration" href={event.linkRegistration} />
        </div>
      </DetailSection>

      <div className="mt-8 pt-4 border-t border-border">
        <ActionBar
          onSave={() => saveEvent(event)}
          onDismiss={() => { notInterestedEvent(event); window.history.back(); }}
        />
      </div>
    </article>
  );
}
