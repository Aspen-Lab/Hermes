"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import type { Paper } from "@/types";
import { useFeedStore } from "@/store/feed";
import { mockPapers } from "@/data/mock";
import {
  Tag,
  LinkChip,
  Callout,
  PropertyStrip,
  Property,
  PullQuote,
  Signal,
} from "@/components/ui";
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
  if (diffDays < 14) return `${diffDays}d ago`;
  if (diffDays < 60) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function splitFirstSentence(text: string): [string, string] {
  const match = text.match(/^(.*?[.!?])\s+(.*)$/s);
  if (!match) return [text, ""];
  return [match[1], match[2]];
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

function extractYear(paper: Paper): number | null {
  if (paper.publishedDate) {
    const y = new Date(paper.publishedDate).getFullYear();
    if (!Number.isNaN(y)) return y;
  }
  const match = paper.venue.match(/\b(19|20)\d{2}\b/);
  if (match) return parseInt(match[0], 10);
  return null;
}

function buildBibTeX(paper: Paper): string {
  const year = extractYear(paper) ?? new Date().getFullYear();
  const firstAuthorLast =
    (paper.authors[0] ?? "unknown")
      .split(/\s+/)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z]/g, "") ?? "unknown";
  const firstTitleWord =
    paper.title
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/[^a-z]/g, "") || "paper";
  const key = `${firstAuthorLast}${year}${firstTitleWord}`;
  const authors = paper.authors.join(" and ");
  return `@inproceedings{${key},
  title={${paper.title}},
  author={${authors}},
  booktitle={${paper.venue}},
  year={${year}}${paper.linkArxiv ? `,\n  url={${paper.linkArxiv}}` : ""}
}`;
}

export default function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const feedPapers = useFeedStore((s) => s.papers);
  const savedPapers = useFeedStore((s) => s.savedPapers);
  const markRead = useFeedStore((s) => s.markRead);
  const { savePaper, notInterestedPaper, moreLikePaper } = useFeedStore();

  const paper =
    feedPapers.find((p) => p.id === id) ??
    savedPapers.find((p) => p.id === id) ??
    mockPapers.find((p) => p.id === id);

  useEffect(() => {
    if (paper) markRead(paper.id);
  }, [paper, markRead]);

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
  const daysOld = paper.publishedDate
    ? Math.floor(
        (Date.now() - new Date(paper.publishedDate).getTime()) / 86_400_000,
      )
    : null;
  const isRecent = daysOld !== null && daysOld <= 90;
  const [leadSentence, tailSentences] = splitFirstSentence(
    paper.summaryResultDiscussion,
  );

  const handleDismiss = () => {
    notInterestedPaper(paper);
    window.history.back();
  };

  return (
    <>
      <ScrollProgress />
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
            {paper.title}
          </h1>

          <p
            className="text-text-muted mt-3 text-[14.5px] leading-[1.7]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {paper.authors.map((author, i) => (
              <span key={author}>
                <Link
                  href={`/?q=${encodeURIComponent(author)}`}
                  className="hover:text-heading hover:underline decoration-accent/50 underline-offset-4 transition-colors"
                >
                  {author}
                </Link>
                {i < paper.authors.length - 1 && ", "}
              </span>
            ))}
          </p>
        </header>

        {/* ── Property strip: dense decision facts ── */}
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
            <Property icon={<IconBook />} label="Venue">
              <Link
                href={`/?q=${encodeURIComponent(paper.venue)}`}
                className="hover:text-accent transition-colors"
              >
                {paper.venue}
              </Link>
            </Property>
            {publishedLabel && (
              <Property icon={<IconCalendar />} label="Published">
                {publishedLabel}
              </Property>
            )}
            <Property icon={<IconClock />} label="Read time">
              {readMinutes} min
            </Property>
            <Property icon={<IconUsers />} label="Authors">
              {paper.authors.length}
            </Property>
            <Property icon={<IconCode />} label="Code">
              {paper.linkCode ? (
                <span className="text-tag">Available</span>
              ) : (
                <span className="text-text-faint">—</span>
              )}
            </Property>
          </PropertyStrip>
        </div>

        {/* ── Primary action row ── */}
        <ActionRow
          arxivUrl={arxivUrl}
          paper={paper}
          onSave={() => savePaper(paper)}
          onDismiss={handleDismiss}
          isSaved={paper.isSaved}
        />

        {/* ── Why this fits you — accent callout ── */}
        <div
          className="mt-10 animate-fade-in-up"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <Callout
            variant="accent"
            icon={<IconStar />}
            title="Why this fits you"
          >
            {paper.relevanceReason}
          </Callout>
        </div>

        {/* ── Introduction ── */}
        <SectionTitle icon={<IconSparkle />} index={4}>
          What it proposes
        </SectionTitle>
        <p
          className="text-[17px] text-text leading-[1.75]"
          style={{ fontFamily: "var(--font-reading)" }}
        >
          {paper.summaryIntro}
        </p>

        {/* ── Experiment keywords ── */}
        <SectionTitle icon={<IconFlask />} index={5}>
          Methods & techniques
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          {paper.summaryExperimentKeywords.map((kw) => (
            <Tag key={kw} href={`/?q=${encodeURIComponent(kw)}`}>
              {kw}
            </Tag>
          ))}
        </div>

        {/* ── Results: lead sentence as pull quote ── */}
        <SectionTitle icon={<IconChart />} index={6}>
          Key result
        </SectionTitle>
        <PullQuote>{leadSentence}</PullQuote>
        {tailSentences && (
          <p
            className="text-[16px] text-text-muted leading-[1.7] mt-2"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            {tailSentences}
          </p>
        )}

        {/* ── Quick signals ── */}
        <SectionTitle icon={<IconCheck />} index={7}>
          At a glance
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Signal ok={!!paper.linkArxiv}>On arXiv</Signal>
          <Signal ok={!!paper.linkCode}>Code public</Signal>
          <Signal ok={isRecent}>
            {isRecent ? "Recent (≤90d)" : "Older paper"}
          </Signal>
          <Signal ok={paper.authors.length <= 10}>
            {paper.authors.length <= 3
              ? "Small team"
              : paper.authors.length <= 10
                ? "Medium team"
                : "Large team"}
          </Signal>
        </div>

        {/* ── Explore further ── */}
        <SectionTitle icon={<IconLink />} index={8}>
          Explore further
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          {showPaperLink && (
            <LinkChip label="Publisher site" href={paper.linkPaper} />
          )}
          <LinkChip label="Google Scholar" href={scholarUrl} />
          <LinkChip
            label={paper.linkCode ? "Source code" : "Search code"}
            href={codeUrl}
          />
        </div>

        {/* ── Train feed ── */}
        <div
          className="mt-12 pt-6 border-t border-border animate-fade-in-up"
          style={{ "--i": 9 } as React.CSSProperties}
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

        {/* ── Related ── */}
        {related.length > 0 && (
          <section
            className="mt-14 animate-fade-in-up"
            style={{ "--i": 10 } as React.CSSProperties}
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
    </>
  );
}

// ── Section title with icon + index fade-in ──

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

// ── Scroll progress bar (fixed at top) ──

function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? (scrolled / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div
      className="fixed top-0 inset-x-0 z-[60] h-[2px] bg-transparent pointer-events-none lg:left-52"
      aria-hidden
    >
      <div
        className="h-full bg-accent/90 transition-[width] duration-100 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Primary action row ──

function ActionRow({
  arxivUrl,
  paper,
  onSave,
  onDismiss,
  isSaved,
}: {
  arxivUrl: string;
  paper: Paper;
  onSave: () => void;
  onDismiss: () => void;
  isSaved: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(buildBibTeX(paper));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="flex items-center flex-wrap gap-2.5 mt-6 animate-fade-in-up"
      style={{
        "--i": 2,
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
        onClick={handleCopyCitation}
        aria-label="Copy citation"
        title="Copy BibTeX to clipboard"
        className="group inline-flex items-center gap-1.5 h-11 pl-3.5 pr-4 rounded-full text-[13.5px] font-medium bg-transparent border border-border-strong text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover transition-all duration-200 ease-out active:scale-[0.96]"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300 ease-out group-hover:-translate-y-[1px]"
          aria-hidden
        >
          {copied ? (
            <path d="M5 12l5 5L20 7" />
          ) : (
            <>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </>
          )}
        </svg>
        {copied ? "Copied" : "Cite"}
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

// ── Icons (12×12 stroke) ──

function IconBullseye() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
      <path d="M4 19.5V21h16" />
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

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20c0-2.5-1.5-4.5-4-5.5" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16" />
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

function IconSparkle() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

function IconFlask() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l-5-9V3" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21V9M9 21V5M15 21v-8M21 21V3" />
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

function IconLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}
