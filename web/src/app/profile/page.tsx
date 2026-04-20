"use client";

import { useState, useRef, useMemo, type KeyboardEvent } from "react";
import { useProfileStore } from "@/store/profile";
import { careerStages, industryPreferences, venueOptions } from "@/types";

const industryLabels: Record<string, string> = {
  academia: "Academia",
  industry: "Industry",
  both: "Either — surprise me",
  startups: "Startups",
  bigTech: "Big tech",
};

export default function ProfilePage() {
  const {
    profile,
    updateTopics,
    updateVenues,
    updateCareerStage,
    updateIndustryPreference,
    updateLocations,
    updateMethods,
    logOut,
  } = useProfileStore();

  const [showLogout, setShowLogout] = useState(false);

  // Exclude "No preference" sentinel — empty array means no preference.
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

  // Completeness: four signals Hermes actually uses.
  const signals = [
    profile.researchTopics.length > 0,
    profile.preferredMethods.length > 0,
    profile.preferredVenues.length > 0,
    profile.locationPreferences.length > 0,
  ];
  const done = signals.filter(Boolean).length;
  const total = signals.length;

  return (
    <article className="mx-auto max-w-[740px] px-6 py-16 lg:py-20">
      <header className="mb-4">
        <h1
          className="text-[34px] lg:text-[38px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Profile
        </h1>
        <p className="text-text-muted mt-3 text-[16.5px] leading-relaxed max-w-[56ch]">
          Hermes reads the internet in the shape you define here. The more
          you tell it, the sharper the daily briefing.
        </p>
      </header>

      {/* ── Completeness ── */}
      <div
        className="mt-8 mb-12 flex items-center gap-4"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <div className="relative h-[3px] flex-1 rounded-full bg-border overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-accent/80 rounded-full transition-[width] duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <span className="text-[12.5px] text-text-faint tabular-nums shrink-0">
          {done} / {total} signals set
        </span>
      </div>

      {/* ── Group 1: Research ── */}
      <Group
        title="Research"
        caption="These signals shape which papers surface in your feed — topic match, methodology fit, preferred venues."
      >
        <Field
          label="Research topics"
          help="Hermes uses these as the primary query. Be specific — 'NLP' is too broad; 'instruction tuning for small models' is useful."
        >
          <ChipInput
            values={profile.researchTopics}
            onChange={updateTopics}
            placeholder="Add a topic…"
          />
        </Field>

        <Field
          label="Preferred methods"
          help="Narrows within topics. Pairs well with topics — 'NLP' + 'RLHF' recovers a specific slice of literature."
        >
          <ChipInput
            values={profile.preferredMethods}
            onChange={updateMethods}
            placeholder="e.g. diffusion, RL, graph neural networks"
          />
        </Field>

        <Field
          label="Preferred venues"
          help="Tap to toggle. Hermes boosts papers from these venues. Leave empty if you trust arXiv above all."
        >
          <div className="flex flex-wrap gap-2 pt-1">
            {realVenues.map((v) => {
              const active = profile.preferredVenues.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => toggleVenue(v)}
                  className={`text-[12.5px] px-3 py-1.5 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                    active
                      ? "bg-tag-dim text-tag shadow-[inset_0_0_0_1px_rgba(15,118,110,0.25)] scale-[1.03]"
                      : "text-text-faint hover:text-text-muted bg-bg-secondary/60 hover:bg-bg-secondary"
                  }`}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </Field>
      </Group>

      {/* ── Group 2: Career ── */}
      <Group
        title="Career"
        caption="These shape events and jobs — where you are, what you want next, and where you'd actually move."
      >
        <Field label="Career stage">
          <div
            className="flex flex-wrap gap-2 pt-1"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {careerStages.map((s) => {
              const active = profile.careerStage === s;
              return (
                <button
                  key={s}
                  onClick={() => updateCareerStage(s)}
                  className={`text-[12.5px] px-3 py-1.5 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                    active
                      ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)] scale-[1.03]"
                      : "text-text-faint hover:text-text-muted bg-bg-secondary/60 hover:bg-bg-secondary"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Looking toward"
          help="Filters the jobs feed. 'Either' keeps the surface wide."
        >
          <div
            className="flex flex-wrap gap-2 pt-1"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {industryPreferences.map((p) => {
              const active = profile.industryVsAcademia === p;
              return (
                <button
                  key={p}
                  onClick={() => updateIndustryPreference(p)}
                  className={`text-[12.5px] px-3 py-1.5 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
                    active
                      ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_rgba(245,132,20,0.3)] scale-[1.03]"
                      : "text-text-faint hover:text-text-muted bg-bg-secondary/60 hover:bg-bg-secondary"
                  }`}
                >
                  {industryLabels[p] ?? p}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Locations you'd move for"
          help="Used for event and job location filtering. 'Remote' counts as a location."
        >
          <ChipInput
            values={profile.locationPreferences}
            onChange={updateLocations}
            placeholder="Remote, Bay Area, London…"
          />
        </Field>
      </Group>

      {/* ── Danger zone ── */}
      <section
        className="mt-20 pt-6 border-t border-border"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {!showLogout ? (
          <button
            onClick={() => setShowLogout(true)}
            className="text-[12.5px] text-text-faint hover:text-red transition-colors"
          >
            Reset profile
          </button>
        ) : (
          <div className="text-[12.5px]">
            <p className="text-text-muted mb-2">
              This resets all settings to defaults.
            </p>
            <button
              onClick={() => {
                logOut();
                setShowLogout(false);
              }}
              className="text-red hover:text-red/80 mr-5"
            >
              Confirm reset
            </button>
            <button
              onClick={() => setShowLogout(false)}
              className="text-text-faint hover:text-text-muted"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </article>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers

function Group({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-7">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {title}
        </h2>
        <p className="text-text-muted text-[14.5px] mt-2 leading-[1.6] max-w-[60ch]">
          {caption}
        </p>
      </div>
      <div className="space-y-8">{children}</div>
    </section>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[14px] font-medium text-heading mb-1.5"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {label}
      </label>
      {help && (
        <p className="text-[12.5px] text-text-faint leading-[1.55] mb-3 max-w-[60ch]">
          {help}
        </p>
      )}
      {children}
    </div>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
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

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-surface shadow-card focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-accent/20 transition-shadow cursor-text min-h-[52px]"
    >
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-tag-dim text-tag text-[12.5px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {v}
          <button
            onClick={(e) => {
              e.stopPropagation();
              remove(v);
            }}
            aria-label={`Remove ${v}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-tag/20 text-tag/70 hover:text-tag transition-colors"
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
        className="flex-1 min-w-[8ch] bg-transparent text-text placeholder-text-faint/60 outline-none text-[14.5px] py-1"
        style={{ fontFamily: "var(--font-sans)" }}
      />
    </div>
  );
}
