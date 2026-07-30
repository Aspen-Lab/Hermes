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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { TierUpgradeBlock } from "@/components/reports/tier-upgrade-block";
import { reportProviderConfigured } from "@/components/reports/provider-configured";

const ROSTER_STARS_KEY = "peer-event-roster-stars-v1";
const EVENT_TIER_UPGRADE_ITEMS = [
  {
    title: "Personal attendance plan",
    description:
      "Turn the programme, deadlines, and costs into a plan for your priorities.",
  },
  {
    title: "People and organisations to meet",
    description:
      "Connect the full roster to your papers, saved roles, and declared interests.",
  },
  {
    title: "Post-event follow-through",
    description:
      "Prepare specific follow-ups from the sessions and contacts that matter to you.",
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
  onToggleSave,
  onDismiss,
}: {
  primaryHref?: string;
  primaryLabel: string;
  isSaved: boolean;
  onToggleSave: () => void;
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
  starredKeys,
  onToggleStar,
}: {
  event: Event;
  context: EventRosterContext;
  starredKeys: ReadonlySet<string>;
  onToggleStar: (key: string) => void;
}) {
  const organisations = (event.organisations ?? []).map((item, index) => {
    const key = organisationStarKey(item);
    const reason = organisationReason(item, context);
    return { item, index, key, reason, starred: starredKeys.has(key) };
  });
  const people = (event.people ?? []).map((item, index) => {
    const key = personStarKey(item);
    const reason = personReason(item, context);
    return { item, index, key, reason, starred: starredKeys.has(key) };
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

  return (
    <ReportSection title="Who'll be in the room" className="mt-14">
      <div className="grid gap-10 lg:grid-cols-2">
        {organisations.length > 0 && (
          <div>
            <h3 className="text-title font-semibold text-heading">
              Organisations
            </h3>
            <div className="mt-3 grid gap-2">
              {organisations.map(({ item, key, reason, starred }) => (
                <article
                  key={key}
                  data-roster-row="organisation"
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3",
                    (reason || starred) && "border-accent/25 bg-accent/5",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">{item.name}</p>
                    {clean(item.descriptor) && (
                      <p className="mt-0.5 text-body-sm text-text-muted">
                        {item.descriptor}
                      </p>
                    )}
                    {(reason || starred) && (
                      <p className="mt-2 text-caption font-medium text-accent">
                        {reason ?? "You marked this organisation as important."}
                      </p>
                    )}
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
            </div>
          </div>
        )}

        {people.length > 0 && (
          <div>
            <h3 className="text-title font-semibold text-heading">People</h3>
            <div className="mt-3 grid gap-2">
              {people.map(({ item, key, reason, starred }) => (
                <article
                  key={key}
                  data-roster-row="person"
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3",
                    (reason || starred) && "border-accent/25 bg-accent/5",
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
                    {(reason || starred) && (
                      <p className="mt-2 text-caption font-medium text-accent">
                        {reason ?? "You marked this person as important."}
                      </p>
                    )}
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
  starredKeys = new Set<string>(),
  isSaved,
  providerConfigured = false,
  onToggleStar,
  onToggleSave,
  onDismiss,
}: {
  event: Event;
  careerStage?: CareerStage;
  rosterContext?: EventRosterContext;
  starredKeys?: ReadonlySet<string>;
  isSaved: boolean;
  providerConfigured?: boolean;
  onToggleStar: (key: string) => void;
  onToggleSave: () => void;
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
            onToggleSave={onToggleSave}
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
        starredKeys={starredKeys}
        onToggleStar={onToggleStar}
      />

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
          providerConfigured={providerConfigured}
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
  const papers = useFeedStore((state) => state.papers);
  const savedPapers = useFeedStore((state) => state.savedPapers);
  const savedJobs = useFeedStore((state) => state.savedJobs);
  const markRead = useFeedStore((state) => state.markRead);
  const saveEvent = useFeedStore((state) => state.saveEvent);
  const unsaveEvent = useFeedStore((state) => state.unsaveEvent);
  const notInterestedEvent = useFeedStore((state) => state.notInterestedEvent);
  const profile = useProfileStore((state) => state.profile);
  const [starredKeys, toggleStar] = useRosterStars();

  const event =
    feedEvents.find((candidate) => candidate.id === id) ??
    eventPool.find((candidate) => candidate.id === id) ??
    savedEvents.find((candidate) => candidate.id === id);
  const isSaved = savedEvents.some((candidate) => candidate.id === id);

  useEffect(() => {
    if (event) markRead(event.id);
  }, [event, markRead]);

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
      starredKeys={starredKeys}
      isSaved={isSaved}
      providerConfigured={reportProviderConfigured(profile)}
      onToggleStar={toggleStar}
      onToggleSave={() =>
        isSaved ? unsaveEvent(event.id) : saveEvent(event)
      }
      onDismiss={() => {
        notInterestedEvent(event);
        window.history.back();
      }}
    />
  );
}
