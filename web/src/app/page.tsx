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
import { SectionHeading, EmptyState, LoadingSkeleton, SecretInput } from "@/components/ui";
import { FilterBar } from "@/components/search/filter-bar";
import {
  DEFAULT_FILTERS,
  filtersFromUrlParams,
  filtersToApiQuery,
  filtersToUrlParams,
  type Filters,
} from "@/lib/search/filters";
import { AiKeyFields, providerShortLabel } from "@/components/profile/ai-setup";
import { OnboardingTour } from "@/components/onboarding-tour";

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
  const feedTopicsKey = useFeedStore((s) => s.feedTopicsKey);
  const profile = useProfileStore((s) => s.profile);
  const updateTavilyEnabled = useProfileStore((s) => s.updateTavilyEnabled);
  const updateTavilyApiKey = useProfileStore((s) => s.updateTavilyApiKey);
  const updateFeedAiProvider = useProfileStore((s) => s.updateFeedAiProvider);
  const updateFeedAiApiKey = useProfileStore((s) => s.updateFeedAiApiKey);
  const updateDeepReportEnabled = useProfileStore((s) => s.updateDeepReportEnabled);

  const searchParamsObj = useSearchParams();
  const incomingQuery = searchParamsObj?.get("q") ?? "";

  const [query, setQuery] = useState(incomingQuery);
  const [activeType, setActiveType] = useState<FeedType>("all");
  const [filters, setFilters] = useState<Filters>(() =>
    filtersFromUrlParams(searchParamsObj),
  );
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [openTool, setOpenTool] = useState<"ai" | "tavily" | "deep" | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
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
    if (!feedAutoLoadKey || isLoading) return;
    // Reload when the loaded feed's topics differ from the current required
    // topics — i.e. on first load (key null) AND whenever the user edits topics
    // after papers were already loaded. The attempted-ref guards against
    // re-firing for the same key (e.g. on a transient empty result).
    if (feedTopicsKey === feedAutoLoadKey) return;
    if (attemptedAutoLoadKeyRef.current === feedAutoLoadKey) return;

    attemptedAutoLoadKeyRef.current = feedAutoLoadKey;
    void loadFeed();
  }, [feedAutoLoadKey, feedTopicsKey, isLoading, loadFeed]);

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

  // Explicit submit: bypass the 400ms debounce. Fired by the send button
  // and by Enter inside the input.
  const handleSearchSubmit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 2) void searchPapers(query, filters);
  }, [query, filters, searchPapers]);

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

  const firstPaperId = briefingItems.find((i) => i.kind === "paper")?.data.id;
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
      icon: "/logo-mark.png",
    },
    { key: "papers", label: "Papers", count: papers.length, icon: "/icon-papers.svg" },
    { key: "events", label: "Events", count: events.length, icon: "/icon-events.svg" },
    { key: "jobs", label: "Jobs", count: jobs.length, icon: "/icon-jobs.svg" },
  ];

  return (
    <article className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
      <div className="mx-auto max-w-[820px]">
      <header className="mb-8 flex items-center gap-3 sm:gap-5">
        <div className="min-w-0">
          <Greeting
            isSearchMode={isSearchMode}
            displayName={profile.displayName}
            lastRefresh={lastRefresh}
          />
          {!isSearchMode && (
            <MetaRow profile={profile} />
          )}
        </div>
        {/* Brand mark — hands + pear, transparent bg so it sits on any
            theme. Hidden on phones where the greeting needs the room. */}
        {!isSearchMode && (
          <Image
            src="/logo.png"
            alt=""
            width={1254}
            height={356}
            priority
            aria-hidden
            className="hidden sm:block shrink-0 w-[280px] lg:w-[380px] h-auto select-none pointer-events-none"
          />
        )}
      </header>

      {/* ── Search ── */}
      <div className="mb-6">
        {!isSearchMode && briefingItems.length > 0 && (
          <BriefingStatus
            total={briefingItems.length}
            unread={unreadCount}
            lastRefresh={lastRefresh}
            closed={briefingClosed}
            onRefresh={loadFeed}
            isRefreshing={isLoading}
          />
        )}
        {/* Composite command bar — input on top, inline tool pills
            below, optional expanded settings panel underneath. Mirrors
            ChatGPT-style "rich input" patterns: one cohesive surface
            instead of an input plus three stacked side cards. */}
        <div data-tour="search" className="rounded-3xl bg-surface border border-border shadow-[0_1px_3px_rgba(20,20,20,0.04),0_8px_24px_rgba(20,20,20,0.04)] focus-within:border-border-strong focus-within:shadow-[0_2px_4px_rgba(20,20,20,0.05),0_14px_36px_rgba(20,20,20,0.07)] transition-[box-shadow,border-color] duration-200">
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
              id="peer-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              placeholder="Search papers, events, jobs…  (press /)"
              className="w-full bg-transparent py-4 pl-11 pr-12 text-[14.5px] text-text placeholder:text-text-faint/70 focus:outline-none"
              style={{ fontFamily: "var(--font-sans)" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchResults([]);
                }}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-text-faint/70 hover:bg-bg-secondary hover:text-text transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            )}
          </div>

          {/* Tools row — left: modes pills · right: send action */}
          <div
            className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-0.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <div data-tour="ai-tools" className="flex items-center flex-wrap gap-1.5 min-w-0">
            {/* Auto / AI search toggle */}
            <button
              type="button"
              onClick={() => setAiPaperSearchEnabled(!aiPaperSearchEnabled)}
              disabled={isLoading}
              aria-pressed={aiPaperSearchEnabled}
              title={
                aiPaperSearchEnabled
                  ? "AI paper search: Peer uses planning and reranking."
                  : "Auto search: Peer uses fixed scoring only."
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
                {providerShortLabel(profile.feedAiProvider)}
              </span>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`opacity-60 transition-transform duration-200 ${openTool === "ai" ? "rotate-180" : ""}`} aria-hidden>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>

            {/* Deep Report toggle — requires user AI key to be filled in */}
            <button
              type="button"
              onClick={() => setOpenTool((cur) => (cur === "deep" ? null : "deep"))}
              aria-expanded={openTool === "deep"}
              title="Deep report — read each paper's full text before writing the report (uses your own AI key)."
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] transition-colors active:scale-[0.96] ${
                openTool === "deep"
                  ? "bg-bg-secondary text-heading shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                  : profile.deepReportEnabled
                    ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.28)]"
                    : "bg-bg-secondary/55 text-text-muted hover:text-heading hover:bg-bg-secondary"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span className="font-medium">{profile.deepReportEnabled ? "Deep report on" : "Deep report"}</span>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`opacity-60 transition-transform duration-200 ${openTool === "deep" ? "rotate-180" : ""}`} aria-hidden>
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

            {/* Right zone — send action */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSearchSubmit}
                disabled={query.length < 2 || isSearching}
                aria-label="Search"
                title="Search now (Enter)"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,opacity,box-shadow] active:scale-[0.94] ${
                  query.length >= 2 && !isSearching
                    ? "bg-accent text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12),0_1px_2px_rgba(245,132,20,0.25)] hover:bg-accent/90"
                    : "bg-bg-secondary text-text-faint/70 cursor-not-allowed"
                }`}
              >
                {isSearching ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Expanded panel — only one tool at a time */}
          {openTool === "ai" && (
            <div
              className={`px-3.5 pb-3.5 space-y-3 border-t border-border/50 pt-3 ${aiPaperSearchEnabled ? "" : "opacity-60"}`}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <p className="text-[11.5px] leading-relaxed text-text-muted">
                Use Peer default or bring your own normal AI key for Tier 2 reranking.
              </p>
              <AiKeyFields
                provider={profile.feedAiProvider}
                apiKey={profile.feedAiApiKey ?? ""}
                onProviderChange={updateFeedAiProvider}
                onApiKeyChange={updateFeedAiApiKey}
                idPrefix="feed-ai"
              />
              <p className="text-[10.5px] leading-relaxed text-text-faint">
                {aiPaperSearchEnabled
                  ? profile.feedAiProvider === "default"
                    ? "Uses the AI already connected to this Peer site. It does not use your own device, and if this site has no AI connected, the advanced rerank step stays off."
                    : "When this is filled in, Peer forces Tier 2 so your own key actually powers the AI rerank."
                  : "Turn AI search on to use this. Tier 0 ignores both Peer default AI and your own key."}
              </p>
            </div>
          )}

          {openTool === "deep" && (
            <div
              className={`px-3.5 pb-3.5 space-y-3 border-t border-border/50 pt-3 ${aiPaperSearchEnabled ? "" : "opacity-60"}`}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11.5px] leading-relaxed text-text-muted">
                  Read each paper&apos;s full text (HTML when available, PDF as fallback) before writing the report. Burns more tokens per paper but produces specific, paper-grounded reports instead of summarizing the abstract.
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.deepReportEnabled}
                  // Disabled only when the user explicitly picked a non-default
                  // provider but hasn't typed a key. With "default" selected we
                  // let the toggle through — the server resolves to whatever
                  // the site is configured with (Vertex Gemini / Anthropic /
                  // OpenAI / Qwen via env vars). If the site has no default
                  // configured the API gracefully falls back to a shallow
                  // report with an explanatory banner.
                  disabled={profile.feedAiProvider !== "default" && !profile.feedAiApiKey?.trim()}
                  onClick={() => updateDeepReportEnabled(!profile.deepReportEnabled)}
                  className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed ${
                    profile.deepReportEnabled ? "bg-accent" : "bg-bg-secondary"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-bg shadow transition-transform duration-200 ease-out ${
                      profile.deepReportEnabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10.5px] leading-relaxed text-text-faint">
                {profile.feedAiProvider === "default"
                  ? "Using the AI connected to this Peer site (Vertex Gemini / Anthropic / OpenAI / Qwen, depending on server setup). Deep report calls a cheap model (classify) and a smart model (extract) per paper — for Gemini, that's gemini-2.5-flash and gemini-2.5-pro. If the site has no AI configured, deep falls back to abstract-only."
                  : !profile.feedAiApiKey?.trim()
                  ? "Set your own AI provider and key in the AI key panel first. Deep report uses your key — both a cheap model (classify) and a smart model (extract) get called per paper."
                  : "When on, Peer downloads each paper's HTML or legal PDF, runs a two-pass read (cheap classify + smart extract), and grounds every result in the body text. Paywalled papers fall back to the abstract with a notice."}
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
              <SecretInput
                value={profile.tavilyApiKey ?? ""}
                onChange={updateTavilyApiKey}
                placeholder="Tavily API key"
              />
              <p className="text-[10.5px] leading-relaxed text-text-faint">
                {aiPaperSearchEnabled
                  ? "Used only as a paper-discovery helper. Peer still reruns academic sources before ranking."
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
                description="Tell Peer what you're working on — topics, methods, venues — and tomorrow's briefing will be built around that."
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
              <div data-tour="highlights" className="mx-auto max-w-[820px] mt-6">
                <DailyDigest
                  papers={briefingItems
                    .filter((i) => i.kind === "paper")
                    .map((i) => i.data as Paper)}
                  contextHint={[
                    profile.researchTopics.length > 0
                      ? `Required interests (every paper below matches at least one — name the matching one in your sentence): ${profile.researchTopics.join(", ")}`
                      : "",
                    profile.currentProject,
                    profile.currentChallenges,
                  ]
                    .filter((s) => s && s.trim().length > 0)
                    .join("\n\n")}
                  selectedPaperId={selectedPaperId}
                  onSelectPaper={setSelectedPaperId}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {briefingItems.map((item) => (
                  <div
                    key={item.data.id}
                    id={item.kind === "paper" ? `paper-${item.data.id}` : undefined}
                    data-tour={item.data.id === firstPaperId ? "paper-card" : undefined}
                    className="rounded-3xl transition-shadow"
                  >
                    <FeedTile
                      item={item}
                      selected={item.kind === "paper" && item.data.id === selectedPaperId}
                    />
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
      <OnboardingTour />
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
    displayName && displayName !== "Peer Member"
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
        // The greeting word is derived from the current clock, which can differ
        // between the server render and the browser (timezone / hour boundary).
        suppressHydrationWarning
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
        <span
          className="text-[14px] lg:text-[15px] italic text-heading/80 tracking-tight leading-none"
          suppressHydrationWarning
        >
          {weekday}
        </span>
        <span className="text-border-strong text-[12px] leading-none" aria-hidden>·</span>
        <span className="text-[13px] lg:text-[14px] leading-none" suppressHydrationWarning>{monthDay}</span>
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
  onRefresh,
  isRefreshing,
}: {
  total: number;
  unread: number;
  lastRefresh: string | null;
  closed: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  // Sits as a context pill directly above the search box: rounded-full to read
  // as a tab attached to the input below, with a live accent dot on the left
  // and a refresh affordance on the right. Mirrors the Codex pattern of a
  // contextual status chip docked above the command input.
  const wrapper =
    "mb-2 flex items-center gap-2.5 rounded-full border pl-3.5 pr-1.5 py-1.5 text-[12px] backdrop-blur-sm";
  const refreshBtn = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label="Refresh briefing"
      title="Refresh briefing"
      className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-text-faint hover:bg-bg hover:text-text-muted transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={isRefreshing ? "animate-spin" : ""}
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v6h-6" />
      </svg>
    </button>
  );
  if (closed) {
    return (
      <div
        className={`${wrapper} bg-accent/8 border-accent/20`}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        <span className="text-heading font-medium whitespace-nowrap">Briefing closed</span>
        <span className="text-text-faint hidden sm:inline">·</span>
        <span className="text-text-muted truncate hidden sm:inline">
          all {total} reviewed · back tomorrow
        </span>
        {refreshBtn}
      </div>
    );
  }
  return (
    <div
      className={`${wrapper} bg-bg-secondary/55 border-border`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
      <span className="tabular-nums text-text-muted whitespace-nowrap">
        <span className="text-heading font-medium">{total}</span> item{total === 1 ? "" : "s"}
      </span>
      <span className="text-border-strong">·</span>
      <span className="tabular-nums text-text-muted whitespace-nowrap">
        <span className="text-accent font-medium">{unread}</span> unread
      </span>
      <span className="text-border-strong hidden sm:inline">·</span>
      <span className="text-text-faint truncate hidden sm:inline">
        synced {formatSynced(lastRefresh)}
      </span>
      {refreshBtn}
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
      ? "text-accent bg-accent-dim/70 shadow-[inset_0_0_0_1px_rgba(245,132,20,0.16)]"
      : kind === "method"
      ? "text-tag bg-tag-dim/70 shadow-[inset_0_0_0_1px_rgba(15,118,110,0.16)]"
      : "text-link bg-link-dim/70 shadow-[inset_0_0_0_1px_rgba(29,78,216,0.14)]";

  const Icon = kind === "topic" ? TopicIcon : kind === "method" ? MethodIcon : VenueIcon;

  return (
    <span
      className={`inline-flex items-center gap-1 h-5 pl-1.5 pr-2 rounded text-[11px] font-medium tracking-[0.005em] ${tone}`}
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
  profile: { researchTopics: string[]; preferredMethods: string[] };
}) {
  const { researchTopics, preferredMethods } = profile;
  const typedSignals: { kind: SignalKind; label: string }[] = [
    ...researchTopics.slice(0, 3).map((label) => ({ kind: "topic" as const, label })),
    ...preferredMethods.slice(0, 2).map((label) => ({ kind: "method" as const, label })),
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

  // Only show first 5 chips inline; rest become "+N more" so the row
  // stays single-line on most viewports without sacrificing context.
  const VISIBLE = 5;
  const overflow = Math.max(0, typedSignals.length - VISIBLE);

  return (
    <Link
      href="/profile"
      aria-label="Edit profile signals"
      className="group mt-4 inline-flex items-center flex-wrap gap-x-1.5 gap-y-1 transition-colors"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-faint/80 mr-1">
        Tuned for
      </span>
      {typedSignals.slice(0, VISIBLE).map((s) => (
        <SignalBadge key={`${s.kind}:${s.label}`} kind={s.kind} label={s.label} />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] text-text-faint/80 tabular-nums">
          +{overflow}
        </span>
      )}
      <span
        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-text-faint/60 group-hover:text-accent group-hover:bg-accent-dim transition-all duration-200 ease-out active:scale-90"
        aria-hidden
        title="Edit signals"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 ease-out group-hover:-rotate-12">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      {missingTopics && (
        <div className="basis-full flex items-center gap-1 text-[10.5px] text-text-faint/70 mt-0.5">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-accent/80" aria-hidden>
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>Add research topics for sharper picks</span>
          <span className="text-accent/80 transition-transform duration-200 ease-out group-hover:translate-x-[2px]">→</span>
        </div>
      )}
    </Link>
  );
}
