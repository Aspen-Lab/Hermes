"use client";

import Link from "next/link";
import type { Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Tag, Relevance, ActionBar } from "@/components/ui";

export function JobCard({ job }: { job: Job }) {
  const { saveJob, notInterestedJob } = useFeedStore();

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-xl bg-surface border border-border p-6 hover:border-border-strong hover:bg-surface-hover transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[17px] font-semibold text-heading leading-snug tracking-tight">
          {job.roleTitle}
        </h3>
        <Relevance score={job.relevanceScore} />
      </div>

      <p className="text-[14px] text-text-muted mt-2">
        {job.companyOrLab} · {job.isRemote ? "Remote" : job.location}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3">
        {job.isRemote && <Tag>remote</Tag>}
        <Tag>{job.companyOrLab.toLowerCase().replace(/\s+/g, "-")}</Tag>
      </div>

      <p className="text-[15px] text-text-muted mt-4 leading-relaxed line-clamp-2" style={{ fontFamily: "var(--font-reading)" }}>
        {job.matchReason}
      </p>

      <ActionBar
        onSave={() => saveJob(job)}
        onDismiss={() => notInterestedJob(job)}
      />
    </Link>
  );
}
