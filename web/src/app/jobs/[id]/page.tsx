"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import {
  Tag,
  Callout,
  PropertyStrip,
  Property,
  Signal,
} from "@/components/ui";
import { BriefingQuickHit } from "@/components/cards/briefing-quick-hit";
import { formatDayAge, formatMatchPct } from "@/lib/format";
import {
  IconBuilding,
  IconBullseye,
  IconCalendar,
  IconCheckCircle,
  IconPin,
  IconStar,
} from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";

function pickRelatedJobs(current: Job, pool: Job[], limit = 3): Job[] {
  const others = pool.filter((j) => j.id !== current.id);
  const reqs = new Set(
    current.keyRequirements.map((r) => r.toLowerCase()),
  );
  return others
    .map((j) => {
      const sharedReqs = j.keyRequirements.filter((r) =>
        reqs.has(r.toLowerCase()),
      ).length;
      const sameCompany = j.companyOrLab === current.companyOrLab ? 1 : 0;
      return {
        j,
        score: sharedReqs * 2 + sameCompany + (j.relevanceScore ?? 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.j);
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  // Job ids are source-namespaced ("remotive:123") — the colon arrives
  // URL-encoded in the route param. Same decode guard as the papers page.
  const id = (() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  })();
  const feedJobs = useFeedStore((s) => s.jobs);
  const jobPool = useFeedStore((s) => s.jobPool);
  const savedJobs = useFeedStore((s) => s.savedJobs);
  const markRead = useFeedStore((s) => s.markRead);
  const { saveJob, notInterestedJob } = useFeedStore();
  const [now] = useState(Date.now);

  const job =
    feedJobs.find((j) => j.id === id) ??
    jobPool.find((j) => j.id === id) ??
    savedJobs.find((j) => j.id === id);

  useEffect(() => {
    if (job) markRead(job.id);
  }, [job, markRead]);

  const related = useMemo(() => {
    if (!job) return [];
    return pickRelatedJobs(job, jobPool, 3);
  }, [job, jobPool]);

  if (!job) {
    return (
      <PageContainer width="narrow" className="px-6 py-20">
        <p className="text-text-muted italic">Job not found.</p>
        <Link href="/" className="text-link text-body mt-3 inline-block">
          ← Back to feed
        </Link>
      </PageContainer>
    );
  }

  const isSaved = savedJobs.some((j) => j.id === job.id);
  const matchPct = formatMatchPct(job.relevanceScore);
  const postedLabel = formatDayAge(job.postedDate, now);
  const daysOld = job.postedDate
    ? Math.floor((now - new Date(job.postedDate).getTime()) / 86_400_000)
    : null;
  const isFresh = daysOld !== null && daysOld <= 30;

  const handleDismiss = () => {
    notInterestedJob(job);
    window.history.back();
  };

  return (
    <PageContainer width="detail" className="px-6 py-14">
      <Link
        href="/"
        className="group inline-flex items-center gap-1 text-body-sm text-text-faint hover:text-link transition-all duration-200 ease-out active:scale-95"
      >
        <span className="transition-transform duration-200 ease-out group-hover:-translate-x-[2px]">
          ←
        </span>
        Back
      </Link>

      {/* ── Hero ── */}
      <header
        className="mt-8 animate-fade-in-up"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <h1
          className="text-[30px] lg:text-[34px] font-semibold text-heading leading-[1.15] tracking-[-0.015em]"
        >
          {job.roleTitle}
        </h1>
        <p
          className="text-text-muted mt-3 text-body"
        >
          <Link
            href={`/?q=${encodeURIComponent(job.companyOrLab)}`}
            className="hover:text-heading hover:underline decoration-accent/50 underline-offset-4 transition-colors"
          >
            {job.companyOrLab}
          </Link>
          {" · "}
          {job.isRemote ? "Remote" : job.location}
        </p>
      </header>

      {/* ── Property strip ── */}
      <div
        className="mt-6 animate-fade-in-up"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <PropertyStrip>
          {matchPct !== null && (
            <Property icon={<IconBullseye />} label="Match" accent>
              {matchPct}%
            </Property>
          )}
          <Property icon={<IconBuilding />} label="Company">
            {job.companyOrLab}
          </Property>
          <Property icon={<IconPin />} label="Location">
            {job.isRemote ? "Remote" : job.location}
          </Property>
          <Property icon={<IconGlobe />} label="Format">
            {job.isRemote ? "Remote" : "On-site"}
          </Property>
          {postedLabel && (
            <Property icon={<IconCalendar />} label="Posted">
              {postedLabel}
            </Property>
          )}
          <Property icon={<IconList />} label="Must-haves">
            {job.keyRequirements.length}
          </Property>
        </PropertyStrip>
      </div>

      {/* ── Action row ── */}
      <ActionRow
        applyUrl={job.linkPosting}
        isSaved={isSaved}
        onSave={() => saveJob(job)}
        onDismiss={handleDismiss}
      />

      {/* ── Why this matches (accent callout) ── */}
      <div
        className="mt-10 animate-fade-in-up"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <Callout
          variant="accent"
          icon={<IconStar />}
          title="Why this matches you"
        >
          {job.matchReason}
        </Callout>
      </div>

      {/* ── Requirements ── */}
      <SectionTitle icon={<IconList />} index={4}>
        Must-have skills
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {job.keyRequirements.map((req) => (
          <Tag key={req} href={`/?q=${encodeURIComponent(req)}`}>
            {req}
          </Tag>
        ))}
      </div>

      {/* ── Signals ── */}
      <SectionTitle icon={<IconCheckCircle />} index={5}>
        At a glance
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        <Signal ok={!!job.linkPosting}>Direct listing</Signal>
        <Signal ok={job.isRemote}>
          {job.isRemote ? "Remote OK" : "On-site only"}
        </Signal>
        {daysOld !== null && (
          <Signal ok={isFresh}>
            {isFresh ? "Recent (≤30d)" : "Older listing"}
          </Signal>
        )}
        <Signal ok={job.keyRequirements.length <= 7}>
          {job.keyRequirements.length <= 4
            ? "Focused requirements"
            : job.keyRequirements.length <= 7
              ? "Standard scope"
              : "Heavy requirements"}
        </Signal>
      </div>

      {/* ── Related jobs ── */}
      {related.length > 0 && (
        <section
          className="mt-14 animate-fade-in-up"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <h2
            className="text-caption font-semibold uppercase tracking-[0.18em] text-text-faint mb-2"
          >
            Related roles
          </h2>
          <div className="divide-y divide-border">
            {related.map((j) => (
              <BriefingQuickHit key={j.id} item={{ kind: "job", data: j }} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

// ── Section title (shared pattern w/ paper page) ──

function SectionTitle({
  icon,
  index,
  children,
}: {
  icon?: React.ReactNode;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <h3
      className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.18em] text-text-faint mt-10 mb-3 animate-fade-in-up"
      style={{
        "--i": index,
        } as React.CSSProperties}
    >
      {icon}
      {children}
    </h3>
  );
}

// ── Action row ──

function ActionRow({
  applyUrl,
  isSaved,
  onSave,
  onDismiss,
}: {
  applyUrl?: string;
  isSaved: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex items-center flex-wrap gap-2.5 mt-6 animate-fade-in-up"
      style={{ "--i": 2} as React.CSSProperties}
    >
      {applyUrl && (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ tone: "primary" }), "group h-11 px-5 text-body font-semibold hover:shadow-card-hover")}
        >
          Apply for this role
          <span className="text-caption opacity-90 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
            ↗
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={onSave}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Saved" : "Save"}
        className={`group inline-flex items-center gap-1.5 h-11 pl-3.5 pr-4 rounded-full text-body-sm font-medium transition-all duration-200 ease-out active:scale-[0.96] ${
          isSaved
            ? "bg-accent/10 text-accent border border-accent/40"
            : "bg-transparent border border-border-strong text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={isSaved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-300 ease-out ${
            isSaved ? "scale-100" : "group-hover:-translate-y-[1px]"
          }`}
          aria-hidden
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {isSaved ? "Saved" : "Save"}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Not interested — hide this"
        className="group inline-flex items-center justify-center w-11 h-11 rounded-full text-text-faint hover:text-red hover:bg-red/10 transition-colors duration-200 ease-out active:scale-[0.9] ml-auto"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300 ease-out group-hover:rotate-90"
          aria-hidden
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Icons ──

function IconGlobe() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
