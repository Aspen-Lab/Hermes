"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Job, RoleKind } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import {
  daysUntil,
  formatDate,
  formatDaysAgo,
  formatDaysLeft,
  formatMatchPct,
} from "@/lib/format";
import { reportShortDate } from "@/components/reports/report-date";
import { formatSalaryRange } from "@/lib/opportunities/salary";
import {
  cleanJobDescription,
  cleanJobSubtitlePart,
  cleanJobTitle,
} from "@/lib/opportunities/job-cleanup";
import {
  buildEnrichmentContext,
  canAttemptOpportunityEnrichment,
  hasJobEnrichment,
  loadConfiguredOpportunityEnrichment,
  opportunityPageReadingReason,
  opportunityEnrichmentCacheKey,
  type JobEnrichment,
  type OpportunityEnrichmentLoadResult,
  type OpportunityPageReadingReason,
} from "@/lib/opportunities/enrichment";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { TierUpgradeBlock } from "@/components/reports/tier-upgrade-block";
import { WhyPeerSentThis } from "@/components/reports/why-peer-sent-this";
import { ReportFactTile } from "@/components/reports/fact-tile";
import { ReportBadge } from "@/components/reports/report-badge";
import { CompletionPill } from "@/components/opportunities/completion-pill";
import { OpportunityFeedbackPair } from "@/components/opportunities/feedback-pair";
import { BackToFeedLink } from "@/components/navigation/back-to-feed-link";

/**
 * B-20. Plate 02's wording for the promises that survive.
 *
 * Two of the plate's four are deliberately absent under manager ruling §1d:
 * "How competitive this actually is" (Peer presents, the reader judges) and
 * "The role in three clean sentences" (merged into "What the role is"). A
 * promise for a feature we will not build is the exact dishonesty this block
 * was rewritten to remove, so neither is listed.
 */
const JOB_TIER_UPGRADE_ITEMS = [
  {
    title: "Sponsorship read when the posting is silent",
    description:
      "Judges this employer's track record instead of leaving it at “not stated”.",
  },
  {
    // Not on the plate. Ruling §1d keeps it: Phase 9 built it, it quotes the
    // posting verbatim, and the plate predates the feature.
    title: "What this employer actually asks for",
    description:
      "Quotes the specific requirements and duties from the posting itself.",
  },
  {
    title: "What to emphasise in your application",
    description:
      "Which of your papers and methods to lead with, given this team's work.",
  },
];

const JOB_PAGE_READING_NOTES: Record<OpportunityPageReadingReason, string> = {
  "no-provider": "Connect an AI key to let Peer read the job posting.",
  "no-quotable-details":
    "Peer read the job posting but found no requirements or duties it could quote.",
  "read-failed": "Peer could not finish reading the job posting this time.",
};

const ROLE_LABELS: Record<RoleKind, string> = {
  internship: "Internship",
  "phd-position": "PhD position",
  postdoc: "Postdoc",
  staff: "Staff",
  faculty: "Faculty",
};

type VisaState = NonNullable<Job["visa"]>["state"];

const VISA_LABELS: Record<VisaState, string> = {
  // B2-04. Plate 02's header chip reads "Visa sponsorship", not
  // "Sponsorship available" — this wording never matched the plate. The
  // other two states have no plate example to check against, so they are
  // left as they were rather than guessed at.
  sponsors: "Visa sponsorship",
  "not-stated": "Visa not stated",
  "wont-sponsor": "No sponsorship",
};

/**
 * B-06. The VISA tile's short value, from plate 02. Deliberately different
 * words from the header chip above it: the tile is labelled "VISA" already, so
 * repeating "Visa sponsorship" would print the same fact twice in the
 * same eyeful.
 */
const VISA_TILE_LABELS: Record<VisaState, string> = {
  sponsors: "Sponsors",
  "not-stated": "Not stated",
  "wont-sponsor": "No",
};

/** B-06. The SALARY tile's sub-line: "per year", not the value's "/ yr". */
const SALARY_PERIODS: Record<
  NonNullable<Job["salary"]>["period"],
  string
> = {
  year: "per year",
  month: "per month",
  hour: "per hour",
};

type JobFactKey =
  | "salary"
  | "employment-type"
  | "work-mode"
  | "posted"
  | "deadline"
  | "start"
  | "visa";

interface JobFact {
  key: JobFactKey;
  label: string;
  value: string;
  /**
   * B-06. Plate 02's second grey line under every tile. It carries the two
   * highest-value numbers on the row — "47 days left" and "8 days ago" —
   * which appeared nowhere in the report before.
   */
  detail?: string;
  tone?: "accent" | "danger";
}

interface TimelinePoint {
  key: "posted" | "today" | "deadline" | "start";
  label: string;
  // B3-02. Optional: the "Today" point prints the bare word with nothing
  // beneath it, on the plate. Every other point still has one.
  value?: string;
  accent?: boolean;
}

// Full stops inside initials and abbreviations do not end a sentence — "Y. Chen"
// and "e.g." would otherwise each start a new bullet.
const NOT_A_BULLET_BREAK_RE =
  /(?:^|[\s("'[])(?:[A-Z]|[Ee]\.g|[Ii]\.e|U\.S|U\.K|Dr|Prof|Mr|Mrs|Ms|St|vs|etc|No|Fig|Vol|Jr|Sr|Ph\.D|cf|al)$/;

const MAX_ROLE_BULLETS = 5;

/** Split the posting's own prose into whole-sentence bullets. Never mid-word. */
export function splitIntoBullets(text: string | undefined): string[] {
  const source = text?.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const bullets: string[] = [];
  let start = 0;
  for (const match of source.matchAll(/[.!?](?:["')\]]*)?(?=\s|$)/g)) {
    if (match.index === undefined) continue;
    if (NOT_A_BULLET_BREAK_RE.test(source.slice(0, match.index))) continue;
    const end = match.index + match[0].length;
    const sentence = source.slice(start, end).trim();
    if (sentence) bullets.push(sentence);
    start = end;
  }
  const tail = source.slice(start).trim();
  // A trailing fragment with no full stop is an unfinished sentence — drop it
  // rather than print half a thought, unless it is all we have.
  if (tail && bullets.length === 0) bullets.push(tail);
  return bullets.slice(0, MAX_ROLE_BULLETS);
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

/**
 * B2-03. `job.employmentType` arrives as a slug ("full-time", "part_time")
 * and the plate wants it capitalised as ONE phrase — "Full-time" — not every
 * word capitalised. The old body stripped hyphens before capitalising, so a
 * single hyphenated word lost its hyphen and became two separate capitalised
 * words, "Full Time". Same bug class as B-12's activity-label mangling: a
 * formatter meant for slugs applied to a value that already reads as prose.
 * An underscore is a genuine slug separator and becomes a space; a hyphen is
 * not and stays exactly where it is.
 */
function humanize(value: string): string {
  const words = value.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * B2-04 / Ruling 9. The plate states the same contract length twice, in two
 * phrasings — "3 years" in the header chip, "3-yr contract" in the TYPE
 * tile's detail line. A's round-2 report called this a structural conflict
 * (one field, two different strings); Ruling 9 overruled that: one field plus
 * two formatters produces both.
 *
 * `job.contractLength` is scraped free text ("3-year fixed-term position",
 * "fixed-term appointment for 3 years", or occasionally no duration at all)
 * — it is not normalised at the source, and this does not change that.
 * `expandContractLength` pulls a clean "N years" / "N months" out of that text
 * when one is there; `abbreviateContractLength` then turns that into the
 * tile's short form. Neither invents a duration: text that does not parse
 * comes back verbatim, unabbreviated, in both places.
 */
const CONTRACT_WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};
const CONTRACT_DURATION_RE =
  /\b(\d+(?:\.\d+)?|one|two|three|four|five)[\s-]*(year|month)s?\b/i;

function expandContractLength(value: string): string {
  const match = CONTRACT_DURATION_RE.exec(value);
  if (!match) return value;
  const amount = CONTRACT_WORD_NUMBERS[match[1].toLowerCase()] ?? Number(match[1]);
  const unit = match[2].toLowerCase();
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

function abbreviateContractLength(value: string): string {
  const match = /^(\d+(?:\.\d+)?)\s+(year|month)s?$/i.exec(value);
  if (!match) return value;
  const unit = match[2].toLowerCase() === "year" ? "yr" : "mo";
  return `${match[1]}-${unit} contract`;
}

function visaTone(
  state: VisaState,
): "accent" | "danger" | undefined {
  if (state === "sponsors") return "accent";
  if (state === "wont-sponsor") return "danger";
  return undefined;
}

const WORK_MODE_LABELS: Record<NonNullable<Job["workMode"]>, string> = {
  "on-site": "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

/**
 * B2-06. Prefers the new three-state field; falls back to the boolean so a
 * job whose mapper hasn't populated `workMode` yet (or was scored before this
 * field existed) still shows exactly what it showed before — "Remote" when
 * `isRemote`, nothing otherwise.
 */
function workModeLabel(job: Job): string | undefined {
  if (job.workMode) return WORK_MODE_LABELS[job.workMode];
  return job.isRemote ? "Remote" : undefined;
}

/**
 * B-06. Plate 02's seven tiles, each with a label, a value and a grey
 * sub-line. Two were missing entirely — LOCATION was built only for remote
 * jobs, and VISA was in the key union but never pushed, so the visa state
 * lived only as a header chip.
 *
 * B2-06 added a work-mode field, so the LOCATION sub-line can now show
 * "Hybrid" or "On-site" when the posting says so, not only "Remote". The
 * plate's parenthetical, "(3 days on-site)", has no field behind it and is
 * not invented — just the mode word prints.
 */
export function buildJobFacts(job: Job, nowMs: number = Date.now()): JobFact[] {
  // B2-01 / Ruling 8. Plate 02 shows dates without a year inside the report's
  // own horizon ("Sep 15", not "Sep 15, 2026") and STARTS at month+year only
  // ("Jan 2027") — never a day of month. `reportShortDate` also guards
  // against a date more than ~12 months out silently losing its year.
  const posted = reportShortDate(job.postedDate, nowMs);
  const deadline = reportShortDate(job.applicationDeadline, nowMs);
  const start = formatDate(job.startDate, "monthYear");
  const location = clean(job.location);
  // B2-04. Expand once, abbreviate for the tile; the header chip below uses
  // the same expanded value unabbreviated.
  const contractLengthExpanded = clean(job.contractLength)
    ? expandContractLength(clean(job.contractLength)!)
    : undefined;
  const facts: Array<JobFact | undefined> = [
    job.salary
      ? {
          key: "salary",
          label: "Salary",
          // B2-02. The period used to print twice — once inside this value
          // (formatSalary's own "/ yr" suffix) and again in the detail line
          // below. formatSalaryRange carries no period; the detail line below
          // is the only place it appears now.
          value: formatSalaryRange(job.salary),
          detail: `${SALARY_PERIODS[job.salary.period]} · ${
            job.salaryIsEstimated ? "estimated" : "from posting"
          }`,
        }
      : undefined,
    job.roleKind || clean(job.employmentType)
      ? {
          key: "employment-type",
          label: "Type",
          value: job.roleKind
            ? ROLE_LABELS[job.roleKind]
            : humanize(job.employmentType!),
          detail:
            [
              job.roleKind && clean(job.employmentType)
                ? humanize(job.employmentType!)
                : undefined,
              // B2-04. The plate's short form, "3-yr contract" — abbreviated
              // from the same expanded value the header chip states in full.
              contractLengthExpanded
                ? abbreviateContractLength(contractLengthExpanded)
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
        }
      : undefined,
    location
      ? {
          key: "work-mode",
          label: "Location",
          value: location,
          // B2-06 / B3-08. Plate's "Hybrid · US" sub-line — the mode word
          // comes from job.workMode when the posting states it, and the
          // country (when job.place carries one) now joins it here. Kept
          // local to this tile rather than folded into workModeLabel()
          // itself, which the subtitle's third segment also calls and whose
          // own plate example ("Hybrid (3 days on-site)") never shows a
          // country — appending it inside workModeLabel would leak it there
          // too.
          detail:
            [workModeLabel(job), clean(job.place?.country)]
              .filter(Boolean)
              .join(" · ") || undefined,
        }
      : undefined,
    // B2-05 / B3-06 / Ruling 20. The plate's "flexible" sub-line states
    // whether the start date is negotiable. `job.startDateFlexible` is
    // `undefined` unless the posting itself says so (extracted upstream in
    // `extractJobDetails`, never inferred from silence, same convention as
    // `workMode`) — the detail only ever prints the fixed word "flexible",
    // never invented for a posting that doesn't say it.
    start
      ? {
          key: "start",
          label: "Starts",
          value: start,
          detail: job.startDateFlexible ? "flexible" : undefined,
        }
      : undefined,
    deadline
      ? {
          key: "deadline",
          label: "Apply by",
          value: deadline,
          detail: formatDaysLeft(daysUntil(job.applicationDeadline!, nowMs)),
        }
      : undefined,
    posted
      ? {
          key: "posted",
          label: "Posted",
          value: posted,
          detail: formatDaysAgo(-daysUntil(job.postedDate!, nowMs)),
        }
      : undefined,
    job.visa
      ? {
          key: "visa",
          label: "Visa",
          // The plate's short value. The header chip keeps the long one, so
          // the two never print the same words twice.
          value: VISA_TILE_LABELS[job.visa.state],
          detail: clean(job.visa.evidence)
            ? "stated in the posting"
            : undefined,
          tone: visaTone(job.visa.state),
        }
      : undefined,
  ];
  return facts.filter((fact): fact is JobFact => Boolean(fact?.value));
}

function buildTimeline(job: Job, nowMs: number): TimelinePoint[] {
  // B2-01. Mirrors buildJobFacts's date styling exactly, so the facts row and
  // the Timeline never disagree about the same date.
  const posted = reportShortDate(job.postedDate, nowMs);
  const deadline = reportShortDate(job.applicationDeadline, nowMs);
  const start = formatDate(job.startDate, "monthYear");
  if (!posted && !deadline && !start) return [];

  const points: TimelinePoint[] = [];
  if (posted) points.push({ key: "posted", label: "Posted", value: posted });
  // B3-02. The plate's Timeline shows the bare word "Today" with nothing
  // underneath — it is the anchor the other three points are measured
  // against, not a fourth date. Printing a date here (this milestone's own
  // computed "now") made the one accented point read like just another
  // date. No `today` variable is needed any more; the point always renders
  // once there is at least one other point (guarded by the `!posted &&
  // !deadline && !start` return above).
  points.push({ key: "today", label: "Today", accent: true });
  if (deadline) {
    points.push({ key: "deadline", label: "Deadline", value: deadline });
  }
  if (start) points.push({ key: "start", label: "Start", value: start });
  return points;
}

function distinct(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = clean(value);
    if (!trimmed) return [];
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

/** B-10. Known site chrome that scraping picks up and files as a requirement. */
const SITE_CHROME_RE =
  /^(?:apply(?:\s+now)?|apply\s+for\s+this\s+job|sign\s*in|sign\s*up|log\s*in|login|register|submit|search|share|save(?:\s+job)?|view\s+job|view\s+details|more\s+details|back(?:\s+to\s+results)?|next|previous|home|menu|careers?(?:\s+page)?|jobs?(?:\s+page)?|job\s+(?:listing|description|alerts?)|web\s+job\s+listing|about\s+us|contact\s+us|cookies?|privacy(?:\s+policy)?|terms(?:\s+(?:of\s+(?:use|service)|and\s+conditions))?|newsletter|follow\s+us|read\s+more|learn\s+more|see\s+all|show\s+more|full\s+time|part\s+time|remote|hybrid|on\s*-?\s*site)$/i;

/**
 * B-10. A skill is something a person can have. "tesla.com" and "Sign in" are
 * not, and the report was listing them under "Not matched in your profile" —
 * telling the reader they were missing a skill called Sign in.
 *
 * The guard sits here, at the report layer, deliberately. Upstream,
 * `keyRequirements` comes from `item.tags`, which also feeds cards, search and
 * the preference ledger; tightening it there would change ranking. This filter
 * changes only what the skills section is willing to print.
 */
function isPlausibleRequirement(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return false;
  // A URL or a bare domain is a link, not a skill.
  if (/https?:\/\/|www\.|\S+\.(?:com|org|net|io|co|edu|gov|ai|jobs)\b/i.test(text)) {
    return false;
  }
  return !SITE_CHROME_RE.test(text);
}

function skillComparison(job: Job): {
  matched: string[];
  unmatched: string[];
  pct: number;
} | null {
  const requirements = distinct(job.keyRequirements).filter(
    isPlausibleRequirement,
  );
  // Nothing survived the guard: hide the section rather than print an empty
  // chip row under a heading promising skills.
  if (requirements.length === 0) return null;
  const terms = distinct(job.matchedTerms ?? []).map((term) =>
    term.toLowerCase(),
  );
  const matched = requirements.filter((requirement) => {
    const normalized = requirement.toLowerCase();
    return terms.some(
      (term) => normalized.includes(term) || term.includes(normalized),
    );
  });
  const matchedSet = new Set(matched.map((item) => item.toLowerCase()));
  const unmatched = requirements.filter(
    (requirement) => !matchedSet.has(requirement.toLowerCase()),
  );
  return {
    matched,
    unmatched,
    pct: Math.round((matched.length / requirements.length) * 100),
  };
}

function HeaderChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "accent" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-meta font-medium",
        tone === "accent"
          ? "border-accent/25 bg-accent/10 text-accent"
          : tone === "danger"
            ? "border-red/25 bg-red/10 text-red"
            : "border-border bg-surface text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** B-05/B-06 moved the tile body into a component both reports share. */
function FactTile({ fact }: { fact: JobFact }) {
  return <ReportFactTile fact={fact} attribute="data-job-fact" />;
}

function ReportSection({
  title,
  children,
  className,
  sectionKey,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  sectionKey?: string;
}) {
  return (
    <section
      data-job-section={sectionKey}
      className={cn(
        "mt-12 animate-fade-in-up print:break-inside-avoid",
        className,
      )}
    >
      <h2 className="text-caption font-semibold uppercase tracking-[0.18em] text-text-faint">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function JobActionRow({
  applyUrl,
  isSaved,
  isApplied,
  isInterested,
  onToggleSave,
  onAppliedChange,
  onInterested,
  onDismiss,
}: {
  applyUrl?: string;
  isSaved: boolean;
  isApplied: boolean;
  isInterested: boolean;
  onToggleSave: () => void;
  onAppliedChange: (next: boolean) => void;
  onInterested: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      data-report-action-row="job"
      className="mt-7 flex flex-wrap items-center gap-2"
    >
      {applyUrl && (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ tone: "primary" }),
            "h-11 px-4 text-body font-semibold",
          )}
        >
          {/* B-18. Plate 02 says where the link goes. "Apply" alone reads like
              Peer takes the application; it does not — it hands you off. */}
          Apply on employer site
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
        label="Mark as applied"
        controlKey="applied"
        checked={isApplied}
        onChange={onAppliedChange}
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

export function JobReport({
  job,
  isSaved,
  isApplied,
  isInterested = false,
  nowMs,
  enrichment = null,
  pageReadingReason,
  providerConfigured = false,
  enrichmentLoading = false,
  onToggleSave,
  onAppliedChange,
  onDismiss,
  onInterested = () => undefined,
  onBack,
}: {
  job: Job;
  isSaved: boolean;
  isApplied: boolean;
  isInterested?: boolean;
  nowMs: number;
  enrichment?: JobEnrichment | null;
  pageReadingReason?: OpportunityPageReadingReason;
  /** Legacy test seam: provider availability alone must not hide the locked block. */
  providerConfigured?: boolean;
  enrichmentLoading?: boolean;
  onToggleSave: () => void;
  onAppliedChange: (next: boolean) => void;
  onDismiss: () => void;
  onInterested?: () => void;
  onBack?: () => void;
}) {
  // Three states, three screens. Showing "connect a key" to somebody who has
  // one — because their page fetch failed — was the report contradicting itself
  // on the exact screen where they check whether their key works.
  const matchPct = formatMatchPct(job.relevanceScore);
  const facts = buildJobFacts(job, nowMs);
  /**
   * B2-04 / Ruling 9. Plate 02 states employment type and contract length
   * together in one header chip ("Full-time · 3 years") — the same expanded
   * value the TYPE tile abbreviates into "3-yr contract" below. One field
   * (`job.contractLength`), two formatters; neither invents a duration.
   */
  const contractChipText =
    [
      clean(job.employmentType) ? humanize(job.employmentType!) : undefined,
      clean(job.contractLength)
        ? expandContractLength(clean(job.contractLength)!)
        : undefined,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;
  const timeline = buildTimeline(job, nowMs);
  const skills = skillComparison(job);
  const roleSummary = cleanJobDescription(job.summary) || undefined;
  // Plate 02 shows one role block of bullets, not a paragraph and not the same
  // content three times. Tier 1/2 supplies its own sentences; Tier 0 splits the
  // posting's own text on sentence boundaries so it is never a wall of prose.
  const roleBullets = enrichment?.roleSummary?.length
    ? enrichment.roleSummary
    : splitIntoBullets(roleSummary);
  const materials = distinct(job.applicationMaterials ?? []);
  const visaEvidence = clean(job.visa?.evidence);
  const roleTitle = cleanJobTitle(job.roleTitle) || job.roleTitle;
  const company = cleanJobSubtitlePart(job.companyOrLab);
  const location = cleanJobSubtitlePart(job.location);
  /**
   * B-18 / B2-06. Plate 02's subtitle has three segments — employer, place,
   * work mode ("Toyota Research Institute · Los Altos, CA · Hybrid (3 days
   * on-site)"). The mode word now comes from `job.workMode` when the posting
   * states it, falling back to "Remote" from `isRemote` alone. The plate's
   * "(3 days on-site)" parenthetical has no field behind it and stays out —
   * nothing is invented. Remote used to *replace* the location, which threw
   * away where the team actually sits; it no longer does.
   */
  const workMode = workModeLabel(job);
  // B-17. Plate 02's labelled rows, built only from fields that exist.
  const applyRows: Array<{ label: string; value: string }> = [
    materials.length > 0
      ? { label: "Materials", value: materials.join(", ") }
      : undefined,
    clean(job.sourceId)
      ? { label: "Seen on", value: clean(job.sourceId)! }
      : undefined,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const hasEnrichment = hasJobEnrichment(enrichment);

  return (
    <PageContainer
      width="detail"
      className="px-6 py-14 print:relative print:z-[60] print:bg-bg"
    >
      <BackToFeedLink
        onBack={onBack}
        className="inline-flex items-center gap-1 text-body-sm text-text-faint transition-colors hover:text-link"
      >
        <span aria-hidden>←</span>
        Back
      </BackToFeedLink>

      <header className="mt-8 animate-fade-in-up">
        {(job.roleKind ||
          contractChipText ||
          job.visa ||
          matchPct !== null) && (
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Job summary">
            {job.roleKind && <HeaderChip>{ROLE_LABELS[job.roleKind]}</HeaderChip>}
            {contractChipText && <HeaderChip>{contractChipText}</HeaderChip>}
            {job.visa && (
              <HeaderChip tone={visaTone(job.visa.state)}>
                {VISA_LABELS[job.visa.state]}
              </HeaderChip>
            )}
            {matchPct !== null && (
              <HeaderChip tone="accent">{matchPct}% match</HeaderChip>
            )}
          </div>
        )}

        <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.015em] text-heading lg:text-[36px]">
          {roleTitle}
        </h1>
        {(company || location || workMode) && (
          <p className="mt-3 text-body text-text-muted">
            {[company, location, workMode].filter(Boolean).map((part, index) => (
              <span key={part}>
                {index > 0 && <span aria-hidden> · </span>}
                {part}
              </span>
            ))}
          </p>
        )}

        <JobActionRow
          applyUrl={clean(job.linkPosting)}
          isSaved={isSaved}
          isApplied={isApplied}
          isInterested={isInterested}
          onToggleSave={onToggleSave}
          onAppliedChange={onAppliedChange}
          onInterested={onInterested}
          onDismiss={onDismiss}
        />
      </header>

      {facts.length > 0 && (
        <dl className="mt-10 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {facts.map((fact) => (
            <FactTile key={fact.key} fact={fact} />
          ))}
        </dl>
      )}

      {visaEvidence && !enrichment?.sponsorshipRead && (
        <blockquote className="mt-4 border-l-2 border-accent/50 pl-4 text-body leading-7 text-text-muted">
          “{visaEvidence}”
          {/* B-19. Plate 02 closes the quote with its source. Without it the
              sentence reads as Peer's own words, which is the one thing this
              block exists to avoid: it is the posting's promise, not ours. */}
          <cite
            data-visa-attribution
            className="mt-1 block not-italic text-caption text-text-faint"
          >
            — from the job description
          </cite>
        </blockquote>
      )}

      {timeline.length > 0 && (
        <ReportSection
          title="Timeline"
          sectionKey="timeline"
          className="break-inside-avoid"
        >
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {timeline.map((point, index) => (
              <li
                key={point.key}
                className="relative rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full bg-text-faint/40",
                      point.accent && "bg-accent",
                    )}
                    aria-hidden
                  />
                  <span className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
                    {point.label}
                  </span>
                </div>
                {point.value && (
                  <p className="mt-2 text-body-sm font-semibold text-heading">
                    {point.value}
                  </p>
                )}
                {index < timeline.length - 1 && (
                  <span
                    className="absolute -right-3 top-1/2 hidden w-3 border-t border-border lg:block"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>
        </ReportSection>
      )}

      {/* B-10. Plate 02: one heading with NEW and TIER 0 badges, the line
          "6 of 9 you already have", ONE flat wrapping row of chips, then the
          footnote. The build had a different heading, a progress bar the plate
          does not have, and a two-column split into "Matched" and "Not matched"
          lists — which turned a glance into a comparison exercise. The progress
          bar is gone under say-it-once: the count line already states the
          ratio. */}
      {skills && (
        <ReportSection title="Skills they ask for" sectionKey="skills">
          <p className="-mt-2 mb-4 flex flex-wrap items-center gap-2">
            <ReportBadge>New</ReportBadge>
            <ReportBadge tone="accent">Tier 0</ReportBadge>
          </p>
          <p className="text-caption text-text-faint">
            {skills.matched.length} of{" "}
            {skills.matched.length + skills.unmatched.length} you already have
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.matched.map((skill) => (
              <span
                key={skill}
                data-skill-requirement="matched"
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-body-sm font-medium text-accent"
              >
                {skill}
                <span aria-hidden>✓</span>
              </span>
            ))}
            {skills.unmatched.map((skill) => (
              <span
                key={skill}
                data-skill-requirement="unmatched"
                className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-body-sm text-text-muted"
              >
                {skill}
              </span>
            ))}
          </div>
          <p className="mt-4 text-caption leading-5 text-text-faint">
            Highlighted chips come from your Required and Explore topics plus
            your project text. The plain ones are the gaps — worth seeing before
            you spend an evening on the application.
          </p>
        </ReportSection>
      )}

      {(roleBullets.length > 0 || materials.length > 0) && (
        <div className="mt-10 grid gap-8 md:grid-cols-2" data-role-and-materials>
          {roleBullets.length > 0 && (
            <section data-section="what-the-role-is">
              <h2 className="text-micro font-semibold uppercase tracking-[0.16em] text-text-faint">
                What the role is
              </h2>
              <ul className="mt-4 space-y-3">
                {roleBullets.map((point) => (
                  <li
                    key={point}
                    data-role-bullet
                    className="relative pl-5 text-body-lg leading-8 text-text"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.7em] h-1.5 w-1.5 rounded-full bg-accent/60"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {applyRows.length > 0 && (
            <section data-section="to-apply-have-ready">
              <h2 className="text-micro font-semibold uppercase tracking-[0.16em] text-text-faint">
                To apply, have ready
              </h2>
              {/*
                B-17. Plate 02 has labelled rows — MATERIALS / ELIGIBILITY /
                TEAM / SEEN ON — not a bare list. Only MATERIALS and SEEN ON
                have a field behind them today; ELIGIBILITY and TEAM would need
                new extraction, and the plate's own rule is that an absent field
                hides rather than prints empty. The shape is here so they can
                slot in when the data exists.
              */}
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                {applyRows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt
                      data-apply-row={row.label.toLowerCase()}
                      className="pt-0.5 text-micro font-semibold uppercase tracking-[0.14em] text-text-faint"
                    >
                      {row.label}
                    </dt>
                    <dd className="text-body-sm text-heading">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}

      {Boolean(enrichment?.specificRequirements?.length) && (
        <ReportSection
          title="What this employer actually asks for"
          sectionKey="specific-requirements"
        >
          <ul className="space-y-2">
            {enrichment?.specificRequirements?.map((requirement) => (
              <li
                key={requirement}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-body text-heading"
              >
                {requirement}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {Boolean(enrichment?.specificDuties?.length) && (
        <ReportSection
          title="What the person would actually do"
          sectionKey="specific-duties"
        >
          <ul className="space-y-2">
            {enrichment?.specificDuties?.map((duty) => (
              <li
                key={duty}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-body text-heading"
              >
                {duty}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {enrichmentLoading && (
        <p
          data-enrichment-loading="job"
          role="status"
          aria-live="polite"
          className="mt-8 flex items-center gap-2 text-body-sm text-text-faint"
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
          />
          Peer is reading the job posting…
        </p>
      )}
      {!enrichmentLoading &&
        !enrichment?.specificRequirements?.length &&
        !enrichment?.specificDuties?.length &&
        providerConfigured &&
        pageReadingReason && (
          <p
            data-page-reading-note="job"
            className="mt-8 text-body-sm text-text-faint"
          >
            {JOB_PAGE_READING_NOTES[pageReadingReason]}
          </p>
        )}

      {enrichment?.sponsorshipRead && (
        <ReportSection title="Sponsorship read">
          <div className="grid gap-3 md:grid-cols-2">
            {visaEvidence && (
              <blockquote className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4 text-body leading-7 text-text-muted">
                <span className="mb-2 block text-micro font-semibold uppercase tracking-[0.14em] text-accent">
                  Posting evidence
                </span>
                “{visaEvidence}”
              </blockquote>
            )}
            <div className="rounded-xl border border-border bg-bg-secondary/50 px-5 py-4">
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
                Peer inference — verify with the employer
              </p>
              <p className="mt-2 text-title font-semibold text-heading">
                {enrichment.sponsorshipRead.likelihood}
              </p>
              <p className="mt-2 text-body leading-7 text-text-muted">
                {enrichment.sponsorshipRead.basis}
              </p>
            </div>
          </div>
        </ReportSection>
      )}

      {enrichment?.emphasise && (
        <ReportSection title="What to emphasise in your application">
          <ul className="grid gap-2 sm:grid-cols-2">
            {enrichment.emphasise.map((point) => (
              <li
                key={point}
                className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-body-sm text-heading"
              >
                {point}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {/* B-03 / §1b Correction 2. Plate 02's last block before the locked
          block. P10.4 deleted it on the grounds that it was a one-line
          restatement; the plate shows a substantive Tier 0 paragraph. */}
      <WhyPeerSentThis
        reason={job.matchReason}
        facetReason={job.facetPreferenceReason}
        sectionKey="why-peer-sent-this"
      />

      <TierUpgradeBlock
        items={JOB_TIER_UPGRADE_ITEMS}
        providerConfigured={providerConfigured || hasEnrichment}
      />
    </PageContainer>
  );
}

export default function JobDetailPage({
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
  const feedJobs = useFeedStore((state) => state.jobs);
  const jobPool = useFeedStore((state) => state.jobPool);
  const savedJobs = useFeedStore((state) => state.savedJobs);
  const isApplied = useFeedStore((state) => Boolean(state.appliedAt[id]));
  const markRead = useFeedStore((state) => state.markRead);
  const saveJob = useFeedStore((state) => state.saveJob);
  const unsaveJob = useFeedStore((state) => state.unsaveJob);
  const setJobApplied = useFeedStore((state) => state.setJobApplied);
  const notInterestedJob = useFeedStore((state) => state.notInterestedJob);
  const moreLikeJob = useFeedStore((state) => state.moreLikeJob);
  const feedback = useFeedStore((state) => state.jobFeedback[id]);
  const profile = useProfileStore((state) => state.profile);
  const [nowMs] = useState(Date.now);
  const [enrichmentResult, setEnrichmentResult] = useState<{
    key: string;
    result: OpportunityEnrichmentLoadResult<JobEnrichment> | null;
    done: boolean;
  }>({ key: "", result: null, done: false });

  const job =
    feedJobs.find((candidate) => candidate.id === id) ??
    jobPool.find((candidate) => candidate.id === id) ??
    savedJobs.find((candidate) => candidate.id === id);
  const isSaved = savedJobs.some((candidate) => candidate.id === id);
  const contextHint = buildEnrichmentContext(profile);
  const enrichmentKey = job
    ? opportunityEnrichmentCacheKey(
        "job",
        job.id,
        contextHint,
        profile.feedAiProvider,
      )
    : "";

  useEffect(() => {
    if (job) markRead(job.id);
  }, [job, markRead]);

  useEffect(() => {
    if (!job || !enrichmentKey) return;

    let cancelled = false;
    void loadConfiguredOpportunityEnrichment<
      OpportunityEnrichmentLoadResult<JobEnrichment>
    >(
      {
        feedAiProvider: profile.feedAiProvider,
        feedAiApiKey: profile.feedAiApiKey,
      },
      enrichmentKey,
      async (llmOverride) => {
        const response = await fetch("/api/jobs/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job, contextHint, llmOverride }),
        });
        if (!response.ok) {
          throw new Error(`Job report failed: ${response.status}`);
        }
        const result = (await response.json()) as {
          enrichment: JobEnrichment | null;
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
    job,
    contextHint,
    enrichmentKey,
    profile,
  ]);

  if (!job) {
    return (
      <PageContainer width="narrow" className="px-6 py-20">
        <p className="italic text-text-muted">Job not found.</p>
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
    <JobReport
      job={job}
      isSaved={isSaved}
      isApplied={isApplied}
      isInterested={
        (feedback ?? job.feedback) === "moreLikeThis" ||
        (feedback ?? job.feedback) === "liked"
      }
      nowMs={nowMs}
      enrichment={currentEnrichmentResult?.enrichment ?? null}
      pageReadingReason={pageReadingReason}
      enrichmentLoading={!currentEnrichmentDone && canAttemptOpportunityEnrichment(profile)}
      providerConfigured={canAttemptOpportunityEnrichment(profile)}
      onToggleSave={() => (isSaved ? unsaveJob(job.id) : saveJob(job))}
      onAppliedChange={(next) => setJobApplied(job, next)}
      onInterested={() => moreLikeJob(job)}
      onDismiss={() => {
        notInterestedJob(job);
        window.history.back();
      }}
      onBack={() => router.back()}
    />
  );
}
