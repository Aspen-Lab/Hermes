import type { AxisId } from "./axes";

export interface Question {
  id: string;
  axis: AxisId;
  /** Choosing A contributes -1 to the axis (the "negative" pole). */
  a: string;
  /** Choosing B contributes +1 to the axis (the "positive" pole). */
  b: string;
}

// 15 questions, 3 per axis. Forced choice — no neutral option.
// Each pair frames a working tendency, not a value judgment.
export const QUESTIONS: Question[] = [
  // ── Empirical (-) vs Theoretical (+) ─────────────────────────────
  {
    id: "et_1",
    axis: "empirical_theoretical",
    a: "I trust a result more after I've seen it replicated across three datasets.",
    b: "I trust a result more after I see why it has to be true.",
  },
  {
    id: "et_2",
    axis: "empirical_theoretical",
    a: "A new method is exciting if it bumps a benchmark.",
    b: "A new method is exciting if it explains an existing benchmark.",
  },
  {
    id: "et_3",
    axis: "empirical_theoretical",
    a: "I'd rather spend a week debugging an experiment than a week deriving an equation.",
    b: "I'd rather spend a week deriving an equation than a week debugging an experiment.",
  },

  // ── Specialist (-) vs Generalist (+) ─────────────────────────────
  {
    id: "sg_1",
    axis: "specialist_generalist",
    a: "I want to be the person other people email when their narrow problem comes up.",
    b: "I want to be the person who connects two narrow problems nobody noticed were the same.",
  },
  {
    id: "sg_2",
    axis: "specialist_generalist",
    a: "I read deeply in one literature and shallow-skim adjacent ones.",
    b: "I read shallowly across many literatures and stitch them together.",
  },
  {
    id: "sg_3",
    axis: "specialist_generalist",
    a: "Switching subfields feels like starting over.",
    b: "Switching subfields feels like finding a new lens for the same instinct.",
  },

  // ── Solo (-) vs Collaborative (+) ────────────────────────────────
  {
    id: "sc_1",
    axis: "solo_collaborative",
    a: "My best work happens when I'm the only one in the document.",
    b: "My best work happens when three people are arguing in the document.",
  },
  {
    id: "sc_2",
    axis: "solo_collaborative",
    a: "I'd rather author one careful paper than coauthor four.",
    b: "I'd rather coauthor four ambitious papers than author one careful one.",
  },
  {
    id: "sc_3",
    axis: "solo_collaborative",
    a: "Coordinating a team is overhead I tolerate.",
    b: "Coordinating a team is part of the research, not overhead.",
  },

  // ── Builder (-) vs Critic (+) ────────────────────────────────────
  {
    id: "bc_1",
    axis: "builder_critic",
    a: "I'd rather build the next layer on a working framework.",
    b: "I'd rather show that the current framework rests on a shaky assumption.",
  },
  {
    id: "bc_2",
    axis: "builder_critic",
    a: "A great paper consolidates messy work into a clean foundation.",
    b: "A great paper destabilizes a foundation that everyone treated as clean.",
  },
  {
    id: "bc_3",
    axis: "builder_critic",
    a: "I revise my view when the evidence forces me.",
    b: "I revise my view because the framing was wrong, not just the evidence.",
  },

  // ── Formal (-) vs Narrative (+) ──────────────────────────────────
  {
    id: "fn_1",
    axis: "formal_narrative",
    a: "If a claim can be a theorem, it should be.",
    b: "If a claim needs a theorem, the framing probably failed.",
  },
  {
    id: "fn_2",
    axis: "formal_narrative",
    a: "I'd rather write the equations than the introduction.",
    b: "I'd rather write the introduction than the equations.",
  },
  {
    id: "fn_3",
    axis: "formal_narrative",
    a: "I judge a paper's clarity by its definitions.",
    b: "I judge a paper's clarity by its first three paragraphs.",
  },
];

export const AXIS_WEIGHTS: Record<AxisId, number> = {
  empirical_theoretical: 3,
  specialist_generalist: 3,
  solo_collaborative: 3,
  builder_critic: 3,
  formal_narrative: 3,
};
