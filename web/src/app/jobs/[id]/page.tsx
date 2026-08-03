"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Job, RoleKind } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { formatDate, formatMatchPct } from "@/lib/format";
import { formatSalary } from "@/lib/opportunities/salary";
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
import { CompletionPill } from "@/components/opportunities/completion-pill";
import { OpportunityFeedbackPair } from "@/components/opportunities/feedback-pair";
import { BackToFeedLink } from "@/components/navigation/back-to-feed-link";

const JOB_TIER_UPGRADE_ITEMS = [
  {
    title: "Sponsorship read when the posting is silent",
    description:
      "Judge the employer's likely position without confusing inference with posting evidence.",
  },
  {
    title: "What this employer actually asks for",
    description:
      "Quote the specific requirements and duties from the posting itself.",
  },
  {
    title: "What to emphasise in your application",
    description:
      "Identify which parts of your declared work and methods should lead.",
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
  sponsors: "Sponsorship available",
  "not-stated": "Visa not stated",
  "wont-sponsor": "No sponsorship",
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
  tone?: "accent" | "danger";
}

interface TimelinePoint {
  key: "posted" | "today" | "deadline" | "start";
  label: string;
  value: string;
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

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function visaTone(
  state: VisaState,
): "accent" | "danger" | undefined {
  if (state === "sponsors") return "accent";
  if (state === "wont-sponsor") return "danger";
  return undefined;
}

export function buildJobFacts(job: Job): JobFact[] {
  const posted = formatDate(job.postedDate);
  const deadline = formatDate(job.applicationDeadline);
  const start = formatDate(job.startDate);
  const facts: Array<JobFact | undefined> = [
    job.salary
      ? {
          key: "salary",
          label: "Salary",
          value: `${formatSalary(job.salary)}${
            job.salaryIsEstimated ? " · estimated" : ""
          }`,
        }
      : undefined,
    clean(job.employmentType)
      ? {
          key: "employment-type",
          label: "Employment",
          value: humanize(job.employmentType!),
        }
      : undefined,
    job.isRemote
      ? { key: "work-mode", label: "Work mode", value: "Remote" }
      : undefined,
    posted
      ? { key: "posted", label: "Posted", value: posted }
      : undefined,
    deadline
      ? { key: "deadline", label: "Apply by", value: deadline }
      : undefined,
    start
      ? { key: "start", label: "Starts", value: start }
      : undefined,
  ];
  return facts.filter((fact): fact is JobFact => Boolean(fact?.value));
}

function buildTimeline(job: Job, nowMs: number): TimelinePoint[] {
  const posted = formatDate(job.postedDate);
  const deadline = formatDate(job.applicationDeadline);
  const start = formatDate(job.startDate);
  if (!posted && !deadline && !start) return [];

  const today = formatDate(new Date(nowMs).toISOString());
  const points: TimelinePoint[] = [];
  if (posted) points.push({ key: "posted", label: "Posted", value: posted });
  if (today) {
    points.push({
      key: "today",
      label: "Today",
      value: today,
      accent: true,
    });
  }
  if (deadline) {
    points.push({ key: "deadline", label: "Apply by", value: deadline });
  }
  if (start) points.push({ key: "start", label: "Starts", value: start });
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

function skillComparison(job: Job): {
  matched: string[];
  unmatched: string[];
  pct: number;
} | null {
  const requirements = distinct(job.keyRequirements);
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

function FactTile({ fact }: { fact: JobFact }) {
  return (
    <div
      data-job-fact={fact.key}
      className={cn(
        "min-w-0 rounded-xl border border-border bg-surface px-4 py-3",
        fact.tone === "accent" && "border-accent/25 bg-accent/5",
        fact.tone === "danger" && "border-red/25 bg-red/5",
      )}
    >
      <dt className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint">
        {fact.label}
      </dt>
      <dd
        className={cn(
          "mt-1 break-words text-body-sm font-semibold text-heading",
          fact.tone === "accent" && "text-accent",
          fact.tone === "danger" && "text-red",
        )}
      >
        {fact.value}
      </dd>
    </div>
  );
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
          Apply
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
        label="Applied"
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
  const facts = buildJobFacts(job);
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
  const location = cleanJobSubtitlePart(
    job.isRemote ? "Remote" : job.location,
  );
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
          clean(job.contractLength) ||
          job.visa ||
          matchPct !== null) && (
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Job summary">
            {job.roleKind && <HeaderChip>{ROLE_LABELS[job.roleKind]}</HeaderChip>}
            {clean(job.contractLength) && (
              <HeaderChip>{clean(job.contractLength)}</HeaderChip>
            )}
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
        {(company || location) && (
          <p className="mt-3 text-body text-text-muted">
            {company}
            {company && location && <span aria-hidden> · </span>}
            {location}
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
                <p className="mt-2 text-body-sm font-semibold text-heading">
                  {point.value}
                </p>
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

      {skills && (
        <ReportSection title="Skills and profile gaps">
          <div
            role="progressbar"
            aria-label="Requirements matched in your profile"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={skills.pct}
            className="h-2 overflow-hidden rounded-full bg-bg-secondary"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${skills.pct}%` }}
            />
          </div>
          <p className="mt-2 text-caption text-text-faint">
            {skills.matched.length} of{" "}
            {skills.matched.length + skills.unmatched.length} requirements match
            terms in your profile
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {skills.matched.length > 0 && (
              <div>
                <h3 className="text-body-sm font-semibold text-heading">
                  Matched in your profile
                </h3>
                <ul className="mt-2 space-y-2">
                  {skills.matched.map((skill) => (
                    <li
                      key={skill}
                      data-skill-requirement="matched"
                      className="text-body-sm text-text-muted"
                    >
                      <span className="mr-2 text-accent" aria-hidden>
                        ✓
                      </span>
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {skills.unmatched.length > 0 && (
              <div>
                <h3 className="text-body-sm font-semibold text-heading">
                  Not matched in your profile
                </h3>
                <ul className="mt-2 space-y-2">
                  {skills.unmatched.map((skill) => (
                    <li
                      key={skill}
                      data-skill-requirement="unmatched"
                      className="text-body-sm text-text-muted"
                    >
                      <span className="mr-2 text-text-faint" aria-hidden>
                        ○
                      </span>
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
          {materials.length > 0 && (
            <section data-section="to-apply-have-ready">
              <h2 className="text-micro font-semibold uppercase tracking-[0.16em] text-text-faint">
                To apply, have ready
              </h2>
              <ul className="mt-4 space-y-2">
                {materials.map((material) => (
                  <li
                    key={material}
                    className="rounded-lg border border-border bg-surface px-4 py-3 text-body-sm text-heading"
                  >
                    {material}
                  </li>
                ))}
              </ul>
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
