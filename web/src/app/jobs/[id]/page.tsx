"use client";

import { use } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { mockJobs } from "@/data/mock";
import { Tag, DetailSection, ActionBar, Relevance } from "@/components/ui";

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
      <article className="mx-auto max-w-[720px] px-6 py-20">
        <p className="text-text-muted italic">Job not found.</p>
        <Link href="/" className="text-link text-[14px] mt-3 inline-block">← Back to feed</Link>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-[720px] px-6 py-14">
      <Link
        href="/"
        className="text-[13px] text-text-faint hover:text-link transition-colors"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        ← Back
      </Link>

      <header className="mt-8">
        <h1
          className="text-[30px] lg:text-[34px] font-semibold text-heading leading-[1.15] tracking-[-0.015em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {job.roleTitle}
        </h1>
        <p
          className="text-text-muted mt-3 text-[14.5px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {job.companyOrLab} · {job.isRemote ? "Remote" : job.location}
        </p>
        <div className="flex items-center flex-wrap gap-2.5 mt-4">
          {job.isRemote && <Tag>remote</Tag>}
          <Tag>{job.companyOrLab.toLowerCase().replace(/\s+/g, "-")}</Tag>
          <Relevance score={job.relevanceScore} />
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
        <div className="mt-10">
          <a
            href={job.linkPosting}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-dim text-accent hover:bg-accent/20 transition-colors text-[14px]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Apply for this role
            <span className="text-[11px] opacity-70">↗</span>
          </a>
        </div>
      )}

      <div className="mt-10 pt-5 border-t border-border">
        <ActionBar
          onSave={() => saveJob(job)}
          onDismiss={() => { notInterestedJob(job); window.history.back(); }}
        />
      </div>
    </article>
  );
}
