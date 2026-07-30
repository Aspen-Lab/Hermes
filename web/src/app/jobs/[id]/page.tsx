"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Job, RoleKind } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { formatDate, formatMatchPct } from "@/lib/format";
import { formatSalary } from "@/lib/opportunities/salary";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { TierUpgradeBlock } from "@/components/reports/tier-upgrade-block";
import { reportProviderConfigured } from "@/components/reports/provider-configured";
import { CompletionPill } from "@/components/opportunities/completion-pill";

const JOB_TIER_UPGRADE_ITEMS = [
  {
    title: "Tailored application strategy",
    description:
      "Turn the posting evidence into a focused plan for this specific role.",
  },
  {
    title: "Requirement-by-requirement evidence",
    description:
      "Connect each stated requirement to examples from your profile and work.",
  },
  {
    title: "Interview preparation",
    description:
      "Develop role-specific questions and preparation areas from the full posting.",
  },
];

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
  const visa = job.visa;
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
    visa
      ? {
          key: "visa",
          label: "Visa",
          value: VISA_LABELS[visa.state],
          tone: visaTone(visa.state),
        }
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
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 animate-fade-in-up">
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
  onToggleSave,
  onAppliedChange,
  onDismiss,
}: {
  applyUrl?: string;
  isSaved: boolean;
  isApplied: boolean;
  onToggleSave: () => void;
  onAppliedChange: (next: boolean) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-7 flex flex-wrap items-center gap-2.5">
      {applyUrl && (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ tone: "primary" }),
            "h-11 px-5 text-body font-semibold",
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
          "h-11 px-4 text-body-sm",
          isSaved && "border-accent/35 bg-accent/10 text-accent",
        )}
      >
        {isSaved ? "Saved" : "Save"}
      </button>
      <CompletionPill
        label="Applied"
        checked={isApplied}
        onChange={onAppliedChange}
        className="h-11 px-4 text-body-sm"
      />
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

export function JobReport({
  job,
  isSaved,
  isApplied,
  nowMs,
  providerConfigured = false,
  onToggleSave,
  onAppliedChange,
  onDismiss,
}: {
  job: Job;
  isSaved: boolean;
  isApplied: boolean;
  nowMs: number;
  providerConfigured?: boolean;
  onToggleSave: () => void;
  onAppliedChange: (next: boolean) => void;
  onDismiss: () => void;
}) {
  const matchPct = formatMatchPct(job.relevanceScore);
  const facts = buildJobFacts(job);
  const timeline = buildTimeline(job, nowMs);
  const skills = skillComparison(job);
  const roleSummary = clean(job.summary);
  const materials = distinct(job.applicationMaterials ?? []);
  const matchReason = clean(job.matchReason);
  const facetReason = clean(job.facetPreferenceReason);
  const visaEvidence = clean(job.visa?.evidence);
  const company = clean(job.companyOrLab);
  const location = clean(job.isRemote ? "Remote" : job.location);

  return (
    <PageContainer width="detail" className="px-6 py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-body-sm text-text-faint transition-colors hover:text-link"
      >
        <span aria-hidden>←</span>
        Back
      </Link>

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
          {job.roleTitle}
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
          onToggleSave={onToggleSave}
          onAppliedChange={onAppliedChange}
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

      {visaEvidence && (
        <blockquote className="mt-4 border-l-2 border-accent/50 pl-4 text-body leading-7 text-text-muted">
          “{visaEvidence}”
        </blockquote>
      )}

      {timeline.length > 0 && (
        <ReportSection title="Timeline">
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
                    <li key={skill} className="text-body-sm text-text-muted">
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
                    <li key={skill} className="text-body-sm text-text-muted">
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

      {roleSummary && (
        <ReportSection title="What the role is">
          <p className="max-w-3xl text-body-lg leading-8 text-text">
            {roleSummary}
          </p>
        </ReportSection>
      )}

      {materials.length > 0 && (
        <ReportSection title="What to have ready">
          <ul className="grid gap-2 sm:grid-cols-2">
            {materials.map((material) => (
              <li
                key={material}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-body-sm text-heading"
              >
                {material}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {(matchReason || facetReason) && (
        <ReportSection title="Why Peer sent it">
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
            {matchReason && (
              <p className="text-body-lg leading-7 text-heading">{matchReason}</p>
            )}
            {facetReason && (
              <p className="mt-2 text-body-sm text-accent">{facetReason}</p>
            )}
          </div>
        </ReportSection>
      )}

      <TierUpgradeBlock
        items={JOB_TIER_UPGRADE_ITEMS}
        providerConfigured={providerConfigured}
      />
    </PageContainer>
  );
}

export default function JobDetailPage({
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
  const feedJobs = useFeedStore((state) => state.jobs);
  const jobPool = useFeedStore((state) => state.jobPool);
  const savedJobs = useFeedStore((state) => state.savedJobs);
  const isApplied = useFeedStore((state) => Boolean(state.appliedAt[id]));
  const markRead = useFeedStore((state) => state.markRead);
  const saveJob = useFeedStore((state) => state.saveJob);
  const unsaveJob = useFeedStore((state) => state.unsaveJob);
  const setJobApplied = useFeedStore((state) => state.setJobApplied);
  const notInterestedJob = useFeedStore((state) => state.notInterestedJob);
  const profile = useProfileStore((state) => state.profile);
  const [nowMs] = useState(Date.now);

  const job =
    feedJobs.find((candidate) => candidate.id === id) ??
    jobPool.find((candidate) => candidate.id === id) ??
    savedJobs.find((candidate) => candidate.id === id);
  const isSaved = savedJobs.some((candidate) => candidate.id === id);

  useEffect(() => {
    if (job) markRead(job.id);
  }, [job, markRead]);

  if (!job) {
    return (
      <PageContainer width="narrow" className="px-6 py-20">
        <p className="italic text-text-muted">Job not found.</p>
        <Link href="/" className="mt-3 inline-block text-body text-link">
          ← Back to feed
        </Link>
      </PageContainer>
    );
  }

  return (
    <JobReport
      job={job}
      isSaved={isSaved}
      isApplied={isApplied}
      nowMs={nowMs}
      providerConfigured={reportProviderConfigured(profile)}
      onToggleSave={() => (isSaved ? unsaveJob(job.id) : saveJob(job))}
      onAppliedChange={(next) => setJobApplied(job, next)}
      onDismiss={() => {
        notInterestedJob(job);
        window.history.back();
      }}
    />
  );
}
