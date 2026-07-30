import type { Event, PreferenceConcept } from "@/types";
import {
  normalizePreferenceConcepts,
  preferenceKey,
} from "@/lib/preferences/ledger";
import { locationFit } from "@/lib/opportunities/shared";
import type { ScoredEventItem } from "./types";

const MAX_SIGNALS = 8;

/**
 * Concepts the ledger learns from when the user saves/dismisses this event.
 * Leads with the event's own series identity (name minus the year) so
 * feedback distinguishes AAAI from KR even when both share a category, then
 * matched profile topics (bridging to paper-side concepts by label), then a
 * capped slice of subject tags — uncapped, two same-category conferences
 * would carry identical signals and a like + dismiss would fully cancel.
 */
export function eventPreferenceSignals(item: ScoredEventItem): PreferenceConcept[] {
  const seriesName = item.name.replace(/\b(19|20)\d{2}\b/g, "").trim();
  return normalizePreferenceConcepts([
    ...(seriesName
      ? [
          {
            key: preferenceKey(seriesName, "event_topic"),
            label: seriesName,
            source: "event_topic" as const,
          },
        ]
      : []),
    ...item.matchedKeywords.map((label) => ({
      key: preferenceKey(label, "event_topic"),
      label,
      source: "event_topic" as const,
    })),
    ...item.tags
      .filter((tag) => tag.length > 2 && !/web discovery|tech conference/i.test(tag))
      .slice(0, 3)
      .map((label) => ({
        key: preferenceKey(label, "event_topic"),
        label,
        source: "event_topic" as const,
      })),
  ]).slice(0, MAX_SIGNALS);
}

export function scoredEventToEvent(item: ScoredEventItem, locationPreferences?: string[]): Event {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    date: item.startDate,
    endDate: item.endDate,
    location: item.location || (item.isOnline ? "Online" : "See event page"),
    place: item.place,
    isOnline: item.isOnline,
    deadline: item.deadline,
    shortDescription: item.description.slice(0, 280),
    relevanceReason: item.relevanceReason,
    facetPreferenceReason: item.facetPreferenceReason,
    linkOfficial: item.url,
    linkRegistration: item.registrationUrl ?? item.url,
    relevanceScore: item.score,
    isSaved: false,
    preferenceSignals: eventPreferenceSignals(item),
    rank: item.rank,
    tags: item.tags.length > 0 ? item.tags : undefined,
    matchedTerms: item.matchedKeywords.length > 0 ? item.matchedKeywords : undefined,
    locationFit: locationPreferences
      ? locationFit(item.location, item.isOnline, locationPreferences)
      : undefined,
  };
}
