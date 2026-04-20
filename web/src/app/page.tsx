"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useFeedStore } from "@/store/feed";
import { PaperCard } from "@/components/cards/paper-card";
import { EventCard } from "@/components/cards/event-card";
import { JobCard } from "@/components/cards/job-card";
import { SearchResultCard } from "@/components/cards/search-result-card";
import { SectionHeading, EmptyState, LoadingSkeleton } from "@/components/ui";
import type { Paper, Event, Job } from "@/types";

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

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function collectTags(papers: Paper[], events: Event[], jobs: Job[]) {
  const tags = new Map<string, number>();
  const bump = (t: string) => tags.set(t, (tags.get(t) || 0) + 1);
  papers.forEach((p) => {
    bump(p.source);
    bump(p.venue.toLowerCase().replace(/\s+/g, "-"));
  });
  events.forEach((e) => {
    bump(e.type);
    if (e.isOnline) bump("online");
  });
  jobs.forEach((j) => {
    if (j.isRemote) bump("remote");
    bump(j.companyOrLab.toLowerCase().replace(/\s+/g, "-"));
  });
  return [...tags.entries()].sort((a, b) => b[1] - a[1]);
}

export default function DiscoveryPage() {
  const { papers, events, jobs, isLoading, lastRefresh, loadFeed } =
    useFeedStore();

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (papers.length === 0 && !isLoading) loadFeed();
  }, [papers.length, isLoading, loadFeed]);

  const searchPapers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/papers/search?q=${encodeURIComponent(q)}&per_page=12`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearchTotal(data.total || 0);
    } catch {
      setSearchResults([]);
      setSearchTotal(0);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced API search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => searchPapers(query), 400);
    } else {
      setSearchResults([]);
      setSearchTotal(0);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchPapers]);

  const isSearchMode = query.length >= 2;

  const allTags = useMemo(
    () => collectTags(papers, events, jobs),
    [papers, events, jobs]
  );

  const filteredPapers = useMemo(() => {
    let result = papers;
    if (query && !isSearchMode) {
      result = result.filter((p) =>
        matchesQuery(query, p.title, p.authors.join(" "), p.venue, p.source, p.relevanceReason, p.summaryIntro)
      );
    }
    if (activeTag) {
      result = result.filter(
        (p) =>
          p.source === activeTag ||
          p.venue.toLowerCase().replace(/\s+/g, "-") === activeTag
      );
    }
    return result;
  }, [papers, query, activeTag, isSearchMode]);

  const filteredEvents = useMemo(() => {
    if (isSearchMode) return [];
    let result = events;
    if (query) {
      result = result.filter((e) =>
        matchesQuery(query, e.name, e.type, e.location, e.shortDescription, e.relevanceReason)
      );
    }
    if (activeTag) {
      result = result.filter(
        (e) =>
          e.type === activeTag ||
          (activeTag === "online" && e.isOnline)
      );
    }
    return result;
  }, [events, query, activeTag, isSearchMode]);

  const filteredJobs = useMemo(() => {
    if (isSearchMode) return [];
    let result = jobs;
    if (query) {
      result = result.filter((j) =>
        matchesQuery(query, j.roleTitle, j.companyOrLab, j.location, j.matchReason, j.keyRequirements.join(" "))
      );
    }
    if (activeTag) {
      result = result.filter(
        (j) =>
          j.companyOrLab.toLowerCase().replace(/\s+/g, "-") === activeTag ||
          (activeTag === "remote" && j.isRemote)
      );
    }
    return result;
  }, [jobs, query, activeTag, isSearchMode]);

  const totalFiltered = filteredPapers.length + filteredEvents.length + filteredJobs.length;
  const totalAll = papers.length + events.length + jobs.length;
  const isEmpty = !isLoading && totalAll === 0 && !isSearchMode;

  return (
    <article className="mx-auto max-w-[740px] lg:max-w-[880px] px-6 py-14">
      <header className="mb-6">
        <h1 className="font-mono text-2xl font-bold text-heading tracking-tight">
          {isSearchMode ? "Search" : "Daily Briefing"}
        </h1>
        <p className="text-text-muted mt-2 text-[16px]" style={{ fontFamily: "var(--font-reading)" }}>
          {isSearchMode
            ? "Search papers across OpenAlex \u2014 250M+ academic works."
            : "Personalized recommendations based on your research profile."}
        </p>
        {!isSearchMode && (
          <p className="font-mono text-[12px] text-text-faint mt-3">
            {lastRefresh
              ? new Date(lastRefresh).toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                  year: "numeric", hour: "2-digit", minute: "2-digit",
                })
              : "Not synced yet"}
          </p>
        )}
      </header>

      {/* ── Search ── */}
      <div className="mb-4">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveTag(null);
            }}
            placeholder="Search papers, events, jobs..."
            className="w-full bg-surface border border-border rounded-xl py-3 pl-11 pr-16 font-mono text-[14px] text-text placeholder:text-text-faint/60 focus:outline-none focus:border-accent/30 focus:ring-1 focus:ring-accent/15 transition-colors"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSearchResults([]);
                setSearchTotal(0);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted font-mono text-[12px] transition-colors"
            >
              clear
            </button>
          )}
        </div>

        {/* ── Tag filters (feed mode only) ── */}
        {!isSearchMode && allTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-4">
            <button
              onClick={() => setActiveTag(null)}
              className={`font-mono text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                !activeTag
                  ? "bg-accent-dim border-accent/20 text-accent"
                  : "border-border text-text-faint hover:text-text-muted hover:border-border-strong"
              }`}
            >
              all
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`font-mono text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                  activeTag === tag
                    ? "bg-accent-dim border-accent/20 text-accent"
                    : "border-border text-text-faint hover:text-text-muted hover:border-border-strong"
                }`}
              >
                #{tag}
                <span className="ml-1.5 opacity-40">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Search status ── */}
        {isSearchMode && (
          <p className="font-mono text-[12px] text-text-faint mt-3">
            {isSearching
              ? "searching..."
              : searchResults.length > 0
                ? `${searchResults.length} of ${searchTotal.toLocaleString()} results for \u201c${query}\u201d`
                : `no results for \u201c${query}\u201d`}
          </p>
        )}

        {/* ── Feed filter status ── */}
        {!isSearchMode && (query || activeTag) && totalFiltered > 0 && (
          <p className="font-mono text-[12px] text-text-faint mt-3">
            {totalFiltered} of {totalAll} items
            {query && <> matching &ldquo;{query}&rdquo;</>}
            {activeTag && <> in #{activeTag}</>}
          </p>
        )}
      </div>

      {/* ── Search results ── */}
      {isSearchMode && (
        <>
          {isSearching && searchResults.length === 0 && <LoadingSkeleton />}
          {searchResults.length > 0 && (
            <>
              <SectionHeading count={searchResults.length}>Papers</SectionHeading>
              <div className="grid grid-cols-1 gap-4">
                {searchResults.map((r) => (
                  <SearchResultCard key={r.id} result={r} />
                ))}
              </div>
            </>
          )}
          {!isSearching && searchResults.length === 0 && query.length >= 2 && (
            <EmptyState
              title="No papers found."
              description="Try different keywords or a broader search."
            />
          )}
        </>
      )}

      {/* ── Feed mode ── */}
      {!isSearchMode && (
        <>
          {isLoading && papers.length === 0 && <LoadingSkeleton />}

          {isEmpty && (
            <EmptyState
              title="No recommendations yet."
              description="Set your profile interests to get started."
            />
          )}

          {totalFiltered > 0 && (
            <>
              {filteredPapers.length > 0 && (
                <>
                  <SectionHeading count={filteredPapers.length}>Papers</SectionHeading>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredPapers.map((p) => <PaperCard key={p.id} paper={p} />)}
                  </div>
                </>
              )}

              {filteredEvents.length > 0 && (
                <>
                  <SectionHeading count={filteredEvents.length}>Events</SectionHeading>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredEvents.map((e) => <EventCard key={e.id} event={e} />)}
                  </div>
                </>
              )}

              {filteredJobs.length > 0 && (
                <>
                  <SectionHeading count={filteredJobs.length}>Jobs</SectionHeading>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredJobs.map((j) => <JobCard key={j.id} job={j} />)}
                  </div>
                </>
              )}

              <div className="mt-16 pt-5 border-t border-border">
                <button
                  onClick={loadFeed}
                  disabled={isLoading}
                  className="font-mono text-[12px] text-text-faint hover:text-accent transition-colors disabled:opacity-40"
                >
                  {isLoading ? "loading..." : "Refresh recommendations"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}
