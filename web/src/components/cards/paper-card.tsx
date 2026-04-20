"use client";

import Link from "next/link";
import type { Paper } from "@/types";
import { useFeedStore } from "@/store/feed";
import { Tag, Relevance, ActionBar } from "@/components/ui";

export function PaperCard({ paper }: { paper: Paper }) {
  const { savePaper, notInterestedPaper, moreLikePaper } = useFeedStore();

  return (
    <Link
      href={`/papers/${paper.id}`}
      className="block rounded-xl bg-surface border border-border p-6 hover:border-border-strong hover:bg-surface-hover transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[17px] font-semibold text-heading leading-snug tracking-tight">
          {paper.title}
        </h3>
        <Relevance score={paper.relevanceScore} />
      </div>

      <p className="text-[14px] text-text-muted mt-2">
        {paper.authors.slice(0, 3).join(", ")}
        {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3">
        <Tag>{paper.venue.toLowerCase().replace(/\s+/g, "-")}</Tag>
        <Tag>{paper.source}</Tag>
      </div>

      <p className="text-[15px] text-text-muted mt-4 leading-relaxed line-clamp-2" style={{ fontFamily: "var(--font-reading)" }}>
        {paper.relevanceReason}
      </p>

      <ActionBar
        onSave={() => savePaper(paper)}
        onDismiss={() => notInterestedPaper(paper)}
        onMore={() => moreLikePaper(paper)}
        isSaved={paper.isSaved}
      />
    </Link>
  );
}
