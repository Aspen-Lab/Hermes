"use client";

import Link from "next/link";
import type { Event } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Tag, Relevance, ActionBar } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { cardShell } from "@/components/ui/card-shell";
import { cn } from "@/lib/cn";
import {
  OpportunityRelevanceBar,
  opportunityRelevanceCardProps,
} from "@/components/opportunities/opportunity-relevance-card";

export function EventCard({ event }: { event: Event }) {
  const { saveEvent, notInterestedEvent } = useFeedStore();

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(cardShell(), "relative")}
      {...opportunityRelevanceCardProps(event.relevanceScore)}
    >
      <OpportunityRelevanceBar score={event.relevanceScore} />
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-title-lg font-semibold text-heading leading-snug tracking-[-0.01em]"
        >
          {event.name}
        </h3>
        <Relevance score={event.relevanceScore} />
      </div>

      <p
        className="text-body-sm text-text-muted mt-2.5"
      >
        {formatDate(event.date)} · {event.isOnline ? "Online" : event.location}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3.5">
        <Tag>{event.type}</Tag>
      </div>

      <p className="text-body-lg text-text-muted mt-4 leading-[1.65] line-clamp-2">
        {event.relevanceReason}
      </p>
      {event.facetPreferenceReason && (
        <p className="mt-2 text-caption font-semibold text-accent">
          {event.facetPreferenceReason}
        </p>
      )}

      <ActionBar
        onSave={() => saveEvent(event)}
        onDismiss={() => notInterestedEvent(event)}
      />
    </Link>
  );
}
