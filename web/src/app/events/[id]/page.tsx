"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import type {
  CareerStage,
  Event,
  EventFee,
  EventOrg,
  EventPerson,
} from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { formatDate, formatMatchPct } from "@/lib/format";
import {
  buildEnrichmentContext,
  hasEventEnrichment,
  opportunityEnrichmentCacheKey,
  readCachedOpportunityEnrichment,
  writeCachedOpportunityEnrichment,
  type EventEnrichment,
} from "@/lib/opportunities/enrichment";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { TierUpgradeBlock } from "@/components/reports/tier-upgrade-block";
import { CompletionPill } from "@/components/opportunities/completion-pill";

const ROSTER_STARS_KEY = "peer-event-roster-stars-v1";
const EVENT_TIER_UPGRADE_ITEMS = [
  {
    title: "The other attendees, judged",
    description:
      "Show which unfamiliar people and organisations are worth your time.",
  },
  {
    title: "What each talk is actually about",
    description:
      "Read the supplied programme details instead of repeating session titles.",
  },
  {
    title: "A day-by-day plan",
    description:
      "Order the sessions and people that best match your declared priorities.",
  },
  {
    title: "Is your work a fit for the poster call",
    description:
      "Compare the event's supplied scope with your current project.",
  },
];

export interface EventRosterContext {
  savedEmployers: string[];
  paperAuthors: string[];
  declaredTopics: string[];
  positiveLedgerLabels: string[];
}

interface CheapestWay {
  text: string;
  value: string;
  tier: "standard" | "student" | "online";
}

interface DeadlineMilestone {
  key: "submission" | "registration" | "event";
  label: string;
  value: string;
  accent?: boolean;
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function formatEventType(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFeeDeadline(value: string | undefined): string | undefined {
  return formatDate(value) ?? clean(value);
}

function parsePrice(value: string): { currency: string; amount: number } | null {
  if (/^\s*free\s*$/i.test(value)) return { currency: "free", amount: 0 };
  const amount = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount)) return null;
  const currency =
    value.match(/\b(?:USD|EUR|GBP|CAD|AUD|NZD)\b/i)?.[0].toUpperCase() ??
    value.match(/€|£|(?:US|C|A|CA|AU|NZ)?\$/i)?.[0].toUpperCase();
  return currency ? { currency, amount } : null;
}

function preferredFeeTier(
  event: Event,
  careerStage: CareerStage | undefined,
): "standard" | "student" | "online" {
  if (/^PhD Year /.test(careerStage ?? "")) return "student";
  if (event.isOnline) return "online";
  return "standard";
}

export function cheapestWayIn(
  event: Event,
  careerStage?: CareerStage,
): CheapestWay | null {
  const fees = event.fees ?? [];
  if (fees.length === 0) return null;
  const preferred = preferredFeeTier(event, careerStage);
  const tierOrder = [
    preferred,
    ..."student,online,standard"
      .split(",")
      .filter((tier) => tier !== preferred),
  ] as Array<"standard" | "student" | "online">;

  for (const tier of tierOrder) {
    const candidates = fees.flatMap((fee, index) => {
      const value = clean(fee[tier]);
      return value ? [{ fee, value, index, parsed: parsePrice(value) }] : [];
    });
    if (candidates.length === 0) continue;
    const comparable =
      candidates.every((candidate) => candidate.parsed) &&
      new Set(candidates.map((candidate) => candidate.parsed!.currency)).size ===
        1;
    const selected = comparable
      ? [...candidates].sort(
          (left, right) =>
            left.parsed!.amount - right.parsed!.amount ||
            left.index - right.index,
        )[0]
      : candidates[0];
    const cutoff = formatFeeDeadline(selected.fee.deadline);
    const tierLabel =
      tier === "student"
        ? "student rate"
        : tier === "online"
          ? "online rate"
          : "standard rate";
    return {
      value: selected.value,
      tier,
      text: `${selected.value} ${tierLabel} · ${selected.fee.label}${
        cutoff ? ` · by ${cutoff}` : ""
      }`,
    };
  }
  return null;
}

function deadlineMilestones(event: Event): DeadlineMilestone[] {
  const submission = formatDate(event.deadline);
  const registration = formatDate(event.registrationDeadline);
  const eventDate = formatDate(event.date);
  const milestones: DeadlineMilestone[] = [];
  if (submission) {
    milestones.push({
      key: "submission",
      label: "Submit by",
      value: submission,
    });
  }
  if (registration) {
    milestones.push({
      key: "registration",
      label: "Register by",
      value: registration,
    });
  }
  if (eventDate) {
    milestones.push({
      key: "event",
      label: "Event",
      value: eventDate,
      accent: true,
    });
  }
  return milestones;
}

export function organisationStarKey(item: EventOrg): string {
  return `organisation:${normalized(item.name)}`;
}

export function personStarKey(item: EventPerson): string {
  return `person:${normalized(item.name)}:${normalized(item.institution ?? "")}`;
}

function organisationReason(
  item: EventOrg,
  context: EventRosterContext,
): string | undefined {
  if (clean(item.relevance)) return clean(item.relevance);
  const name = normalized(item.name);
  const saved = context.savedEmployers.find(
    (employer) => normalized(employer) === name,
  );
  if (saved) return `You saved a role at ${saved}.`;
  const ledger = context.positiveLedgerLabels.find(
    (label) => normalized(label) === name,
  );
  return ledger ? `${ledger} appears in your positive preference history.` : undefined;
}

function personReason(
  item: EventPerson,
  context: EventRosterContext,
): string | undefined {
  if (clean(item.relevance)) return clean(item.relevance);
  const name = normalized(item.name);
  if (context.paperAuthors.some((author) => normalized(author) === name)) {
    return "They authored a paper in your feed.";
  }
  if (context.declaredTopics.some((topic) => normalized(topic).includes(name))) {
    return "Their name appears in a topic you declared.";
  }
  return undefined;
}

function useRosterStars(): [Set<string>, (key: string) => void] {
  const [stars, setStars] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(ROSTER_STARS_KEY) ?? "[]",
      );
      return new Set(
        Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : [],
      );
    } catch {
      return new Set();
    }
  });

  const toggle = useCallback((key: string) => {
    setStars((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(
          ROSTER_STARS_KEY,
          JSON.stringify([...next]),
        );
      } catch {
        // The report still works when storage is unavailable.
      }
      return next;
    });
  }, []);

  return [stars, toggle];
}

function HeaderChip({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-meta font-medium",
        accent
          ? "border-accent/25 bg-accent/10 text-accent"
          : "border-border bg-surface text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

function EventActionRow({
  primaryHref,
  primaryLabel,
  isSaved,
  isRegistered,
  isSubmitted,
  onToggleSave,
  onRegisteredChange,
  onSubmittedChange,
  onDismiss,
}: {
  primaryHref?: string;
  primaryLabel: string;
  isSaved: boolean;
  isRegistered: boolean;
  isSubmitted: boolean;
  onToggleSave: () => void;
  onRegisteredChange: (next: boolean) => void;
  onSubmittedChange: (next: boolean) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-7 flex flex-wrap items-center gap-2.5">
      {primaryHref && (
        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ tone: "primary" }),
            "h-11 px-5 text-body font-semibold",
          )}
        >
          {primaryLabel}
          <span aria-hidden>↗</span>
        </a>
      )}
      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={isSaved}
        className={cn(
          buttonVariants({ tone: "soft" }),
          "h-11 px-4 text-body-sm",
          isSaved && "border-accent/35 bg-accent/10 text-accent",
        )}
      >
        {isSaved ? "Saved" : "Save"}
      </button>
      <div className="flex flex-col items-start gap-1.5">
        <CompletionPill
          label="Registered"
          checked={isRegistered}
          onChange={onRegisteredChange}
          className="h-11 px-4 text-body-sm"
        />
        <CompletionPill
          label="Submitted"
          checked={isSubmitted}
          onChange={onSubmittedChange}
          className="h-11 px-4 text-body-sm"
        />
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="h-11 rounded-full px-4 text-body-sm font-medium text-text-muted transition-colors hover:bg-red/10 hover:text-red"
      >
        Not interested
      </button>
    </div>
  );
}

function ReportSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-12", className)}>
      <h2 className="text-caption font-semibold uppercase tracking-[0.18em] text-text-faint">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CheapestCallout({ cheapest }: { cheapest: CheapestWay }) {
  return (
    <aside className="mt-10 rounded-2xl border border-accent/20 bg-accent/8 px-5 py-4">
      <p className="text-micro font-semibold uppercase tracking-[0.16em] text-accent">
        Cheapest way in, for you
      </p>
      <p className="mt-1.5 text-title font-semibold text-heading">
        {cheapest.text}
      </p>
    </aside>
  );
}

function DeadlineTimeline({
  milestones,
}: {
  milestones: DeadlineMilestone[];
}) {
  if (milestones.length === 0) return null;
  return (
    <ol className="mt-4 grid gap-3 sm:grid-cols-3">
      {milestones.map((milestone, index) => (
        <li
          key={milestone.key}
          className="relative rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full bg-text-faint/40",
                milestone.accent && "bg-accent",
              )}
              aria-hidden
            />
            <span className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
              {milestone.label}
            </span>
          </div>
          <p className="mt-2 text-body-sm font-semibold text-heading">
            {milestone.value}
          </p>
          {index < milestones.length - 1 && (
            <span
              className="absolute -right-3 top-1/2 hidden w-3 border-t border-border sm:block"
              aria-hidden
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function CostsTable({
  fees,
  cheapest,
}: {
  fees: EventFee[];
  cheapest: CheapestWay | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {cheapest && (
        <p className="border-b border-border bg-accent/5 px-4 py-3 text-body-sm text-heading">
          <strong>Cheapest way in, for you:</strong> {cheapest.text}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left">
          <thead className="bg-bg-secondary/70">
            <tr>
              {["Item", "Standard", "Student", "Deadline"].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="border-b border-border px-4 py-3 text-micro font-semibold uppercase tracking-[0.14em] text-text-faint"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fees.map((fee, index) => (
              <tr key={`${fee.label}-${index}`} className="border-b border-border last:border-0">
                <th
                  scope="row"
                  className="px-4 py-3 text-body-sm font-semibold text-heading"
                >
                  {fee.label}
                  {clean(fee.online) && (
                    <span className="mt-1 block text-caption font-normal text-text-faint">
                      Online · {fee.online}
                    </span>
                  )}
                </th>
                <td className="px-4 py-3 text-body-sm text-text-muted">
                  {clean(fee.standard)}
                </td>
                <td className="px-4 py-3 text-body-sm text-text-muted">
                  {clean(fee.student)}
                </td>
                <td className="px-4 py-3 text-body-sm text-text-muted">
                  {formatFeeDeadline(fee.deadline)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StarButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${active ? "Unstar" : "Star"} ${label}`}
      title={active ? "Marked as important" : "Tell Peer this matters"}
      className={cn(
        "shrink-0 rounded-full px-2 py-1 text-title transition-colors",
        active
          ? "bg-accent/10 text-accent"
          : "text-text-faint hover:bg-accent/10 hover:text-accent",
      )}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

function RosterSection({
  event,
  context,
  enrichment,
  starredKeys,
  onToggleStar,
}: {
  event: Event;
  context: EventRosterContext;
  enrichment?: EventEnrichment | null;
  starredKeys: ReadonlySet<string>;
  onToggleStar: (key: string) => void;
}) {
  const judgments = new Map(
    (enrichment?.judgedAttendees ?? []).map((item) => [item.name, item]),
  );
  const usedJudgments = new Set<string>();
  const takeJudgment = (name: string, hasTier0Reason: boolean) => {
    if (hasTier0Reason || usedJudgments.has(name)) return undefined;
    const judgment = judgments.get(name);
    if (judgment) usedJudgments.add(name);
    return judgment;
  };
  const organisations = (event.organisations ?? []).map((item, index) => {
    const key = organisationStarKey(item);
    const tier0Reason = organisationReason(item, context);
    const judgment = takeJudgment(item.name, Boolean(tier0Reason));
    const reason = tier0Reason ?? judgment?.why;
    return { item, index, key, reason, judgment, starred: starredKeys.has(key) };
  });
  const people = (event.people ?? []).map((item, index) => {
    const key = personStarKey(item);
    const tier0Reason = personReason(item, context);
    const judgment = takeJudgment(item.name, Boolean(tier0Reason));
    const reason = tier0Reason ?? judgment?.why;
    return { item, index, key, reason, judgment, starred: starredKeys.has(key) };
  });
  const byPriority = <T extends { index: number; reason?: string; starred: boolean }>(
    left: T,
    right: T,
  ) =>
    Number(right.starred) - Number(left.starred) ||
    Number(Boolean(right.reason)) - Number(Boolean(left.reason)) ||
    left.index - right.index;
  organisations.sort(byPriority);
  people.sort(byPriority);

  if (organisations.length === 0 && people.length === 0) return null;
  const judgedCount = enrichment?.judgedAttendees?.length ?? 0;

  return (
    <ReportSection
      title={
        judgedCount > 0
          ? `The other ${judgedCount} attendees, judged`
          : "Who'll be in the room"
      }
      className="mt-14"
    >
      <div className="grid gap-10 lg:grid-cols-2">
        {organisations.length > 0 && (
          <div>
            <h3 className="text-title font-semibold text-heading">
              Organisations
            </h3>
            <div className="mt-3 grid gap-2">
              {organisations
                .filter(({ reason, starred }) => reason || starred)
                .map(({ item, key, reason, judgment, starred }) => (
                  <article
                    key={key}
                    data-roster-row="organisation"
                    data-roster-card="true"
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3",
                      judgment && !judgment.worthIt && "border-border bg-bg-secondary/50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-heading">{item.name}</p>
                      {clean(item.descriptor) && (
                        <p className="mt-0.5 text-body-sm text-text-muted">
                          {item.descriptor}
                        </p>
                      )}
                      <p
                        className={cn(
                          "mt-2 text-caption font-medium text-accent",
                          judgment && !judgment.worthIt && "text-text-muted",
                        )}
                      >
                        {reason ?? "You marked this organisation as important."}
                      </p>
                      {clean(item.atEvent) && (
                        <p className="mt-1 text-caption text-text-faint">
                          At this event · {item.atEvent}
                        </p>
                      )}
                    </div>
                    <StarButton
                      active={starred}
                      label={item.name}
                      onClick={() => onToggleStar(key)}
                    />
                  </article>
                ))}
              {organisations
                .filter(({ reason, starred }) => !reason && !starred)
                .map(({ item, key, starred }) => (
                  <div
                    key={key}
                    data-roster-row="organisation"
                    data-roster-plain="true"
                    className="flex items-start justify-between gap-3 border-b border-border px-1 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-heading">{item.name}</p>
                      {clean(item.descriptor) && (
                        <p className="mt-0.5 text-caption text-text-faint">{item.descriptor}</p>
                      )}
                    </div>
                    <StarButton
                      active={starred}
                      label={item.name}
                      onClick={() => onToggleStar(key)}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {people.length > 0 && (
          <div>
            <h3 className="text-title font-semibold text-heading">People</h3>
            <div className="mt-3 grid gap-2">
              {people
                .filter(({ reason, starred }) => reason || starred)
                .map(({ item, key, reason, judgment, starred }) => (
                  <article
                    key={key}
                    data-roster-row="person"
                    data-roster-card="true"
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3",
                      judgment && !judgment.worthIt && "border-border bg-bg-secondary/50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-heading">{item.name}</p>
                      {(clean(item.role) || clean(item.institution)) && (
                        <p className="mt-0.5 text-body-sm text-text-muted">
                          {[clean(item.role), clean(item.institution)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      <p
                        className={cn(
                          "mt-2 text-caption font-medium text-accent",
                          judgment && !judgment.worthIt && "text-text-muted",
                        )}
                      >
                        {reason ?? "You marked this person as important."}
                      </p>
                      {clean(item.speaking) && (
                        <p className="mt-1 text-caption text-text-faint">
                          Speaking · {item.speaking}
                        </p>
                      )}
                    </div>
                    <StarButton
                      active={starred}
                      label={item.name}
                      onClick={() => onToggleStar(key)}
                    />
                  </article>
                ))}
              {people
                .filter(({ reason, starred }) => !reason && !starred)
                .map(({ item, key, starred }) => (
                  <div
                    key={key}
                    data-roster-row="person"
                    data-roster-plain="true"
                    className="flex items-start justify-between gap-3 border-b border-border px-1 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-heading">{item.name}</p>
                      {(clean(item.role) || clean(item.institution)) && (
                        <p className="mt-0.5 text-caption text-text-faint">
                          {[clean(item.role), clean(item.institution)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <StarButton
                      active={starred}
                      label={item.name}
                      onClick={() => onToggleStar(key)}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </ReportSection>
  );
}

export function EventReport({
  event,
  careerStage,
  rosterContext,
  enrichment = null,
  starredKeys = new Set<string>(),
  isSaved,
  isRegistered,
  isSubmitted,
  providerConfigured: _providerConfigured = false,
  onToggleStar,
  onToggleSave,
  onRegisteredChange,
  onSubmittedChange,
  onDismiss,
}: {
  event: Event;
  careerStage?: CareerStage;
  rosterContext?: EventRosterContext;
  enrichment?: EventEnrichment | null;
  starredKeys?: ReadonlySet<string>;
  isSaved: boolean;
  isRegistered: boolean;
  isSubmitted: boolean;
  providerConfigured?: boolean;
  onToggleStar: (key: string) => void;
  onToggleSave: () => void;
  onRegisteredChange: (next: boolean) => void;
  onSubmittedChange: (next: boolean) => void;
  onDismiss: () => void;
}) {
  const context = rosterContext ?? {
    savedEmployers: [],
    paperAuthors: [],
    declaredTopics: [],
    positiveLedgerLabels: [],
  };
  const matchPct = formatMatchPct(event.relevanceScore);
  const eventDate = formatDate(event.date, "full");
  const endDate = formatDate(event.endDate);
  const location =
    event.isOnline
      ? "Online"
      : clean(event.location)?.toLowerCase() === "see event page"
        ? undefined
        : clean(event.location);
  const primaryHref = clean(event.linkRegistration) ?? clean(event.linkOfficial);
  const primaryLabel =
    event.linkRegistration &&
    (!event.linkOfficial || event.linkRegistration !== event.linkOfficial)
      ? "Register"
      : "Official site";
  const cheapest = cheapestWayIn(event, careerStage);
  const milestones = deadlineMilestones(event);
  const fees = event.fees ?? [];
  const activities = (event.activities ?? []).map(clean).filter(Boolean) as string[];
  const description = clean(event.shortDescription);
  const travelGrant = clean(event.travelGrant);
  const relevanceReason = clean(event.relevanceReason);
  const facetReason = clean(event.facetPreferenceReason);
  const hasHappenings =
    activities.length > 0 ||
    Boolean(description) ||
    Boolean(travelGrant) ||
    event.invitationLetter !== undefined;
  const hasEnrichment = hasEventEnrichment(enrichment);

  return (
    <PageContainer width="wide" className="px-6 py-14">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-body-sm text-text-faint transition-colors hover:text-link"
        >
          <span aria-hidden>←</span>
          Back
        </Link>

        <header className="mt-8">
          <div className="mb-4 flex flex-wrap gap-2">
            <HeaderChip>{formatEventType(event.type)}</HeaderChip>
            <HeaderChip>{event.isOnline ? "Online" : "In person"}</HeaderChip>
            {matchPct !== null && (
              <HeaderChip accent>{matchPct}% match</HeaderChip>
            )}
          </div>
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-heading lg:text-[40px]">
            {event.name}
          </h1>
          {(eventDate || location) && (
            <div className="mt-5 grid gap-3 text-body sm:grid-cols-2">
              {eventDate && (
                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
                    When
                  </p>
                  <p className="mt-1 font-medium text-heading">
                    {eventDate}
                    {endDate ? ` · ${endDate}` : ""}
                  </p>
                </div>
              )}
              {location && (
                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
                    Where
                  </p>
                  <p className="mt-1 font-medium text-heading">{location}</p>
                </div>
              )}
            </div>
          )}
          <EventActionRow
            primaryHref={primaryHref}
            primaryLabel={primaryLabel}
            isSaved={isSaved}
            isRegistered={isRegistered}
            isSubmitted={isSubmitted}
            onToggleSave={onToggleSave}
            onRegisteredChange={onRegisteredChange}
            onSubmittedChange={onSubmittedChange}
            onDismiss={onDismiss}
          />
        </header>

        {cheapest && <CheapestCallout cheapest={cheapest} />}
        <DeadlineTimeline milestones={milestones} />

        {fees.length > 0 && (
          <ReportSection title="What it costs you">
            <CostsTable fees={fees} cheapest={cheapest} />
          </ReportSection>
        )}

        {hasHappenings && (
          <ReportSection title="What actually happens there">
            {description && (
              <p className="text-body-lg leading-8 text-text">{description}</p>
            )}
            {activities.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {activities.map((activity) => (
                  <span
                    key={activity}
                    className="rounded-full border border-tag/20 bg-tag-dim px-3 py-1 text-meta text-tag"
                  >
                    {formatEventType(activity)}
                  </span>
                ))}
              </div>
            )}
            {travelGrant && (
              <p className="mt-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-body-sm text-heading">
                <strong>Travel grant:</strong> {travelGrant}
              </p>
            )}
            {event.invitationLetter !== undefined && (
              <p className="mt-3 text-body-sm text-text-muted">
                Invitation letters{" "}
                {event.invitationLetter
                  ? "are available."
                  : "are explicitly not provided."}
              </p>
            )}
          </ReportSection>
        )}
      </div>

      <RosterSection
        event={event}
        context={context}
        enrichment={enrichment}
        starredKeys={starredKeys}
        onToggleStar={onToggleStar}
      />

      <div className="mx-auto max-w-[720px]">
        {enrichment?.talkSummaries && (
          <ReportSection title="What each talk is actually about">
            <div className="space-y-3">
              {enrichment.talkSummaries.map((talk) => (
                <article
                  key={talk.title}
                  className="rounded-xl border border-border bg-surface px-5 py-4"
                >
                  <h3 className="text-title font-semibold text-heading">{talk.title}</h3>
                  <p className="mt-2 text-body leading-7 text-text-muted">{talk.about}</p>
                </article>
              ))}
            </div>
          </ReportSection>
        )}

        {enrichment?.dayPlan && (
          <ReportSection title="A day-by-day plan">
            <div className="space-y-4">
              {enrichment.dayPlan.map((day) => (
                <section
                  key={day.day}
                  className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4"
                >
                  <h3 className="text-title font-semibold text-heading">{day.day}</h3>
                  <ol className="mt-3 space-y-2">
                    {day.items.map((item, index) => (
                      <li key={`${index}-${item}`} className="flex gap-3 text-body text-text-muted">
                        <span className="font-semibold text-accent">{index + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </ReportSection>
        )}

        {enrichment?.posterFit && (
          <ReportSection title="Is your work a fit for the poster call">
            <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
              <p className="text-title font-semibold text-heading">
                {enrichment.posterFit.fits ? "Likely fit" : "Probably not a fit"}
              </p>
              <p className="mt-2 text-body leading-7 text-text-muted">
                {enrichment.posterFit.reasoning}
              </p>
            </div>
          </ReportSection>
        )}
      </div>

      {(relevanceReason || facetReason) && (
        <div className="mx-auto max-w-[720px]">
          <ReportSection title="Why Peer sent it">
            <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
              {relevanceReason && (
                <p className="text-body-lg leading-7 text-heading">
                  {relevanceReason}
                </p>
              )}
              {facetReason && (
                <p className="mt-2 text-body-sm text-accent">{facetReason}</p>
              )}
            </div>
          </ReportSection>
        </div>
      )}

      <div className="mx-auto max-w-[720px]">
        <TierUpgradeBlock
          items={EVENT_TIER_UPGRADE_ITEMS}
          providerConfigured={hasEnrichment}
        />
      </div>
    </PageContainer>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = (() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  })();
  const feedEvents = useFeedStore((state) => state.events);
  const eventPool = useFeedStore((state) => state.eventPool);
  const savedEvents = useFeedStore((state) => state.savedEvents);
  const isRegistered = useFeedStore((state) =>
    Boolean(state.registeredAt[id]),
  );
  const isSubmitted = useFeedStore((state) =>
    Boolean(state.submittedAt[id]),
  );
  const papers = useFeedStore((state) => state.papers);
  const savedPapers = useFeedStore((state) => state.savedPapers);
  const savedJobs = useFeedStore((state) => state.savedJobs);
  const markRead = useFeedStore((state) => state.markRead);
  const saveEvent = useFeedStore((state) => state.saveEvent);
  const unsaveEvent = useFeedStore((state) => state.unsaveEvent);
  const setEventRegistered = useFeedStore(
    (state) => state.setEventRegistered,
  );
  const setEventSubmitted = useFeedStore((state) => state.setEventSubmitted);
  const notInterestedEvent = useFeedStore((state) => state.notInterestedEvent);
  const profile = useProfileStore((state) => state.profile);
  const [starredKeys, toggleStar] = useRosterStars();
  const [enrichmentResult, setEnrichmentResult] = useState<{
    key: string;
    enrichment: EventEnrichment | null;
    done: boolean;
  }>({ key: "", enrichment: null, done: false });

  const event =
    feedEvents.find((candidate) => candidate.id === id) ??
    eventPool.find((candidate) => candidate.id === id) ??
    savedEvents.find((candidate) => candidate.id === id);
  const isSaved = savedEvents.some((candidate) => candidate.id === id);
  const contextHint = buildEnrichmentContext(profile);
  const enrichmentKey = event
    ? opportunityEnrichmentCacheKey(
        "event",
        event.id,
        contextHint,
        profile.feedAiProvider,
      )
    : "";

  useEffect(() => {
    if (event) markRead(event.id);
  }, [event, markRead]);

  useEffect(() => {
    if (!event || !enrichmentKey) return;

    const cached = readCachedOpportunityEnrichment<EventEnrichment>(enrichmentKey);
    if (cached.hit) {
      setEnrichmentResult({
        key: enrichmentKey,
        enrichment: cached.enrichment,
        done: true,
      });
      return;
    }

    const apiKey = profile.feedAiApiKey?.trim();
    if (profile.feedAiProvider !== "default" && !apiKey) {
      setEnrichmentResult({ key: enrichmentKey, enrichment: null, done: true });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const llmOverride =
      profile.feedAiProvider !== "default" && apiKey
        ? { provider: profile.feedAiProvider, apiKey }
        : undefined;

    void fetch("/api/events/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, contextHint, llmOverride }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Event report failed: ${response.status}`);
        return (await response.json()) as { enrichment: EventEnrichment | null };
      })
      .then((result) => {
        if (cancelled) return;
        const enrichment = result.enrichment ?? null;
        writeCachedOpportunityEnrichment(enrichmentKey, enrichment);
        setEnrichmentResult({ key: enrichmentKey, enrichment, done: true });
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        writeCachedOpportunityEnrichment(enrichmentKey, null);
        setEnrichmentResult({ key: enrichmentKey, enrichment: null, done: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    event,
    contextHint,
    enrichmentKey,
    profile.feedAiProvider,
    profile.feedAiApiKey,
  ]);

  const rosterContext = useMemo<EventRosterContext>(
    () => ({
      savedEmployers: savedJobs.map((job) => job.companyOrLab),
      paperAuthors: [...papers, ...savedPapers].flatMap((paper) => paper.authors),
      declaredTopics: [
        ...profile.researchTopics,
        ...profile.eventRequiredTopics,
        ...profile.eventExploreTopics,
      ],
      positiveLedgerLabels: Object.values(
        profile.preferenceLedger ?? {},
      ).flatMap((entry) =>
        entry.positive + (entry.facetPositive ?? 0) > entry.negative
          ? [entry.label]
          : [],
      ),
    }),
    [
      papers,
      profile.eventExploreTopics,
      profile.eventRequiredTopics,
      profile.preferenceLedger,
      profile.researchTopics,
      savedJobs,
      savedPapers,
    ],
  );

  if (!event) {
    return (
      <PageContainer width="narrow" className="px-6 py-20">
        <p className="italic text-text-muted">Event not found.</p>
        <Link href="/" className="mt-3 inline-block text-body text-link">
          ← Back to feed
        </Link>
      </PageContainer>
    );
  }

  return (
    <EventReport
      event={event}
      careerStage={profile.careerStage}
      rosterContext={rosterContext}
      enrichment={
        enrichmentResult.key === enrichmentKey && enrichmentResult.done
          ? enrichmentResult.enrichment
          : null
      }
      starredKeys={starredKeys}
      isSaved={isSaved}
      isRegistered={isRegistered}
      isSubmitted={isSubmitted}
      onToggleStar={toggleStar}
      onToggleSave={() =>
        isSaved ? unsaveEvent(event.id) : saveEvent(event)
      }
      onRegisteredChange={(next) => setEventRegistered(event, next)}
      onSubmittedChange={(next) => setEventSubmitted(event, next)}
      onDismiss={() => {
        notInterestedEvent(event);
        window.history.back();
      }}
    />
  );
}
