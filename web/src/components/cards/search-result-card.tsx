"use client";

import { Tag } from "@/components/ui";

interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  venue: string;
  publishedDate: string | null;
  citationCount: number;
  doi: string | null;
  url: string;
  source: string;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl bg-surface border border-border p-6 hover:border-border-strong hover:bg-surface-hover transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[17px] font-semibold text-heading leading-snug tracking-tight flex-1">
          {result.title}
        </h3>
        {result.citationCount > 0 && (
          <span className="font-mono text-[12px] text-yellow whitespace-nowrap">
            {result.citationCount.toLocaleString()} cited
          </span>
        )}
      </div>

      <p className="text-[14px] text-text-muted mt-2">
        {result.authors.slice(0, 4).join(", ")}
        {result.authors.length > 4 && ` +${result.authors.length - 4}`}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3">
        {result.venue && (
          <Tag>{result.venue.length > 35 ? result.venue.slice(0, 35) + "..." : result.venue}</Tag>
        )}
        {result.publishedDate && (
          <span className="font-mono text-[12px] text-text-faint">
            {fmtDate(result.publishedDate)}
          </span>
        )}
      </div>

      {result.abstract && (
        <p className="text-[15px] text-text-muted mt-4 leading-relaxed line-clamp-3" style={{ fontFamily: "var(--font-reading)" }}>
          {result.abstract}
        </p>
      )}
    </a>
  );
}
