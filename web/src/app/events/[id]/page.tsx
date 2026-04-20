"use client";

import { use } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { mockEvents } from "@/data/mock";
import { Tag, DetailSection, LinkRow, ActionBar, Relevance } from "@/components/ui";

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
      <article className="mx-auto max-w-[720px] px-6 py-20">
        <p className="text-text-muted italic">Event not found.</p>
        <Link href="/" className="text-link text-[14px] mt-3 inline-block">← Back to feed</Link>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-[720px] px-6 py-14">
      <Link
        href="/"
        className="text-[13px] text-text-faint hover:text-link transition-colors"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        ← Back
      </Link>

      <header className="mt-8">
        <h1
          className="text-[30px] lg:text-[34px] font-semibold text-heading leading-[1.15] tracking-[-0.015em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {event.name}
        </h1>
        <p
          className="text-text-muted mt-3 text-[14.5px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {fmtDate(event.date)} · {event.isOnline ? "Online" : event.location}
        </p>
        <div className="flex items-center flex-wrap gap-2.5 mt-4">
          <Tag>{event.type}</Tag>
          {event.isOnline && <Tag>online</Tag>}
          <Relevance score={event.relevanceScore} />
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

      <div className="mt-10 pt-5 border-t border-border">
        <ActionBar
          onSave={() => saveEvent(event)}
          onDismiss={() => { notInterestedEvent(event); window.history.back(); }}
        />
      </div>
    </article>
  );
}
