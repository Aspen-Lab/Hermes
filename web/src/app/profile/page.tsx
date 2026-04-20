"use client";

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useProfileStore } from "@/store/profile";
import { useFeedStore } from "@/store/feed";
import { careerStages, industryPreferences, venueOptions } from "@/types";

const industryLabels: Record<string, string> = {
  academia: "Academia",
  industry: "Industry",
  both: "Either — surprise me",
  startups: "Startups",
  bigTech: "Big tech",
};

const DEFAULT_NAME = "Hermes Member";

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
function IconPencil() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

export default function ProfilePage() {
  const {
    profile,
    updateDisplayName,
    updateTopics,
    updateVenues,
    updateCareerStage,
    updateIndustryPreference,
    updateLocations,
    updateMethods,
    logOut,
  } = useProfileStore();

  const initialName =
    profile.displayName === DEFAULT_NAME ? "" : profile.displayName;
  const [name, setName] = useState(initialName);
  const [showLogout, setShowLogout] = useState(false);

  const firstName = name.trim().split(/\s+/)[0];

  const signalsSet =
    profile.researchTopics.length +
    profile.preferredMethods.length +
    profile.preferredVenues.length +
    profile.locationPreferences.length;
  const freshUser = signalsSet === 0 && !firstName;

  // View by default when anything is set; edit by default for a fresh user.
  const [mode, setMode] = useState<"view" | "edit">(freshUser ? "edit" : "view");

  useEffect(() => {
    setName(profile.displayName === DEFAULT_NAME ? "" : profile.displayName);
  }, [profile.displayName]);

  const realVenues = useMemo(
    () => venueOptions.filter((v) => v !== "No preference"),
    []
  );

  const toggleVenue = (v: string) => {
    const active = profile.preferredVenues.includes(v);
    updateVenues(
      active
        ? profile.preferredVenues.filter((x) => x !== v)
        : [...profile.preferredVenues, v]
    );
  };

  const signals = [
    profile.researchTopics.length > 0,
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
          <ReadingCard profile={profile} />
        </>
      ) : (
        <EditView
          profile={profile}
          name={name}
          setName={setName}
          updateDisplayName={updateDisplayName}
          updateTopics={updateTopics}
          updateMethods={updateMethods}
          toggleVenue={toggleVenue}
          realVenues={realVenues}
          updateCareerStage={updateCareerStage}
          updateIndustryPreference={updateIndustryPreference}
          updateLocations={updateLocations}
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
                  setMode("edit");
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
  const stats = useReadingStats();

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
        </div>
      </div>

      <div className="h-px bg-border/70 mx-7" />

      {/* ── Signals (compact table) ── */}
      <div className="px-7 py-5">
        <SectionHeader label="Signals" onAdjust={onEdit} />
        <div className="mt-3 space-y-2">
          <SignalRow tone="accent" icon={<IconHash />} label="Topics" items={profile.researchTopics} />
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
            tone="link"
          />
        </div>
      </div>

      {/* ── Top venues (ranked bars) ── */}
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
          <ul className="space-y-1.5">
            {venueBreakdown.map((v) => (
              <li
                key={v.name}
                className="grid grid-cols-[90px_1fr_auto] items-center gap-3 text-[12.5px]"
              >
                <span className="truncate text-heading font-medium">
                  {v.name}
                </span>
                <span className="relative h-1.5 bg-bg-secondary/60 rounded-full overflow-hidden">
                  <span
                    className="absolute inset-y-0 left-0 bg-link/70 rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${(v.count / maxVenue) * 100}%` }}
                  />
                </span>
                <span className="text-text-faint/80 tabular-nums w-6 text-right">
                  {v.count}
                </span>
              </li>
            ))}
          </ul>
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
  tone: Tone;
}) {
  const accent =
    tone === "accent"
      ? "text-accent"
      : tone === "tag"
      ? "text-tag"
      : tone === "link"
      ? "text-link"
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
  };
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

function StatTile({
  big,
  small,
  tone,
}: {
  big: number | string;
  small: string;
  tone: Tone;
}) {
  const accent =
    tone === "accent"
      ? "text-accent"
      : tone === "tag"
      ? "text-tag"
      : tone === "link"
      ? "text-link"
      : "text-heading";

  return (
    <div
      className="rounded-xl bg-bg-secondary/35 px-3.5 py-3 flex flex-col items-start"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className={`text-[24px] font-semibold tabular-nums leading-none ${accent}`}>
        {big}
      </span>
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-faint mt-1.5">
        {small}
      </span>
    </div>
  );
}

function StatRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border/50 last:border-b-0">
      <dt className="text-text-faint">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="text-heading font-medium">{value}</span>
        {hint && <span className="text-text-faint/70 text-[11.5px]">{hint}</span>}
      </dd>
    </div>
  );
}

// ── Edit mode: inline editor ───────────────────────────────────

function EditView({
  profile,
  name,
  setName,
  updateDisplayName,
  updateTopics,
  updateMethods,
  toggleVenue,
  realVenues,
  updateCareerStage,
  updateIndustryPreference,
  updateLocations,
}: {
  profile: ReturnType<typeof useProfileStore.getState>["profile"];
  name: string;
  setName: (s: string) => void;
  updateDisplayName: (s: string) => void;
  updateTopics: (v: string[]) => void;
  updateMethods: (v: string[]) => void;
  toggleVenue: (v: string) => void;
  realVenues: string[];
  updateCareerStage: (s: typeof profile.careerStage) => void;
  updateIndustryPreference: (s: typeof profile.industryVsAcademia) => void;
  updateLocations: (v: string[]) => void;
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
            updateDisplayName(e.target.value);
          }}
          placeholder="Aspen"
          className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2 text-[14px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all"
        />
      </EditRow>

      <EditRow icon={<IconHash />} tone="accent" label="Topics">
        <ChipInput
          values={profile.researchTopics}
          onChange={updateTopics}
          placeholder="RLHF, diffusion, attention…"
          tone="accent"
        />
      </EditRow>

      <EditRow icon={<IconFlask />} tone="tag" label="Methods">
        <ChipInput
          values={profile.preferredMethods}
          onChange={updateMethods}
          placeholder="MoE, RAG, contrastive…"
          tone="tag"
        />
      </EditRow>

      <EditRow icon={<IconBook />} tone="link" label="Venues">
        <div className="flex flex-wrap gap-1.5">
          {realVenues.map((v) => {
            const active = profile.preferredVenues.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggleVenue(v)}
                className={`text-[12px] px-2.5 py-1 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                  active
                    ? "bg-link-dim text-link shadow-[inset_0_0_0_1px_rgba(29,78,216,0.22)] scale-[1.03]"
                    : "text-text-faint hover:text-text-muted bg-bg-secondary/40 hover:bg-bg-secondary/70"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
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
    </div>
  );
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

function ChipInput({
  values,
  onChange,
  placeholder,
  tone = "tag",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: Tone;
}) {
  const [draft, setDraft] = useState("");
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

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-secondary/40 hover:bg-bg-secondary/55 focus-within:bg-bg-secondary/55 focus-within:ring-2 focus-within:ring-accent/20 transition-all cursor-text min-h-[38px]"
    >
      {values.map((v) => (
        <span
          key={v}
          className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[12px] ${chipClass}`}
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {v}
          <button
            onClick={(e) => {
              e.stopPropagation();
              remove(v);
            }}
            aria-label={`Remove ${v}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-black/5 opacity-60 hover:opacity-100 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
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
  );
}
