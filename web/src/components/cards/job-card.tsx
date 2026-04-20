"use client";

import Link from "next/link";
import type { Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Relevance, ActionBar } from "@/components/ui";

export function JobCard({ job }: { job: Job }) {
  const { saveJob, notInterestedJob } = useFeedStore();

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-2xl bg-surface shadow-card p-7 animate-fade-in-up transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover hover:-translate-y-[2px] active:translate-y-0 active:shadow-card"
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-[19px] font-semibold text-heading leading-snug tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {job.roleTitle}
        </h3>
        <Relevance score={job.relevanceScore} />
      </div>

      <p
        className="text-[13.5px] text-text-muted mt-2.5"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {job.companyOrLab} · {job.isRemote ? "Remote" : job.location}
      </p>

      {job.keyRequirements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {job.keyRequirements.slice(0, 3).map((req) => (
            <span
              key={req}
              className="text-[11.5px] text-text-muted bg-bg-secondary/70 px-2 py-[3px] rounded-md"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {req}
            </span>
          ))}
          {job.keyRequirements.length > 3 && (
            <span
              className="text-[11.5px] text-text-faint px-1 py-[3px]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              +{job.keyRequirements.length - 3}
            </span>
          )}
        </div>
      )}

      <p className="text-[15.5px] text-text-muted mt-4 leading-[1.65] line-clamp-2">
        {job.matchReason}
      </p>

      <ActionBar
        onSave={() => saveJob(job)}
        onDismiss={() => notInterestedJob(job)}
      />
    </Link>
  );
}
