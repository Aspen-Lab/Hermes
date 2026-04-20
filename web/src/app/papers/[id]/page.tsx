"use client";

import { use } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { mockPapers } from "@/data/mock";
import { Tag, DetailSection, LinkRow, ActionBar, Relevance } from "@/components/ui";

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

  if (!paper) {
    return (
      <article className="mx-auto max-w-[720px] px-6 py-20">
        <p className="text-text-muted italic">Paper not found.</p>
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
          {paper.title}
        </h1>
        <p
          className="text-text-muted mt-3 text-[14.5px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {paper.authors.join(", ")}
        </p>
        <div className="flex items-center flex-wrap gap-2.5 mt-4">
          <Tag>{paper.venue.toLowerCase().replace(/\s+/g, "-")}</Tag>
          <Tag>{paper.source}</Tag>
          <Relevance score={paper.relevanceScore} />
        </div>
      </header>

      <DetailSection title="Why this fits you">
        {paper.relevanceReason}
      </DetailSection>

      <DetailSection title="Introduction">
        {paper.summaryIntro}
      </DetailSection>

      <DetailSection title="Experiment keywords">
        <div className="flex flex-wrap gap-2">
          {paper.summaryExperimentKeywords.map((kw) => (
            <Tag key={kw}>{kw}</Tag>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Results & Discussion">
        {paper.summaryResultDiscussion}
      </DetailSection>

      {(() => {
        const q = encodeURIComponent(paper.title);
        const arxivUrl = paper.linkArxiv || `https://arxiv.org/search/?query=${q}`;
        const scholarUrl = paper.linkScholar || `https://scholar.google.com/scholar?q=${q}`;
        const codeUrl = paper.linkCode || `https://github.com/search?q=${q}&type=repositories`;
        const showPaper = paper.linkPaper && paper.linkPaper !== paper.linkArxiv;
        return (
          <DetailSection title="Links">
            <div className="flex flex-wrap">
              {showPaper && <LinkRow label="Paper" href={paper.linkPaper} />}
              <LinkRow label="arXiv" href={arxivUrl} />
              <LinkRow label="Scholar" href={scholarUrl} />
              <LinkRow label={paper.linkCode ? "Code" : "Search code"} href={codeUrl} />
            </div>
          </DetailSection>
        );
      })()}

      <div className="mt-10 pt-5 border-t border-border">
        <ActionBar
          onSave={() => savePaper(paper)}
          onDismiss={() => { notInterestedPaper(paper); window.history.back(); }}
          onMore={() => moreLikePaper(paper)}
          isSaved={paper.isSaved}
        />
      </div>
    </article>
  );
}
