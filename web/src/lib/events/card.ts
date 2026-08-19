import type { Event } from "@/types";
import { daysUntil, formatDate, isMonthGranularity, parseDate } from "@/lib/format";
import { eventPrestige } from "@/lib/opportunities/prestige";
import { eventUrgency, type UrgencyBucket } from "@/lib/opportunities/urgency";
import { matchQuality } from "@/lib/opportunities/match-quality";
import { isOnlineOnly } from "@/lib/opportunities/facets";

const UNKNOWN_URGENCY: UrgencyBucket = {
  text: "text-text-faint",
  bg: "bg-surface/80",
  dot: "bg-text-faint/50",
  label: "Not listed",
};

export type EventCardView = {
  prestige: ReturnType<typeof eventPrestige>;
  matchLabel: string;
  matchTone: "accent" | "muted";
  dateLabel: string;
  locationLabel: string;
  locationTone: "neutral" | "accent" | "muted";
  urgency: {
    bucket: UrgencyBucket;
    label: string;
    progress?: number;
  };
  matchedTerms: string[];
};

function dateLabel(event: Event): string {
  if (!parseDate(event.date)) return "Date not listed";
  // A24-02 / Ruling 62b. The month-granularity branch that used to sit HERE
  // has moved into `formatDate` itself, where `format.ts`'s own header says
  // formatters belong. This card was the ONLY surface that had it; the report
  // tile, the report's deadline strip, the feed tile, the briefing quick-hit
  // and the briefing hero all printed an invented day because they reached the
  // shared formatter instead. Two copies is how the surfaces disagreed, so
  // there is now one. `card.test.ts`'s "renders `Aug 2026`" case is UNCHANGED
  // and its green through the shared path is the proof the behaviour survived
  // the move — a credential, not a casualty.
  const start = formatDate(event.date, "medium") ?? "Date not listed";
  // The card keeps its OWN join ("Sep 10, 2026–Sep 12, 2026") rather than
  // `formatDateRange`'s collapsed form, but it applies the same end-suppression
  // rule: a month-granularity start has no day to range FROM, so it ignores the
  // end. The early return this replaces already behaved this way — leaving it
  // out would print "Aug 2026–Sep 15, 2026", a regression rather than a clause
  // honestly left unbuilt. Unwitnessed live (the one such row's endDate is "").
  return event.endDate && parseDate(event.endDate) && !isMonthGranularity(event.date)
    ? `${start}–${formatDate(event.endDate, "medium") ?? "Date not listed"}`
    : start;
}

function locationView(event: Event): Pick<EventCardView, "locationLabel" | "locationTone"> {
  // B20-01, render site 1 of 6. Was `event.isOnline ? "Online" : …`, which
  // deleted the venue of a HYBRID event — schema.org's Mixed attendance mode
  // is stored as `isOnline: true`. `isOnlineOnly` is the shipped predicate the
  // Format facet chips already use, so the tile and the chip now agree.
  const place = isOnlineOnly(event)
    ? "Online"
    : event.location.trim() || (event.isOnline ? "Online" : "Location not listed");
  if (event.locationFit === undefined) {
    return { locationLabel: place, locationTone: "neutral" };
  }
  if (event.locationFit >= 0.95) {
    return { locationLabel: `${place} · Preferred`, locationTone: "accent" };
  }
  if (event.locationFit >= 0.8) {
    return { locationLabel: `${place} · Remote-compatible`, locationTone: "accent" };
  }
  return { locationLabel: `${place} · Outside preferences`, locationTone: "muted" };
}

function deadlineView(event: Event, now: number): EventCardView["urgency"] {
  if (!event.deadline || !parseDate(event.deadline)) {
    return { bucket: UNKNOWN_URGENCY, label: "CFP deadline not listed" };
  }

  const days = daysUntil(event.deadline, now);
  const label =
    days < 0
      ? `CFP closed ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`
      : days === 0
        ? "CFP closes today"
        : days === 1
          ? "CFP closes tomorrow"
          : `CFP closes in ${days} days`;
  const progress = Math.round(Math.max(0, Math.min(100, ((60 - days) / 60) * 100)));
  return { bucket: eventUrgency(days), label, progress };
}

export function eventCardView(event: Event, now: number = Date.now()): EventCardView {
  const match = matchQuality(event.relevanceScore);
  const location = locationView(event);

  return {
    prestige: eventPrestige(event.rank),
    matchLabel: match ? `${match.pct}% · ${match.label}` : "Match not scored",
    matchTone: match && match.band !== "marginal" ? "accent" : "muted",
    dateLabel: dateLabel(event),
    ...location,
    urgency: deadlineView(event, now),
    matchedTerms: event.matchedTerms ?? [],
  };
}
