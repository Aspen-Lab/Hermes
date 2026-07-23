"use client";

// First-run onboarding wizard. Apple-setup-style: one idea per page, every
// page optional except Topics (which the feed needs to produce a real first
// briefing). Writes straight to the shared profile store — same store, same
// field components as /profile — and on finish marks onboarding complete and
// hands off to the feed with the coachmark tour (`/?tour=1`).
//
// This page intentionally renders regardless of the onboarding flag, so a
// developer can open /welcome at any time to iterate. The first-run *gating*
// (auto-redirect for brand-new users) lives in <FirstRunGate>.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useProfileStore } from "@/store/profile";
import { careerStages, industryPreferences } from "@/types";
import {
  ChipInput,
  ChoiceGroup,
  RadioGroup,
  TogglePill,
  TopicsField,
  industryLabels,
  PAPER_FOCUS_OPTIONS,
  PAPER_FRESHNESS_OPTIONS,
  PAPER_COUNT_OPTIONS,
  PAPER_SOURCE_OPTIONS_DETAILED,
  PAPER_IMPORTANCE_OPTIONS,
  PAPER_DISCOVERY_OPTIONS,
} from "@/components/profile/field-kit";
import { AiKeyFields, ApiKeyHelp } from "@/components/profile/ai-setup";
import { SchoolAutocomplete } from "@/components/profile/school-autocomplete";
import { AdvisorField } from "@/components/profile/advisor-field";
import { ConnectorPanel } from "@/components/profile/connector-panel";

const DEFAULT_NAME = "Peer Member";

type StepKey = "basics" | "topics" | "work" | "radar" | "ai" | "connectors" | "persona";

const STEP_ORDER: StepKey[] = ["basics", "topics", "work", "radar", "ai", "connectors", "persona"];

export default function WelcomePage() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const store = useProfileStore();
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);

  const total = STEP_ORDER.length;
  const key = STEP_ORDER[step];
  const isLast = step === total - 1;

  // Topics is the one gate: the feed needs at least one required topic to build
  // a real first briefing.
  const topicsSatisfied = profile.researchTopics.length > 0;
  const canContinue = key === "topics" ? topicsSatisfied : true;


  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finishToTour = () => {
    completeOnboarding();
    router.push("/?tour=1");
  };

  const skipEverything = () => {
    completeOnboarding();
    router.push("/");
  };

  const name = profile.displayName === DEFAULT_NAME ? "" : profile.displayName;

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center">
      <div className="w-full max-w-[640px] px-6 py-12 lg:py-16">
        {/* Header / brand + skip */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-mark.png" alt="Peer" width={28} height={28} className="opacity-90" />
            <span className="text-body-sm font-semibold tracking-[-0.01em] text-heading">Peer</span>
          </div>
          <button
            type="button"
            onClick={skipEverything}
            className="text-meta text-text-faint hover:text-text-muted transition-colors"
          >
            Skip setup →
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4 mb-9">
          <div className="flex-1 h-1 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
          <span className="text-meta text-text-faint tabular-nums shrink-0">
            {step + 1} / {total}
          </span>
        </div>

        {/* Step body */}
        <div className="animate-fade-in-up">
          {key === "basics" && (
            <StepFrame
              kicker="Welcome"
              title="Let's get you set up."
              subtitle="A few quick details so Peer knows who it's briefing. All optional — change anything later in your profile."
            >
              <Field label="Your name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => store.updateDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2.5 text-body text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </Field>
              <Field label="Career stage">
                <PillGroup
                  options={careerStages.map((s) => ({ value: s, label: s }))}
                  value={profile.careerStage}
                  onChange={(v) => store.updateCareerStage(v as typeof profile.careerStage)}
                />
              </Field>
              <Field label="Looking toward">
                <PillGroup
                  options={industryPreferences.map((p) => ({ value: p, label: industryLabels[p] ?? p }))}
                  value={profile.industryVsAcademia}
                  onChange={(v) => store.updateIndustryPreference(v as typeof profile.industryVsAcademia)}
                />
              </Field>
            </StepFrame>
          )}

          {key === "topics" && (
            <StepFrame
              kicker="The one that matters"
              title="What should Peer track for you?"
              subtitle="This is the heart of your briefing. Add at least one Required topic — every paper in your feed must match one of these. Type a topic and press comma or Enter to turn it into a tag; drag a tag between columns to re-rank it."
            >
              <TopicsField
                required={profile.researchTopics}
                soft={profile.softTopics ?? []}
                onChangeRequired={store.updateTopics}
                onChangeSoft={store.updateSoftTopics}
              />
              {!topicsSatisfied && (
                <p className="mt-4 text-meta text-accent/90 flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                  </svg>
                  Add one Required topic to continue — this is what your first briefing is built from.
                </p>
              )}
            </StepFrame>
          )}

          {key === "work" && (
            <StepFrame
              kicker="Your work"
              title="What are you working on, and with whom?"
              subtitle="Optional, but the single biggest lever on quality. Peer biases your briefing toward your real project, open problems, and your advisor's research lineage."
            >
              <Field label="Current project" hint="1–3 sentences about what you're building right now.">
                <textarea
                  value={profile.currentProject ?? ""}
                  onChange={(e) => store.updateCurrentProject(e.target.value)}
                  rows={3}
                  placeholder="Describe the specific project you're working on right now."
                  className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2.5 text-body text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all resize-y leading-relaxed"
                />
              </Field>
              <Field label="Open challenges" hint="The unknowns you wish someone would solve. Papers that mention these rise to the top.">
                <textarea
                  value={profile.currentChallenges ?? ""}
                  onChange={(e) => store.updateCurrentChallenges(e.target.value)}
                  rows={3}
                  placeholder="The open problems you want your briefing to help with."
                  className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2.5 text-body text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all resize-y leading-relaxed"
                />
              </Field>

              <div className="pt-2 border-t border-border/60 space-y-4">
                <Field label="School / org" hint="Used to pin down the right advisor.">
                  <SchoolAutocomplete
                    value={profile.school ?? ""}
                    onChange={store.updateSchool}
                    placeholder="University or company"
                  />
                </Field>
                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
                    Advisor / PI
                  </p>
                  <AdvisorField
                    advisorName={profile.advisorName ?? ""}
                    school={profile.school ?? ""}
                    advisorAuthorId={profile.advisorAuthorId}
                    advisorAuthorLabel={profile.advisorAuthorLabel}
                    onChangeName={store.updateAdvisorName}
                    onConfirm={store.confirmAdvisorAuthor}
                    onClear={store.clearAdvisorAuthor}
                  />
                </div>
              </div>
            </StepFrame>
          )}

          {key === "radar" && (
            <StepFrame
              kicker="Tuning"
              title="How should your radar sweep?"
              subtitle="Sensible defaults are already chosen — adjust only what you care about, or just continue."
            >
              <div className="space-y-4">
                <ChoiceGroup label="Focus" value={profile.feedFocus} options={PAPER_FOCUS_OPTIONS} onChange={(v) => store.updateFeedFocus(v as typeof profile.feedFocus)} />
                <ChoiceGroup label="Freshness" value={profile.feedFreshness} options={PAPER_FRESHNESS_OPTIONS} onChange={(v) => store.updateFeedFreshness(v as typeof profile.feedFreshness)} />
                <ChoiceGroup label="Papers shown" value={profile.paperCount} options={PAPER_COUNT_OPTIONS} onChange={(v) => store.updatePaperCount(v as typeof profile.paperCount)} />

                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">Sources</p>
                  <RadioGroup
                    value={profile.feedSourceMix}
                    options={PAPER_SOURCE_OPTIONS_DETAILED}
                    onChange={(v) => store.updateFeedSourceMix(v as typeof profile.feedSourceMix)}
                  />
                </div>

                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">Preferred journals</p>
                  <ChipInput
                    values={profile.preferredJournals ?? []}
                    onChange={store.updatePreferredJournals}
                    placeholder="Add a journal, press Enter"
                    tone="link"
                  />
                  <p className="mt-1.5 px-0.5 text-caption leading-relaxed text-text-faint/75">
                    List the journals you trust most. Peer treats these as a primary source and
                    gives papers from them a relevance boost (+1/3 of their score), so they rise to
                    the top — though an exceptionally on-target paper from elsewhere can still win.
                  </p>
                </div>

                <ChoiceGroup label="Importance" value={profile.feedImportance} options={PAPER_IMPORTANCE_OPTIONS} onChange={(v) => store.updateFeedImportance(v as typeof profile.feedImportance)} />
                <ChoiceGroup label="Discovery" value={profile.feedDiscoveryMode} options={PAPER_DISCOVERY_OPTIONS} onChange={(v) => store.updateFeedDiscoveryMode(v as typeof profile.feedDiscoveryMode)} />
                <div>
                  <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">Avoid</p>
                  <div className="flex flex-wrap gap-1.5">
                    <TogglePill label="Review papers" active={profile.feedAvoidReviews} onToggle={() => store.updateFeedAvoidReviews(!profile.feedAvoidReviews)} />
                    <TogglePill label="Old papers" active={profile.feedAvoidOldPapers} onToggle={() => store.updateFeedAvoidOldPapers(!profile.feedAvoidOldPapers)} />
                    <TogglePill label="Broad surveys" active={profile.feedAvoidBroadSurveys} onToggle={() => store.updateFeedAvoidBroadSurveys(!profile.feedAvoidBroadSurveys)} />
                  </div>
                </div>

              </div>
            </StepFrame>
          )}

          {key === "ai" && (
            <StepFrame
              kicker="Optional power-up"
              title="Connect an AI key (optional)."
              subtitle="Peer works fully free with zero setup. Adding a key unlocks sharper, AI-written briefings and Deep report — and you can always do this later."
            >
              <div className="rounded-xl bg-accent-dim/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_25%,transparent)] px-4 py-3">
                <p className="text-meta leading-relaxed text-heading">
                  <strong>Peer runs significantly better with an API key.</strong>{" "}
                  A key powers the smarter Tier 1/2 ranking and the full-text Deep report.
                  Without one, you still get a complete free briefing.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <AiKeyFields
                  provider={profile.feedAiProvider}
                  apiKey={profile.feedAiApiKey ?? ""}
                  onProviderChange={store.updateFeedAiProvider}
                  onApiKeyChange={store.updateFeedAiApiKey}
                  idPrefix="welcome-ai"
                />
                <ApiKeyHelp />
                <p className="text-caption leading-relaxed text-text-faint">
                  Deep report and Tavily web scouting can be switched on anytime from the
                  search bar once a key is set. Your key is stored only in your browser.
                </p>
              </div>
            </StepFrame>
          )}

          {key === "connectors" && (
            <StepFrame
              kicker="Optional power-up"
              title="Turn on Events & Jobs for your field."
              subtitle="Papers work out of the box. Events and jobs need a data source — the free curated feeds only cover CS/AI, so for every other field these three free keys are what make your Events and Jobs tabs fill up."
            >
              <div className="rounded-xl bg-accent-dim/60 shadow-[inset_0_0_0_1px_rgba(245,132,20,0.25)] px-4 py-3 mb-4">
                <p className="text-[12.5px] leading-relaxed text-heading">
                  <strong>Why this matters:</strong> a materials-science conference or a
                  battery-lab postdoc never appears in a CS-only feed. These sources search
                  the whole web and every major job board for <em>your</em> topics — all free,
                  all stored only in your browser.
                </p>
              </div>

              <div className="space-y-2.5 mb-4">
                <ApiIntro
                  name="Tavily"
                  tag="Events + academic jobs · all fields"
                  why="Discovers conferences, CFPs, and postings on sites that have no API (HigherEdJobs, jobs.ac.uk, Nature Careers). This is the single biggest unlock for non-CS fields."
                  how="Free — 1,000 searches/month. Sign up, copy the key from your dashboard."
                  href="https://tavily.com"
                />
                <ApiIntro
                  name="Adzuna"
                  tag="Industry jobs · 19 countries"
                  why="Aggregates company R&D and lab roles across major job boards — the best source of industry positions for researchers eyeing the private sector."
                  how="Free tier. Register an app at developer.adzuna.com for an App ID + App Key."
                  href="https://developer.adzuna.com"
                />
                <ApiIntro
                  name="USAJobs"
                  tag="US federal & national labs"
                  why="Every US government research posting — NIH, NSF, and DOE national labs (Argonne, NREL, Berkeley Lab). Nowhere else lists these as cleanly."
                  how="Free, instant. Request a key with your email at developer.usajobs.gov."
                  href="https://developer.usajobs.gov/apirequest/"
                />
              </div>

              <div className="rounded-xl bg-surface shadow-[inset_0_0_0_1px_rgba(20,20,20,0.06)] overflow-hidden">
                <ConnectorPanel />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
                Add any or none now — you can paste keys later from the “Data APIs” button in
                the search bar. Keys never leave your browser.
              </p>
            </StepFrame>
          )}

          {key === "persona" && (
            <StepFrame
              kicker="One more thing"
              title="Want Peer to learn your reading style?"
              subtitle="An optional 2-minute quiz that maps how you tend to work across five axes. It helps shape your feed — but you can absolutely skip it and just explore."
            >
              <div className="rounded-2xl bg-surface shadow-card p-6 flex items-start gap-4">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-accent-dim text-accent shrink-0 text-title">
                  ◎
                </span>
                <div className="min-w-0">
                  <p className="text-body-lg font-medium text-heading">Academic persona quiz</p>
                  <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                    Fifteen forced-choice questions. Not a test — a description of your
                    defaults, useful for tuning what you see.
                  </p>
                  <Link
                    href="/persona"
                    onClick={() => completeOnboarding()}
                    className="mt-3 inline-flex items-center gap-1.5 text-body-sm text-accent hover:text-accent/80 font-medium transition-colors"
                  >
                    Take the quiz
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </StepFrame>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            aria-disabled={step === 0}
            className={`text-body-sm transition-colors ${
              step === 0
                ? "text-text-faint/30 cursor-default pointer-events-none"
                : "text-text-faint hover:text-text-muted"
            }`}
          >
            ← Back
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={finishToTour}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-accent text-white text-body-sm font-medium shadow-card hover:bg-accent/90 transition-colors active:scale-[0.97]"
            >
              Enter Peer
              <span aria-hidden>→</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={canContinue ? next : undefined}
              aria-disabled={!canContinue}
              className={`inline-flex items-center gap-1.5 h-10 px-5 rounded-full text-body-sm font-medium transition-colors active:scale-[0.97] ${
                canContinue
                  ? "bg-heading text-bg shadow-card hover:bg-heading/90"
                  : "bg-bg-secondary text-text-faint/70 cursor-default pointer-events-none"
              }`}
            >
              Continue
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small layout helpers ───────────────────────────────────────

// Compact "what this API is and why it's worth 2 minutes" card, used in the
// connectors onboarding step.
function ApiIntro({
  name,
  tag,
  why,
  how,
  href,
}: {
  name: string;
  tag: string;
  why: string;
  how: string;
  href: string;
}) {
  return (
    <div className="rounded-xl bg-bg-secondary/40 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[13.5px] font-semibold text-heading">{name}</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-accent/90 text-right">
          {tag}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-text-muted">{why}</p>
      <p className="text-[11px] leading-relaxed text-text-faint mt-1.5">
        {how}{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Get a key ↗
        </a>
      </p>
    </div>
  );
}

function StepFrame({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-micro font-semibold uppercase tracking-[0.22em] text-accent/90 mb-2.5">
        <span className="inline-block w-4 h-[1.5px] bg-accent/70 align-middle mr-2" />
        {kicker}
      </p>
      <h1
        className="text-[28px] lg:text-[32px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
      >
        {title}
      </h1>
      <p className="text-text-muted mt-3 text-body leading-[1.6] max-w-[56ch]">
        {subtitle}
      </p>
      <div className="mt-7 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-micro font-semibold uppercase tracking-[0.14em] text-text-faint/80 mb-1.5">
        {label}
      </p>
      {children}
      {hint && (
        <p className="text-caption text-text-faint/75 mt-1.5 px-0.5 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-meta px-2.5 py-1 rounded-full transition-all duration-200 ease-out active:scale-[0.94] ${
              active
                ? "bg-accent-dim text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] scale-[1.03]"
                : "text-text-faint hover:text-text-muted bg-bg-secondary/40 hover:bg-bg-secondary/70"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
