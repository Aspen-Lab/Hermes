"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Paper, Event, Job } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { SearchResultCard } from "@/components/cards/search-result-card";
import { FeedTile } from "@/components/cards/feed-tile";
import { FeedMoreTile } from "@/components/cards/feed-more-tile";
import { DailyDigest } from "@/components/digest/daily-digest";
import { SectionHeading, EmptyState, LoadingSkeleton } from "@/components/ui";
import { FilterBar } from "@/components/search/filter-bar";
import {
  DEFAULT_FILTERS,
  filtersFromUrlParams,
  filtersToApiQuery,
  filtersToUrlParams,
  type Filters,
} from "@/lib/search/filters";

const FEED_AI_PROVIDER_OPTIONS = [
  { value: "default", label: "Hermes default (site setup)" },
  { value: "openai", label: "OpenAI / ChatGPT" },
  { value: "gemini", label: "Google Gemini API" },
  { value: "anthropic", label: "Anthropic / Claude" },
] as const;

interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  venue: string;
  sourceType: "journal" | "conference" | "arxiv" | "repository" | null;
  isOpenAccess: boolean;
  publishedDate: string | null;
  citationCount: number;
  doi: string | null;
  url: string;
  source: string;
}

type FeedType = "all" | "papers" | "events" | "jobs";
type BriefingItem =
  | { kind: "paper"; data: Paper }
  | { kind: "event"; data: Event }
  | { kind: "job"; data: Job };

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function scoreOf(item: BriefingItem): number {
  return item.data.relevanceScore ?? 0;
}

export default function DiscoveryPageWrapper() {
  return (
    <Suspense fallback={null}>
      <DiscoveryPage />
    </Suspense>
  );
}

function DiscoveryPage() {
  const {
    papers,
    events,
    jobs,
    isLoading,
    lastRefresh,
    loadFeed,
    aiPaperSearchEnabled,
    setAiPaperSearchEnabled,
  } = useFeedStore();
  const readItems = useFeedStore((s) => s.readItems);
  const profile = useProfileStore((s) => s.profile);
  const updateTavilyEnabled = useProfileStore((s) => s.updateTavilyEnabled);
  const updateTavilyApiKey = useProfileStore((s) => s.updateTavilyApiKey);
  const updateFeedAiProvider = useProfileStore((s) => s.updateFeedAiProvider);
  const updateFeedAiApiKey = useProfileStore((s) => s.updateFeedAiApiKey);

  const searchParamsObj = useSearchParams();
  const incomingQuery = searchParamsObj?.get("q") ?? "";

  const [query, setQuery] = useState(incomingQuery);
  const [activeType, setActiveType] = useState<FeedType>("all");
  const [filters, setFilters] = useState<Filters>(() =>
    filtersFromUrlParams(searchParamsObj),
  );
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [openTool, setOpenTool] = useState<"ai" | "tavily" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attemptedAutoLoadKeyRef = useRef<string | null>(null);

  // Hydrate from ?q= on navigation (e.g. clicking an author / keyword / venue).
  useEffect(() => {
    if (incomingQuery && incomingQuery !== query) {
      setQuery(incomingQuery);
    }
  }, [incomingQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedAutoLoadKey = useMemo(
    () =>
      profile.researchTopics
        .map((topic) => topic.trim())
        .filter(Boolean)
        .join("\n"),
    [profile.researchTopics],
  );

  useEffect(() => {
    if (
      !feedAutoLoadKey ||
      papers.length > 0 ||
      isLoading ||
      attemptedAutoLoadKeyRef.current === feedAutoLoadKey
    ) {
      return;
    }

    attemptedAutoLoadKeyRef.current = feedAutoLoadKey;
    void loadFeed();
  }, [feedAutoLoadKey, papers.length, isLoading, loadFeed]);

  const searchPapers = useCallback(async (q: string, f: Filters) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const apiParams = filtersToApiQuery(f);
      apiParams.set("q", q);
      apiParams.set("per_page", "12");
      const res = await fetch(`/api/papers/search?${apiParams.toString()}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Sync URL with current query + filters (replaceState to avoid history pollution).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const next = filtersToUrlParams(filters);
    if (query) next.set("q", query);
    // Preserve any unrelated existing params (none today, but defensive).
    const reserved = new Set([
      "q", "year", "from", "to", "sort", "oa", "cites", "src", "venue",
    ]);
    url.searchParams.forEach((_, key) => {
      if (reserved.has(key)) url.searchParams.delete(key);
    });
    next.forEach((v, k) => url.searchParams.set(k, v));
    const target = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
    if (target !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, "", target);
    }
  }, [query, filters]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => searchPapers(query, filters), 400);
    } else {
      setSearchResults([]);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, searchPapers]);

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

  const totalAll = papers.length + events.length + jobs.length;
  const unreadCount = briefingItems.filter((i) => !readItems[i.data.id]).length;
  const briefingClosed =
    !isSearchMode && briefingItems.length > 0 && unreadCount === 0;
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
    <article className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-[820px]">
      <header className="mb-8">
        <Greeting
          isSearchMode={isSearchMode}
          displayName={profile.displayName}
          lastRefresh={lastRefresh}
        />
        {!isSearchMode && (
          <MetaRow profile={profile} />
        )}
        {!isSearchMode && briefingItems.length > 0 && (
          <BriefingStatus
            total={briefingItems.length}
            unread={unreadCount}
            lastRefresh={lastRefresh}
            closed={briefingClosed}
          />
        )}
      </header>

      {/* ── Search ── */}
      <div className="mb-6">
        {/* Composite command bar — input on top, inline tool pills
            below, optional expanded settings panel underneath. Mirrors
            ChatGPT-style "rich input" patterns: one cohesive surface
            instead of an input plus three stacked side cards. */}
        <div className="rounded-2xl bg-surface shadow-card focus-within:shadow-card-hover transition-shadow">
          {/* Input row */}
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="hermes-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search papers, events, jobs…  (press /)"
              className="w-full bg-transparent rounded-t-2xl py-3.5 pl-11 pr-16 text-[14.5px] text-text placeholder:text-text-faint/70 focus:outline-none"
              style={{ fontFamily: "var(--font-sans)" }}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted text-[12px] transition-colors"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                clear
              </button>
            )}
          </div>

          {/* Tools row — compact pills */}
          <div
            className="flex items-center flex-wrap gap-1.5 px-2.5 pb-2.5 pt-0.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {/* Auto / AI search toggle */}
            <button
              type="button"
              onClick={() => setAiPaperSearchEnabled(!aiPaperSearchEnabled)}
              disabled={isLoading}
              aria-pressed={aiPaperSearchEnabled}
              title={
                aiPaperSearchEnabled
                  ? "AI paper search: Hermes uses planning and reranking."
                  : "Auto search: Hermes uses fixed scoring only."
              }
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] transition-colors active:scale-[0.96] disabled:opacity-55 disabled:cursor-wait ${
                aiPaperSearchEnabled
                  ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.28)]"
                  : "bg-bg-secondary/55 text-text-muted hover:text-heading hover:bg-bg-secondary"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 2l1.5 5L19 8.5 14.5 11 13 16l-2.5-4.5L6 10l4.5-1.5z" />
              </svg>
              <span className="font-medium">{aiPaperSearchEnabled ? "AI search" : "Auto"}</span>
              <span className="opacity-60 text-[10.5px]">{aiPaperSearchEnabled ? "Tier 1/2" : "Tier 0"}</span>
            </button>

            {/* AI key hookup */}
            <button
              type="button"
              onClick={() => setOpenTool((cur) => (cur === "ai" ? null : "ai"))}
              aria-expanded={openTool === "ai"}
              title="Configure your own AI provider key"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] transition-colors active:scale-[0.96] ${
                openTool === "ai"
                  ? "bg-bg-secondary text-heading shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                  : profile.feedAiProvider !== "default"
                    ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.28)]"
                    : "bg-bg-secondary/55 text-text-muted hover:text-heading hover:bg-bg-secondary"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="8" cy="14" r="4" />
                <path d="M11 11l7-7M16 6l3 3M14 8l3 3" />
              </svg>
              <span className="font-medium">
                {profile.feedAiProvider === "openai"
                  ? "OpenAI"
                  : profile.feedAiProvider === "gemini"
                    ? "Gemini"
                    : profile.feedAiProvider === "anthropic"
                      ? "Claude"
                      : "AI key"}
              </span>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`opacity-60 transition-transform duration-200 ${openTool === "ai" ? "rotate-180" : ""}`} aria-hidden>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>

            {/* Tavily hook */}
            <button
              type="button"
              onClick={() => setOpenTool((cur) => (cur === "tavily" ? null : "tavily"))}
              aria-expanded={openTool === "tavily"}
              title="Tavily web scouting"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] transition-colors active:scale-[0.96] ${
                openTool === "tavily"
                  ? "bg-bg-secondary text-heading shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                  : profile.tavilyEnabled
                    ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.28)]"
                    : "bg-bg-secondary/55 text-text-muted hover:text-heading hover:bg-bg-secondary"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
              <span className="font-medium">{profile.tavilyEnabled ? "Tavily on" : "Tavily"}</span>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`opacity-60 transition-transform duration-200 ${openTool === "tavily" ? "rotate-180" : ""}`} aria-hidden>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
          </div>

          {/* Expanded panel — only one tool at a time */}
          {openTool === "ai" && (
            <div
              className={`px-3.5 pb-3.5 space-y-3 border-t border-border/50 pt-3 ${aiPaperSearchEnabled ? "" : "opacity-60"}`}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <p className="text-[11.5px] leading-relaxed text-text-muted">
                Use Hermes default or bring your own normal AI key for Tier 2 reranking.
              </p>
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                  AI company
                </label>
                <select
                  value={profile.feedAiProvider}
                  onChange={(e) => updateFeedAiProvider(e.target.value as typeof profile.feedAiProvider)}
                  className="w-full rounded-lg bg-bg-secondary/45 px-3 py-2 text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {FEED_AI_PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {profile.feedAiProvider !== "default" && (
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                    API key
                  </label>
                  <input
                    type="password"
                    value={profile.feedAiApiKey ?? ""}
                    onChange={(e) => updateFeedAiApiKey(e.target.value)}
                    placeholder={
                      profile.feedAiProvider === "openai"
                        ? "OpenAI API key"
                        : profile.feedAiProvider === "gemini"
                          ? "Gemini API key"
                          : "Anthropic API key"
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg bg-bg-secondary/45 px-3 py-2 text-[12.5px] text-text placeholder:text-text-faint/65 focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              )}
              <p className="text-[10.5px] leading-relaxed text-text-faint">
                {aiPaperSearchEnabled
                  ? profile.feedAiProvider === "default"
                    ? "Uses the AI already connected to this Hermes site. It does not use your own device, and if this site has no AI connected, the advanced rerank step stays off."
                    : "When this is filled in, Hermes forces Tier 2 so your own key actually powers the AI rerank."
                  : "Turn AI search on to use this. Tier 0 ignores both Hermes default AI and your own key."}
              </p>
            </div>
          )}

          {openTool === "tavily" && (
            <div
              className={`px-3.5 pb-3.5 space-y-3 border-t border-border/50 pt-3 ${aiPaperSearchEnabled ? "" : "opacity-60"}`}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11.5px] leading-relaxed text-text-muted">
                  Extra web scouting for paper leads.
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.tavilyEnabled}
                  onClick={() => updateTavilyEnabled(!profile.tavilyEnabled)}
                  className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-out ${
                    profile.tavilyEnabled ? "bg-accent" : "bg-bg-secondary"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-bg shadow transition-transform duration-200 ease-out ${
                      profile.tavilyEnabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>
              <input
                type="password"
                value={profile.tavilyApiKey ?? ""}
                onChange={(e) => updateTavilyApiKey(e.target.value)}
                placeholder="Tavily API key"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg bg-bg-secondary/45 px-3 py-2 text-[12.5px] text-text placeholder:text-text-faint/65 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <p className="text-[10.5px] leading-relaxed text-text-faint">
                {aiPaperSearchEnabled
                  ? "Used only as a paper-discovery helper. Hermes still reruns academic sources before ranking."
                  : "Turn AI search on to use Tavily. Tier 0 ignores this hook."}
              </p>
            </div>
          )}
        </div>

        {/* ── Filter bar (search mode only) ── */}
        {isSearchMode && (
          <FilterBar
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
        )}

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
                    <Image
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
                ? `${searchResults.length} ${searchResults.length === 1 ? "result" : "results"} for \u201c${query}\u201d`
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
      </div>{/* /max-w-[820px] inner header wrapper */}

      {/* ── Search results ── */}
      {isSearchMode && (
        <>
          {isSearching && searchResults.length === 0 && (
            <div className="mx-auto max-w-[820px]"><LoadingSkeleton /></div>
          )}
          {searchResults.length > 0 && (
            <>
              <div className="mx-auto max-w-[820px]">
                <SectionHeading count={searchResults.length}>Papers</SectionHeading>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResults.map((r) => (
                  <SearchResultCard key={r.id} result={r} />
                ))}
              </div>
            </>
          )}
          {!isSearching && searchResults.length === 0 && query.length >= 2 && (
            <div className="mx-auto max-w-[820px]">
              <EmptyState
                title="Nothing turned up."
                description="Try different keywords, or broaden the search to a field you're exploring."
              />
            </div>
          )}
        </>
      )}

      {/* ── Feed mode: dense grid ── */}
      {!isSearchMode && (
        <>
          {isLoading && briefingItems.length === 0 && (
            <div className="mx-auto max-w-[820px]"><LoadingSkeleton /></div>
          )}

          {isEmpty && (
            <div className="mx-auto max-w-[820px]">
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
            </div>
          )}

          {briefingItems.length > 0 && (
            <>
              {/* One-paragraph synthesized digest. Hides itself if no LLM
                  is configured, so the rest of the feed keeps working. */}
              <div className="mx-auto max-w-[820px] mt-6">
                <DailyDigest
                  papers={briefingItems
                    .filter((i) => i.kind === "paper")
                    .map((i) => i.data as Paper)}
                  contextHint={[
                    profile.currentProject,
                    profile.currentChallenges,
                  ]
                    .filter((s) => s && s.trim().length > 0)
                    .join("\n\n")}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {briefingItems.map((item) => (
                  <div
                    key={item.data.id}
                    id={item.kind === "paper" ? `paper-${item.data.id}` : undefined}
                    className="rounded-3xl transition-shadow"
                  >
                    <FeedTile item={item} />
                  </div>
                ))}
                <FeedMoreTile
                  itemCount={briefingItems.length}
                  topics={profile.researchTopics}
                  onRefresh={loadFeed}
                  isLoading={isLoading}
                />
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
          className="text-[24px] lg:text-[28px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Search
        </h1>
        <p className="text-text-muted mt-2 text-[14px] leading-relaxed max-w-[56ch]">
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
        className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent/90 mb-2"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="inline-block w-4 h-[1.5px] bg-accent/70 align-middle mr-2" />
        Daily briefing
      </p>
      <h1
        className="text-[26px] lg:text-[32px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
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
        className="mt-2 flex items-baseline gap-2 text-text-muted"
        style={{ fontFamily: "var(--font-reading)" }}
      >
        <span className="text-[14px] lg:text-[15px] italic text-heading/80 tracking-tight leading-none">
          {weekday}
        </span>
        <span className="text-border-strong text-[12px] leading-none" aria-hidden>·</span>
        <span className="text-[13px] lg:text-[14px] leading-none">{monthDay}</span>
      </div>
    </>
  );
}

function formatSynced(lastRefresh: string | null): string {
  if (!lastRefresh) return "not synced yet";
  const diff = Date.now() - new Date(lastRefresh).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BriefingStatus({
  total,
  unread,
  lastRefresh,
  closed,
}: {
  total: number;
  unread: number;
  lastRefresh: string | null;
  closed: boolean;
}) {
  if (closed) {
    return (
      <div
        className="mt-6 flex items-center gap-2.5 rounded-full bg-accent-dim border border-accent/20 px-4 py-2 text-[12.5px]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <span className="text-heading font-medium">Briefing closed</span>
        <span className="text-text-faint">·</span>
        <span className="text-text-muted">
          All {total} item{total === 1 ? "" : "s"} reviewed. Back tomorrow with
          a fresh one.
        </span>
      </div>
    );
  }
  return (
    <div
      className="mt-6 flex items-center gap-2 text-[12.5px] text-text-faint"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="tabular-nums">
        <span className="text-heading font-medium">{total}</span>{" "}
        item{total === 1 ? "" : "s"}
      </span>
      <span className="text-border-strong">·</span>
      <span className="tabular-nums">
        <span className="text-accent font-medium">{unread}</span> unread
      </span>
      <span className="text-border-strong">·</span>
      <span>synced {formatSynced(lastRefresh)}</span>
    </div>
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
        className="group mt-6 inline-flex items-center gap-2 rounded-full bg-bg-secondary/50 hover:bg-bg-secondary pl-2 pr-3.5 py-1.5 text-[12.5px] text-text-muted hover:text-heading transition-colors duration-200 ease-out active:scale-[0.98]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-bg transition-transform duration-200 ease-out group-hover:rotate-90">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        Set up your profile
        <span className="text-[10px] opacity-60 transition-transform duration-200 ease-out group-hover:translate-x-[2px]">→</span>
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      aria-label="Edit profile signals"
      className="group mt-6 flex items-center flex-wrap gap-x-2 gap-y-1.5 rounded-xl bg-bg-secondary/35 hover:bg-bg-secondary/60 px-3 py-2 transition-colors duration-200 ease-out"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-faint/85">
        Tuned for
      </span>
      <div className="flex items-center flex-wrap gap-1.5 flex-1 min-w-0">
        {typedSignals.map((s) => (
          <SignalBadge key={`${s.kind}:${s.label}`} kind={s.kind} label={s.label} />
        ))}
      </div>
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-text-faint/75 group-hover:text-accent group-hover:bg-accent-dim transition-all duration-200 ease-out active:scale-90"
        aria-hidden
        title="Edit signals"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 ease-out group-hover:-rotate-12">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      {missingTopics && (
        <div className="basis-full flex items-center gap-1 text-[11px] text-text-faint/80 mt-0.5 pl-0.5">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-accent/80" aria-hidden>
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>Add research topics for sharper picks</span>
          <span className="text-accent/80 transition-transform duration-200 ease-out group-hover:translate-x-[2px]">→</span>
        </div>
      )}
    </Link>
  );
}
