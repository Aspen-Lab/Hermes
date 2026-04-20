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
      className="group block rounded-2xl bg-surface shadow-card p-7 animate-fade-in-up transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover hover:-translate-y-[2px] active:translate-y-0 active:shadow-card"
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-[19px] font-semibold text-heading leading-snug tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {paper.title}
        </h3>
        <Relevance score={paper.relevanceScore} />
      </div>

      <p
        className="text-[13.5px] text-text-muted mt-2.5"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {paper.authors.slice(0, 3).join(", ")}
        {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3.5">
        <Tag>{paper.venue}</Tag>
      </div>

      <p className="text-[15.5px] text-text-muted mt-4 leading-[1.65] line-clamp-2">
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
