"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import type { Paper } from "@/types";
import { useFeedStore } from "@/store/feed";
import { mockPapers } from "@/data/mock";
import { Tag, DetailSection, LinkRow } from "@/components/ui";
import { BriefingQuickHit } from "@/components/cards/briefing-quick-hit";

const WORDS_PER_MINUTE = 220;

function wordCount(...parts: (string | undefined)[]): number {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function readingTimeMinutes(paper: Paper): number {
  const words = wordCount(
    paper.summaryIntro,
    paper.summaryResultDiscussion,
    paper.relevanceReason,
  );
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

function formatPublishedDate(d?: string): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const day = 86_400_000;
  const diffDays = Math.floor(diffMs / day);
  if (diffDays < 1) return "Today";
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 14) return `${diffDays} days ago`;
  if (diffDays < 60) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function pickRelated(current: Paper, pool: Paper[], limit = 3): Paper[] {
  const others = pool.filter((p) => p.id !== current.id);
  const kw = new Set(current.summaryExperimentKeywords.map((k) => k.toLowerCase()));
  const scored = others
    .map((p) => {
      const sharedKw = p.summaryExperimentKeywords.filter((k) =>
        kw.has(k.toLowerCase()),
      ).length;
      const sameVenue = p.venue === current.venue ? 1 : 0;
      return { p, score: sharedKw * 2 + sameVenue + (p.relevanceScore ?? 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
  return scored;
}

export default function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const feedPapers = useFeedStore((s) => s.papers);
  const savedPapers = useFeedStore((s) => s.savedPapers);
  const { savePaper, notInterestedPaper, moreLikePaper } = useFeedStore();

  const paper =
    feedPapers.find((p) => p.id === id) ??
    savedPapers.find((p) => p.id === id) ??
    mockPapers.find((p) => p.id === id);

  const related = useMemo(() => {
    if (!paper) return [];
    const pool = feedPapers.length > 0 ? feedPapers : mockPapers;
    return pickRelated(paper, pool, 3);
  }, [paper, feedPapers]);

  if (!paper) {
    return (
      <article className="mx-auto max-w-[720px] px-6 py-20">
        <p className="text-text-muted italic">Paper not found.</p>
        <Link href="/" className="text-link text-[14px] mt-3 inline-block">
          ← Back to feed
        </Link>
      </article>
    );
  }

  const q = encodeURIComponent(paper.title);
  const arxivUrl = paper.linkArxiv || `https://arxiv.org/search/?query=${q}`;
  const scholarUrl =
    paper.linkScholar || `https://scholar.google.com/scholar?q=${q}`;
  const codeUrl =
    paper.linkCode || `https://github.com/search?q=${q}&type=repositories`;
  const showPaperLink = paper.linkPaper && paper.linkPaper !== paper.linkArxiv;

  const matchPct = paper.relevanceScore
    ? Math.round(Math.max(0, Math.min(1, paper.relevanceScore)) * 100)
    : null;
  const publishedLabel = formatPublishedDate(paper.publishedDate);
  const readMinutes = readingTimeMinutes(paper);

  const handleDismiss = () => {
    notInterestedPaper(paper);
    window.history.back();
  };

  return (
    <article className="mx-auto max-w-[720px] px-6 py-14">
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

      <header
        className="mt-8 animate-fade-in-up"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <h1
          className="text-[30px] lg:text-[34px] font-semibold text-heading leading-[1.15] tracking-[-0.015em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {paper.title}
        </h1>

        <p
          className="text-text-muted mt-3 text-[14.5px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {paper.authors.join(", ")}
        </p>

        <div
          className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-4 text-[13px] text-text-faint"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <Tag>{paper.venue}</Tag>
          {publishedLabel && (
            <>
              <span className="text-border-strong">·</span>
              <span>{publishedLabel}</span>
            </>
          )}
          <span className="text-border-strong">·</span>
          <span>{readMinutes} min read</span>
          {matchPct !== null && (
            <>
              <span className="text-border-strong">·</span>
              <span
                className="inline-flex items-center gap-1.5 text-accent font-medium"
                title="Algorithmic match based on your profile keywords"
              >
                <span className="relative block w-[6px] h-[6px] rounded-full bg-accent" />
                {matchPct}% match
              </span>
            </>
          )}
        </div>
      </header>

      <ActionRow
        arxivUrl={arxivUrl}
        onSave={() => savePaper(paper)}
        onDismiss={handleDismiss}
        isSaved={paper.isSaved}
      />

      <DetailSection title="Why this fits you" index={1}>
        {paper.relevanceReason}
      </DetailSection>

      <DetailSection title="Introduction" index={2}>
        {paper.summaryIntro}
      </DetailSection>

      <DetailSection title="Experiment keywords" index={3}>
        <div className="flex flex-wrap gap-2">
          {paper.summaryExperimentKeywords.map((kw) => (
            <Tag key={kw}>{kw}</Tag>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Results & Discussion" index={4}>
        {paper.summaryResultDiscussion}
      </DetailSection>

      <DetailSection title="Also on" index={5}>
        <div className="flex flex-wrap">
          {showPaperLink && <LinkRow label="Publisher" href={paper.linkPaper} />}
          <LinkRow label="Scholar" href={scholarUrl} />
          <LinkRow label={paper.linkCode ? "Code" : "Search code"} href={codeUrl} />
        </div>
      </DetailSection>

      <div
        className="mt-12 pt-6 border-t border-border animate-fade-in-up"
        style={{ "--i": 6 } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => moreLikePaper(paper)}
          className="group inline-flex items-center gap-2 h-10 px-4 rounded-full bg-surface border border-border-strong text-[13.5px] text-text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-dim transition-colors duration-200 ease-out active:scale-[0.96]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 ease-out group-hover:rotate-12"
            aria-hidden
          >
            <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
            <path d="M19 3l.6 1.6L21 5l-1.4.4L19 7l-.6-1.6L17 5l1.4-.4z" />
          </svg>
          Train my feed on this
        </button>
      </div>

      {related.length > 0 && (
        <section
          className="mt-16 animate-fade-in-up"
          style={{ "--i": 7 } as React.CSSProperties}
        >
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mb-2"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Related from your feed
          </h2>
          <div className="divide-y divide-border">
            {related.map((p) => (
              <BriefingQuickHit key={p.id} item={{ kind: "paper", data: p }} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

// ── Prominent action row: primary CTA (arXiv) + save/dismiss icon buttons ──

function ActionRow({
  arxivUrl,
  onSave,
  onDismiss,
  isSaved,
}: {
  arxivUrl: string;
  onSave: () => void;
  onDismiss: () => void;
  isSaved: boolean;
}) {
  return (
    <div
      className="flex items-center flex-wrap gap-2.5 mt-7 animate-fade-in-up"
      style={{
        "--i": 1,
        fontFamily: "var(--font-sans)",
      } as React.CSSProperties}
    >
      <a
        href={arxivUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 h-11 px-5 rounded-full bg-accent text-bg text-[14px] font-semibold shadow-card hover:shadow-card-hover hover:bg-accent/90 transition-all duration-200 ease-out active:scale-[0.97]"
      >
        Read on arXiv
        <span className="text-[11px] opacity-90 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
          ↗
        </span>
      </a>

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
