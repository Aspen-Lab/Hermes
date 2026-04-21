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
      className="group block rounded-2xl bg-surface shadow-card p-7 animate-fade-in-up transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover hover:-translate-y-[2px] active:translate-y-0 active:shadow-card"
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-[19px] font-semibold text-heading leading-snug tracking-[-0.01em] flex-1"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {result.title}
        </h3>
        {result.citationCount > 0 && (
          <span
            className="text-[11.5px] text-text-faint whitespace-nowrap tabular-nums shrink-0"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {result.citationCount.toLocaleString()} cited
          </span>
        )}
      </div>

      <p
        className="text-[13.5px] text-text-muted mt-2.5"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {result.authors.slice(0, 4).join(", ")}
        {result.authors.length > 4 && ` +${result.authors.length - 4}`}
      </p>

      <div className="flex items-center flex-wrap gap-2 mt-3.5">
        {result.venue && (
          <Tag>{result.venue.length > 35 ? result.venue.slice(0, 35) + "..." : result.venue}</Tag>
        )}
        {result.publishedDate && (
          <span
            className="text-[11.5px] text-text-faint"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {fmtDate(result.publishedDate)}
          </span>
        )}
      </div>

      {result.abstract && (
        <p className="text-[15.5px] text-text-muted mt-4 leading-[1.65] line-clamp-2">
          {result.abstract}
        </p>
      )}
    </a>
  );
}
