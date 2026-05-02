"use client";

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { applyColorTheme } from "@/lib/theme";
import { useProfileStore } from "@/store/profile";
import { useFeedStore } from "@/store/feed";
import { careerStages, colorThemeOptions, industryPreferences, type ColorTheme } from "@/types";

const industryLabels: Record<string, string> = {
  academia: "Academia",
  industry: "Industry",
  both: "Either — surprise me",
  startups: "Startups",
  bigTech: "Big tech",
};

const DEFAULT_NAME = "Hermes Member";

// Quick-add suggestion chips for the profile editor. Curated, not exhaustive
// — the goal is to seed common research languages so first-run users don't
// stare at an empty field and type "whatever". Order matters: most-popular
// first, scannable left-to-right.
const SUGGESTED_TOPICS: string[] = [
  "transformers",
  "large language models",
  "diffusion models",
  "RAG",
  "vision-language models",
  "reinforcement learning",
  "human-computer interaction",
  "accessibility",
];

const SUGGESTED_METHODS: string[] = [
  "RLHF",
  "contrastive learning",
  "supervised fine-tuning",
  "MoE",
  "distillation",
  "few-shot",
  "qualitative study",
];

const SUGGESTED_VENUES: string[] = [
  "NeurIPS",
  "ICLR",
  "ICML",
  "ACL",
  "EMNLP",
  "CVPR",
  "CHI",
  "UIST",
  "arXiv",
];

const PAPER_FOCUS_OPTIONS = [
  { value: "tight", label: "Tight", help: "Stay close to my project." },
  { value: "balanced", label: "Balanced", help: "Mix close matches and useful neighbors." },
  { value: "exploratory", label: "Exploratory", help: "Look wider for ideas I might miss." },
] as const;

const PAPER_FRESHNESS_OPTIONS = [
  { value: "today", label: "Today", help: "Only very new work." },
  { value: "week", label: "This week", help: "Recent without being too narrow." },
  { value: "month", label: "This month", help: "A wider recent window." },
] as const;

const PAPER_COUNT_OPTIONS = [
  { value: 5, label: "5", help: "Shortest briefing." },
  { value: 10, label: "10", help: "Default daily forecast." },
] as const;

const PAPER_SOURCE_OPTIONS = [
  { value: "balanced", label: "Balanced", help: "Use every source evenly." },
  { value: "preprints", label: "Preprints", help: "Favor arXiv and early papers." },
  { value: "published", label: "Published", help: "Favor journal and venue records." },
  { value: "code", label: "Code", help: "Favor work with code or datasets." },
] as const;

const PAPER_IMPORTANCE_OPTIONS = [
  { value: "new", label: "New", help: "Prefer fresh work." },
  { value: "highlyCited", label: "Highly cited", help: "Prefer proven papers." },
  { value: "rising", label: "Rising fast", help: "Prefer recent papers gaining attention." },
] as const;

const PAPER_METHOD_OPTIONS = [
  { value: "mustMatch", label: "Must match", help: "Only close method matches." },
  { value: "relatedOk", label: "Related OK", help: "Allow nearby methods." },
  { value: "any", label: "Any method", help: "Do not filter by method." },
] as const;

const PAPER_DISCOVERY_OPTIONS = [
  { value: "core", label: "Core field", help: "Stay inside my main area." },
  { value: "adjacent", label: "Adjacent fields", help: "Bring in nearby areas." },
  { value: "surprise", label: "Surprise me", help: "Include a few unusual finds." },
] as const;

// ── Icons ───────────────────────────────────────────────────────

function IconUser() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function IconHash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}
function IconFlask() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3h6" />
      <path d="M10 3v6L4 20a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 20L14 9V3" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IconCareer() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M16 9h3a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2M9 19h2" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a9 9 0 0 0 0 18h1.2a2.3 2.3 0 0 0 0-4.6h-.5a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12h-3Z" />
      <circle cx="7.5" cy="10" r="1" />
      <circle cx="9.5" cy="7" r="1" />
      <circle cx="14.5" cy="7" r="1" />
      <circle cx="16.5" cy="10" r="1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────

type Tone = "accent" | "tag" | "link" | "neutral";

function previewColorTheme(theme: ColorTheme) {
  applyColorTheme(theme);
}

export default function ProfilePage() {
  const {
    profile,
    updateDisplayName,
    updateTopics,
    updateSoftTopics,
    updateVenues,
    updateCareerStage,
    updateIndustryPreference,
    updateLocations,
    updateMethods,
    updateSchool,
    updateCurrentProject,
    updateCurrentChallenges,
    updateFeedFocus,
    updateFeedFreshness,
    updatePaperCount,
    updateFeedSourceMix,
    updateFeedImportance,
    updateFeedMethodMode,
    updateFeedDiscoveryMode,
    updateFeedAvoidReviews,
    updateFeedAvoidOldPapers,
    updateFeedAvoidBroadSurveys,
    updateDigestEnabled,
    updateDigestHourLocal,
    updateDigestTimezone,
    updateDigestFrequency,
    updateColorTheme,
    logOut,
  } = useProfileStore();

  const name = profile.displayName === DEFAULT_NAME ? "" : profile.displayName;
  const setName = updateDisplayName;
  const [showLogout, setShowLogout] = useState(false);

  const firstName = name.trim().split(/\s+/)[0];

  const [mode, setMode] = useState<"view" | "edit">("view");

  const signals = [
    profile.researchTopics.length > 0,
    (profile.softTopics ?? []).length > 0,
    profile.preferredMethods.length > 0,
    profile.preferredVenues.length > 0,
    profile.locationPreferences.length > 0,
  ];
  const doneCount = signals.filter(Boolean).length;
  const total = signals.length;

  return (
    <article className="mx-auto max-w-[740px] lg:max-w-[820px] px-6 py-16 lg:py-20">
      {/* ── Header ── */}
      <header className="mb-8">
        <p
          className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-accent/90 mb-3"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <span className="inline-block w-5 h-[1.5px] bg-accent/70 align-middle mr-2.5" />
          Your profile
        </p>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <h1
            className="text-[36px] lg:text-[44px] font-semibold text-heading tracking-[-0.02em] leading-[1.05]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {firstName ? (
              <>
                <span
                  className="italic font-medium"
                  style={{ fontFamily: "var(--font-reading)" }}
                >
                  {firstName}
                </span>
                &rsquo;s signals
                <span className="text-text-faint/70">.</span>
              </>
            ) : (
              <>
                Your signals
                <span className="text-text-faint/70">.</span>
              </>
            )}
          </h1>
          {mode === "view" ? (
            <button
              onClick={() => setMode("edit")}
              className="group inline-flex items-center gap-1.5 h-9 pl-3 pr-4 rounded-full bg-accent-dim text-accent hover:bg-accent/15 transition-all duration-200 ease-out active:scale-[0.96] shadow-[inset_0_0_0_1px_rgba(245,132,20,0.25)] text-[13px] font-medium"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <span className="transition-transform duration-200 ease-out group-hover:-rotate-12">
                <IconPencil />
              </span>
              Edit
            </button>
          ) : (
            <button
              onClick={() => setMode("view")}
              className="group inline-flex items-center gap-1.5 h-9 pl-3 pr-4 rounded-full bg-heading text-bg hover:bg-heading/90 transition-all duration-200 ease-out active:scale-[0.96] text-[13px] font-medium shadow-card"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <IconCheck />
              Done
            </button>
          )}
        </div>
        <div className="mt-3.5 flex items-center gap-2.5" style={{ fontFamily: "var(--font-sans)" }}>
          <div className="flex items-center gap-1">
            {signals.map((done, i) => (
              <span
                key={i}
                className={`block w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                  done ? "bg-accent" : "bg-border-strong/40"
                }`}
              />
            ))}
          </div>
          <span className="text-[12px] text-text-faint tabular-nums">
            <span className="text-text-muted font-medium">{doneCount}</span> of {total} signals set
          </span>
        </div>
      </header>

      {mode === "view" ? (
        <>
          <DashboardView
            profile={profile}
            displayName={name}
            onEdit={() => setMode("edit")}
          />
          <AppearanceCard
            colorTheme={profile.colorTheme}
            onConfirm={updateColorTheme}
          />
          <ReadingCard profile={profile} />
          <PastBriefings />
        </>
      ) : (
        <EditView
          profile={profile}
          name={name}
          setName={setName}
          updateTopics={updateTopics}
          updateSoftTopics={updateSoftTopics}
          updateMethods={updateMethods}
          updateSchool={updateSchool}
          updateCurrentProject={updateCurrentProject}
          updateCurrentChallenges={updateCurrentChallenges}
          updateFeedFocus={updateFeedFocus}
          updateFeedFreshness={updateFeedFreshness}
          updatePaperCount={updatePaperCount}
          updateFeedSourceMix={updateFeedSourceMix}
          updateFeedImportance={updateFeedImportance}
          updateFeedMethodMode={updateFeedMethodMode}
          updateFeedDiscoveryMode={updateFeedDiscoveryMode}
          updateFeedAvoidReviews={updateFeedAvoidReviews}
          updateFeedAvoidOldPapers={updateFeedAvoidOldPapers}
          updateFeedAvoidBroadSurveys={updateFeedAvoidBroadSurveys}
          updateVenues={updateVenues}
          updateCareerStage={updateCareerStage}
          updateIndustryPreference={updateIndustryPreference}
          updateLocations={updateLocations}
          updateDigestEnabled={updateDigestEnabled}
          updateDigestHourLocal={updateDigestHourLocal}
          updateDigestTimezone={updateDigestTimezone}
          updateDigestFrequency={updateDigestFrequency}
        />
      )}

      {/* ── Reset ── */}
      <section
        className="mt-14 pt-6 border-t border-border"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {!showLogout ? (
          <button
            onClick={() => setShowLogout(true)}
            className="inline-flex items-center gap-1.5 text-[12px] text-text-faint hover:text-red transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Reset profile to defaults
          </button>
        ) : (
          <div className="rounded-xl bg-red/[0.05] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.15)] px-4 py-3 text-[12.5px] flex items-center flex-wrap gap-x-5 gap-y-2">
            <span className="text-text-muted">Reset all signals to defaults?</span>
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={() => {
                  logOut();
                  setShowLogout(false);
                  setMode("view");
                }}
                className="text-red hover:text-red/80 font-medium transition-colors active:scale-95"
              >
                Confirm reset
              </button>
              <button
                onClick={() => setShowLogout(false)}
                className="text-text-faint hover:text-text-muted transition-colors active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </article>
  );
}

// ── View mode: editorial dashboard ─────────────────────────────

function DashboardView({
  profile,
  displayName,
  onEdit,
}: {
  profile: ReturnType<typeof useProfileStore.getState>["profile"];
  displayName: string;
  onEdit: () => void;
}) {
  const avatarLetter = displayName ? displayName[0].toUpperCase() : "";
  const industry =
    industryLabels[profile.industryVsAcademia] ?? profile.industryVsAcademia;

  return (
    <div
      className="relative rounded-3xl bg-surface shadow-card overflow-hidden animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* ── Identity band ── */}
      <div className="relative px-7 pt-7 pb-6">
        {/* Ambient gradient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(520px 200px at 90% -30%, rgba(245,132,20,0.12), transparent 60%), radial-gradient(420px 180px at 0% 120%, rgba(15,118,110,0.07), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-dim shadow-[inset_0_0_0_1px_rgba(245,132,20,0.28)]">
            {avatarLetter ? (
              <span
                className="text-accent text-[26px] font-medium italic leading-none"
                style={{ fontFamily: "var(--font-reading)" }}
              >
                {avatarLetter}
              </span>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/logo.svg"
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 object-contain opacity-85"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-text-faint/80 font-semibold">
              Reader
            </p>
            {displayName ? (
              <p
                className="text-[26px] italic font-medium text-heading tracking-tight leading-tight mt-0.5"
                style={{ fontFamily: "var(--font-reading)" }}
              >
                {displayName}
              </p>
            ) : (
              <p className="text-[17px] text-text-faint mt-1 italic" style={{ fontFamily: "var(--font-reading)" }}>
                Unnamed — tap edit to introduce yourself
              </p>
            )}
          </div>
        </div>

        {/* Career caption */}
        <div className="relative mt-5 flex items-center gap-2 text-[12.5px] text-text-muted">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${toneBadge("neutral")}`}>
            <IconCareer />
          </span>
          <span className="text-heading font-medium">{profile.careerStage}</span>
          <span className="text-text-faint/60" aria-hidden>·</span>
          <span className="text-text-muted">{industry}</span>
          {profile.school && (
            <>
              <span className="text-text-faint/60" aria-hidden>·</span>
              <span className="text-text-muted">{profile.school}</span>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-border/70 mx-7" />

      {/* ── Signals (compact table) ── */}
      <div className="px-7 py-5">
        <SectionHeader label="Signals" onAdjust={onEdit} />
        <div className="mt-3 space-y-2">
          <SignalRow tone="accent" icon={<IconHash />} label="Required" items={profile.researchTopics} />
          <SignalRow tone="tag" icon={<IconHash />} label="Explore" items={profile.softTopics ?? []} />
          <SignalRow tone="tag" icon={<IconFlask />} label="Methods" items={profile.preferredMethods} />
          <SignalRow tone="link" icon={<IconBook />} label="Venues" items={profile.preferredVenues} />
          <SignalRow tone="tag" icon={<IconPin />} label="Locations" items={profile.locationPreferences} />
        </div>
      </div>

      {/* ── Footer action ── */}
      <div className="px-7 py-3.5 bg-bg-secondary/30 border-t border-border/70 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-text-faint/70 font-semibold">
          Tuning any time
        </span>
        <button
          onClick={onEdit}
          className="group inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:text-accent/80 transition-colors active:scale-95"
        >
          <span className="transition-transform duration-200 ease-out group-hover:-rotate-12">
            <IconPencil />
          </span>
          Adjust signals
          <span className="text-[10px] opacity-60 transition-transform duration-200 ease-out group-hover:translate-x-[2px]">→</span>
        </button>
      </div>
    </div>
  );
}

// ── Reading: fancy editorial dashboard ─────────────────────────

function ReadingCard({
  profile,
}: {
  profile: ReturnType<typeof useProfileStore.getState>["profile"];
}) {
  const stats = useReadingStats();
  const realCells = useDailyActivityCells();
  const totalSurfaced = stats.saved + stats.read;
  const savedRate =
    totalSurfaced > 0 ? Math.round((stats.saved / totalSurfaced) * 100) : 0;
  const archetype = computeArchetype({
    saved: stats.saved,
    read: stats.read,
    savedRate,
    profile,
  });

  // Venue strength list (real data from saved papers)
  const venueBreakdown = stats.venueBreakdown.slice(0, 5);
  const maxVenue = venueBreakdown[0]?.count ?? 1;

  const pullQuote = composePullQuote({
    saved: stats.saved,
    read: stats.read,
    savedRate,
  });

  return (
    <div
      className="relative mt-5 rounded-3xl bg-surface shadow-card overflow-hidden animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)", animationDelay: "80ms" }}
    >
      {/* Ambient gradient wash — Anthropic-style warm backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(680px 260px at 10% -10%, rgba(245,132,20,0.10), transparent 60%), radial-gradient(520px 220px at 100% 120%, rgba(180,83,9,0.07), transparent 65%)",
        }}
      />

      {/* ── Header kicker ── */}
      <div className="relative px-7 pt-7 pb-4 flex items-baseline justify-between">
        <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent/90">
          <span className="inline-block w-4 h-[1.5px] bg-accent/70" />
          Reading · your rhythm
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-faint/70">
          Since day one
        </span>
      </div>

      {/* ── Hero line ── */}
      <div className="relative px-7 pb-5">
        <p
          className="text-heading leading-[1.15] tracking-[-0.01em] text-[26px] lg:text-[30px]"
          style={{ fontFamily: "var(--font-reading)" }}
        >
          You&apos;ve kept{" "}
          <span className="italic font-medium text-accent tabular-nums">
            {stats.saved}
          </span>{" "}
          item{stats.saved === 1 ? "" : "s"} out of{" "}
          <span className="italic font-medium tabular-nums">
            {totalSurfaced}
          </span>{" "}
          Hermes surfaced<span className="text-text-faint/70">.</span>
        </p>
        {stats.saved > 0 && (
          <p
            className="mt-3 text-[14px] text-text-muted max-w-[56ch] leading-[1.55] italic"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            {pullQuote}
          </p>
        )}
      </div>

      {/* ── 3-stat strip ── */}
      <div className="relative px-7 pb-5">
        <div className="grid grid-cols-3 gap-[1px] bg-border/80 rounded-xl overflow-hidden">
          <HeroStat label="Saved" value={String(stats.saved)} tone="accent" />
          <HeroStat label="Read" value={String(stats.read)} tone="tag" />
          <HeroStat
            label="Save rate"
            value={totalSurfaced ? `${savedRate}%` : "—"}
            tone="peach"
          />
        </div>
      </div>

      {/* ── What you save — tile grid ── */}
      {stats.saved > 0 && (
        <div className="relative px-7 pb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
              What you save
            </span>
            <span className="text-[10.5px] text-text-faint/60 tabular-nums">
              {stats.saved} total
            </span>
          </div>
          <TypeTiles breakdown={stats.typeBreakdown} total={stats.saved} />
        </div>
      )}

      {/* ── Top venues — tile grid ── */}
      {venueBreakdown.length > 0 && (
        <div className="relative px-7 pb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
              Where you read most
            </span>
            <span className="text-[10.5px] text-text-faint/60 tabular-nums">
              {venueBreakdown.length} venues
            </span>
          </div>
          <VenueGrid items={venueBreakdown} max={maxVenue} />
        </div>
      )}

      {/* ── Continuous learning calendar ── */}
      <div className="relative px-7 pb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
            Continuous reading
          </span>
          <StreakBadge activity={stats.saved + stats.read} cells={realCells ?? undefined} />
        </div>
        <ReadingCalendar activity={stats.saved + stats.read} cells={realCells ?? undefined} />
      </div>

      {/* ── Sticky topics (keyword weighted cloud) ── */}
      {stats.keywordBreakdown.length > 0 && (
        <div className="relative px-7 pb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
              Topics sticky with you
            </span>
            <span className="text-[10.5px] text-text-faint/60 tabular-nums">
              from {stats.saved} saves
            </span>
          </div>
          <KeywordCloud items={stats.keywordBreakdown} />
        </div>
      )}

      {/* ── Archetype pull ── */}
      <div className="relative mx-7 mb-6 rounded-2xl bg-bg-secondary/40 px-5 py-4 flex items-start gap-4">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent text-bg shrink-0 shadow-card text-[16px]">
          {archetype.glyph}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
            Reader archetype
          </p>
          <p
            className="text-[20px] lg:text-[22px] italic text-heading leading-tight mt-0.5 tracking-tight"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            {archetype.label}
          </p>
          <p className="text-[12.5px] text-text-muted leading-[1.55] mt-1 max-w-[48ch]">
            {archetype.description}
          </p>
        </div>
      </div>

      {/* ── Footer: share (placeholder, distribution path) ── */}
      <div className="relative px-7 py-3.5 bg-bg-secondary/30 border-t border-border/70 flex items-center justify-between flex-wrap gap-y-2">
        <span className="text-[11px] uppercase tracking-[0.16em] text-text-faint/70 font-semibold">
          Shareable reader card
        </span>
        <div className="flex items-center gap-2 text-[12px]" style={{ fontFamily: "var(--font-sans)" }}>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="group inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-surface shadow-card text-text-muted/80 transition-all cursor-not-allowed opacity-80"
            title="Coming soon"
          >
            <IconShare />
            Copy card
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="group inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-surface shadow-card text-text-muted/80 transition-all cursor-not-allowed opacity-80"
            title="Coming soon"
          >
            <IconDownload />
            PNG
          </button>
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-faint/60">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone | "peach";
}) {
  const accent =
    tone === "accent"
      ? "text-accent"
      : tone === "tag"
      ? "text-tag"
      : tone === "link"
      ? "text-link"
      : tone === "peach"
      ? "text-peach"
      : "text-heading";

  return (
    <div
      className="bg-surface px-4 py-4 flex flex-col items-start"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="text-[11px] uppercase tracking-[0.16em] text-text-faint">
        {label}
      </span>
      <span
        className={`mt-2 text-[30px] lg:text-[34px] font-semibold tabular-nums leading-none ${accent}`}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Charts ─────────────────────────────────────────────────────

function TypeTiles({
  breakdown,
  total,
}: {
  breakdown: { papers: number; events: number; jobs: number };
  total: number;
}) {
  const tiles = [
    {
      key: "papers",
      label: "Papers",
      count: breakdown.papers,
      color: "text-accent",
      bg: "bg-accent-dim",
      ring: "shadow-[inset_0_0_0_1px_rgba(245,132,20,0.22)]",
    },
    {
      key: "events",
      label: "Events",
      count: breakdown.events,
      color: "text-tag",
      bg: "bg-tag-dim",
      ring: "shadow-[inset_0_0_0_1px_rgba(194,99,14,0.20)]",
    },
    {
      key: "jobs",
      label: "Jobs",
      count: breakdown.jobs,
      color: "text-peach",
      bg: "bg-peach-dim",
      ring: "shadow-[inset_0_0_0_1px_rgba(217,122,48,0.20)]",
    },
  ];

  if (total === 0) return null;

  return (
    <div
      className="grid grid-cols-3 gap-2"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {tiles.map((t) => {
        const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
        const empty = t.count === 0;
        return (
          <div
            key={t.key}
            className={`relative rounded-xl px-3.5 py-3 transition-all duration-300 ${
              empty
                ? "bg-bg-secondary/30 text-text-faint/60"
                : `${t.bg} ${t.ring}`
            }`}
          >
            <div className={`text-[24px] font-semibold tabular-nums leading-none ${empty ? "" : t.color}`}>
              {t.count}
            </div>
            <div className="mt-1.5 flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.14em]">
              <span className={empty ? "text-text-faint/60" : "text-text-muted"}>
                {t.label}
              </span>
              {!empty && (
                <span className={`tabular-nums ${t.color} opacity-70`}>
                  {pct}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Venue grid — blocks, warm intensity by rank ───────────────

function VenueGrid({
  items,
  max,
}: {
  items: { name: string; count: number }[];
  max: number;
}) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {items.map((v) => {
        const weight = v.count / max;
        // Three warm intensity tiers
        const tier =
          weight > 0.66
            ? {
                text: "text-accent",
                bg: "bg-accent-dim",
                ring: "shadow-[inset_0_0_0_1px_rgba(245,132,20,0.22)]",
              }
            : weight > 0.33
            ? {
                text: "text-tag",
                bg: "bg-tag-dim",
                ring: "shadow-[inset_0_0_0_1px_rgba(194,99,14,0.20)]",
              }
            : {
                text: "text-peach",
                bg: "bg-peach-dim",
                ring: "shadow-[inset_0_0_0_1px_rgba(217,122,48,0.18)]",
              };
        return (
          <div
            key={v.name}
            className={`rounded-xl px-3 py-2.5 ${tier.bg} ${tier.ring} flex items-baseline justify-between gap-2`}
          >
            <span className="truncate text-[12.5px] text-heading font-medium">
              {v.name}
            </span>
            <span
              className={`text-[15px] font-semibold tabular-nums leading-none ${tier.text}`}
            >
              {v.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendar (GitHub-style contribution grid) ──────────────────
//
// We don't yet timestamp individual reads/saves in the store, so the intensity
// per cell is derived from total activity via a stable hash. When real
// timestamps land, swap `synthesizeActivity` for the real per-day counts.

const CAL_WEEKS = 18;
const CAL_DAYS = 7;

// Fetches real per-day read counts and maps them into a cells grid
// aligned with the calendar (CAL_WEEKS columns × CAL_DAYS rows,
// newest column = today). Returns null while loading / when unauthenticated,
// so callers can fall back to the synthesized shimmer.
function useDailyActivityCells(): number[] | null {
  const [cells, setCells] = useState<number[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/read?aggregate=daily", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { daily: { date: string; count: number }[] };
        if (cancelled) return;
        const byDate = new Map(data.daily.map((d) => [d.date, d.count]));
        const out = new Array<number>(CAL_WEEKS * CAL_DAYS).fill(0);
        // Fill grid newest-first: rightmost column = today.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let w = 0; w < CAL_WEEKS; w++) {
          for (let d = 0; d < CAL_DAYS; d++) {
            // cell at (w, d) represents (today - ((CAL_WEEKS-1-w) * 7 + (CAL_DAYS-1-d))) days
            const daysAgo = (CAL_WEEKS - 1 - w) * 7 + (CAL_DAYS - 1 - d);
            const dt = new Date(today);
            dt.setDate(dt.getDate() - daysAgo);
            const key = dt.toISOString().slice(0, 10);
            out[w * CAL_DAYS + d] = byDate.get(key) ?? 0;
          }
        }
        setCells(out);
      } catch {
        // swallow — fallback to synth
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return cells;
}

function synthesizeActivity(totalActivity: number): number[] {
  // Returns CAL_WEEKS * CAL_DAYS cells. Biases activity toward recent weeks.
  const cells = CAL_WEEKS * CAL_DAYS;
  const out = new Array<number>(cells).fill(0);
  if (totalActivity <= 0) return out;

  // Deterministic pseudo-random — stable for a given activity count.
  let seed = totalActivity * 9301 + 49297;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Distribute up to ~2.5x total activity across cells, recent-weighted
  const points = Math.min(cells, Math.max(totalActivity, Math.round(totalActivity * 1.3)));
  for (let p = 0; p < points; p++) {
    // Bias toward recent (higher week index)
    const weekBias = rand();
    const w = Math.floor(Math.pow(weekBias, 0.55) * CAL_WEEKS);
    const d = Math.floor(rand() * CAL_DAYS);
    const idx = w * CAL_DAYS + d;
    out[idx] += 1;
  }
  return out;
}

function streakFromCells(cells: number[]): number {
  // Count consecutive active cells working backward from the last column.
  let streak = 0;
  for (let w = CAL_WEEKS - 1; w >= 0; w--) {
    let anyActivity = false;
    for (let d = 0; d < CAL_DAYS; d++) {
      if (cells[w * CAL_DAYS + d] > 0) {
        anyActivity = true;
        break;
      }
    }
    if (anyActivity) streak++;
    else break;
  }
  return streak;
}

function StreakBadge({ activity, cells: realCells }: { activity: number; cells?: number[] }) {
  const cells = realCells ?? synthesizeActivity(activity);
  const weeks = streakFromCells(cells);
  if (weeks === 0) {
    return (
      <span className="text-[10.5px] text-text-faint/60 uppercase tracking-[0.14em]">
        No streak yet
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-accent font-medium tabular-nums"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-accent" aria-hidden>
        <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 2-3 2-6z" />
        <path d="M6 14c0 4 3 7 6 7s6-3 6-7c0-2-1-4-2-5-1 2-3 3-4 3s-3-1-4-3c-1 1-2 3-2 5z" />
      </svg>
      {weeks}-week streak
    </span>
  );
}

function ReadingCalendar({ activity, cells: realCells }: { activity: number; cells?: number[] }) {
  const cells = realCells ?? synthesizeActivity(activity);
  const maxActivity = Math.max(1, ...cells);

  const intensity = (v: number): number => {
    if (v <= 0) return 0;
    const ratio = v / maxActivity;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  const cellClass = (level: number) => {
    switch (level) {
      case 0:
        return "bg-bg-secondary/60";
      case 1:
        return "bg-accent/20 shadow-[inset_0_0_0_1px_rgba(245,132,20,0.15)]";
      case 2:
        return "bg-accent/40 shadow-[inset_0_0_0_1px_rgba(245,132,20,0.20)]";
      case 3:
        return "bg-accent/70 shadow-[inset_0_0_0_1px_rgba(245,132,20,0.25)]";
      default:
        return "bg-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.30)]";
    }
  };

  // Weekday labels we'll surface
  const dayLabels = ["Mon", "Wed", "Fri"];
  // Rough month markers — synthesized labels positioned across weeks
  const monthMarkers = useMemo(() => {
    const today = new Date();
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < CAL_WEEKS; w++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (CAL_WEEKS - 1 - w) * 7);
      const m = d.getMonth();
      if (m !== lastMonth) {
        labels.push({ col: w, label: d.toLocaleDateString("en-US", { month: "short" }) });
        lastMonth = m;
      }
    }
    return labels;
  }, []);

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      <div className="flex gap-2">
        {/* Weekday labels */}
        <div className="flex flex-col justify-between pt-3.5 shrink-0">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const visible = d === 1 || d === 3 || d === 5;
            return (
              <span
                key={d}
                className="text-[9px] text-text-faint/70 h-[11px] leading-[11px]"
              >
                {visible ? dayLabels[Math.floor(d / 2)] : "\u00A0"}
              </span>
            );
          })}
        </div>
        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Month labels */}
          <div
            className="grid mb-1 text-[9px] text-text-faint/70 uppercase tracking-[0.1em]"
            style={{ gridTemplateColumns: `repeat(${CAL_WEEKS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: CAL_WEEKS }).map((_, w) => {
              const m = monthMarkers.find((x) => x.col === w);
              return (
                <span key={w} className="truncate">
                  {m ? m.label : ""}
                </span>
              );
            })}
          </div>
          {/* Cells */}
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${CAL_WEEKS}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: CAL_WEEKS }).map((_, w) => (
              <div key={w} className="grid grid-rows-7 gap-[2px]">
                {Array.from({ length: CAL_DAYS }).map((__, d) => {
                  const v = cells[w * CAL_DAYS + d];
                  const level = intensity(v);
                  return (
                    <span
                      key={d}
                      className={`block aspect-square rounded-[3px] transition-colors ${cellClass(level)}`}
                      title={v > 0 ? `${v} interaction${v === 1 ? "" : "s"}` : "no activity"}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-text-faint/70">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`w-2.5 h-2.5 rounded-[3px] ${cellClass(l)}`} aria-hidden />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function KeywordCloud({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) return null;
  const max = items[0]?.count ?? 1;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((k) => {
        const weight = k.count / max;
        // Map weight → size + tone intensity
        const fontSize =
          weight > 0.75 ? 15 : weight > 0.5 ? 13.5 : weight > 0.3 ? 12.5 : 11.5;
        const tone =
          weight > 0.6 ? "accent" : weight > 0.3 ? "tag" : "peach";
        const bg =
          tone === "accent"
            ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.20)]"
            : tone === "tag"
            ? "bg-tag-dim text-tag shadow-[inset_0_0_0_1px_rgba(194,99,14,0.18)]"
            : "bg-peach-dim text-peach shadow-[inset_0_0_0_1px_rgba(217,122,48,0.18)]";
        return (
          <span
            key={k.name}
            className={`inline-flex items-center gap-1 px-2.5 py-[3px] rounded-md font-medium ${bg}`}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: `${fontSize}px`,
            }}
          >
            {k.name}
            {k.count > 1 && (
              <span className="text-[10px] opacity-60 tabular-nums">
                ×{k.count}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function composePullQuote({
  saved,
  read,
  savedRate,
}: {
  saved: number;
  read: number;
  savedRate: number;
}): string {
  if (read === 0) return "Signal-to-noise pending — come back after a few briefings.";
  if (saved === 0) return "You've read through your briefings but not bookmarked. Hermes is still learning your filter.";
  if (savedRate >= 40) return `A ${savedRate}% save rate — you don't waste taps. The filter is trusting.`;
  if (savedRate >= 20) return `Roughly one in ${Math.round(100 / savedRate)} survives the scroll. A considered reader.`;
  return `Selective — you keep fewer than one in five. The bar is high, and Hermes is learning it.`;
}

type Archetype = {
  label: string;
  description: string;
  glyph: string;
};

function computeArchetype({
  saved,
  read,
  savedRate,
  profile,
}: {
  saved: number;
  read: number;
  savedRate: number;
  profile: ReturnType<typeof useProfileStore.getState>["profile"];
}): Archetype {
  if (saved + read === 0) {
    return {
      label: "Just landed",
      description: "No reading history yet. Your first briefing will set the tone.",
      glyph: "✶",
    };
  }
  if (savedRate >= 40) {
    return {
      label: "Editorial Curator",
      description: "High trust in the filter. You save what you mean to return to, and Hermes is already converging on your taste.",
      glyph: "✎",
    };
  }
  if (savedRate >= 20) {
    return {
      label: "Methodical Explorer",
      description: "Balanced rhythm — reading widely, saving deliberately. You let the briefing stretch you a little.",
      glyph: "◎",
    };
  }
  if (profile.researchTopics.length >= 3) {
    return {
      label: "Deep Specialist",
      description: "Narrow topics, high standards. You want depth, not volume — Hermes should lean niche.",
      glyph: "◉",
    };
  }
  return {
    label: "Selective Reader",
    description: "You move quickly and keep little. Great for keeping the briefing tight — Hermes will trim more.",
    glyph: "◆",
  };
}

function IconShare() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51 8.59 10.49" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── Section header (reused for Signals / Reading) ──────────────

function SectionHeader({
  label,
  onAdjust,
}: {
  label: string;
  onAdjust?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
        <span className="inline-block w-3.5 h-[1.5px] bg-accent/70" aria-hidden />
        {label}
      </span>
      {onAdjust && (
        <button
          onClick={onAdjust}
          className="text-[11px] text-text-faint/80 hover:text-accent transition-colors active:scale-95"
        >
          adjust
        </button>
      )}
    </div>
  );
}

// ── Compact signal row ─────────────────────────────────────────

function SignalRow({
  tone,
  icon,
  label,
  items,
}: {
  tone: Tone;
  icon: ReactNode;
  label: string;
  items: string[];
}) {
  const chipClass = toneBadge(tone);
  const hasAny = items.length > 0;

  return (
    <div
      className="flex items-center gap-3"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center gap-1.5 shrink-0 w-[92px]">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${toneBadge(tone)}`}>
          {icon}
        </span>
        <span className="text-[11.5px] font-medium text-text-muted">
          {label}
        </span>
      </div>
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1">
        {hasAny ? (
          items.map((it) => (
            <span
              key={it}
              className={`inline-block px-2 py-[2px] rounded-md text-[11.5px] ${chipClass}`}
            >
              {it}
            </span>
          ))
        ) : (
          <span className="text-[11.5px] text-text-faint/60">—</span>
        )}
      </div>
      <span className="text-[11px] text-text-faint/50 tabular-nums w-5 text-right shrink-0">
        {hasAny ? items.length : ""}
      </span>
    </div>
  );
}

// ── Reading stats ──────────────────────────────────────────────

function useReadingStats() {
  const savedPapers = useFeedStore((s) => s.savedPapers);
  const savedEvents = useFeedStore((s) => s.savedEvents);
  const savedJobs = useFeedStore((s) => s.savedJobs);
  const readItems = useFeedStore((s) => s.readItems);
  const lastRefresh = useFeedStore((s) => s.lastRefresh);

  const saved = savedPapers.length + savedEvents.length + savedJobs.length;
  const read = Object.keys(readItems).length;

  // Saved-item type distribution
  const typeBreakdown = {
    papers: savedPapers.length,
    events: savedEvents.length,
    jobs: savedJobs.length,
  };

  // Top keywords across saved papers' experiment keywords
  const kwCounts = new Map<string, number>();
  savedPapers.forEach((p) => {
    (p.summaryExperimentKeywords ?? []).forEach((k) => {
      const key = k.toLowerCase();
      kwCounts.set(key, (kwCounts.get(key) ?? 0) + 1);
    });
  });
  const keywordBreakdown = [...kwCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Venue breakdown (saved papers)
  const venueCounts = new Map<string, number>();
  savedPapers.forEach((p) => {
    if (p.venue) venueCounts.set(p.venue, (venueCounts.get(p.venue) ?? 0) + 1);
  });
  const venueBreakdown = [...venueCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const topVenue = venueBreakdown[0] ?? null;

  // Top source (saved papers)
  const sourceCounts = new Map<string, number>();
  savedPapers.forEach((p) => {
    sourceCounts.set(p.source, (sourceCounts.get(p.source) ?? 0) + 1);
  });
  const topSourceEntry = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topSource = topSourceEntry ? { name: topSourceEntry[0], count: topSourceEntry[1] } : null;

  // Avg match (saved papers with scores)
  const scoredPapers = savedPapers.filter((p) => typeof p.relevanceScore === "number");
  const avgMatch = scoredPapers.length
    ? Math.round(
        (scoredPapers.reduce((a, p) => a + (p.relevanceScore ?? 0), 0) / scoredPapers.length) * 100
      )
    : null;

  // Reader profile classification (based on combined activity)
  const activity = saved + read;
  let readerLabel: string;
  let readerHint: string | undefined;
  if (activity === 0) {
    readerLabel = "Just arrived";
    readerHint = "read a few briefings";
  } else if (activity < 10) {
    readerLabel = "Casual";
    readerHint = `${activity} interactions`;
  } else if (activity < 40) {
    readerLabel = "Regular";
    readerHint = `${activity} interactions`;
  } else {
    readerLabel = "Heavy";
    readerHint = `${activity} interactions`;
  }

  const lastBriefing = lastRefresh ? formatRelativeTime(lastRefresh) : null;

  return {
    saved,
    read,
    avgMatch,
    topVenue,
    topSource,
    readerLabel,
    readerHint,
    lastBriefing,
    venueBreakdown,
    typeBreakdown,
    keywordBreakdown,
  };
}

interface PastBriefing {
  id: number;
  deliveredAt: string;
  channel: "inapp" | "email" | "both";
  itemIds: string[];
  payload: { items?: { id: string; title?: string; summary?: string }[] } | null;
  openedAt: string | null;
}

function PastBriefings() {
  const [briefings, setBriefings] = useState<PastBriefing[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/briefings", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = (await res.json()) as { briefings: PastBriefing[] };
        if (!cancelled) {
          setBriefings(data.briefings ?? []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (!briefings || briefings.length === 0) {
    return (
      <section
        className="mt-8 rounded-2xl bg-surface shadow-card px-7 py-6"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint mb-1.5">
          Past briefings
        </p>
        <p className="text-[13px] text-text-faint/80">
          Your first daily briefing will land here once the cron fires at your preferred hour.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mt-8 rounded-2xl bg-surface shadow-card overflow-hidden"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="px-7 pt-6 pb-3 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          Past briefings
        </p>
        <span className="text-[10.5px] text-text-faint/60 tabular-nums">
          {briefings.length} delivered
        </span>
      </div>
      <ul className="divide-y divide-border/70">
        {briefings.slice(0, 20).map((b) => {
          const items = b.payload?.items ?? [];
          const preview = items.slice(0, 3).map((i) => i.title).filter(Boolean).join(" · ");
          return (
            <li key={b.id} className="px-7 py-3.5 flex items-start gap-4">
              <div className="shrink-0 w-[84px] pt-0.5">
                <p className="text-[11.5px] text-text-muted tabular-nums">
                  {formatRelativeTime(b.deliveredAt)}
                </p>
                <p className="text-[10px] text-text-faint/60 uppercase tracking-[0.1em] mt-0.5">
                  {b.channel}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-text truncate">
                  {preview || `${items.length} items`}
                </p>
                <p className="text-[11px] text-text-faint mt-0.5 tabular-nums">
                  {b.itemIds.length} items
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ChoiceValue = string | number;
type ChoiceOption = {
  value: ChoiceValue;
  label: string;
  help?: string;
};

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: ChoiceValue;
  options: readonly ChoiceOption[];
  onChange: (value: ChoiceValue) => void;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              title={option.help}
              className={`group text-left text-[12px] px-2.5 py-1.5 rounded-xl transition-all duration-200 ease-out active:scale-[0.94] ${
                active
                  ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)] scale-[1.02]"
                  : "text-text-faint hover:text-text-muted bg-bg-secondary/40 hover:bg-bg-secondary/70"
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              {option.help && (
                <span className={`block text-[10.5px] leading-snug mt-0.5 ${active ? "text-accent/75" : "text-text-faint/75"}`}>
                  {option.help}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TogglePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] transition-all duration-200 ease-out active:scale-[0.94] ${
        active
          ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)]"
          : "bg-bg-secondary/40 text-text-faint hover:bg-bg-secondary/70 hover:text-text-muted"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-text-faint/45"}`}
      />
      {label}
    </button>
  );
}

// ── Edit mode: inline editor ───────────────────────────────────

function EditView({
  profile,
  name,
  setName,
  updateTopics,
  updateSoftTopics,
  updateMethods,
  updateSchool,
  updateCurrentProject,
  updateCurrentChallenges,
  updateFeedFocus,
  updateFeedFreshness,
  updatePaperCount,
  updateFeedSourceMix,
  updateFeedImportance,
  updateFeedMethodMode,
  updateFeedDiscoveryMode,
  updateFeedAvoidReviews,
  updateFeedAvoidOldPapers,
  updateFeedAvoidBroadSurveys,
  updateVenues,
  updateCareerStage,
  updateIndustryPreference,
  updateLocations,
  updateDigestEnabled,
  updateDigestHourLocal,
  updateDigestTimezone,
  updateDigestFrequency,
}: {
  profile: ReturnType<typeof useProfileStore.getState>["profile"];
  name: string;
  setName: (s: string) => void;
  updateTopics: (v: string[]) => void;
  updateSoftTopics: (v: string[]) => void;
  updateMethods: (v: string[]) => void;
  updateSchool: (s: string) => void;
  updateCurrentProject: (s: string) => void;
  updateCurrentChallenges: (s: string) => void;
  updateFeedFocus: ReturnType<typeof useProfileStore.getState>["updateFeedFocus"];
  updateFeedFreshness: ReturnType<typeof useProfileStore.getState>["updateFeedFreshness"];
  updatePaperCount: ReturnType<typeof useProfileStore.getState>["updatePaperCount"];
  updateFeedSourceMix: ReturnType<typeof useProfileStore.getState>["updateFeedSourceMix"];
  updateFeedImportance: ReturnType<typeof useProfileStore.getState>["updateFeedImportance"];
  updateFeedMethodMode: ReturnType<typeof useProfileStore.getState>["updateFeedMethodMode"];
  updateFeedDiscoveryMode: ReturnType<typeof useProfileStore.getState>["updateFeedDiscoveryMode"];
  updateFeedAvoidReviews: ReturnType<typeof useProfileStore.getState>["updateFeedAvoidReviews"];
  updateFeedAvoidOldPapers: ReturnType<typeof useProfileStore.getState>["updateFeedAvoidOldPapers"];
  updateFeedAvoidBroadSurveys: ReturnType<typeof useProfileStore.getState>["updateFeedAvoidBroadSurveys"];
  updateVenues: (v: string[]) => void;
  updateCareerStage: (s: typeof profile.careerStage) => void;
  updateIndustryPreference: (s: typeof profile.industryVsAcademia) => void;
  updateLocations: (v: string[]) => void;
  updateDigestEnabled: (v: boolean) => void;
  updateDigestHourLocal: (h: number) => void;
  updateDigestTimezone: (tz: string) => void;
  updateDigestFrequency: (f: typeof profile.digestFrequency) => void;
}) {
  return (
    <div
      className="rounded-2xl bg-surface shadow-card divide-y divide-border/70 animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <EditRow icon={<IconUser />} tone="neutral" label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder="Aspen"
          className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2 text-[14px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all"
        />
      </EditRow>
      <EditRow icon={<IconHash />} tone="accent" label="Topics">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent/80">
              Required
            </p>
            <ChipInput
              values={profile.researchTopics}
              onChange={updateTopics}
              placeholder="LCO, solid-state battery..."
              suggestions={SUGGESTED_TOPICS}
              tone="accent"
              dragId="required"
              onChipDrop={(value) => {
                if (!profile.researchTopics.includes(value)) {
                  updateTopics([...profile.researchTopics, value]);
                }
                updateSoftTopics((profile.softTopics ?? []).filter((v) => v !== value));
              }}
            />
            <p className="mt-1.5 px-0.5 text-[10.5px] leading-snug text-text-faint/70">
              Paper <strong>must</strong> be related to at least one of these. Type both the
              full name and abbreviation if you use acronyms (for example, add both
              &ldquo;LCO&rdquo; and &ldquo;lithium cobalt oxide&rdquo;).
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-tag/80">
              Nice to have
            </p>
            <ChipInput
              values={profile.softTopics ?? []}
              onChange={updateSoftTopics}
              placeholder="thin films, dendrites..."
              tone="tag"
              dragId="soft"
              onChipDrop={(value) => {
                if (!(profile.softTopics ?? []).includes(value)) {
                  updateSoftTopics([...(profile.softTopics ?? []), value]);
                }
                updateTopics(profile.researchTopics.filter((v) => v !== value));
              }}
            />
            <p className="mt-1.5 px-0.5 text-[10.5px] leading-snug text-text-faint/70">
              Papers that match these score higher, but papers without them can still
              appear in your feed.
            </p>
          </div>
        </div>
      </EditRow>

      <EditRow icon={<IconFlask />} tone="tag" label="Methods">
        <ChipInput
          values={profile.preferredMethods}
          onChange={updateMethods}
          placeholder="contrastive learning, RLHF, MoE..."
          suggestions={SUGGESTED_METHODS}
          tone="tag"
        />
      </EditRow>

      <EditRow icon={<IconBook />} tone="link" label="Venues">
        <ChipInput
          values={profile.preferredVenues}
          onChange={updateVenues}
          placeholder="NeurIPS, ICLR, CHI..."
          suggestions={SUGGESTED_VENUES}
          tone="link"
        />
      </EditRow>

      <EditRow icon={<IconBuilding />} tone="neutral" label="Affiliation">
        <input
          type="text"
          value={profile.school ?? ""}
          onChange={(e) => updateSchool(e.target.value)}
          placeholder="MIT Media Lab, Stanford HCI, DeepMind..."
          className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2 text-[14px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all"
        />
      </EditRow>

      <EditRow icon={<IconFlask />} tone="accent" label="Project">
        <textarea
          value={profile.currentProject ?? ""}
          onChange={(e) => updateCurrentProject(e.target.value)}
          placeholder="What specific project are you working on right now? e.g. 'Pulsed-current electroplating of single-crystal LCO thin films for solid-state microbatteries.'"
          rows={3}
          className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2 text-[14px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all resize-y leading-relaxed"
        />
        <p className="text-[11px] text-text-faint/75 mt-1.5 px-1 leading-relaxed">
          Describe your project in 1–3 sentences. Hermes uses this to bias the briefing toward your actual work, not just your generic field.
        </p>
      </EditRow>

      <EditRow icon={<IconHash />} tone="tag" label="Challenges">
        <textarea
          value={profile.currentChallenges ?? ""}
          onChange={(e) => updateCurrentChallenges(e.target.value)}
          placeholder="What open problems are you hunting information for? e.g. 'Suppressing dendritic Co growth at high current densities. Characterizing the H1–3 transition under fast charging.'"
          rows={3}
          className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2 text-[14px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all resize-y leading-relaxed"
        />
        <p className="text-[11px] text-text-faint/75 mt-1.5 px-1 leading-relaxed">
          The unknowns you wish someone would solve for you. Highest-leverage signal — papers that mention these will rise to the top.
        </p>
      </EditRow>

      <EditRow icon={<IconPin />} tone="tag" label="Locations">
        <ChipInput
          values={profile.locationPreferences}
          onChange={updateLocations}
          placeholder="Remote, Bay Area, London…"
          tone="tag"
        />
      </EditRow>

      <EditRow icon={<IconCareer />} tone="neutral" label="Career">
        <div className="space-y-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
              Stage
            </p>
            <div className="flex flex-wrap gap-1.5">
              {careerStages.map((s) => {
                const active = profile.careerStage === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateCareerStage(s)}
                    className={`text-[12px] px-2.5 py-1 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                      active
                        ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)] scale-[1.03]"
                        : "text-text-faint hover:text-text-muted bg-bg-secondary/40 hover:bg-bg-secondary/70"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
              Looking toward
            </p>
            <div className="flex flex-wrap gap-1.5">
              {industryPreferences.map((p) => {
                const active = profile.industryVsAcademia === p;
                return (
                  <button
                    key={p}
                    onClick={() => updateIndustryPreference(p)}
                    className={`text-[12px] px-2.5 py-1 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                      active
                        ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)] scale-[1.03]"
                        : "text-text-faint hover:text-text-muted bg-bg-secondary/40 hover:bg-bg-secondary/70"
                    }`}
                  >
                    {industryLabels[p] ?? p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </EditRow>

      <EditRow icon={<IconBook />} tone="link" label="Paper radar">
        <div className="space-y-4">
          <p className="text-[12.5px] text-text-faint/85 leading-relaxed">
            Tell Hermes how widely to look before it chooses your final daily papers.
          </p>
          <ChoiceGroup
            label="Focus"
            value={profile.feedFocus}
            options={PAPER_FOCUS_OPTIONS}
            onChange={(value) => updateFeedFocus(value as typeof profile.feedFocus)}
          />
          <ChoiceGroup
            label="Freshness"
            value={profile.feedFreshness}
            options={PAPER_FRESHNESS_OPTIONS}
            onChange={(value) => updateFeedFreshness(value as typeof profile.feedFreshness)}
          />
          <ChoiceGroup
            label="Papers shown"
            value={profile.paperCount}
            options={PAPER_COUNT_OPTIONS}
            onChange={(value) => updatePaperCount(value as typeof profile.paperCount)}
          />
          <ChoiceGroup
            label="Sources"
            value={profile.feedSourceMix}
            options={PAPER_SOURCE_OPTIONS}
            onChange={(value) => updateFeedSourceMix(value as typeof profile.feedSourceMix)}
          />
          <ChoiceGroup
            label="Importance"
            value={profile.feedImportance}
            options={PAPER_IMPORTANCE_OPTIONS}
            onChange={(value) => updateFeedImportance(value as typeof profile.feedImportance)}
          />
          <ChoiceGroup
            label="Methods"
            value={profile.feedMethodMode}
            options={PAPER_METHOD_OPTIONS}
            onChange={(value) => updateFeedMethodMode(value as typeof profile.feedMethodMode)}
          />
          <ChoiceGroup
            label="Discovery"
            value={profile.feedDiscoveryMode}
            options={PAPER_DISCOVERY_OPTIONS}
            onChange={(value) => updateFeedDiscoveryMode(value as typeof profile.feedDiscoveryMode)}
          />
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
              Avoid
            </p>
            <div className="flex flex-wrap gap-1.5">
              <TogglePill
                label="Review papers"
                active={profile.feedAvoidReviews}
                onToggle={() => updateFeedAvoidReviews(!profile.feedAvoidReviews)}
              />
              <TogglePill
                label="Old papers"
                active={profile.feedAvoidOldPapers}
                onToggle={() => updateFeedAvoidOldPapers(!profile.feedAvoidOldPapers)}
              />
              <TogglePill
                label="Broad surveys"
                active={profile.feedAvoidBroadSurveys}
                onToggle={() => updateFeedAvoidBroadSurveys(!profile.feedAvoidBroadSurveys)}
              />
            </div>
          </div>
        </div>
      </EditRow>

      <EditRow icon={<IconBell />} tone="accent" label="Digest">
        <div className="space-y-3">
          {/* Enable toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={profile.digestEnabled}
              onClick={() => updateDigestEnabled(!profile.digestEnabled)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ease-out ${
                profile.digestEnabled ? "bg-accent" : "bg-bg-secondary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-bg shadow transition-transform duration-200 ease-out ${
                  profile.digestEnabled ? "translate-x-4" : ""
                }`}
              />
            </button>
            <span className="text-[13px] text-text-muted">
              {profile.digestEnabled ? "Daily briefing on" : "Daily briefing off"}
            </span>
          </label>

          {/* Frequency */}
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
              Frequency
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["daily", "weekdays", "weekly", "off"] as const).map((f) => {
                const active = profile.digestFrequency === f;
                return (
                  <button
                    key={f}
                    onClick={() => updateDigestFrequency(f)}
                    className={`text-[12px] px-2.5 py-1 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                      active
                        ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)] scale-[1.03]"
                        : "text-text-faint hover:text-text-muted bg-bg-secondary/40 hover:bg-bg-secondary/70"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time + timezone */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="shrink-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
                Time (local)
              </p>
              <select
                value={profile.digestHourLocal}
                onChange={(e) => updateDigestHourLocal(Number(e.target.value))}
                className="bg-bg-secondary/40 rounded-lg px-2.5 py-1.5 text-[13px] text-text outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all tabular-nums"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
                Timezone
              </p>
              <input
                type="text"
                value={profile.digestTimezone}
                onChange={(e) => updateDigestTimezone(e.target.value)}
                placeholder="America/New_York"
                className="w-full bg-bg-secondary/40 rounded-lg px-3 py-1.5 text-[13px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>

        </div>
      </EditRow>

    </div>
  );
}

function AppearanceCard({
  colorTheme,
  onConfirm,
}: {
  colorTheme: ColorTheme;
  onConfirm: (theme: ColorTheme) => void;
}) {
  const [draftTheme, setDraftTheme] = useState(colorTheme);

  useEffect(() => {
    setDraftTheme(colorTheme);
    previewColorTheme(colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    return () => {
      previewColorTheme(colorTheme);
    };
  }, [colorTheme]);

  const changed = draftTheme !== colorTheme;

  return (
    <section
      className="mt-5 rounded-3xl bg-surface shadow-card overflow-hidden animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)", animationDelay: "40ms" }}
    >
      <div className="px-7 py-6 border-b border-border/70 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint/80">
            Appearance
          </p>
          <h2 className="mt-1 text-[20px] text-heading font-medium tracking-[-0.01em]">
            Color theme
          </h2>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Switch palettes directly here. No edit mode required.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary/45 px-3 py-1 text-[12px] text-text-faint">
          <IconPalette />
          {colorThemeOptions.find((option) => option.value === draftTheme)?.label ?? "System"}
        </span>
      </div>
      <div className="px-7 py-5 space-y-4">
        <ColorThemePicker
          value={draftTheme}
          onChange={(theme) => {
            setDraftTheme(theme);
            previewColorTheme(theme);
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onConfirm(draftTheme)}
            disabled={!changed}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200 ease-out ${
              changed
                ? "bg-heading text-bg hover:bg-heading/90 active:scale-[0.97]"
                : "bg-bg-secondary/55 text-text-faint cursor-not-allowed"
            }`}
          >
            <IconCheck />
            Select color
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftTheme(colorTheme);
              previewColorTheme(colorTheme);
            }}
            disabled={!changed}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition-all duration-200 ease-out ${
              changed
                ? "bg-bg-secondary/45 text-text-muted hover:bg-bg-secondary/70 active:scale-[0.97]"
                : "bg-bg-secondary/30 text-text-faint cursor-not-allowed"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

function ColorThemePicker({
  value,
  onChange,
}: {
  value: ColorTheme;
  onChange: (theme: ColorTheme) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {colorThemeOptions.map((option) => (
        <ColorThemeCard
          key={option.value}
          value={option.value}
          label={option.label}
          selected={value === option.value}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

function ColorThemeCard({
  value,
  label,
  selected,
  onSelect,
}: {
  value: ColorTheme;
  label: string;
  selected: boolean;
  onSelect: (theme: ColorTheme) => void;
}) {
  const swatches = themePreview(value);

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={`group relative cursor-pointer rounded-2xl p-3 transition-all duration-200 ease-out active:scale-[0.98] ${
        selected
          ? "bg-accent-dim shadow-[inset_0_0_0_1px_rgba(245,132,20,0.28)]"
          : "bg-bg-secondary/35 hover:bg-bg-secondary/55 shadow-[inset_0_0_0_1px_rgba(20,20,20,0.06)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-heading">{label}</p>
          <p className="text-[11px] text-text-faint mt-0.5">
            {value === "system" ? "Follows your OS" : `${label} palette`}
          </p>
        </div>
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
            selected ? "bg-accent text-bg" : "bg-surface text-text-faint shadow-[inset_0_0_0_1px_rgba(20,20,20,0.08)]"
          }`}
        >
          <IconCheck />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {swatches.map((swatch) => (
          <span
            key={swatch}
            className="block h-6 flex-1 rounded-full shadow-[inset_0_0_0_1px_rgba(20,20,20,0.06)]"
            style={{ background: swatch }}
          />
        ))}
      </div>
    </button>
  );
}

function themePreview(theme: ColorTheme): string[] {
  switch (theme) {
    case "system":
      return ["linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #09090b 50%, #16181d 100%)", "#f59e0b", "#7dd3fc"];
    case "cream":
      return ["#faf5e8", "#f58414", "#7a4412"];
    case "white":
      return ["#f8fafc", "#2563eb", "#0f766e"];
    case "black":
      return ["#09090b", "#f59e0b", "#34d399"];
    case "pink":
      return ["#fff3f8", "#ec4899", "#be185d"];
    case "blue":
      return ["#eff6ff", "#2563eb", "#0f766e"];
  }
}

function EditRow({
  icon,
  tone = "neutral",
  label,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-4 px-5 py-4"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center gap-2.5 shrink-0 w-[108px] pt-1">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${toneBadge(tone)}`}
        >
          {icon}
        </span>
        <span className="text-[12px] font-medium text-text-faint uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Shared ─────────────────────────────────────────────────────

function toneBadge(tone: Tone = "neutral") {
  switch (tone) {
    case "accent":
      return "text-accent bg-accent-dim";
    case "tag":
      return "text-tag bg-tag-dim";
    case "link":
      return "text-link bg-link-dim";
    default:
      return "text-text-muted bg-bg-secondary/70";
  }
}

// Module-level drag state — avoids relying on dataTransfer.getData() which
// Firefox can fail to return in drop handlers when custom MIME types are used.
let _chipDrag: { value: string; source: string } | null = null;

function ChipInput({
  values,
  onChange,
  placeholder,
  hint,
  suggestions,
  tone = "tag",
  dragId,
  onChipDrop,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** One-line helper text shown below the input. */
  hint?: string;
  /** Quick-add chips shown only when no values are present yet. */
  suggestions?: string[];
  tone?: Tone;
  /** When set, chips are draggable and carry this ID in the drag payload. */
  dragId?: string;
  /** Called with the chip value when a chip from a different dragId is dropped here. */
  onChipDrop?: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const cleaned = raw.trim().replace(/,$/, "").trim();
    if (!cleaned) return;
    if (values.includes(cleaned)) {
      setDraft("");
      return;
    }
    onChange([...values, cleaned]);
    setDraft("");
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && values.length) {
      onChange(values.slice(0, -1));
    } else if (e.key === "Tab" && draft !== "") {
      e.preventDefault();
      commit(draft);
    }
  };

  const chipClass = toneBadge(tone);
  const isDraggable = !!dragId;
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep a stable ref to onChipDrop so the native listener always calls the
  // latest version without needing to re-register on every render.
  const onChipDropRef = useRef(onChipDrop);
  useEffect(() => { onChipDropRef.current = onChipDrop; }, [onChipDrop]);

  // ── Native drag listeners (bypass React synthetic events, matches the HTML
  //    test that confirmed working in Firefox) ──────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Source-side: dragstart / dragend (delegated from chip spans)
    const onDragStart = (e: DragEvent) => {
      const chip = (e.target as Element).closest("[data-chip-value]") as HTMLElement | null;
      if (!chip) return;
      const value = chip.dataset.chipValue;
      if (!value || !dragId) return;
      _chipDrag = { value, source: dragId };
      try {
        e.dataTransfer!.setData("text/plain", JSON.stringify({ kind: "chip", value, source: dragId }));
        e.dataTransfer!.effectAllowed = "move";
      } catch { /* ok */ }
    };
    const onDragEnd = () => { _chipDrag = null; };

    // Drop-target-side
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const onDragLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) setIsDragOver(false);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (_chipDrag && _chipDrag.source !== dragId) {
        onChipDropRef.current?.(_chipDrag.value);
        _chipDrag = null;
      }
    };

    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragend", onDragEnd);
    if (onChipDropRef.current) {
      el.addEventListener("dragenter", onDragEnter);
      el.addEventListener("dragleave", onDragLeave);
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("drop", onDrop);
    }
    return () => {
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("dragend", onDragEnd);
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    };
  }, [dragId, isDraggable]);

  const dropRingClass = isDragOver
    ? tone === "accent"
      ? "bg-accent-dim/50 ring-2 ring-accent/50"
      : "bg-tag-dim/50 ring-2 ring-tag/50"
    : "bg-bg-secondary/40 hover:bg-bg-secondary/55 focus-within:bg-bg-secondary/55 focus-within:ring-2 focus-within:ring-accent/20";

  return (
    <>
      <div
        ref={containerRef}
        onClick={() => inputRef.current?.focus()}
        className={`flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all min-h-[38px] ${dropRingClass}`}
        style={{ cursor: "text" }}
      >
        {values.map((v) => (
          <span
            key={v}
            draggable={isDraggable}
            data-chip-value={isDraggable ? v : undefined}
            className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[12px] ${chipClass}`}
            style={{
              fontFamily: "var(--font-sans)",
              cursor: isDraggable ? "grab" : undefined,
              userSelect: isDraggable ? "none" : undefined,
            }}
          >
            {v}
            <button
              type="button"
              draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                remove(v);
              }}
              aria-label={`Remove ${v}`}
              className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-black/5 opacity-60 hover:opacity-100 transition-all"
              style={{ cursor: "pointer" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ pointerEvents: "none" }}>
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => draft && commit(draft)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[8ch] bg-transparent text-text placeholder-text-faint/60 outline-none text-[13.5px] py-0.5"
          style={{ fontFamily: "var(--font-sans)" }}
        />
      </div>
      {(suggestions && suggestions.length > 0 && values.length === 0) && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 px-1">
          <span className="text-[10.5px] text-text-faint/70 uppercase tracking-[0.14em] mr-1">
            Try
          </span>
          {suggestions
            .filter((s) => !values.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  commit(s);
                }}
                className="text-[11.5px] text-text-faint hover:text-accent px-1.5 py-0.5 rounded-md hover:bg-accent-dim/40 transition-colors active:scale-[0.95]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                + {s}
              </button>
            ))}
        </div>
      )}
      {hint && (
        <p
          className="text-[11px] text-text-faint/75 mt-1.5 px-1 leading-relaxed"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {hint}
        </p>
      )}
    </>
  );
}
