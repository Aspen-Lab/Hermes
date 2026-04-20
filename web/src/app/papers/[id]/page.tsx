"use client";

import { use } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { mockPapers } from "@/data/mock";
import { Tag, DetailSection, LinkRow, ActionBar } from "@/components/ui";

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
      <article className="mx-auto max-w-[720px] px-6 py-16">
        <p className="text-text-muted italic">Paper not found.</p>
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
          {paper.title}
        </h1>
        <p className="text-text-muted mt-2">
          {paper.authors.join(", ")}
        </p>
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <Tag>{paper.venue.toLowerCase().replace(/\s+/g, "-")}</Tag>
          <Tag>{paper.source}</Tag>
          {paper.relevanceScore && (
            <span className="font-mono text-xs text-yellow">
              {Math.round(paper.relevanceScore * 100)}% match
            </span>
          )}
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

      <DetailSection title="Links">
        <div className="flex flex-wrap">
          <LinkRow label="Paper" href={paper.linkPaper} />
          <LinkRow label="arXiv" href={paper.linkArxiv} />
          <LinkRow label="Google Scholar" href={paper.linkScholar} />
          <LinkRow label="Code" href={paper.linkCode} />
        </div>
      </DetailSection>

      <div className="mt-8 pt-4 border-t border-border">
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
