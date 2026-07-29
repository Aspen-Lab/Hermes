"use client";

import Link from "next/link";
import type { Event } from "@/types";
import { useFeedStore } from "@/store/feed";
import { ActionBar } from "@/components/ui";
import { cardShell } from "@/components/ui/card-shell";
import { PrestigeBadge } from "@/components/ui/prestige-badge";
import { FactsStrip } from "@/components/ui/facts-strip";
import { UrgencyBar } from "@/components/ui/urgency-bar";
import { MatchedTerms } from "@/components/ui/matched-terms";
import { eventCardView } from "@/lib/events/card";
import { IconCalendar, IconPin } from "@/components/icons";

export function EventCard({ event }: { event: Event }) {
  const { saveEvent, notInterestedEvent } = useFeedStore();
  const view = eventCardView(event);

  return (
    <Link href={`/events/${event.id}`} className={cardShell()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PrestigeBadge tier={view.prestige.tier} label={view.prestige.label} />
          <span className="rounded-md border border-tag/20 bg-tag-dim px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.14em] text-tag">
            {event.type}
          </span>
        </div>
        <span
          className={
            view.matchTone === "accent"
              ? "text-meta font-medium text-accent"
              : "text-meta text-text-faint"
          }
        >
          {view.matchLabel}
        </span>
      </div>

      <h3 className="mt-3 text-title-lg font-semibold leading-snug tracking-[-0.01em] text-heading">
        {event.name}
      </h3>

      <FactsStrip
        className="mt-3.5"
        facts={[
          { icon: <IconCalendar />, label: view.dateLabel },
          { icon: <IconPin />, label: view.locationLabel, tone: view.locationTone },
        ]}
      />

      <UrgencyBar className="mt-3.5" {...view.urgency} />

      <div className="mt-4">
        <MatchedTerms terms={view.matchedTerms} />
        <p className="mt-2.5 text-body-lg leading-[1.65] text-text-muted">
          {event.relevanceReason}
        </p>
      </div>

      <ActionBar
        onSave={() => saveEvent(event)}
        onDismiss={() => notInterestedEvent(event)}
      />
    </Link>
  );
}
