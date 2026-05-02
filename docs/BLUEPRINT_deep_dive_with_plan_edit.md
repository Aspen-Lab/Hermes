# Blueprint — Deep Dive Mode (with Plan Preview + Edit)

**Status:** Parked. Not on the active roadmap. Revisit when daily-flow features (synthesized digest, audio briefing, sub-agents) are stable and users start asking "can I dig deeper into X?"

**Why parked:** Deep-dive is a *power-user* feature. The core Hermes vision is the calm daily weather forecast; deep-dive is a different cognitive mode (active research, not passive reading) and risks pulling product attention away from the morning-ritual goal. Build the daily ritual first; let user demand pull deep-dive into existence.

---

## 1. The user story

> "Hermes, give me everything notable in **LCO cathode degradation research** over the past month. I want to read for 30 minutes and come out caught up."

Hermes today can't answer this. The daily briefing is fixed at 10 papers, scoped to "today," and uses a single flat pipeline. A deep dive needs:

- **Wider net** — search across more sources, more results per source, more time horizons
- **Iterative refinement** — first pass surfaces gaps; second pass fills them
- **Synthesis at length** — not a paragraph, a multi-section report with sub-headings
- **Human steering** — let the user scope the investigation before it runs

This is exactly the pattern deer-flow built around. Their nodes (Coordinator → Planner → Human Feedback → Researchers → Reporter) translate cleanly.

## 2. The flow (combined deep-dive + plan-edit)

```
User opens "Deep Dive" surface
        ↓
Types a question in natural language:
  "What's happening in LCO cathode degradation research this month?"
        ↓
Planner agent drafts a research plan:
  • What sub-questions to investigate
  • What sources to query
  • What time range
  • Estimated runtime (e.g. ~3 minutes)
        ↓
PLAN PREVIEW UI ← critical UX moment
  Shown to user as an editable card list:
    [✓] Find recent papers on H1-3 phase transition mechanisms
    [✓] Track ALD-coating progress for 4.6V cycling
    [✓] Look for new operando characterization techniques
    [✗] (user removed) Search general battery news
    [+] (user added) Check what DeepMind / Toyota Research has published
        ↓
User clicks "Run"
        ↓
Sub-agents fan out in parallel (one per sub-question)
Each sub-agent: search → score → extract → cite
        ↓
Reporter synthesizes into a long-form report:
  - Executive summary (3 sentences)
  - Section per sub-question with citations
  - "Open questions" / "What to watch next" close-out
        ↓
Stored to the user's library, shareable, exportable as PDF
```

## 3. Trigger surface — where it lives in the UI

**Recommended:** A separate `/deep-dive` page accessed from the main nav. NOT inside the daily briefing flow. Reasons:

- Deep dive is **active mode** (~5 min of attention per run); daily briefing is **passive mode** (~2 min skim). Mixing them violates the weather-forecast tone.
- Deep dive runs are **expensive** (multiple LLM calls + many API hits). Daily flow stays cheap.
- The visual language can be different: deep dive looks more like a research notebook; daily looks like a newspaper.

Reuse on the daily side: the **weekly recap** (3-paragraph Sunday digest) can be implemented as a *scheduled deep-dive run* with a fixed plan template. Same engine, different trigger.

## 4. Plan-edit UX details

The plan card list must:

- Show the plan in **plain language**, not as JSON or technical config
- Let the user **add, remove, reorder** sub-questions with click/keyboard
- Show **estimated runtime** that updates as user edits
- Have a **"trust the plan"** quick-confirm path for users who don't want to edit
- Never make plan editing *required* — for repeat queries, last edited plan should be the default

Inspiration from deer-flow: their planner outputs plans as structured markdown with checkable items. Hermes should do the same but render it editorially, not as a JSON tree.

## 5. Output format — the report

Default format: **multi-section markdown report** rendered in Hermes's editorial style.

Sections (template):
1. **Executive summary** — 3 sentences max
2. **Key findings** — bulleted, each with citation chip linking to source paper
3. **Themes** — one paragraph per sub-question
4. **What we couldn't find** — gaps surfaced during research (this is *underrated*; deer-flow doesn't do this)
5. **Open questions / What to watch** — invites the user back next month

Stretch outputs (later):
- PDF export (researchers love PDFs)
- Audio version (ties into daily-flow audio briefing infrastructure)
- Slide deck (only if users ask — deer-flow has it, may not fit Hermes)

## 6. Engineering scope (rough)

- New page: `web/src/app/deep-dive/page.tsx`
- New API: `POST /api/deep-dive/plan` (returns draft plan), `POST /api/deep-dive/run` (executes plan, streams progress)
- New library: `web/src/lib/deep-dive/` — planner, sub-agent runner, reporter
- New table: `deep_dive_runs` in Supabase (id, user_id, query, plan, report_md, status, created_at)
- LLM dependency: deep-dive is **not** Tier 0; it requires real model calls (Claude / GPT). Decide BYOK vs. hosted billing when the time comes.
- Streaming UI: long runs need progress feedback (server-sent events or polling)

## 7. Risks and things to watch

- **Cost.** A single deep-dive run could be 10–30× the cost of a daily briefing. Need rate limits per user from day one.
- **Quality vs. depth tradeoff.** Longer reports aren't automatically better. Resist the urge to make reports *long*; make them *dense*.
- **Plan-editing fatigue.** If we make users edit a plan every time, adoption dies. Default to "trust the plan" with edit-as-escape-hatch.
- **Scope creep into "agent platform."** Deer-flow is an agent harness. Hermes is not. Deep-dive is one feature, not the new product identity.

## 8. Open questions to revisit at design time

- Does deep-dive run on demand only, or can users *schedule* a recurring deep-dive (e.g. "every Sunday, deep-dive on my saved papers' methods")?
- Does the report stay private, or can users share a public link (a la Notion)?
- Should deep-dive read the user's saved/read history as input (so it knows what they've already seen)?
- Does the weekly recap reuse this engine, or is it a simpler thing?

---

**Next concrete action when this is unparked:** spec the plan-card data model and prototype the plan-preview UI in isolation. The UX of plan editing is the hardest part; everything else is plumbing.
