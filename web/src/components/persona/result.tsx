"use client";

import { AXES, type AxisId, type Persona, type Scores } from "@/lib/persona/axes";

interface PersonaResultProps {
  scores: Scores;
  persona: Persona;
  onRestart: () => void;
}

export function PersonaResult({
  scores,
  persona,
  onRestart,
}: PersonaResultProps) {
  return (
    <div
      className="flex flex-col gap-10 animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex flex-col gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
          Your academic persona
        </span>
        <h1
          className="text-[36px] md:text-[44px] text-heading leading-[1.05] tracking-[-0.015em]"
          style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
        >
          {persona.name}
        </h1>
        <p
          className="text-[17px] text-text-muted leading-[1.55] max-w-[640px]"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          {persona.tagline}
        </p>
      </div>

      <p
        className="text-[15px] text-text leading-[1.7] max-w-[640px]"
        style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
      >
        {persona.blurb}
      </p>

      <div className="flex flex-col gap-3 max-w-[640px]">
        <h2 className="text-[12px] uppercase tracking-[0.18em] text-text-faint">
          Spotted at the conference like
        </h2>
        <p
          className="text-[14.5px] text-text-muted leading-[1.65] italic border-l-2 border-[color:var(--color-accent)] pl-4"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          {persona.look}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <h2 className="text-[12px] uppercase tracking-[0.18em] text-text-faint">
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
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-[color:var(--color-border)]">
        <button
          type="button"
          onClick={onRestart}
          className="h-10 px-4 rounded-full bg-surface shadow-card hover:shadow-card-hover transition-shadow text-[13px] text-text"
        >
          Retake
        </button>
        <span className="text-[12px] text-text-faint">
          Saved locally only — not uploaded.
        </span>
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
