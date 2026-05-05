"use client";

import { useState } from "react";
import { AXES, type AxisId, type Persona, type Scores } from "@/lib/persona/axes";

interface PersonaResultProps {
  scores: Scores;
  persona: Persona;
  onRestart: () => void;
}

// Convention: drop a portrait at `web/public/persona/<slug>.png` and it
// auto-renders above the title. Slug = persona name, lowercased, leading
// "the " stripped, non-alphanumerics → dashes.
//
//   The Bench Operator       → bench-operator.png
//   The Theoretical Provocateur → theoretical-provocateur.png
//   The Polymath             → polymath.png
//
// If the file is missing, the <img> errors and the component renders null.
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function PersonaArt({ name }: { name: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  const src = `/persona/${nameToSlug(name)}.png`;
  return (
    <figure className="relative">
      {/* Soft cream-on-surface card frames the polygon portrait */}
      <div className="rounded-[28px] bg-gradient-to-b from-[color:var(--color-bg-secondary)]/60 to-[color:var(--color-bg-secondary)]/30 p-6 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          onError={() => setErrored(true)}
          className="block w-full h-auto object-contain max-h-[420px]"
          loading="eager"
          decoding="async"
        />
      </div>
      <figcaption
        className="mt-4 text-center text-[10.5px] uppercase tracking-[0.22em] text-text-faint"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        — Profile sketch —
      </figcaption>
    </figure>
  );
}

export function PersonaResult({
  scores,
  persona,
  onRestart,
}: PersonaResultProps) {
  return (
    <div
      className="grid lg:grid-cols-[minmax(280px,360px)_1fr] gap-10 lg:gap-16 items-start animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* ── Left: portrait, sticky on desktop ── */}
      <aside className="lg:sticky lg:top-12 self-start">
        <PersonaArt name={persona.name} />
      </aside>

      {/* ── Right: text, axes, retake ── */}
      <div className="flex flex-col gap-10 max-w-[620px]">
        <header className="flex flex-col gap-3">
          <span className="text-[10.5px] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            Your academic persona
          </span>
          <h1
            className="text-[40px] md:text-[52px] text-heading leading-[1.02] tracking-[-0.018em]"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
          >
            {persona.name}
          </h1>
          <p
            className="text-[18px] md:text-[19px] text-text-muted leading-[1.55] italic"
            style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
          >
            {persona.tagline}
          </p>
        </header>

        <p
          className="text-[15.5px] text-text leading-[1.75]"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          {persona.blurb}
        </p>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[color:var(--color-border)]" aria-hidden />
            <h2 className="text-[10.5px] uppercase tracking-[0.22em] text-text-faint">
              Spotted at the conference like
            </h2>
            <span className="h-px flex-1 bg-[color:var(--color-border)]" aria-hidden />
          </div>
          <p
            className="text-[15px] text-text-muted leading-[1.7] italic"
            style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
          >
            {persona.look}
          </p>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-[10.5px] uppercase tracking-[0.22em] text-text-faint">
            Your axes
          </h2>
          <div className="flex flex-col gap-5">
            {AXES.map((axis) => (
              <AxisBar
                key={axis.id}
                id={axis.id}
                negative={axis.negative}
                positive={axis.positive}
                blurb={axis.blurb}
                score={scores[axis.id]}
              />
            ))}
          </div>
        </section>

        <footer className="flex items-center gap-3 pt-6 border-t border-[color:var(--color-border)]">
          <button
            type="button"
            onClick={onRestart}
            className="h-10 px-5 rounded-full bg-surface shadow-card hover:shadow-card-hover hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 ease-out text-[13px] text-text"
          >
            Retake quiz
          </button>
          <span className="text-[11.5px] text-text-faint italic">
            Saved locally only — not uploaded.
          </span>
        </footer>
      </div>
    </div>
  );
}

interface AxisBarProps {
  id: AxisId;
  negative: string;
  positive: string;
  blurb: string;
  /** Score in [-1, +1]. */
  score: number;
}

function AxisBar({ negative, positive, blurb, score }: AxisBarProps) {
  // Convert [-1, +1] to a marker position in [0, 100]%.
  const pct = ((score + 1) / 2) * 100;
  const isNeg = score < 0;
  const strength = Math.abs(score);
  // Stronger lean → bolder pole label.
  const negStrong = isNeg && strength > 0.33;
  const posStrong = !isNeg && strength > 0.33;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-[13.5px]">
        <span
          className={[
            "transition-colors",
            negStrong ? "text-heading font-semibold" : "text-text-faint",
          ].join(" ")}
        >
          {negative}
        </span>
        <span
          className={[
            "transition-colors",
            posStrong ? "text-heading font-semibold" : "text-text-faint",
          ].join(" ")}
        >
          {positive}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[color:var(--color-bg-secondary)] overflow-visible">
        <div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-[color:var(--color-border-strong)]"
          style={{ left: "0", right: "0" }}
        />
        <div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-[color:var(--color-border-strong)]"
          style={{ left: "50%", transform: "translate(-50%, -50%)" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[color:var(--color-accent)] shadow-card transition-[left] duration-500 ease-out"
          style={{ left: `calc(${pct}% - 8px)` }}
          aria-label={`Score ${score.toFixed(2)}`}
        />
      </div>
      <p className="text-[12px] text-text-faint">{blurb}</p>
    </div>
  );
}
