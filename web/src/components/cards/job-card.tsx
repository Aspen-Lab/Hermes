"use client";

import Link from "next/link";
import type { Job } from "@/types";
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
import { HighlightedText } from "@/components/ui/highlighted-text";
import { jobCardView } from "@/lib/jobs/card";
import { IconCalendar, IconPin } from "@/components/icons";
import { CompletionPill } from "@/components/opportunities/completion-pill";

interface JobCompletionControl {
  applied: boolean;
  onChange: (next: boolean) => void;
}

export function JobCard({
  job,
  completion,
}: {
  job: Job;
  completion?: JobCompletionControl;
}) {
  const { saveJob, unsaveJob, notInterestedJob } = useFeedStore();
  const view = jobCardView(job);
  const relevanceProps = opportunityRelevanceCardProps(job.relevanceScore);
  const isDone = completion?.applied === true;

  return (
    <Link
      href={`/jobs/${job.id}`}
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
      <OpportunityRelevanceBar score={job.relevanceScore} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PrestigeBadge tier={view.prestige.tier} label={view.prestige.label} />
          <span className="rounded-md border border-tag/20 bg-tag-dim px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.14em] text-tag">
            {view.employmentTypeLabel}
          </span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          {completion && (
            <CompletionPill
              label="Applied"
              checked={completion.applied}
              onChange={completion.onChange}
            />
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

      <div className="mt-3">
        <h3 className="text-title-lg font-semibold leading-snug tracking-[-0.01em] text-heading">
          {job.roleTitle}
        </h3>
        <p className="mt-1 text-body-sm text-text-muted">{job.companyOrLab}</p>
      </div>

      <FactsStrip
        className="mt-3.5"
        facts={[
          { icon: <IconCalendar />, label: view.postedLabel },
          { icon: <IconPin />, label: view.locationLabel, tone: view.locationTone },
          { label: view.salaryLabel, tone: view.salaryTone },
        ]}
      />

      <UrgencyBar className="mt-3.5" {...view.urgency} />

      <div className="mt-4">
        <MatchedTerms terms={view.matchedTerms} />
        <p className="mt-2.5 text-body-lg leading-[1.65] text-text-muted">
          <HighlightedText text={view.summaryText} terms={view.matchedTerms} />
        </p>
        {job.facetPreferenceReason && (
          <p className="mt-2 text-caption font-semibold text-accent">
            {job.facetPreferenceReason}
          </p>
        )}
        {job.keyRequirements.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
          {job.keyRequirements.slice(0, 3).map((req) => (
            <span
              key={req}
              className="text-caption text-text-muted bg-bg-secondary/70 px-2 py-[3px] rounded-md"
            >
              {req}
            </span>
          ))}
          {job.keyRequirements.length > 3 && (
            <span
              className="text-caption text-text-faint px-1 py-[3px]"
            >
              +{job.keyRequirements.length - 3}
            </span>
          )}
          </div>
        )}
      </div>

      <ActionBar
        onSave={() => saveJob(job)}
        onUnsave={() => unsaveJob(job.id)}
        onDismiss={() => notInterestedJob(job)}
        isSaved={job.isSaved}
      />
    </Link>
  );
}
