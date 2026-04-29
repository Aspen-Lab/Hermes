// Five independent axes describing an academic working style.
// Inspired by Jung-style multi-dimensional traits (vs. MBTI's 16 boxes):
// each axis is a continuous score in [-1, +1], and a persona is named
// from the two axes farthest from zero. Combinations are descriptive,
// not categorical.

export type AxisId =
  | "empirical_theoretical"
  | "specialist_generalist"
  | "solo_collaborative"
  | "builder_critic"
  | "formal_narrative";

export interface AxisDef {
  id: AxisId;
  /** Negative pole: short label, single word ideally. */
  negative: string;
  /** Positive pole. */
  positive: string;
  /** Subtitle shown under axis bar in the result card. */
  blurb: string;
}

export const AXES: AxisDef[] = [
  {
    id: "empirical_theoretical",
    negative: "Empirical",
    positive: "Theoretical",
    blurb: "Where do you start — data or first principles?",
  },
  {
    id: "specialist_generalist",
    negative: "Specialist",
    positive: "Generalist",
    blurb: "Single deep question vs. roaming across fields.",
  },
  {
    id: "solo_collaborative",
    negative: "Solo",
    positive: "Collaborative",
    blurb: "Lone author or large-team operator.",
  },
  {
    id: "builder_critic",
    negative: "Builder",
    positive: "Critic",
    blurb: "Extending the canon vs. picking productive fights.",
  },
  {
    id: "formal_narrative",
    negative: "Formal",
    positive: "Narrative",
    blurb: "Math-and-proofs vs. prose-and-intuition.",
  },
];

export type Scores = Record<AxisId, number>;

export const ZERO_SCORES: Scores = {
  empirical_theoretical: 0,
  specialist_generalist: 0,
  solo_collaborative: 0,
  builder_critic: 0,
  formal_narrative: 0,
};

/**
 * Aggregate signed votes per axis into [-1, +1].
 * `votes[axis]` is the sum of (-1 | +1) signals from answered questions on that axis.
 * Normalize by the total weight from the question bank.
 */
export function normalizeScores(
  votes: Record<AxisId, number>,
  weights: Record<AxisId, number>,
): Scores {
  const out = { ...ZERO_SCORES };
  (Object.keys(votes) as AxisId[]).forEach((id) => {
    const w = weights[id] || 1;
    out[id] = Math.max(-1, Math.min(1, votes[id] / w));
  });
  return out;
}

// ── Persona naming ──────────────────────────────────────────────────
//
// Pick the two axes with the strongest absolute score; combine their
// active poles into a name. Fallback "The Polymath" for very flat profiles.

export interface Persona {
  name: string;
  tagline: string;
  blurb: string;
  /** MBTI-style appearance/vibe — concrete, light parody, recognizable. */
  look: string;
}

const POLE_LABEL: Record<AxisId, { neg: string; pos: string }> = {
  empirical_theoretical: { neg: "Empirical", pos: "Theoretical" },
  specialist_generalist: { neg: "Specialist", pos: "Generalist" },
  solo_collaborative: { neg: "Solo", pos: "Collaborative" },
  builder_critic: { neg: "Builder", pos: "Critic" },
  formal_narrative: { neg: "Formal", pos: "Narrative" },
};

/**
 * Curated names for common axis pairings. Keys are sorted alphabetically and
 * joined by `+`, where each token is "<axis>:<pole>". Order-independent.
 */
const PAIR_NAMES: Record<
  string,
  { name: string; tagline: string; blurb: string; look: string }
> = {
  "builder_critic:Builder+empirical_theoretical:Empirical": {
    name: "The Bench Builder",
    tagline: "Adds bricks to the wall, one experiment at a time.",
    blurb:
      "You trust evidence over elegance and prefer extending working frameworks to overturning them. Your papers tend to read like incremental upgrades that quietly redefine the baseline.",
    look: "Plaid flannel with rolled sleeves, ink on fingers. Laptop covered in stickers from defunct lab websites. Quiet, present, doesn't waste words — fixes your code without making you feel bad about it.",
  },
  "builder_critic:Critic+empirical_theoretical:Theoretical": {
    name: "The Theoretical Provocateur",
    tagline: "Looks for the assumption nobody questioned.",
    blurb:
      "You spot the unstated premise in everyone else's framework and write the paper that names it. Your contributions are reframings — short on data, long on consequences.",
    look: "Black turtleneck. Probably a scarf indoors. Glasses a stronger prescription than they need. Smiles half a second late after your point — the follow-up question is more interesting than your talk.",
  },
  "builder_critic:Critic+empirical_theoretical:Empirical": {
    name: "The Disconfirmer",
    tagline: "Runs the experiment that wasn't supposed to fail.",
    blurb:
      "You're empirically careful and theoretically restless. The papers you cite hardest are usually the ones whose results you couldn't reproduce.",
    look: "Lab notebook always open, slightly worn corduroys. Browser has 47 tabs and one is the original Bem 2011. Agreeable until they aren't — you'll know which week they hit a 'wait, let me check that figure' moment.",
  },
  "specialist_generalist:Specialist+empirical_theoretical:Empirical": {
    name: "The Bench Specialist",
    tagline: "One question, ten years, all the apparatus.",
    blurb:
      "You pick a narrow phenomenon and chase it until you own the literature. Tooling, replication, and method calibration are not chores — they are the work.",
    look: "Same fleece for a decade. Carries calibration tools in a tackle box. Field-station tan. Slow to start, doesn't stop. Knows the 1973 paper everyone forgot — and they're citation 47 in your bibliography.",
  },
  "specialist_generalist:Generalist+empirical_theoretical:Theoretical": {
    name: "The Field Crosser",
    tagline: "Reads three disciplines before lunch.",
    blurb:
      "You import frameworks across fields and notice analogies others miss. Risk: the depth police will hate one section of every paper. Worth it.",
    look: "Scarf in any weather. Three books from different disciplines in their bag. Eats lunch with a different department every day. Makes you feel smart by repeating your idea back with a metaphor from biology.",
  },
  "formal_narrative:Formal+specialist_generalist:Specialist": {
    name: "The Method Architect",
    tagline: "The proof is the paper.",
    blurb:
      "You build formal machinery others use as a foundation. Your papers are dense, narrow, and quietly cited everywhere downstream.",
    look: "Five identical button-downs on rotation. Fountain pen, leather notebook. Speaks in proofs. Will not move on until the lemma is correct. Indispensable as a coauthor; terrifying as a reviewer.",
  },
  "formal_narrative:Narrative+specialist_generalist:Generalist": {
    name: "The Synthesist",
    tagline: "Weaves four literatures into one story.",
    blurb:
      "You write essays that look like surveys but argue like position papers. Your superpower is making other people's work visible to each other.",
    look: "Linen blazer, soft layers, reading glasses on a chain. Bag has six books they're 'in the middle of'. The most temperate person at dinner — until you read their four-page review of your paper.",
  },
  "solo_collaborative:Collaborative+formal_narrative:Formal": {
    name: "The Lab Lead",
    tagline: "Author #1 of 23, and not by accident.",
    blurb:
      "You run a coordinated formal program — multiple students, shared apparatus, papers as outputs of an ongoing investigation. Less lone genius, more research factory.",
    look: "Blazer with ID badge clipped. Hair tied back. Calendar in nine colors. Always slightly late, never apologetic. Gracious to students, terrifying to grant officers — and they remember every coauthor's name.",
  },
  "solo_collaborative:Solo+formal_narrative:Narrative": {
    name: "The Solo Essayist",
    tagline: "One name on the byline, and it's earned.",
    blurb:
      "You write the kind of long, voice-driven paper where rephrasing a sentence is the same activity as rephrasing the argument. Coauthors slow you down.",
    look: "Rumpled. Glasses with one screw loose. Cardigan in summer. Hard to schedule, impossible to interrupt. Their answer to 'any thoughts?' is 2,000 words and all of them are good.",
  },
  "builder_critic:Builder+solo_collaborative:Collaborative": {
    name: "The Group Builder",
    tagline: "Scales good ideas through other people.",
    blurb:
      "Your contributions are infrastructure — datasets, benchmarks, frameworks — and the citations they accrue come from people doing very different work than yours.",
    look: "Hoodie. GitHub sticker on laptop. Thermos in hand. Comfortable in any room with a whiteboard. Low-ego, high-throughput. Your favorite dataset / benchmark / framework is theirs.",
  },
};

const SOLO_NAMES: Record<
  AxisId,
  {
    neg: { name: string; look: string };
    pos: { name: string; look: string };
  }
> = {
  empirical_theoretical: {
    neg: {
      name: "The Bench Operator",
      look: "Olive flannel with rolled sleeves, top-knot, wire-frame glasses. Laptop is a graveyard of dead projects (Dead Labs, CrashedTech, DataCorpse). Coffee + open sketchbook. Anti-glamour. Gets it done quietly.",
    },
    pos: {
      name: "The Theorist",
      look: "Tortoise-shell glasses, soft turtleneck, marker on the cuff. Always finds the chalk-friendly classroom. Says 'I don't know yet' more often than anyone in the room.",
    },
  },
  specialist_generalist: {
    neg: {
      name: "The Specialist",
      look: "One outfit, one question, one decade. Books on shelf are all in the same color family. Knows the literature so well they've stopped checking citations.",
    },
    pos: {
      name: "The Polymath",
      look: "Library bag is a bouquet — one book per discipline. Cold brew, three pens, an opened-and-closed magazine. The room they entered is now a different room.",
    },
  },
  solo_collaborative: {
    neg: {
      name: "The Solo Author",
      look: "Coat and headphones; you don't talk to them at a workshop. Late-night commits stronger than the coauthored papers. The byline is one name, and that's the point.",
    },
    pos: {
      name: "The Convener",
      look: "Clipboard or tablet calendar always in hand. Knows everyone's name and what they're working on. The Slack workspace was their idea, the channel naming convention is theirs too.",
    },
  },
  builder_critic: {
    neg: {
      name: "The Builder",
      look: "Cargo pants, hoodie, laptop bag with a USB drive on a lanyard. Says 'let me try' more often than 'let me check'. The repo is theirs and the wiki has no broken links.",
    },
    pos: {
      name: "The Provocateur",
      look: "Black sweater, opinions visible from across the room. Asks 'why this question?' before 'why this method?'. Their reading list is half retracted papers.",
    },
  },
  formal_narrative: {
    neg: {
      name: "The Formalist",
      look: "Buttoned-up shirt, fountain pen, single sheet of paper with one equation in pencil. Will not say 'roughly' if 'precisely' is available.",
    },
    pos: {
      name: "The Essayist",
      look: "Soft fabrics, a notebook in the side pocket of a tote bag, two unfinished books on the table. Speaks in clauses; writes in arcs.",
    },
  },
};

export function pickPersona(scores: Scores): Persona {
  const ranked = (Object.keys(scores) as AxisId[])
    .map((id) => ({ id, score: scores[id], abs: Math.abs(scores[id]) }))
    .sort((a, b) => b.abs - a.abs);

  const top = ranked[0];
  const second = ranked[1];

  // Very flat profile: use Polymath fallback.
  if (top.abs < 0.25) {
    return {
      name: "The Polymath",
      tagline: "Resists every box on offer.",
      blurb:
        "Your scores sit close to the center on every axis. Either you genuinely work across registers or the questions didn't catch you — try answering on instinct.",
      look: "Patagonia Monday, Oxford shirt Tuesday, hoodie Wednesday. No tribe, no uniform, no tells. Refuses every box; possibly the box is wrong.",
    };
  }

  const topPole = top.score >= 0 ? POLE_LABEL[top.id].pos : POLE_LABEL[top.id].neg;
  const secondPole =
    second.score >= 0 ? POLE_LABEL[second.id].pos : POLE_LABEL[second.id].neg;

  const key = [
    `${top.id}:${topPole}`,
    `${second.id}:${secondPole}`,
  ]
    .sort()
    .join("+");

  if (PAIR_NAMES[key]) return PAIR_NAMES[key];

  // Fallback: name from dominant axis pole only.
  const solo = top.score >= 0 ? SOLO_NAMES[top.id].pos : SOLO_NAMES[top.id].neg;
  const secondaryAdj =
    second.score >= 0 ? POLE_LABEL[second.id].pos : POLE_LABEL[second.id].neg;

  return {
    name: solo.name,
    tagline: `Leans ${secondaryAdj.toLowerCase()} on a second read.`,
    blurb: `Your strongest signal is on the ${POLE_LABEL[top.id].neg}–${POLE_LABEL[top.id].pos} axis. The next loudest is ${POLE_LABEL[second.id].neg}–${POLE_LABEL[second.id].pos}. Together they describe most of how you work; the rest is fine-tuning.`,
    look: solo.look,
  };
}
