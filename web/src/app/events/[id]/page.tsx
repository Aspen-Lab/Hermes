"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
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
import { cleanEventDescription } from "@/lib/events/mapper";
import {
  buildEnrichmentContext,
  canAttemptOpportunityEnrichment,
  capGeneratedReasoning,
  hasEventEnrichment,
  loadConfiguredOpportunityEnrichment,
  opportunityPageReadingReason,
  opportunityEnrichmentCacheKey,
  resolveEventReportDescription,
  type EventEnrichment,
  type OpportunityEnrichmentLoadResult,
  type OpportunityPageReadingReason,
} from "@/lib/opportunities/enrichment";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { TierUpgradeBlock } from "@/components/reports/tier-upgrade-block";
import { WhyPeerSentThis } from "@/components/reports/why-peer-sent-this";
import { CompletionPill } from "@/components/opportunities/completion-pill";
import { OpportunityFeedbackPair } from "@/components/opportunities/feedback-pair";
import { BackToFeedLink } from "@/components/navigation/back-to-feed-link";

const ROSTER_STARS_KEY = "peer-event-roster-stars-v1";
const EVENT_TIER_UPGRADE_ITEMS = [
  {
    title: "Organisations and people, judged",
    description:
      "Show which unfamiliar people and organisations are worth your time.",
  },
  {
    title: "What each talk is actually about",
    description:
      "Read the supplied programme details instead of repeating session titles.",
  },
  {
    title: "Is your work a fit for the poster call",
    description:
      "Compare the event's supplied scope with your current project.",
  },
];

const EVENT_PAGE_READING_NOTES: Record<
  OpportunityPageReadingReason,
  string
> = {
  "no-provider": "Connect an AI key to let Peer read the programme.",
  "no-quotable-details":
    "Peer read the page but found no talk titles it could quote.",
  "read-failed": "Peer could not finish reading the programme page this time.",
};

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
  key: "today" | "submission" | "registration" | "event";
  label: string;
  value: string;
  accent?: boolean;
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function isCachedRosterRejection(value: string): boolean {
  return /\b(?:not|rather\s+than|instead\s+of|isn['’]t|does\s+not\s+(?:represent|appear))\b[^.]*?\b(?:attendee|participant|exhibitor|speaker|delegate|person\s+attending|organisation|organization|company)\b/i.test(
    value,
  );
}

function isCachedRosterFurniture(value: string): boolean {
  return /^(?:download\s+(?:the\s+)?brochure|companies?\s+[a-z]\s*(?:-|to)\s*[a-z]|executive\s+team|mailing\s+list|request\s+(?:more\s+)?information|privacy\s+policy|contact\s+us|terms(?:\s+(?:of\s+(?:use|service)|and\s+conditions))?|site\s*map)$/i.test(
    value.replace(/\s+/g, " ").trim(),
  );
}

function isCachedGenericSessionLabel(value: string): boolean {
  const core = value
    .replace(/\s+(?:session|track|talk|day|programme|program)s?$/i, "")
    .trim();
  return (
    !core ||
    !/\s/.test(core) ||
    /^(?:tutorials?|panels?|keynotes?|workshops?|posters?|receptions?|plenar(?:y|ies)|breakouts?|networking|exhibitions?|symposi(?:um|a)|seminars?|round\s*tables?|short\s+courses?|demos?|registration|lunch(?:es)?|breaks?)$/i.test(
      core,
    )
  );
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

/** A whole machine date and nothing else — "2027-04-15", "2027-04-15T09:00Z". */
const WHOLE_ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/;

/**
 * B-01. A fee deadline is source text, not a date value: plate 03's DEADLINE
 * column is free prose ("Rate held until Feb 6", "Early bird ends Jan 9 · $620
 * after", "Oct 30"). None of it carries a year, so none of it may print one.
 *
 * The old body was `formatDate(value) ?? clean(value)`, which handed every
 * string to `new Date()`. V8's legacy parser skips tokens it does not
 * recognise and **defaults a missing year to 2001**, so "Rate held until Feb 6"
 * rendered as "Feb 6, 2001" — a fabricated year printed as fact. Only reformat
 * when the whole string is a machine date; everything else prints verbatim.
 */
function formatFeeDeadline(value: string | undefined): string | undefined {
  const text = clean(value);
  if (!text) return undefined;
  if (!WHOLE_ISO_DATE.test(text)) return text;
  return formatDate(text) ?? text;
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

/**
 * B-09. Four milestones, not three: plate 03 opens the strip with **Today** so
 * the two deadlines can be read as distances rather than bare dates. Mirrors
 * `buildTimeline` on the job report exactly, so the two reports agree.
 */
function deadlineMilestones(event: Event, nowMs: number): DeadlineMilestone[] {
  const submission = formatDate(event.deadline);
  const registration = formatDate(event.registrationDeadline);
  const eventDate = formatDate(event.date);
  const milestones: DeadlineMilestone[] = [];
  if (!submission && !registration && !eventDate) return milestones;
  const today = formatDate(new Date(nowMs).toISOString());
  if (today) {
    milestones.push({ key: "today", label: "Today", value: today, accent: true });
  }
  if (submission) {
    milestones.push({
      key: "submission",
      // Plate 03 labels this "Abstract" — what the deadline is for, not what
      // the reader must do about it.
      label: "Abstract",
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
    // Accent stays on Today alone, as it does on the job report. Two accented
    // points in a four-point strip is no accent at all.
    milestones.push({ key: "event", label: "Event", value: eventDate });
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
  isInterested,
  onToggleSave,
  onRegisteredChange,
  onSubmittedChange,
  onInterested,
  onDismiss,
}: {
  primaryHref?: string;
  primaryLabel: string;
  isSaved: boolean;
  isRegistered: boolean;
  isSubmitted: boolean;
  isInterested: boolean;
  onToggleSave: () => void;
  onRegisteredChange: (next: boolean) => void;
  onSubmittedChange: (next: boolean) => void;
  onInterested: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      data-report-action-row="event"
      className="mt-7 flex flex-wrap items-center gap-2"
    >
      {primaryHref && (
        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ tone: "primary" }),
            "h-11 px-4 text-body font-semibold",
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
          "h-11 px-3 text-body-sm",
          isSaved && "border-accent/35 bg-accent/10 text-accent",
        )}
      >
        {isSaved ? "Saved" : "Save"}
      </button>
      <CompletionPill
        label="Registered"
        checked={isRegistered}
        onChange={onRegisteredChange}
        className="h-11 px-3 text-body-sm"
      />
      <CompletionPill
        label="Submitted"
        checked={isSubmitted}
        onChange={onSubmittedChange}
        className="h-11 px-3 text-body-sm"
      />
      <OpportunityFeedbackPair
        isInterested={isInterested}
        onInterested={onInterested}
        onNotInterested={onDismiss}
      />
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
    <section className={cn("mt-12 print:break-inside-avoid", className)}>
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
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
  const organisations = (event.organisations ?? [])
    .filter((item) => !isCachedRosterFurniture(item.name))
    .map((item, index) => {
      const key = organisationStarKey(item);
      const tier0Reason = organisationReason(item, context);
      const judgment = takeJudgment(item.name, Boolean(tier0Reason));
      const reason = tier0Reason ?? judgment?.why;
      return {
        item,
        index,
        key,
        reason,
        judgment,
        starred: starredKeys.has(key),
      };
    });
  const people = (event.people ?? [])
    .filter((item) => !isCachedRosterFurniture(item.name))
    .map((item, index) => {
      const key = personStarKey(item);
      const tier0Reason = personReason(item, context);
      const judgment = takeJudgment(item.name, Boolean(tier0Reason));
      const reason = tier0Reason ?? judgment?.why;
      return {
        item,
        index,
        key,
        reason,
        judgment,
        starred: starredKeys.has(key),
      };
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
  const rosterLabel =
    organisations.length > 0 && people.length > 0
      ? "Organisations and people at the event"
      : organisations.length > 0
        ? "Organisations at the event"
        : "People at the event";

  return (
    <ReportSection
      title={`${rosterLabel}${judgedCount > 0 ? ` · ${judgedCount} judged` : ""}`}
      className="mt-14"
    >
      <div data-roster-layout="full-width" className="w-full space-y-10">
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
  pageReadingReason,
  starredKeys = new Set<string>(),
  isSaved,
  isRegistered,
  isSubmitted,
  isInterested = false,
  nowMs,
  providerConfigured = false,
  enrichmentLoading = false,
  onToggleStar,
  onToggleSave,
  onRegisteredChange,
  onSubmittedChange,
  onDismiss,
  onInterested = () => undefined,
  onBack,
}: {
  event: Event;
  careerStage?: CareerStage;
  rosterContext?: EventRosterContext;
  enrichment?: EventEnrichment | null;
  pageReadingReason?: OpportunityPageReadingReason;
  starredKeys?: ReadonlySet<string>;
  isSaved: boolean;
  isRegistered: boolean;
  isSubmitted: boolean;
  isInterested?: boolean;
  /**
   * B-02. Captured once by the page, never read from inside the component.
   * Plate 03 needs "92 days left" under ABSTRACT DUE and a "Today" milestone,
   * and every test here renders through renderToStaticMarkup against fixed
   * fixtures — calling Date.now() in the body would make them time-dependent.
   */
  nowMs: number;
  providerConfigured?: boolean;
  enrichmentLoading?: boolean;
  onToggleStar: (key: string) => void;
  onToggleSave: () => void;
  onRegisteredChange: (next: boolean) => void;
  onSubmittedChange: (next: boolean) => void;
  onDismiss: () => void;
  onInterested?: () => void;
  onBack?: () => void;
}) {
  // Three states, three screens. Showing "connect a key" to somebody who has
  // one — because their page fetch failed — was the report contradicting itself
  // on the exact screen where they check whether their key works.
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
  const milestones = deadlineMilestones(event, nowMs);
  const fees = event.fees ?? [];
  const activities = (event.activities ?? []).map(clean).filter(Boolean) as string[];
  const description = resolveEventReportDescription(
    cleanEventDescription(event.shortDescription),
    enrichment,
  );
  const travelGrant = clean(event.travelGrant);
  const hasHappenings =
    activities.length > 0 ||
    Boolean(description) ||
    Boolean(travelGrant) ||
    event.invitationLetter !== undefined;
  const displayedJudgments = (enrichment?.judgedAttendees ?? []).filter(
    ({ why }) => !isCachedRosterRejection(why),
  );
  const displayedTalks = (enrichment?.talkSummaries ?? []).filter(
    ({ title }) => !isCachedGenericSessionLabel(title),
  );
  const displayEnrichment: EventEnrichment | null = enrichment
    ? {
        ...enrichment,
        judgedAttendees:
          displayedJudgments.length > 0 ? displayedJudgments : undefined,
        talkSummaries: displayedTalks.length > 0 ? displayedTalks : undefined,
      }
    : null;
  const hasEnrichment = hasEventEnrichment(displayEnrichment);

  return (
    <PageContainer
      width="wide"
      className="px-6 py-14 print:relative print:z-[60] print:bg-bg"
    >
      <div className="mx-auto max-w-[720px]">
        <BackToFeedLink
          onBack={onBack}
          className="inline-flex items-center gap-1 text-body-sm text-text-faint transition-colors hover:text-link"
        >
          <span aria-hidden>←</span>
          Back
        </BackToFeedLink>

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
            isInterested={isInterested}
            onToggleSave={onToggleSave}
            onRegisteredChange={onRegisteredChange}
            onSubmittedChange={onSubmittedChange}
            onInterested={onInterested}
            onDismiss={onDismiss}
          />
        </header>

        {cheapest && <CheapestCallout cheapest={cheapest} />}
        {/* B-09. Every other block on the page is wrapped in a ReportSection;
            this one was rendered bare, so it emitted no heading at all. */}
        {milestones.length > 0 && (
          <ReportSection title="Two deadlines, one event">
            <DeadlineTimeline milestones={milestones} />
          </ReportSection>
        )}

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
        enrichment={displayEnrichment}
        starredKeys={starredKeys}
        onToggleStar={onToggleStar}
      />

      <div className="mx-auto max-w-[720px]">
        {displayEnrichment?.talkSummaries && (
          <ReportSection title="What each talk is actually about">
            <div className="space-y-3">
              {displayEnrichment.talkSummaries.map((talk) => (
                <article
                  key={talk.title}
                  className="rounded-xl border border-border bg-surface px-5 py-4"
                >
                  <h3 className="text-title font-semibold text-heading">{talk.title}</h3>
                  {talk.when && (
                    <p
                      data-talk-when
                      className="mt-1 text-caption font-medium text-accent"
                    >
                      {talk.when}
                    </p>
                  )}
                  <p className="mt-2 text-body leading-7 text-text-muted">{talk.about}</p>
                </article>
              ))}
            </div>
          </ReportSection>
        )}

        {enrichmentLoading && (
          <p
            data-enrichment-loading="event"
            role="status"
            aria-live="polite"
            className="mt-8 flex items-center gap-2 text-body-sm text-text-faint"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            />
            Peer is reading the programme page…
          </p>
        )}

        {!enrichmentLoading &&
          !displayEnrichment?.talkSummaries &&
          providerConfigured &&
          pageReadingReason && (
          <p
            data-page-reading-note="event"
            className="mt-8 text-body-sm text-text-faint"
          >
            {EVENT_PAGE_READING_NOTES[pageReadingReason]}
          </p>
        )}

        {displayEnrichment?.posterFit?.points?.length ? (
          <ReportSection title="Is your work a fit for the poster call">
            <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
              <p className="text-title font-semibold text-heading">
                {displayEnrichment.posterFit.fits
                  ? "Overlaps your topics"
                  : "Little overlap with your topics"}
              </p>
              <ul className="mt-3 space-y-2">
                {displayEnrichment.posterFit!.points.map((point) => (
                  <li
                    key={point}
                    data-poster-fit-point
                    className="relative pl-5 text-body leading-7 text-text-muted"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.65em] h-1.5 w-1.5 rounded-full bg-accent/60"
                    />
                    {capGeneratedReasoning(point)}
                  </li>
                ))}
              </ul>
            </div>
          </ReportSection>
        ) : null}
      </div>


      <div className="mx-auto max-w-[720px]">
        {/* B-03 / §1b Correction 2. Per §1c this sits after "What it costs
            you" and before the locked block. */}
        <WhyPeerSentThis
          reason={event.relevanceReason}
          facetReason={event.facetPreferenceReason}
        />

        <TierUpgradeBlock
          items={EVENT_TIER_UPGRADE_ITEMS}
          providerConfigured={providerConfigured || hasEnrichment}
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
  const router = useRouter();
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
  const moreLikeEvent = useFeedStore((state) => state.moreLikeEvent);
  const feedback = useFeedStore((state) => state.eventFeedback[id]);
  const profile = useProfileStore((state) => state.profile);
  const [starredKeys, toggleStar] = useRosterStars();
  const [nowMs] = useState(Date.now);
  const [enrichmentResult, setEnrichmentResult] = useState<{
    key: string;
    result: OpportunityEnrichmentLoadResult<EventEnrichment> | null;
    done: boolean;
  }>({ key: "", result: null, done: false });

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

    let cancelled = false;
    void loadConfiguredOpportunityEnrichment<
      OpportunityEnrichmentLoadResult<EventEnrichment>
    >(
      {
        feedAiProvider: profile.feedAiProvider,
        feedAiApiKey: profile.feedAiApiKey,
      },
      enrichmentKey,
      async (llmOverride) => {
        const response = await fetch("/api/events/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, contextHint, llmOverride }),
        });
        if (!response.ok) {
          throw new Error(`Event report failed: ${response.status}`);
        }
        const result = (await response.json()) as {
          enrichment: EventEnrichment | null;
          sourceReadStatus?:
            | "read"
            | "failed"
            | "not-requested";
        };
        return {
          enrichment: result.enrichment ?? null,
          sourceReadStatus:
            result.sourceReadStatus === "read" ||
            result.sourceReadStatus === "not-requested"
              ? result.sourceReadStatus
              : "failed",
        };
      },
    ).then((result) => {
      if (cancelled) return;
      setEnrichmentResult({ key: enrichmentKey, result, done: true });
    });

    return () => {
      cancelled = true;
    };
  }, [
    event,
    contextHint,
    enrichmentKey,
    profile,
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
        <BackToFeedLink
          onBack={() => router.back()}
          className="mt-3 inline-block text-body text-link"
        >
          ← Back to feed
        </BackToFeedLink>
      </PageContainer>
    );
  }

  const currentEnrichmentDone =
    enrichmentResult.key === enrichmentKey && enrichmentResult.done;
  const currentEnrichmentResult = currentEnrichmentDone
    ? enrichmentResult.result
    : null;
  const pageReadingReason = currentEnrichmentDone
    ? opportunityPageReadingReason(
        currentEnrichmentResult,
        canAttemptOpportunityEnrichment(profile),
      )
    : undefined;

  return (
    <EventReport
      event={event}
      careerStage={profile.careerStage}
      rosterContext={rosterContext}
      enrichment={currentEnrichmentResult?.enrichment ?? null}
      pageReadingReason={pageReadingReason}
      enrichmentLoading={!currentEnrichmentDone && canAttemptOpportunityEnrichment(profile)}
      providerConfigured={canAttemptOpportunityEnrichment(profile)}
      starredKeys={starredKeys}
      isSaved={isSaved}
      isRegistered={isRegistered}
      isSubmitted={isSubmitted}
      nowMs={nowMs}
      isInterested={
        (feedback ?? event.feedback) === "moreLikeThis" ||
        (feedback ?? event.feedback) === "liked"
      }
      onToggleStar={toggleStar}
      onToggleSave={() =>
        isSaved ? unsaveEvent(event.id) : saveEvent(event)
      }
      onRegisteredChange={(next) => setEventRegistered(event, next)}
      onSubmittedChange={(next) => setEventSubmitted(event, next)}
      onInterested={() => moreLikeEvent(event)}
      onDismiss={() => {
        notInterestedEvent(event);
        window.history.back();
      }}
      onBack={() => router.back()}
    />
  );
}
