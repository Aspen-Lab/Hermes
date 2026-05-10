"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import type { Paper } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { mockPapers } from "@/data/mock";
import {
  buildFallbackPaperReport,
  isPaperReviewLike,
  reviewPaperLabel,
  type PaperReport,
} from "@/lib/papers/report";
import {
  Tag,
  LinkChip,
  Callout,
  PropertyStrip,
  Property,
  PullQuote,
  FactChip,
} from "@/components/ui";
import { BriefingQuickHit } from "@/components/cards/briefing-quick-hit";
import {
  PaperFigure,
} from "@/components/paper-figure";

const WORDS_PER_MINUTE = 220;

function wordCount(...parts: (string | undefined)[]): number {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function figureQuery(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
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

function relativeTimeFromDays(days: number): string {
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = days / 365;
  if (years < 1.5) return "1 year ago";
  return `${years.toFixed(1).replace(/\.0$/, "")} years ago`;
}

function teamSizeLabel(n: number): string {
  if (n === 1) return "Solo author";
  if (n <= 3) return `${n} authors · small team`;
  if (n <= 10) return `${n} authors`;
  return `${n} authors · large team`;
}

// Wraps occurrences of `required` and `soft` keywords in colored pill spans.
// Longest keywords are matched first to avoid partial-word collisions.
function highlightKeywords(
  text: string,
  required: string[],
  soft: string[],
): React.ReactNode[] {
  type Hit = { start: number; end: number; tone: "required" | "soft" };
  const candidates = [
    ...required.filter((k) => k.trim().length >= 3).map((k) => ({ kw: k.trim(), tone: "required" as const })),
    ...soft.filter((k) => k.trim().length >= 3).map((k) => ({ kw: k.trim(), tone: "soft" as const })),
  ].sort((a, b) => b.kw.length - a.kw.length);

  const lower = text.toLowerCase();
  const hits: Hit[] = [];
  for (const { kw, tone } of candidates) {
    const kl = kw.toLowerCase();
    let i = 0;
    while (i <= lower.length - kl.length) {
      const pos = lower.indexOf(kl, i);
      if (pos === -1) break;
      if (!hits.some((h) => pos < h.end && pos + kl.length > h.start)) {
        hits.push({ start: pos, end: pos + kl.length, tone });
      }
      i = pos + 1;
    }
  }
  if (hits.length === 0) return [text];

  hits.sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const { start, end, tone } of hits) {
    if (cursor < start) nodes.push(text.slice(cursor, start));
    const cls =
      tone === "required"
        ? "inline-block px-1.5 py-0.5 rounded bg-accent-dim text-accent text-[0.875em] font-medium border border-accent/20 mx-0.5 leading-normal"
        : "inline-block px-1.5 py-0.5 rounded bg-tag-dim text-tag text-[0.875em] font-medium border border-tag/20 mx-0.5 leading-normal";
    nodes.push(
      <span key={`kw-${start}`} className={cls}>
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
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

// Read per-paper AI extracts (headlineFinding, keyNumbers) from the
// locally cached digest. Silently returns null if no cache or paper not found.
function readPerPaperDigest(paperId: string): {
    headlineFinding?: string;
    keyNumbers?: { value: string; label: string }[];
  } | null {
  if (!paperId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("hermes-digest-cache");
    if (!raw) return null;
    const entry = JSON.parse(raw) as {
      payload?: { perPaper?: Record<string, unknown> };
    };
    const perPaper = entry?.payload?.perPaper?.[paperId];
    if (perPaper && typeof perPaper === "object") {
      return perPaper as {
        headlineFinding?: string;
        keyNumbers?: { value: string; label: string }[];
      };
    }
  } catch {
    /* noop */
  }
  return null;
}

export default function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = (() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  })();
  const isExternalId =
    id.startsWith("openalex:") || id.startsWith("arxiv:");

  const feedPapers = useFeedStore((s) => s.papers);
  const savedPapers = useFeedStore((s) => s.savedPapers);
  const markRead = useFeedStore((s) => s.markRead);
  const { savePaper, notInterestedPaper, moreLikePaper } = useFeedStore();
  const profile = useProfileStore((s) => s.profile);

  const [fetchResult, setFetchResult] = useState<{
    id: string;
    paper: Paper | null;
    done: boolean;
  }>(() => ({ id, paper: null, done: false }));
  const [reportResult, setReportResult] = useState<{
    key: string;
    report: PaperReport | null;
    done: boolean;
  }>(() => ({ key: "", report: null, done: false }));

  const storePaper =
    feedPapers.find((p) => p.id === id) ??
    savedPapers.find((p) => p.id === id) ??
    mockPapers.find((p) => p.id === id);

  // Many publishers (Nature/Science/etc.) don't share abstracts with OpenAlex,
  // so the storePaper may have an empty summaryIntro. In that case, prefer
  // the API-fetched paper, which enriches missing abstracts via Semantic Scholar.
  const storePaperIsEnriched = !!storePaper?.summaryIntro?.trim();
  const fetchedPaperForId = fetchResult.id === id ? fetchResult.paper : null;
  const fetchDoneForId = fetchResult.id === id && fetchResult.done;
  const paper = storePaperIsEnriched
    ? storePaper
    : (fetchedPaperForId ?? storePaper ?? undefined);
  const shouldFetchById = isExternalId && !storePaperIsEnriched && !fetchDoneForId;
  const isFetchingById = shouldFetchById;

  useEffect(() => {
    if (!shouldFetchById) return;
    let cancelled = false;
    fetch(`/api/papers/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? (res.json() as Promise<Paper>) : null))
      .then((p) => {
        if (!cancelled) setFetchResult({ id, paper: p, done: true });
      })
      .catch(() => {
        if (!cancelled) setFetchResult({ id, paper: null, done: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, shouldFetchById]);

  useEffect(() => {
    if (paper) markRead(paper.id);
  }, [paper, markRead]);

  const perPaperDigest = useMemo(
    () => readPerPaperDigest(paper?.id ?? ""),
    [paper?.id],
  );
  const contextHint = useMemo(
    () =>
      [
        profile.currentProject,
        profile.currentChallenges,
        profile.researchTopics.length > 0
          ? `Topics: ${profile.researchTopics.join(", ")}`
          : undefined,
        profile.preferredMethods.length > 0
          ? `Methods: ${profile.preferredMethods.join(", ")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    [
      profile.currentProject,
      profile.currentChallenges,
      profile.researchTopics,
      profile.preferredMethods,
    ],
  );
  const reportKey = paper ? `${paper.id}|${contextHint}` : "";
  const fallbackReport = useMemo(
    () => (paper ? buildFallbackPaperReport(paper, contextHint) : null),
    [paper, contextHint],
  );
  const reportDone = Boolean(
    paper && reportResult.key === reportKey && reportResult.done,
  );
  const report =
    reportDone && reportResult.report
      ? reportResult.report
      : reportDone
        ? fallbackReport
        : null;
  const reportLoading = Boolean(paper && !reportDone);

  useEffect(() => {
    if (!paper || reportResult.key === reportKey) return;
    let cancelled = false;
    fetch("/api/papers/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper, contextHint }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<PaperReport>) : null))
      .then((nextReport) => {
        if (!cancelled) {
          setReportResult({ key: reportKey, report: nextReport, done: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReportResult({ key: reportKey, report: null, done: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paper, contextHint, reportKey, reportResult.key]);

  const related = useMemo(() => {
    if (!paper) return [];
    const pool = feedPapers.length > 0 ? feedPapers : mockPapers;
    return pickRelated(paper, pool, 3);
  }, [paper, feedPapers]);

  if (!paper) {
    if (isFetchingById) {
      return (
        <article className="mx-auto max-w-[760px] px-4 sm:px-6 py-10 sm:py-14">
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
          <BriefingSkeleton />
        </article>
      );
    }
    return (
      <article className="mx-auto max-w-[720px] px-6 py-20 animate-fade-in-up">
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

  const primaryUrl = paper.linkArxiv ?? paper.linkPaper ?? arxivUrl;
  const primaryLabel = paper.linkArxiv
    ? "Read on arXiv"
    : paper.linkPaper
      ? `Read on ${paper.venue || "source"}`
      : "Search arXiv";
  const figureSourceUrl = paper.linkArxiv ?? paper.linkPaper;
  const methodFigureQuery = figureQuery(
    report?.whatItProposes.summary,
    report?.whatItProposes.methods.join(" "),
  );

  const matchPct = paper.relevanceScore
    ? Math.round(Math.max(0, Math.min(1, paper.relevanceScore)) * 100)
    : null;
  const publishedLabel = formatPublishedDate(paper.publishedDate);
  const readMinutes = readingTimeMinutes(paper);
  const daysOld = paper.publishedDate
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(paper.publishedDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;
  const isRecent = daysOld !== null && daysOld < 30;
  const isLiked =
    paper.feedback === "moreLikeThis" || paper.feedback === "liked";
  const isReviewPaper = isPaperReviewLike(paper);
  const reviewLabel = reviewPaperLabel(paper);

  const handleDismiss = () => {
    notInterestedPaper(paper);
    window.history.back();
  };

  return (
    <>
      <ScrollProgress />
      <article className="mx-auto max-w-[760px] px-4 sm:px-6 py-10 sm:py-14">

        {/* ── Back ── */}
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

        {/* ── Title & Authors ── */}
        <header
          className="mt-8 animate-fade-in-up"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          {reviewLabel && (
            <span
              className="inline-block mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-md bg-tag-dim text-tag border border-tag/20"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {reviewLabel}
            </span>
          )}
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
            <Property icon={<IconBook />} label="Journal">
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

        {/* ── Action row: Read · Save · Cite · Like · Not interested ── */}
        <ActionRow
          primaryUrl={primaryUrl}
          primaryLabel={primaryLabel}
          paper={paper}
          onSave={() => savePaper(paper)}
          onLike={() => moreLikePaper(paper)}
          onDismiss={handleDismiss}
          isSaved={paper.isSaved}
          isLiked={isLiked}
        />

        {/* ════════════════════════════════════════
            SECTION 1 — WHAT IT PROPOSES
            ════════════════════════════════════════ */}
        <SectionTitle icon={<IconSparkle />} index={3}>
          What it proposes
        </SectionTitle>

        <ReportFigureRow
          title="Method and proposal"
          body={report?.whatItProposes.summary}
          bullets={report?.whatItProposes.methods}
          loading={reportLoading}
          figure={
            reportLoading ? (
              <FigureLoadingFrame />
            ) : (
              <PaperFigure
              itemId={paper.id}
                url={figureSourceUrl}
                doi={paper.doi}
                query={methodFigureQuery}
                paperTitle={paper.title}
              alt={`${paper.title} — method figure`}
                variant="compact"
                figureIndex={0}
                hideOnMiss={false}
              />
            )
          }
        />

        {/* ════════════════════════════════════════
            SECTION 2 — RESULTS & SIGNIFICANCE  /  PAPER CONTENTS & HIGHLIGHT
            ════════════════════════════════════════ */}
        {isReviewPaper ? (
          <>
            <SectionTitle icon={<IconBook />} index={4}>
              Paper contents &amp; highlight
            </SectionTitle>

            <div className="mt-5 space-y-3">
              {reportLoading && [1, 2, 3].map((i) => (
                <div key={`loading-review-${i}`} className="rounded-2xl border border-border-strong bg-surface px-5 py-4 shadow-card space-y-3">
                  <ShimmerBar width="40%" height="h-3" />
                  <ShimmerBar width="92%" />
                  <ShimmerBar width="78%" />
                </div>
              ))}
              {!reportLoading && (report?.reviewContents?.sections ?? []).map((section, index) => (
                <div
                  key={`${section.heading}-${index}`}
                  className="rounded-2xl border border-border-strong bg-surface px-5 py-4 shadow-card"
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint mb-1"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {section.heading}
                  </p>
                  <p
                    className="text-[15px] text-text leading-[1.68] break-words"
                    style={{ fontFamily: "var(--font-reading)" }}
                  >
                    {section.summary}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <SectionTitle icon={<IconChart />} index={4}>
              Results & significance
            </SectionTitle>

            <PullQuote>
              {reportLoading
                ? "Preparing the final report from the paper metadata and your profile."
                : perPaperDigest?.headlineFinding ||
                report?.resultsAndSignificance.summary ||
                paper.relevanceReason}
            </PullQuote>

            <div className="mt-5 space-y-5">
              {reportLoading && [1, 2].map((figureIndex) => (
                <ReportFigureRow
                  key={`loading-result-${figureIndex}`}
                  title={`Key result ${figureIndex}`}
                  loading
                  figure={<FigureLoadingFrame />}
                />
              ))}
              {!reportLoading && (report?.resultsAndSignificance.keyResults ?? []).map((result, index) => (
                <ReportFigureRow
                  key={`${result.title}-${index}`}
                  title={result.title}
                  body={result.detail}
                  figure={
                    <PaperFigure
                      itemId={paper.id}
                      url={figureSourceUrl}
                      doi={paper.doi}
                      query={figureQuery(result.title, result.detail)}
                      paperTitle={paper.title}
                      alt={`${paper.title} — ${result.title}`}
                      variant="compact"
                      figureIndex={result.figureIndex}
                      hideOnMiss={false}
                    />
                  }
                />
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            SECTION 3 — WHY IT FITS YOU
            ════════════════════════════════════════ */}
        <SectionTitle icon={<IconStar />} index={5}>
          Why it fits you
        </SectionTitle>

        <div className="rounded-2xl border border-accent/20 bg-accent-dim px-5 py-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent mb-3 flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <IconBullseye />
            Relevance
          </p>
          {reportLoading ? (
            <div className="space-y-2.5" aria-busy="true">
              <ShimmerBar width="90%" />
              <ShimmerBar width="76%" />
              <ShimmerBar width="82%" />
            </div>
          ) : (
            <ul className="space-y-2">
              {(report?.whyItFitsYou.reasons ?? [paper.relevanceReason]).filter(Boolean).map((reason, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[15px] text-text leading-[1.65]"
                  style={{ fontFamily: "var(--font-reading)" }}
                >
                  <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full bg-accent/60" aria-hidden />
                  <span>{highlightKeywords(reason, profile.researchTopics, profile.softTopics ?? [])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Keywords that correlate to the user's profile */}
        {!reportLoading && ((report?.whyItFitsYou.keywords.length ?? 0) > 0 ||
          paper.summaryExperimentKeywords.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {(report?.whyItFitsYou.keywords.length
              ? report.whyItFitsYou.keywords
              : paper.summaryExperimentKeywords
            ).slice(0, 8).map((kw) => (
              <Tag key={kw} href={`/?q=${encodeURIComponent(kw)}`}>
                {kw}
              </Tag>
            ))}
          </div>
        )}

        {/* ── Quick signals ── */}
        <SectionTitle icon={<IconCheck />} index={7}>
          At a glance
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          {paper.linkArxiv && (
            <FactChip icon={<IconArxivDoc />} tone="accent">Preprint on arXiv</FactChip>
          )}
          {paper.linkCode && (
            <FactChip icon={<IconCode />} tone="tag">Code available</FactChip>
          )}
          {daysOld !== null && (
            <FactChip icon={<IconClock />} tone={isRecent ? "tag" : "muted"}>
              {relativeTimeFromDays(daysOld)}
            </FactChip>
          )}
          <FactChip icon={<IconUsers />} tone="neutral">
            {teamSizeLabel(paper.authors.length)}
          </FactChip>
        </div>

        {/* ── Explore further ── */}
        <SectionTitle icon={<IconLink />} index={8}>
          Explore further
        </SectionTitle>

        <div className="flex flex-wrap gap-2">
          <LinkChip label={primaryLabel} href={primaryUrl} />
          {showPaperLink && (
            <LinkChip
              icon={<IconDoc />}
              label="Publisher site"
              href={paper.linkPaper}
            />
          )}
          <LinkChip
            icon={<IconScholar />}
            label="Google Scholar"
            href={scholarUrl}
          />
          <LinkChip
            icon={<IconCode />}
            label={paper.linkCode ? "Source code" : "Search code"}
            href={codeUrl}
          />
        </div>

        {reportLoading && (
          <p
            className="mt-3 text-[12px] text-text-faint"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Refining report with AI…
          </p>
        )}

        {/* ── Train feed ── */}
        <div
          className="mt-12 pt-6 border-t border-border animate-fade-in-up flex items-center gap-3 flex-wrap"
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
            More like this
          </button>
          <span
            className="text-[12.5px] text-text-faint"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Tomorrow&rsquo;s briefing leans toward this paper&rsquo;s topics, methods, and venue.
          </span>
        </div>

        {/* ── Related from your feed ── */}
        {related.length > 0 && (
          <section
            className="mt-14 animate-fade-in-up"
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
    </>
  );
}

// ── Section title ──────────────────────────────────────────────

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
    <h2
      className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint mt-10 mb-3 animate-fade-in-up"
      style={{
        "--i": index,
        fontFamily: "var(--font-sans)",
      } as React.CSSProperties}
    >
      {icon}
      {children}
    </h2>
  );
}

function ReportFigureRow({
  title,
  body,
  bullets,
  figure,
  loading = false,
}: {
  title: string;
  body?: string;
  bullets?: string[];
  figure: React.ReactNode;
  loading?: boolean;
}) {
  const visibleBullets = (bullets ?? []).filter(Boolean).slice(0, 5);
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border-strong bg-surface px-5 py-4 shadow-card">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint mb-2"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {title}
        </p>
        {loading ? (
          <div className="space-y-3 pt-2" aria-busy="true">
            <ShimmerBar width="96%" />
            <ShimmerBar width="88%" />
            <ShimmerBar width="74%" />
            <div className="pt-3 space-y-2">
              <ShimmerBar width="52%" height="h-3" />
              <ShimmerBar width="44%" height="h-3" />
            </div>
          </div>
        ) : (
          <p
            className="text-[16px] text-text leading-[1.72] break-words"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            {body || "Hermes could not extract enough text from the available metadata. Open the paper link for the full report source."}
          </p>
        )}
        {!loading && visibleBullets.length > 0 && (
          <ol
            className="mt-4 space-y-2 text-[14px] text-text-muted leading-[1.55] list-decimal list-inside"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {visibleBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ol>
        )}
      </div>
      <div className="has-[.figure-hidden]:hidden">{figure}</div>
    </div>
  );
}

// ── Scroll progress bar ────────────────────────────────────────

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

// ── Action row ─────────────────────────────────────────────────
// Read · Save · Cite  |  Like · Not interested

function ActionRow({
  primaryUrl,
  primaryLabel,
  paper,
  onSave,
  onLike,
  onDismiss,
  isSaved,
  isLiked,
}: {
  primaryUrl: string;
  primaryLabel: string;
  paper: Paper;
  onSave: () => void;
  onLike: () => void;
  onDismiss: () => void;
  isSaved: boolean;
  isLiked: boolean;
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
      className="flex items-center flex-wrap gap-2 mt-6 animate-fade-in-up"
      style={{
        "--i": 2,
        fontFamily: "var(--font-sans)",
      } as React.CSSProperties}
    >
      {/* Primary: read paper */}
      <a
        href={primaryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-accent text-bg text-[13.5px] sm:text-[14px] font-semibold shadow-card hover:shadow-card-hover hover:bg-accent/90 transition-all duration-200 ease-out active:scale-[0.97]"
      >
        {primaryLabel}
        <span className="text-[11px] opacity-90 transition-transform duration-200 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[1px]">
          ↗
        </span>
      </a>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Saved" : "Save"}
        className={`group inline-flex items-center gap-1.5 h-9 sm:h-11 pl-3 pr-3.5 sm:pl-3.5 sm:pr-4 rounded-full text-[12.5px] sm:text-[13.5px] font-medium transition-all duration-200 ease-out active:scale-[0.96] ${
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
          aria-hidden
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {isSaved ? "Saved" : "Save"}
      </button>

      {/* Cite (BibTeX) */}
      <button
        type="button"
        onClick={handleCopyCitation}
        aria-label="Copy BibTeX citation"
        title="Copy BibTeX to clipboard"
        className="group inline-flex items-center gap-1.5 h-9 sm:h-11 pl-3 pr-3.5 sm:pl-3.5 sm:pr-4 rounded-full text-[12.5px] sm:text-[13.5px] font-medium bg-transparent border border-border-strong text-text-muted hover:text-heading hover:border-heading/35 hover:bg-surface-hover transition-all duration-200 ease-out active:scale-[0.96]"
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

      {/* Spacer */}
      <span className="flex-1" aria-hidden />

      {/* Like */}
      <button
        type="button"
        onClick={onLike}
        aria-pressed={isLiked}
        aria-label="Like — train feed on this"
        className={`group inline-flex items-center gap-1.5 h-9 sm:h-11 pl-3 pr-3.5 sm:pl-3.5 sm:pr-4 rounded-full text-[12.5px] sm:text-[13.5px] font-medium border transition-all duration-200 ease-out active:scale-[0.96] ${
          isLiked
            ? "bg-accent/10 text-accent border-accent/40"
            : "bg-transparent border-border-strong text-text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-dim"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={isLiked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M7 10v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3zM7 10l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 19H7" />
        </svg>
        {isLiked ? "Liked" : "Like"}
      </button>

      {/* Not interested */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Not interested — show less like this"
        title="Not interested"
        className="group inline-flex items-center gap-1.5 h-9 sm:h-11 pl-3 pr-3.5 sm:pl-3.5 sm:pr-4 rounded-full text-[12.5px] sm:text-[13.5px] font-medium bg-transparent border border-border-strong text-text-muted hover:text-red hover:border-red/40 hover:bg-red/5 transition-all duration-200 ease-out active:scale-[0.96]"
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
          aria-hidden
        >
          <path d="M17 14V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zM17 14l-4 7a2 2 0 0 1-2-2v-3H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 5H17" />
        </svg>
        Not interested
      </button>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────

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

function IconChart() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21V9M9 21V5M15 21v-8M21 21V3" />
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

function IconArxivDoc() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function IconScholar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 10l10-5 10 5-10 5L2 10z" />
      <path d="M6 12v5a6 6 0 0 0 12 0v-5" />
      <path d="M22 10v6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

// ── Briefing skeleton ──
// Loading state that mirrors the real briefing's geometry so the page doesn't
// jump when content arrives. Staggered fade-in + shimmering bars.

function ShimmerBar({
  width,
  height = "h-4",
  rounded = "rounded-md",
}: {
  width: string;
  height?: string;
  rounded?: string;
}) {
  return (
    <div className={`${height} ${rounded} skeleton-shimmer`} style={{ width }} />
  );
}

function FigureLoadingFrame() {
  return (
    <div className="mt-5 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-bg-secondary/50 p-4">
      <div className="h-full rounded-xl border border-border bg-surface px-4 py-4">
        <div className="space-y-3">
          <ShimmerBar width="38%" height="h-3" />
          <ShimmerBar width="96%" height="h-4" />
          <ShimmerBar width="84%" height="h-4" />
          <ShimmerBar width="66%" height="h-4" />
        </div>
      </div>
    </div>
  );
}

function BriefingSkeleton() {
  return (
    <div className="mt-10" aria-busy="true" aria-label="Loading briefing">
      <div className="animate-fade-in-up space-y-3" style={{ "--i": 0 } as React.CSSProperties}>
        <ShimmerBar width="88%" height="h-8" />
        <ShimmerBar width="62%" height="h-8" />
      </div>
      <div className="mt-5 animate-fade-in-up" style={{ "--i": 1 } as React.CSSProperties}>
        <ShimmerBar width="55%" height="h-4" />
      </div>
      <div className="mt-8 grid grid-cols-4 gap-6 animate-fade-in-up" style={{ "--i": 2 } as React.CSSProperties}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <ShimmerBar width="55%" height="h-3" />
            <ShimmerBar width="85%" height="h-5" />
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-2xl bg-surface shadow-card p-6 space-y-3 animate-fade-in-up" style={{ "--i": 3 } as React.CSSProperties}>
        <ShimmerBar width="22%" height="h-3" />
        <ShimmerBar width="96%" />
        <ShimmerBar width="80%" />
      </div>
      <div className="mt-10 space-y-3 animate-fade-in-up" style={{ "--i": 4 } as React.CSSProperties}>
        <ShimmerBar width="100%" />
        <ShimmerBar width="95%" />
        <ShimmerBar width="88%" />
        <ShimmerBar width="78%" />
      </div>
    </div>
  );
}
