"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import type { Paper, Event, Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { PaperCard } from "@/components/cards/paper-card";
import { EventCard } from "@/components/cards/event-card";
import { JobCard } from "@/components/cards/job-card";
import { SearchResultCard } from "@/components/cards/search-result-card";
import { BriefingHero, type HeroItem } from "@/components/cards/briefing-hero";
import { BriefingQuickHit } from "@/components/cards/briefing-quick-hit";
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
type BriefingItem = HeroItem;

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function scoreOf(item: BriefingItem): number {
  return item.data.relevanceScore ?? 0;
}

const WORTH_YOUR_TIME_MAX = 6;

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

  const briefingItems = useMemo<BriefingItem[]>(() => {
    const paperItems: BriefingItem[] =
      activeType === "all" || activeType === "papers"
        ? papers.map((p) => ({ kind: "paper", data: p }))
        : [];
    const eventItems: BriefingItem[] =
      activeType === "all" || activeType === "events"
        ? events.map((e) => ({ kind: "event", data: e }))
        : [];
    const jobItems: BriefingItem[] =
      activeType === "all" || activeType === "jobs"
        ? jobs.map((j) => ({ kind: "job", data: j }))
        : [];
    const all = [...paperItems, ...eventItems, ...jobItems];

    const filtered = query
      ? all.filter((item) => {
          if (item.kind === "paper") {
            const p = item.data as Paper;
            return matchesQuery(
              query,
              p.title,
              p.authors.join(" "),
              p.venue,
              p.source,
              p.relevanceReason,
              p.summaryIntro,
            );
          }
          if (item.kind === "event") {
            const e = item.data as Event;
            return matchesQuery(
              query,
              e.name,
              e.type,
              e.location,
              e.shortDescription,
              e.relevanceReason,
            );
          }
          const j = item.data as Job;
          return matchesQuery(
            query,
            j.roleTitle,
            j.companyOrLab,
            j.location,
            j.matchReason,
            j.keyRequirements.join(" "),
          );
        })
      : all;

    return filtered.sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [papers, events, jobs, query, activeType]);

  const topPick = briefingItems[0];
  const worthYourTime = briefingItems.slice(1, 1 + WORTH_YOUR_TIME_MAX);
  const quickHits = briefingItems.slice(1 + WORTH_YOUR_TIME_MAX);

  const totalAll = papers.length + events.length + jobs.length;
  const isEmpty = !isLoading && totalAll === 0 && !isSearchMode;

  const typeChips: { key: FeedType; label: string; count: number; icon: string }[] = [
    {
      key: "all",
      label: "All",
      count: papers.length + events.length + jobs.length,
      icon: "/logo.svg",
    },
    { key: "papers", label: "Papers", count: papers.length, icon: "/icon-papers.svg" },
    { key: "events", label: "Events", count: events.length, icon: "/icon-events.svg" },
    { key: "jobs", label: "Jobs", count: jobs.length, icon: "/icon-jobs.svg" },
  ];

  return (
    <article className="mx-auto max-w-[740px] lg:max-w-[820px] px-6 py-16 lg:py-20">
      <header className="mb-8">
        <Greeting
          isSearchMode={isSearchMode}
          displayName={profile.displayName}
          lastRefresh={lastRefresh}
        />
        {!isSearchMode && (
          <MetaRow profile={profile} />
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

        {/* ── Type tabs (feed only) ── */}
        {!isSearchMode && totalAll > 0 && (
          <div
            className="flex items-center flex-wrap gap-2.5 mt-6"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {typeChips.map(({ key, label, count, icon }) => {
              const active = activeType === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveType(key)}
                  aria-pressed={active}
                  className={[
                    "group relative inline-flex items-center h-12 rounded-full pl-1.5 pr-5 gap-2",
                    "transition-all duration-300 ease-out active:scale-[0.97]",
                    active
                      ? "bg-heading text-bg shadow-card-hover scale-[1.03]"
                      : "bg-surface text-text shadow-card hover:shadow-card-hover hover:-translate-y-[1px] hover:text-heading",
                  ].join(" ")}
                >
                  <span className="relative inline-flex items-center justify-center w-[40px] h-[40px] shrink-0">
                    {/* Burst pulse behind icon on activation — remounted per activeType */}
                    {active && (
                      <span
                        key={`burst-${activeType}`}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full bg-accent/40 animate-tab-burst"
                      />
                    )}
                    <img
                      key={`icon-${key}-${active ? "on" : "off"}`}
                      src={icon}
                      alt=""
                      width={40}
                      height={40}
                      className={[
                        "relative w-full h-full object-contain",
                        active
                          ? "animate-stamp drop-shadow-[0_2px_6px_rgba(245,132,20,0.45)]"
                          : "transition-transform duration-300 ease-out group-hover:scale-[1.08] group-hover:-rotate-3 group-active:scale-95",
                      ].join(" ")}
                    />
                  </span>
                  <span className="text-[14.5px] font-medium tracking-[-0.005em]">
                    {label}
                  </span>
                  <span
                    className={`text-[12px] tabular-nums transition-colors ${
                      active ? "text-bg/55" : "text-text-faint"
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
        {!isSearchMode && query && briefingItems.length > 0 && (
          <p
            className="text-[12px] text-text-faint mt-4"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {briefingItems.length} items matching &ldquo;{query}&rdquo;
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {searchResults.map((r) => (
                  <SearchResultCard key={r.id} result={r} />
                ))}
              </div>
            </>
          )}
          {!isSearching && searchResults.length === 0 && query.length >= 2 && (
            <EmptyState
              title="Nothing turned up."
              description="Try different keywords, or broaden the search to a field you're exploring."
            />
          )}
        </>
      )}

      {/* ── Feed mode: tiered briefing ── */}
      {!isSearchMode && (
        <>
          {isLoading && briefingItems.length === 0 && <LoadingSkeleton />}

          {isEmpty && (
            <EmptyState
              title="Your briefing is still waking up."
              description="Tell Hermes what you're working on — topics, methods, venues — and tomorrow's briefing will be built around that."
              action={
                <Link
                  href="/profile"
                  className="group inline-flex items-center gap-1.5 text-[13.5px] text-accent hover:text-accent/80 underline decoration-accent/30 hover:decoration-accent/70 underline-offset-4 transition-all duration-200 ease-out active:scale-[0.97]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Set up profile
                  <span className="text-[11px] opacity-70 transition-transform duration-200 ease-out group-hover:translate-x-[2px]">→</span>
                </Link>
              }
            />
          )}

          {briefingItems.length > 0 && (
            <>
              {topPick && (
                <div className="mt-4">
                  <BriefingHero item={topPick} />
                </div>
              )}

              {worthYourTime.length > 0 && (
                <>
                  <SectionHeading count={worthYourTime.length}>
                    Worth your time
                  </SectionHeading>
                  <div className="grid grid-cols-1 gap-5">
                    {worthYourTime.map((item) =>
                      item.kind === "paper" ? (
                        <PaperCard key={item.data.id} paper={item.data} />
                      ) : item.kind === "event" ? (
                        <EventCard key={item.data.id} event={item.data} />
                      ) : (
                        <JobCard key={item.data.id} job={item.data} />
                      ),
                    )}
                  </div>
                </>
              )}

              {quickHits.length > 0 && (
                <>
                  <SectionHeading count={quickHits.length}>Quick hits</SectionHeading>
                  <div className="divide-y divide-border">
                    {quickHits.map((item) => (
                      <BriefingQuickHit key={item.data.id} item={item} />
                    ))}
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

function Greeting({
  isSearchMode,
  displayName,
  lastRefresh,
}: {
  isSearchMode: boolean;
  displayName: string;
  lastRefresh: string | null;
}) {
  if (isSearchMode) {
    return (
      <>
        <h1
          className="text-[34px] lg:text-[38px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Search
        </h1>
        <p className="text-text-muted mt-3 text-[16.5px] leading-relaxed max-w-[56ch]">
          Search papers across OpenAlex — 250M+ academic works.
        </p>
      </>
    );
  }

  const firstName =
    displayName && displayName !== "Hermes Member"
      ? displayName.trim().split(/\s+/)[0]
      : "";

  const now = lastRefresh ? new Date(lastRefresh) : new Date();
  const hour = now.getHours();
  const greet =
    hour < 5
      ? "Still up"
      : hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : hour < 22
      ? "Good evening"
      : "Hello";

  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <p
        className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-accent/90 mb-3"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="inline-block w-5 h-[1.5px] bg-accent/70 align-middle mr-2.5" />
        Daily briefing
      </p>
      <h1
        className="text-[36px] lg:text-[44px] font-semibold text-heading tracking-[-0.02em] leading-[1.05]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {firstName ? (
          <>
            {greet},{" "}
            <span className="italic font-medium" style={{ fontFamily: "var(--font-reading)" }}>
              {firstName}
            </span>
            <span className="text-text-faint/70">.</span>
          </>
        ) : (
          <>
            {greet}
            <span className="text-text-faint/70">.</span>
          </>
        )}
      </h1>
      <div
        className="mt-3.5 flex items-baseline gap-2.5"
        style={{ fontFamily: "var(--font-reading)" }}
      >
        <span className="text-[21px] lg:text-[24px] italic text-heading/85 tracking-tight leading-none">
          {weekday}
        </span>
        <span className="text-border-strong text-[16px] leading-none" aria-hidden>·</span>
        <span className="text-[17px] lg:text-[18px] text-text-muted leading-none">{monthDay}</span>
      </div>
    </>
  );
}

// ── Icons for typed signal badges ─────────────────────────────

function TopicIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}
function MethodIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 2v6L4 20a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 20L14 8V2" />
      <path d="M9 2h6" />
    </svg>
  );
}
function VenueIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

type SignalKind = "topic" | "method" | "venue";

function SignalBadge({ kind, label }: { kind: SignalKind; label: string }) {
  const tone =
    kind === "topic"
      ? "text-accent bg-accent-dim shadow-[inset_0_0_0_1px_rgba(245,132,20,0.18)]"
      : kind === "method"
      ? "text-tag bg-tag-dim shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18)]"
      : "text-link bg-link-dim shadow-[inset_0_0_0_1px_rgba(29,78,216,0.15)]";

  const Icon = kind === "topic" ? TopicIcon : kind === "method" ? MethodIcon : VenueIcon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-md text-[11.5px] font-medium tracking-[0.005em] ${tone}`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <Icon />
      {label}
    </span>
  );
}

function MetaRow({
  profile,
}: {
  profile: { researchTopics: string[]; preferredMethods: string[]; preferredVenues: string[] };
}) {
  const { researchTopics, preferredMethods, preferredVenues } = profile;
  const typedSignals: { kind: SignalKind; label: string }[] = [
    ...researchTopics.slice(0, 3).map((label) => ({ kind: "topic" as const, label })),
    ...preferredMethods.slice(0, 2).map((label) => ({ kind: "method" as const, label })),
    ...preferredVenues.slice(0, 2).map((label) => ({ kind: "venue" as const, label })),
  ];
  const hasAny = typedSignals.length > 0;
  const missingTopics = researchTopics.length === 0;

  if (!hasAny) {
    return (
      <Link
        href="/profile"
        className="group mt-6 flex items-center gap-3 rounded-2xl bg-surface shadow-card px-4 py-3.5 hover:shadow-card-hover hover:-translate-y-[1px] transition-[box-shadow,transform] duration-200 ease-out active:translate-y-0"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent text-bg shadow-card transition-transform duration-200 ease-out group-hover:rotate-90">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block text-[13px] font-medium text-heading">Set up your profile</span>
          <span className="block text-[11.5px] text-text-faint mt-0.5">Tell Hermes what to hunt for — sharper briefings by tomorrow.</span>
        </span>
        <span className="text-[12px] text-text-faint transition-transform duration-200 ease-out group-hover:translate-x-[3px]">→</span>
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      aria-label="Edit profile signals"
      className="group mt-6 block rounded-2xl bg-surface/70 backdrop-blur-sm shadow-card px-4 pt-3 pb-3.5 hover:shadow-card-hover hover:bg-surface transition-[background-color,box-shadow] duration-200 ease-out"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Tuned for
        </span>
        <span className="inline-flex items-center gap-1 text-[11.5px] text-accent font-medium transition-colors group-hover:text-accent/80">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 ease-out group-hover:-rotate-12" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Edit
        </span>
      </div>
      <div className="flex items-center flex-wrap gap-1.5">
        {typedSignals.map((s) => (
          <SignalBadge key={`${s.kind}:${s.label}`} kind={s.kind} label={s.label} />
        ))}
      </div>
      {missingTopics && (
        <div className="mt-3 pt-2.5 border-t border-border/70 flex items-center gap-1.5 text-[11.5px] text-text-faint">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          Add research topics for sharper picks
          <span className="text-accent ml-0.5 transition-transform duration-200 ease-out group-hover:translate-x-[2px]">→</span>
        </div>
      )}
    </Link>
  );
}
