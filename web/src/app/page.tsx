"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { PaperCard } from "@/components/cards/paper-card";
import { EventCard } from "@/components/cards/event-card";
import { JobCard } from "@/components/cards/job-card";
import { SearchResultCard } from "@/components/cards/search-result-card";
import { SectionHeading, EmptyState, LoadingSkeleton } from "@/components/ui";

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

type FeedType = "all" | "papers" | "events" | "jobs";

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export default function DiscoveryPage() {
  const { papers, events, jobs, isLoading, lastRefresh, loadFeed } =
    useFeedStore();
  const profile = useProfileStore((s) => s.profile);

  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<FeedType>("all");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const filteredPapers = useMemo(() => {
    if (isSearchMode) return papers;
    if (!query) return papers;
    return papers.filter((p) =>
      matchesQuery(query, p.title, p.authors.join(" "), p.venue, p.source, p.relevanceReason, p.summaryIntro)
    );
  }, [papers, query, isSearchMode]);

  const filteredEvents = useMemo(() => {
    if (isSearchMode) return [];
    if (!query) return events;
    return events.filter((e) =>
      matchesQuery(query, e.name, e.type, e.location, e.shortDescription, e.relevanceReason)
    );
  }, [events, query, isSearchMode]);

  const filteredJobs = useMemo(() => {
    if (isSearchMode) return [];
    if (!query) return jobs;
    return jobs.filter((j) =>
      matchesQuery(query, j.roleTitle, j.companyOrLab, j.location, j.matchReason, j.keyRequirements.join(" "))
    );
  }, [jobs, query, isSearchMode]);

  const showPapers = activeType === "all" || activeType === "papers";
  const showEvents = activeType === "all" || activeType === "events";
  const showJobs = activeType === "all" || activeType === "jobs";

  const visibleCount =
    (showPapers ? filteredPapers.length : 0) +
    (showEvents ? filteredEvents.length : 0) +
    (showJobs ? filteredJobs.length : 0);

  const totalAll = papers.length + events.length + jobs.length;
  const isEmpty = !isLoading && totalAll === 0 && !isSearchMode;

  const typeChips: { key: FeedType; label: string; count: number }[] = [
    { key: "all", label: "All", count: filteredPapers.length + filteredEvents.length + filteredJobs.length },
    { key: "papers", label: "Papers", count: filteredPapers.length },
    { key: "events", label: "Events", count: filteredEvents.length },
    { key: "jobs", label: "Jobs", count: filteredJobs.length },
  ];

  return (
    <article className="mx-auto max-w-[740px] lg:max-w-[920px] px-6 py-16 lg:py-20">
      <header className="mb-8">
        <h1
          className="text-[34px] lg:text-[38px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {isSearchMode ? "Search" : "Daily briefing"}
        </h1>
        <p className="text-text-muted mt-3 text-[16.5px] leading-relaxed max-w-[56ch]">
          {isSearchMode
            ? "Search papers across OpenAlex \u2014 250M+ academic works."
            : "Personalized recommendations based on your research profile."}
        </p>
        {!isSearchMode && (
          <>
            <p
              className="text-[12px] text-text-faint mt-4 tracking-wide"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {lastRefresh
                ? new Date(lastRefresh).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                    year: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : "Not synced yet"}
            </p>
            <PersonalizationHint profile={profile} />
          </>
        )}
      </header>

      {/* ── Search ── */}
      <div className="mb-6">
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search papers, events, jobs…"
            className="w-full bg-surface shadow-card rounded-xl py-3 pl-11 pr-16 text-[14.5px] text-text placeholder:text-text-faint/70 focus:outline-none focus:shadow-card-hover focus:ring-2 focus:ring-accent/20 transition-shadow"
            style={{ fontFamily: "var(--font-sans)" }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSearchResults([]);
                setSearchTotal(0);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted text-[12px] transition-colors"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              clear
            </button>
          )}
        </div>

        {/* ── Type chips (feed only) ── */}
        {!isSearchMode && totalAll > 0 && (
          <div
            className="flex items-center gap-2 mt-5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {typeChips.map(({ key, label, count }) => {
              const active = activeType === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveType(key)}
                  className={`inline-flex items-baseline gap-2 text-[13px] px-3.5 py-1.5 rounded-full transition-all duration-200 ease-out active:scale-[0.96] ${
                    active
                      ? "bg-heading text-bg scale-[1.02]"
                      : "text-text-muted hover:text-heading bg-bg-secondary/60 hover:bg-bg-secondary"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[11.5px] tabular-nums ${
                      active ? "text-bg/60" : "text-text-faint"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Search status ── */}
        {isSearchMode && (
          <p
            className="text-[12px] text-text-faint mt-4"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {isSearching
              ? "searching…"
              : searchResults.length > 0
                ? `${searchResults.length} of ${searchTotal.toLocaleString()} results for \u201c${query}\u201d`
                : `no results for \u201c${query}\u201d`}
          </p>
        )}

        {/* ── Query filter status (feed mode) ── */}
        {!isSearchMode && query && visibleCount > 0 && (
          <p
            className="text-[12px] text-text-faint mt-4"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {visibleCount} items matching &ldquo;{query}&rdquo;
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
              <div className="grid grid-cols-1 gap-5">
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

          {visibleCount > 0 && (
            <>
              {showPapers && filteredPapers.length > 0 && (
                <>
                  <SectionHeading count={filteredPapers.length}>Papers</SectionHeading>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredPapers.map((p) => <PaperCard key={p.id} paper={p} />)}
                  </div>
                </>
              )}

              {showEvents && filteredEvents.length > 0 && (
                <>
                  <SectionHeading count={filteredEvents.length}>Events</SectionHeading>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredEvents.map((e) => <EventCard key={e.id} event={e} />)}
                  </div>
                </>
              )}

              {showJobs && filteredJobs.length > 0 && (
                <>
                  <SectionHeading count={filteredJobs.length}>Jobs</SectionHeading>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredJobs.map((j) => <JobCard key={j.id} job={j} />)}
                  </div>
                </>
              )}

              <div className="mt-20 pt-6 border-t border-border">
                <button
                  onClick={loadFeed}
                  disabled={isLoading}
                  className="text-[12.5px] text-text-faint hover:text-accent transition-colors disabled:opacity-40"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {isLoading ? "loading…" : "Refresh recommendations"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}

function PersonalizationHint({
  profile,
}: {
  profile: { researchTopics: string[]; preferredMethods: string[]; preferredVenues: string[] };
}) {
  const { researchTopics, preferredMethods, preferredVenues } = profile;
  const signals = [
    ...researchTopics.slice(0, 3),
    ...preferredMethods.slice(0, 2),
    ...preferredVenues.slice(0, 2),
  ];

  if (signals.length === 0) {
    return (
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 mt-5 text-[13px] text-accent hover:text-accent/80 transition-colors"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Set up your profile to personalize this feed
        <span className="text-[11px] opacity-70">→</span>
      </Link>
    );
  }

  return (
    <div
      className="flex items-center flex-wrap gap-1.5 mt-5 text-[12.5px]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="text-text-faint mr-0.5">Tuned for</span>
      {signals.map((s) => (
        <span
          key={s}
          className="text-text-muted bg-bg-secondary/70 px-2 py-[2px] rounded-md"
        >
          {s}
        </span>
      ))}
      <Link
        href="/profile"
        className="text-text-faint hover:text-accent transition-colors ml-1"
      >
        edit
      </Link>
    </div>
  );
}
