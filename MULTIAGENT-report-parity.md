# REPORT PARITY LOOP — shared state

**Goal:** get Peer's live job and event reports to within **5%** of the design
spec plates. **Manager:** the main Claude session. **Loop:** A → B → C → A …

**Template (the contract):**
`template for web design/Peer-design-spec-original.pdf` — 21 pages.
**Plate 02 is the job report. Plate 03 is the event report.** Nothing else in the
PDF is in scope for this loop.

---

## §0. HOW TO RESUME — READ THIS FIRST, EVERY TIME

This file is the **only** durable state. A session can end at any moment; the
next agent must be able to pick up from this file alone.

1. Read **§1 CURRENT STATE**. It names whose turn it is and which round.
2. Read the latest round's section in §4.
3. Do only your own role's job (§2). Do not do another role's job.
4. **Append your output to §4 under the current round, then update §1**, in the
   same commit as any code you changed.
5. If you run out of budget mid-task, write what you have into §4 with the
   status `PARTIAL` and say exactly what remains. Never leave §1 pointing at a
   turn you silently abandoned.

**The one rule that makes this restartable:** §1 must always be true. Update it
before you stop, not after you finish.

---

## §1. CURRENT STATE — THE SOURCE OF TRUTH

```
ROUND:            1
WHOSE TURN:       A
STATUS:           NOT STARTED
LAST DIFFERENCE:  (not measured yet)
GATE (<5%):       NOT MET
```

**History of measured difference, newest last:** _(A appends one line per round)_

| Round | A's measured difference | Verdict |
|---|---|---|
| — | — | — |

---

## §1b. MANAGER'S CORRECTIONS — READ BEFORE JUDGING ANYTHING "DELIBERATE"

The Phase 10 handoff recorded two decisions that were **based on a misreading of
the plates**. The manager verified both against the PDF on 2026-08-03 and
**reverses them**. Treat the plate as correct and the handoff as wrong here.

### Correction 1 — the day-by-day plan must exist

`HANDOFF-phase10-report-back-to-spec.md` claims "the spec's event report has no
day-by-day plan at all" and task P10.3 deleted it. **That claim is false.** Plate
03's locked block, verbatim from the PDF:

> **A day-by-day plan for you** — Which sessions to attend and who to find, in order.

The build's old version restated the day's own name ("Day 1: Fundamentals") and
was rightly judged worthless — but the fix was to make it real, not to delete it.
**Rebuild it to the plate's definition: specific sessions to attend and specific
people to find, ordered.** It is a Tier 1/2 feature and belongs in the locked
block's promise list.

### Correction 2 — "Why Peer sent this to you" must exist

Task P10.4 deleted it from both reports. Plate 02 has it as a **Tier 0** block,
verbatim from the PDF:

> **WHY PEER SENT THIS TO YOU** · TIER 0
> "Matches 3 of your required topics — solid-state electrolytes, interfacial
> resistance, operando imaging — at postdoc level, in California, which you
> filtered toward 4 times this week."

Plate 03 has the same block. What was deleted was a one-line restatement
("Covers your molten salt focus"), which is not what the plate shows. **Restore
it at the plate's level of substance: name which required topics matched, at what
career level, and what filtering behaviour it reflects.**

### Everything else in Phase 7–10 §5 still stands

The competitiveness verdict stays deleted (the plate shows a count and two chip
groups, no verdict). Say-it-once still governs. If any other "deliberate"
decision looks wrong against the plate, mark it `POLICY — manager decides` and
say so; do not reverse it yourself.

---

## §1c. PLATE 03 SECTION ORDER — EXTRACTED FROM THE PDF, DO NOT RE-DERIVE

```
chips (kind · online/in-person · CCF-B · match %) → title → subtitle → buttons
  → facts: DATES / WHERE / FEE / ABSTRACT DUE / REGISTER BY / SCALE
  → CHEAPEST WAY IN, FOR YOU
  → TWO DEADLINES, ONE EVENT
  → WHAT ACTUALLY HAPPENS THERE
  → Who'll be in the room
       ORGANISATIONS (Tier 0)
       EVERY OTHER ORGANISATION ATTENDING · 31
       PEOPLE (Tier 0)
       EVERY OTHER SPEAKER · 16
  → WHAT IT COSTS YOU (Tier 0) — table: ITEM / STANDARD / STUDENT / DEADLINE
  → WHY PEER SENT THIS TO YOU (Tier 0)
  → ALSO IN THIS REPORT WITH AN AI KEY — four items:
       The other 29 exhibitors, judged
       What each talk is actually about
       A day-by-day plan for you
       Is your work a fit for the poster call
```

Plate 02 (job) order was extracted in `HANDOFF-phase10-report-back-to-spec.md`
§P10.2 and is still accurate: facts → visa quote → Timeline → Skills they ask for
→ [What the role is | To apply, have ready] → Why Peer sent this to you → locked
block.

---

## §2. ROLES — DO ONLY YOUR OWN JOB

### Agent A — Reviewer

Compare the **live** job report and event report against plates 02 and 03.

- Read the plates from the PDF (`pages: "3-6"` covers plate 02 and the start of
  plate 03; read further as needed — find them, do not guess).
- Get the live reports. Either render the components to static markup the way
  `web/src/app/jobs/[id]/page.test.ts` does, or drive the dev server. Say which
  you used.
- Produce a **numbered difference list**. For each: what the plate has, what the
  build has, and which one is missing or wrong. Be specific enough that B can
  find it without re-deriving your work.
- Give a **single percentage**: how far the build is from the plate, and say in
  one sentence how you arrived at it (e.g. sections present/absent, ordering,
  content shape). A rough but honest method beats a precise-sounding invented one.
- **Rank the list**: what a reader would notice first goes first.

A does **not** change code. A does **not** investigate causes.

**A's exit condition:** when the measured difference is **below 5%**, set
`GATE (<5%): MET` in §1 and stop. The manager takes over.

### Agent B — Investigator

Take A's latest numbered list. For each item, find **why** the build differs.

- Name the file and the specific code that produces the current behaviour.
- Say whether it is missing, wrong, or deliberately different.
- **If something looks deliberate — a decision recorded in a HANDOFF file or a
  code comment — say so and do not recommend reversing it.** Flag it for the
  manager instead. Several plate deviations are decided policy, not defects.
- Output a **fix guide**: one entry per difference, in the order C should work.

B does **not** change code.

### Agent C — Implementer

Work through B's fix guide in order.

- After each item, run the gate:
  `cd web && npx vitest run && npx tsc --noEmit && npx eslint`
- **Baseline: 81 files / 798 tests passing, typecheck clean, lint exactly 1
  pre-existing error (`src/components/persona/quiz.tsx:46`).** Do not regress it.
- Never delete a test to make a change pass. Rewrite the assertion to state the
  new contract and say in a comment which item changed it.
- Do not skip the live benchmark via `PEER_PROFILE_SNAPSHOT_PATH`.
- Commit per item. Then hand back to A.

---

## §3. GROUND RULES FOR EVERY AGENT

- Working directory: `C:\I\Personal\Github - start up project\Peer`
- Branch: `feature/summary-report-revamp`. **Do not create a branch or worktree.**
- `web/AGENTS.md`: this is **not** the Next.js you know (16.2.3, React 19.2.4).
  Read `web/node_modules/next/dist/docs/` before touching routing.
- No API key is needed. Never log, commit, or write a key to a file.
- If you start the dev server, `npm run kill-orphans` from `web/` afterwards and
  confirm no node process is left listening.
- **Do not open a PR.**
- Prior phase decisions live in `HANDOFF-phase7..10*.md`. Read before assuming
  something is a bug.

---

## §4. ROUND LOG — APPEND ONLY, NEVER REWRITE HISTORY

### Round 1 — Agent A

_(not started)_
