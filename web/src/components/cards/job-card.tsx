"use client";

import Link from "next/link";
import type { Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Relevance, ActionBar } from "@/components/ui";
import { cardShell } from "@/components/ui/card-shell";

export function JobCard({ job }: { job: Job }) {
  const { saveJob, notInterestedJob } = useFeedStore();

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cardShell()}
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-title-lg font-semibold text-heading leading-snug tracking-[-0.01em]"
        >
          {job.roleTitle}
        </h3>
        <Relevance score={job.relevanceScore} />
      </div>

      <p
        className="text-body-sm text-text-muted mt-2.5"
      >
        {job.companyOrLab} · {job.isRemote ? "Remote" : job.location}
      </p>

      {job.keyRequirements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3.5">
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

      <p className="text-body-lg text-text-muted mt-4 leading-[1.65] line-clamp-2">
        {job.matchReason}
      </p>

      <ActionBar
        onSave={() => saveJob(job)}
        onDismiss={() => notInterestedJob(job)}
      />
    </Link>
  );
}
