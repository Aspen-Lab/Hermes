"use client";

import Link from "next/link";
import type { Event } from "@/types";
import { useFeedStore } from "@/store/feed";
import { ActionBar } from "@/components/ui";
import { cardShell } from "@/components/ui/card-shell";
import { cn } from "@/lib/cn";
import {
  OpportunityRelevanceBar,
  opportunityRelevanceCardProps,
} from "@/components/opportunities/opportunity-relevance-card";
import { PrestigeBadge } from "@/components/ui/prestige-badge";
import { FactsStrip } from "@/components/ui/facts-strip";
import { UrgencyBar } from "@/components/ui/urgency-bar";
import { MatchedTerms } from "@/components/ui/matched-terms";
import { eventCardView } from "@/lib/events/card";
import { IconCalendar, IconPin } from "@/components/icons";
import { CompletionPill } from "@/components/opportunities/completion-pill";

interface EventCompletionControl {
  registered: boolean;
  submitted: boolean;
  onRegisteredChange: (next: boolean) => void;
  onSubmittedChange: (next: boolean) => void;
}

export function EventCard({
  event,
  completion,
}: {
  event: Event;
  completion?: EventCompletionControl;
}) {
  const { saveEvent, unsaveEvent, notInterestedEvent } = useFeedStore();
  const view = eventCardView(event);
  const relevanceProps = opportunityRelevanceCardProps(event.relevanceScore);
  const isDone =
    completion?.registered === true || completion?.submitted === true;

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(cardShell(), "relative")}
      {...relevanceProps}
      data-completion-state={completion ? (isDone ? "done" : "todo") : undefined}
      style={
        isDone
          ? {
              ...relevanceProps.style,
              background:
                "linear-gradient(var(--color-done-dim), var(--color-done-dim)), var(--color-surface)",
            }
          : relevanceProps.style
      }
    >
      <OpportunityRelevanceBar score={event.relevanceScore} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PrestigeBadge tier={view.prestige.tier} label={view.prestige.label} />
          <span className="rounded-md border border-tag/20 bg-tag-dim px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.14em] text-tag">
            {event.type}
          </span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          {completion && (
            <div
              className="flex flex-col items-end gap-1.5"
              data-completion-controls="event"
            >
              <CompletionPill
                label="Registered"
                checked={completion.registered}
                onChange={completion.onRegisteredChange}
              />
              <CompletionPill
                label="Submitted"
                checked={completion.submitted}
                onChange={completion.onSubmittedChange}
              />
            </div>
          )}
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
        {event.facetPreferenceReason && (
          <p className="mt-2 text-caption font-semibold text-accent">
            {event.facetPreferenceReason}
          </p>
        )}
      </div>

      <ActionBar
        onSave={() => saveEvent(event)}
        onUnsave={() => unsaveEvent(event.id)}
        onDismiss={() => notInterestedEvent(event)}
        isSaved={event.isSaved}
      />
    </Link>
  );
}
