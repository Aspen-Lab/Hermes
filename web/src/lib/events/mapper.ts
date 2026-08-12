import type { Event, EventType, PreferenceConcept } from "@/types";
import {
  normalizePreferenceConcepts,
  preferenceKey,
} from "@/lib/preferences/ledger";
import { locationFit } from "@/lib/opportunities/shared";
import type { ScoredEventItem } from "./types";

const MAX_SIGNALS = 8;
const MAX_DESCRIPTION_LENGTH = 280;

export function cleanEventDescription(description: string): string {
  let text = description
    .replace(/\[(?:\.{3}|\u2026)\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const firstLetter = text.match(/[A-Za-z]/)?.[0];
  if (firstLetter && firstLetter === firstLetter.toLowerCase()) {
    const nextSentence = text.match(/[.!?](?:["')\]]*)\s+(?=[A-Z0-9])/);
    if (!nextSentence || nextSentence.index === undefined) return "";
    text = text.slice(nextSentence.index + nextSentence[0].length).trim();
  }

  let needsEllipsis = false;
  const clippedTail = text.match(/(?:,\s*|\s+)[A-Za-z]{1,2}$/);
  if (clippedTail?.index !== undefined) {
    text = text.slice(0, clippedTail.index).replace(/[,:;\s]+$/g, "");
    needsEllipsis = true;
  }

  if (text.length > MAX_DESCRIPTION_LENGTH) {
    const boundary = text
      .slice(0, MAX_DESCRIPTION_LENGTH + 1)
      .replace(/\s+\S*$/, "")
      .replace(/[,:;\s]+$/g, "");
    text = boundary || text.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
    needsEllipsis = true;
  }

  return `${text}${needsEllipsis ? "\u2026" : ""}`;
}

/** An owned summary must still be complete enough to state as a report fact. */
export function cleanOwnedEventReportSummary(description: string): string | undefined {
  const cleaned = cleanEventDescription(description);
  return cleaned && !cleaned.endsWith("…") && /[.!?](?:["')\]]*)$/.test(cleaned)
    ? cleaned
    : undefined;
}

function eventKindIn(text: string): EventType | undefined {
  if (/\b(?:career|student|graduate|campus) (?:fair|expo)\b/i.test(text)) {
    return "career-fair";
  }
  if (
    /\b(?:job|hiring|recruiting|recruitment) (?:fair|expo|event)\b/i.test(text)
  ) {
    return "job-fair";
  }
  if (/\b(?:hackathon|hack day)\b/i.test(text)) return "hackathon";
  if (/\bsummit\b/i.test(text)) return "summit";
  if (/\b(?:expo|exposition|trade show)\b/i.test(text)) return "expo";
  if (/\bworkshop\b/i.test(text)) return "workshop";
  if (/\b(?:seminar|colloquium|webinar|lecture series)\b/i.test(text)) {
    return "seminar";
  }
  if (/\b(?:meetup|networking event)\b/i.test(text)) return "meetup";
  if (
    /\b(?:conference|symposium|congress|forum|convention|annual meeting)\b/i.test(
      text,
    )
  ) {
    return "conference";
  }
  return undefined;
}

/**
 * Sources often default every result to "conference". Prefer the event's
 * title, then its description, while preserving a trustworthy source label
 * when neither contains an explicit event kind.
 */
export function classifyEventType(
  title: string,
  description: string,
  fallback: EventType = "conference",
): EventType {
  return eventKindIn(title) ?? eventKindIn(description) ?? fallback;
}

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
    type: classifyEventType(item.name, item.description, item.type),
    date: item.startDate,
    endDate: item.endDate,
    location: item.location || (item.isOnline ? "Online" : "See event page"),
    place: item.place,
    isOnline: item.isOnline,
    deadline: item.deadline,
    registrationDeadline: item.registrationDeadline,
    fees: item.fees,
    activities: item.activities,
    organisations: item.organisations,
    people: item.people,
    travelGrant: item.travelGrant,
    invitationLetter: item.invitationLetter,
    expectedSize: item.expectedSize,
    shortDescription: cleanEventDescription(item.description),
    reportSummary: item.reportSummary,
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
