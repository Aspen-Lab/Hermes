"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { mockJobs } from "@/data/mock";
import {
  Tag,
  Callout,
  PropertyStrip,
  Property,
  Signal,
} from "@/components/ui";
import { BriefingQuickHit } from "@/components/cards/briefing-quick-hit";

function formatPosted(d?: string): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diff < 1) return "Today";
  if (diff < 2) return "Yesterday";
  if (diff < 14) return `${diff}d ago`;
  if (diff < 60) return `${Math.floor(diff / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

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
  const { id } = use(params);
  const feedJobs = useFeedStore((s) => s.jobs);
  const savedJobs = useFeedStore((s) => s.savedJobs);
  const markRead = useFeedStore((s) => s.markRead);
  const { saveJob, notInterestedJob } = useFeedStore();

  const job =
    feedJobs.find((j) => j.id === id) ??
    savedJobs.find((j) => j.id === id) ??
    mockJobs.find((j) => j.id === id);

  useEffect(() => {
    if (job) markRead(job.id);
  }, [job, markRead]);

  const related = useMemo(() => {
    if (!job) return [];
    const pool = feedJobs.length > 0 ? feedJobs : mockJobs;
    return pickRelatedJobs(job, pool, 3);
  }, [job, feedJobs]);

  if (!job) {
    return (
      <article className="mx-auto max-w-[720px] px-6 py-20">
        <p className="text-text-muted italic">Job not found.</p>
        <Link href="/" className="text-link text-[14px] mt-3 inline-block">
          ← Back to feed
        </Link>
      </article>
    );
  }

  const isSaved = savedJobs.some((j) => j.id === job.id);
  const matchPct = job.relevanceScore
    ? Math.round(Math.max(0, Math.min(1, job.relevanceScore)) * 100)
    : null;
  const postedLabel = formatPosted(job.postedDate);
  const daysOld = job.postedDate
    ? Math.floor((Date.now() - new Date(job.postedDate).getTime()) / 86_400_000)
    : null;
  const isFresh = daysOld !== null && daysOld <= 30;

  const handleDismiss = () => {
    notInterestedJob(job);
    window.history.back();
  };

  return (
    <article className="mx-auto max-w-[760px] px-6 py-14">
      <Link
        href="/"
        className="group inline-flex items-center gap-1 text-[13px] text-text-faint hover:text-link transition-all duration-200 ease-out active:scale-95"
        style={{ fontFamily: "var(--font-sans)" }}
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
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {job.roleTitle}
        </h1>
        <p
          className="text-text-muted mt-3 text-[14.5px]"
          style={{ fontFamily: "var(--font-sans)" }}
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
      <SectionTitle icon={<IconCheck />} index={5}>
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
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mb-2"
            style={{ fontFamily: "var(--font-sans)" }}
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
    </article>
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
      className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mt-10 mb-3 animate-fade-in-up"
      style={{
        "--i": index,
        fontFamily: "var(--font-sans)",
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
      style={{ "--i": 2, fontFamily: "var(--font-sans)" } as React.CSSProperties}
    >
      {applyUrl && (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 h-11 px-5 rounded-full bg-accent text-bg text-[14px] font-semibold shadow-card hover:shadow-card-hover hover:bg-accent/90 transition-all duration-200 ease-out active:scale-[0.97]"
        >
          Apply for this role
          <span className="text-[11px] opacity-90 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
            ↗
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={onSave}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Saved" : "Save"}
        className={`group inline-flex items-center gap-1.5 h-11 pl-3.5 pr-4 rounded-full text-[13.5px] font-medium transition-all duration-200 ease-out active:scale-[0.96] ${
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

function IconBullseye() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2M14 7h2M8 12h2M14 12h2M8 17h2M14 17h2" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
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
function IconStar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <path d="M12 3l2.5 6.5L21 10l-5.2 4 1.7 7L12 17.5 6.5 21l1.7-7L3 10l6.5-.5z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}
