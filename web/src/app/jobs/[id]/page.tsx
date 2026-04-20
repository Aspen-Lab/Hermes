"use client";

import { use } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { mockJobs } from "@/data/mock";
import { Tag, DetailSection, ActionBar } from "@/components/ui";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const feedJobs = useFeedStore((s) => s.jobs);
  const savedJobs = useFeedStore((s) => s.savedJobs);
  const { saveJob, notInterestedJob } = useFeedStore();

  const job =
    feedJobs.find((j) => j.id === id) ??
    savedJobs.find((j) => j.id === id) ??
    mockJobs.find((j) => j.id === id);

  if (!job) {
    return (
      <article className="mx-auto max-w-[720px] px-6 py-16">
        <p className="text-text-muted italic">Job not found.</p>
        <Link href="/" className="text-link text-sm mt-2 inline-block">← Back to feed</Link>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-[720px] px-6 py-12">
      <Link href="/" className="text-sm text-text-faint hover:text-link transition-colors">
        ← Back
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-bold text-heading leading-tight">
          {job.roleTitle}
        </h1>
        <p className="text-text-muted mt-2">
          {job.companyOrLab} · {job.isRemote ? "Remote" : job.location}
        </p>
        <div className="flex items-center flex-wrap gap-2 mt-3">
          {job.isRemote && <Tag>remote</Tag>}
          <Tag>{job.companyOrLab.toLowerCase().replace(/\s+/g, "-")}</Tag>
          {job.relevanceScore && (
            <span className="font-mono text-xs text-yellow">
              {Math.round(job.relevanceScore * 100)}% match
            </span>
          )}
        </div>
      </header>

      <DetailSection title="Why this matches">
        {job.matchReason}
      </DetailSection>

      <DetailSection title="Requirements">
        <ul className="list-none space-y-1">
          {job.keyRequirements.map((req) => (
            <li key={req} className="before:content-['–_'] before:text-text-faint">
              {req}
            </li>
          ))}
        </ul>
      </DetailSection>

      {job.linkPosting && (
        <div className="mt-8">
          <a
            href={job.linkPosting}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:text-link/80 transition-colors"
          >
            Apply for this role ↗
          </a>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-border">
        <ActionBar
          onSave={() => saveJob(job)}
          onDismiss={() => { notInterestedJob(job); window.history.back(); }}
        />
      </div>
    </article>
  );
}
