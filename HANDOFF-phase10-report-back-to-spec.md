# HANDOFF — Phase 10: put the reports back on the design spec

**Planner / Reviewer:** Claude. **Implementer:** you (any agent).
**Created:** 2026-08-01. **Status:** see the Progress Ledger in §2 — that is the source of truth.

**Design spec:** https://claude.ai/code/artifact/c373776b-047b-48eb-8e9f-3c69e3e281de
A 20-page PDF print of it sits at `Peer-design-spec-original.pdf` in the repo root.
**Plate 02 is the job report. Plate 03 is the event report. Those two plates are
the contract.** The built reports have drifted a long way from them; this phase
closes the gap.

**Predecessors, all merged:** `HANDOFF-report-overhaul.md` (24/24),
`HANDOFF-phase7-tier12-enrichment.md` (9/10), `HANDOFF-phase8-report-quality.md`
(11/11), `HANDOFF-phase9-real-programme-reading.md` (9/9).
Read their §6 ground rules — they still apply unchanged.

---

## §1. HOW TO USE THIS DOCUMENT — READ FIRST, EVERY TIME

This document is **resumable**. A previous agent may have completed part of the work.

### If you are starting or resuming, do exactly this:

1. **Read the Progress Ledger (§2).** It is the source of truth for what is done. Do **not** trust the code, your memory, or any summary — trust the ledger.
2. **Find the first task whose status is not `DONE`.** That is where you start. Do not redo `DONE` tasks.
3. **Verify the last `DONE` task still passes** by running its acceptance command. If it fails, fix that first and note it in the session log.
4. **Set that task's status to `IN_PROGRESS`**, commit the ledger change, then do the work.
5. **When the acceptance command passes,** set status to `DONE`, put the command and its result in the "Verified" column, and **commit the ledger together with the code**.
6. Repeat until all tasks are `DONE` or you must stop.
7. **Before you stop for any reason,** append a Session Log entry (§8) and commit.

### Non-negotiable rules for the ledger

- **Update it as you go, not at the end.** If you finish 3 tasks then crash, the ledger must already show 3 `DONE`.
- **`DONE` means the acceptance command passed.** Not "I wrote the code." If you cannot run the command, the status is `BLOCKED`.
- **One commit per task minimum**, including the ledger update, so progress is durable in git history.

---

## §2. PROGRESS LEDGER — THE SOURCE OF TRUTH

Statuses: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED` · `SKIPPED`

### Phase 10A — Stop showing raw source text as if it were a summary

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P10.1 | Event description: AI-condensed at Tier 1/2, extractive only at Tier 0 | DONE | `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts` — 1 file, 48 tests passed |
| P10.2 | Job: merge the two role sections into one bulleted summary, at the top | TODO | |

### Phase 10B — Cut what repeats itself

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P10.3 | Delete the day-by-day plan entirely | TODO | |
| P10.4 | Delete "Why Peer sent it" from both reports | TODO | |
| P10.5 | Talk list carries its session time | TODO | |

### Phase 10C — Present facts, do not deliver verdicts

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P10.6 | Skills becomes two plain columns: matched / not matched, no judgement | TODO | |
| P10.7 | Poster fit becomes a short bulleted list | TODO | |

### Phase 10D — Fix what the review found broken

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P10.8 | Talk titles may come from lists and tables, not only `<h1>`–`<h6>` | TODO | |
| P10.9 | Never offer "connect a key" to a user who already has one | TODO | |
| P10.10 | Local testing keeps the profile: warn before it is silently lost | TODO | |

**Total: 10 tasks.**

---

## §3. MISSION

Four rounds of work made the reports *correct*. This round makes them *the thing
we designed*.

Open `Peer-design-spec-original.pdf` next to a live report and the drift is
obvious. The spec's job report leads with **three bullets** saying what the role
is. The built one leads with a truncated copy-paste of the posting, then repeats
the same content twice more in different words. The spec's event report has no
day-by-day plan at all; the built one has one that restates the talk list.

**The governing rule for this phase: say each thing once, in the shortest form
that still says it, and let the user judge.** Every task below is a variant of
one of three failures — raw text presented as if summarised, the same content
printed twice, or Peer delivering a verdict where it should present facts.

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

Measured 2026-08-01 on this branch, from screenshots of live reports plus code
reading.

### Baseline — do not regress

```
cd web
npx vitest run       →  80 test files, 778 tests, all passing
npx tsc --noEmit     →  clean, exit 0
npx eslint           →  exactly 1 error, PRE-EXISTING, not yours:
                        src/components/persona/quiz.tsx:46  react-hooks/set-state-in-effect
```

Includes a **live** benchmark (`src/lib/events/benchmark.test.ts`) that hits real
websites and passes. **Do not skip it via `PEER_PROFILE_SNAPSHOT_PATH`.**

### The description is raw source text, not a summary

Live event report, "WHAT ACTUALLY HAPPENS THERE":

> "The Molten Salt Electrochemistry Symposium (MoSES) aims to bring together a
> diverse community of researchers and practitioners in the field of molten salt
> electrochemistry. Our goal is to foster robust discussions on best practices
> and current challenges. We invite contributions…"

That is the event's own marketing copy, pasted and cut mid-sentence with an
ellipsis. Spec plate 03 calls for a condensed statement of what happens there.
The same defect appears on the job report under "WHAT THE ROLE IS".

### The same content is printed three times on the job report

1. `WHAT THE ROLE IS` — raw posting text, truncated
2. `THE ROLE IN THREE CLEAN SENTENCES` — the model's rewrite of the same thing
3. `HOW COMPETITIVE THIS ACTUALLY IS` — restates the requirements a third time
   while delivering a verdict

Spec plate 02 has **one** "What the role is" block, three bullets, and no
competitiveness verdict at Tier 0 at all.

### The day-by-day plan restates the talk list

Live output:

```
Day 1 — July 21    1  Day 1: Fundamentals (Recommended for most attendees)
Day 2 — July 22    1  Day 2: Advanced Techniques
Day 3 — July 23    1  Day 3: Research Presentations
```

One item per day, each item the day's own name. It carries no information the
talk list does not already carry. **The spec has no such section.**

### "Why Peer sent it" duplicates the fit section

Live event report ends with:

```
WHY PEER SENT IT      Covers your molten salt focus
```

directly under "IS YOUR WORK A FIT FOR THE POSTER CALL", which says the same
thing at length. Note that spec plate 02 *does* have a "Why Peer sent this to
you" block — but it is a Tier 0 block that names **which** required topics
matched, not a one-line restatement of the fit paragraph.

### Peer is judging where the spec has it presenting

Live: `HOW COMPETITIVE THIS ACTUALLY IS → "Low to medium competitiveness."`
followed by a paragraph weighing the user up.

Spec plate 02 instead shows **"Skills they ask for — 6 of 9 you already have"**,
a bar, then two groups of chips: the ones you have, and the gaps. No verdict.
The user decides.

### Talk titles are missed because only headings are searched

`extractPageHeadings` in `lib/opportunities/page-text.ts` matches
`/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi` and nothing else. A candidate talk
title must then appear in that heading set (`enrichment.ts`, the
`allowedHeadingTitles` check) *and* be quotable from the page text.

The IAEA record for "Ion exchange processes: advances and applications" lists
eight real contributions under **Individual Papers/Chapters** — "Ion exchange in
the nuclear power industry", "Fundamentals of ion exchange", and so on. They are
`<li><a>` links in a sidebar, not headings, so the extractor sees none of them
and the report prints *"Peer read the page but found no talk titles it could
quote."*

A second problem compounds it: those link texts are **visually truncated with
"…"** on the source page, so even if collected, the verbatim check against the
full page text would reject them.

### The locked block asks a key-holder to connect a key

`app/events/[id]/page.tsx` renders `<TierUpgradeBlock providerConfigured={hasEnrichment} />`.
`hasEnrichment` is false whenever enrichment came back null — including when the
user **has** a working provider but the page fetch failed.

Live proof, one screenshot, both messages on the same report:

```
Peer could not finish reading the programme page this time.
…
ALSO IN THIS REPORT WITH AN AI KEY
    🔒 Organisations and people, judged
    🔒 What each talk is actually about
    Connect a key →
```

The user has a key. Other reports on the same session show full AI sections. The
block is telling them to buy something they already own.

### Local testing loses the profile, and it is easy to lose it invisibly

The profile is a zustand `persist` store in **browser localStorage** under
`peer-profile`. `/api/profile` syncs to Supabase but only for an
**authenticated** user (`supabase.auth.getUser()`), so a signed-out local tester
has exactly one copy, in one browser profile, on one machine.

Consequences seen in this project: opening the app in a different browser (the
in-app preview pane versus the tester's own Chrome) shows a different profile
with no indication that anything is wrong; clearing site data silently resets to
onboarding. `.local-data/profile.json` is **not** read by the app — it is a
manual snapshot used only by the live benchmark.

**Reviewer's note, recorded so nobody re-investigates a ghost:** during Phase 8/9
verification the reviewer wrote a test profile into the in-app preview browser's
localStorage. Any "my settings changed" observed in *that* window on 2026-07-31
or 2026-08-01 is explained by this, not by a persistence bug. The underlying
single-copy fragility described above is real and is what P10.10 addresses.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

1. **Say it once.** If two sections carry the same content, the shorter one
   survives and the other is deleted outright — not hidden behind a toggle, not
   moved lower. *Because a report the user scrolls past is worth less than a
   short one they read.*

2. **Bullets over paragraphs everywhere the model writes.** Three to five
   bullets, one idea each. *Because every long AI paragraph in the current build
   is one the user told us they stop reading.*

3. **Peer presents, the user judges.** No "you are a strong candidate", no "low
   to medium competitiveness", no "likely fit" verdict as the headline. Show the
   matched facts and the unmatched facts in two plain groups. *Because Peer
   cannot see the user's CV, their visa situation, or how badly they want the
   job, and a confident wrong verdict is worse than no verdict.*

4. **Tier 0 stays extractive and stays honest.** With no key the description is
   still the posting's own words — but trimmed to whole sentences, never cut
   mid-word. Condensing is a Tier 1/2 feature. *Because the free tier must not
   pretend to summarise.*

5. **Every list item that has a time carries it.** A talk without its slot cannot
   be planned around. *Because that is the only reason the deleted day-by-day
   plan existed, and the fix belongs in the list itself.*

6. **Never advertise a paid upgrade to someone who already paid.** The locked
   block renders only when no provider is configured. When a provider exists but
   produced nothing, say what went wrong instead. *Because the current screen
   destroys trust at the exact moment the user is checking whether their key
   works.*

7. **The spec plates are the target, not a suggestion.** Where this document and
   `Peer-design-spec-original.pdf` disagree, raise it with the reviewer rather
   than choosing. *Because four rounds of small local decisions are what produced
   the current drift.*

---

## §6. GROUND RULES

### Branch and working directory

```
C:\I\Personal\Github - start up project\Peer      (branch: feature/summary-report-revamp)
```

**Work on this branch. Do not create a worktree or a new branch.** This project
is deliberately a single checkout.

**This file lives at the repo root and the ledger in §2 is the copy you edit.**

### Framework

`web/AGENTS.md`: **this is not the Next.js you know.** Next 16.2.3, React 19.2.4.
Read the relevant guide in `web/node_modules/next/dist/docs/` before touching
routing.

### Secrets

No API key is needed for any acceptance command — all are offline tests with
stubbed providers and stubbed fetch. **Never log, commit, or write a key to a
file.**

### Commands

```
cd web
npx vitest run          # baseline: 80 files, 778 tests
npx tsc --noEmit        # must stay clean
npx eslint              # must stay at exactly 1 error (persona/quiz.tsx:46)
```

If you start the dev server, run `npm run kill-orphans` from `web/` afterwards
and verify no node process is left listening.

### DO NOT

- Do not keep a section "just in case" when a task says delete it. See §5.1.
- Do not replace a deleted verdict with a softer verdict. See §5.3.
- Do not make Tier 0 call a model to condense text. See §5.4.
- Do not loosen the verbatim-quoting rule from Phase 9 §5.4 while widening where titles may be found (P10.8). Widening the *source* is in scope; weakening the *check* is not.
- Do not add a second model call per report — Phase 7 §5.1 still holds.
- Do not skip the live benchmark.
- Do not open a PR. The reviewer goes first.

---

## §7. TASK SPECIFICATIONS

### P10.1 — Event description: condensed at Tier 1/2, whole sentences at Tier 0

Files: `web/src/lib/opportunities/enrichment.ts`, `web/src/app/events/[id]/page.tsx`.

Add `condensedDescription?: string` to the event enrichment — two sentences
maximum, stating what happens at the event, written by the model from the page
text it already receives. It replaces the raw description **only when present**.

At Tier 0 the existing extractive description stays, but must end on a complete
sentence. Never cut mid-sentence or mid-word.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— a three-sentence model reply is capped at two; a missing field leaves the
extractive text untouched; a Tier 0 description ending mid-sentence is trimmed
back to the last full stop.

### P10.2 — Job: one role section, bulleted, at the top

Files: `web/src/lib/opportunities/enrichment.ts`, `web/src/app/jobs/[id]/page.tsx`.

Delete `WHAT THE ROLE IS` and `THE ROLE IN THREE CLEAN SENTENCES` as separate
sections. Replace with a single **"What the role is"** block of three to five
bullets, placed immediately under the facts grid, matching spec plate 02.

At Tier 1/2 the bullets are the model's. At Tier 0 they are the posting's own
sentences, split into bullets, trimmed to whole sentences.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a
component test asserting exactly one role section exists, that it renders as a
list, and that it appears before the skills section in DOM order.

### P10.3 — Delete the day-by-day plan

Files: `web/src/lib/opportunities/enrichment.ts`, `web/src/app/events/[id]/page.tsx`,
`tier-upgrade-block` items.

Remove `dayPlan` from the type, the prompt, the parser, the render, and the
locked-block promise list. It is not in the spec and it restated the talk list.

**Acceptance:** `cd web && npx vitest run` — grep shows no `dayPlan` outside
deleted tests; the locked block lists three items, not four.

### P10.4 — Delete "Why Peer sent it"

Files: both report pages.

Remove the section from the event report and the job report.

Note for the reviewer, not for you to decide: spec plate 02 has a Tier 0 "Why
Peer sent this to you" block that names the specific matched topics. That is a
different, richer thing than the one-line restatement being deleted here. If it
is wanted back it is a separate task.

**Acceptance:** `cd web && npx vitest run` plus a component test asserting the
heading is absent from both reports.

### P10.5 — Talks carry their session time

Files: `web/src/lib/opportunities/enrichment.ts`, event report page.

Extend `talkSummaries` to `{ title, about, when? }`. `when` must be quotable from
the fetched page under the same Phase 9 §5.4 rule as the title — if the page does
not state a time, the field is absent and the row renders without it.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— an invented time is dropped while the row survives; a quotable time renders.

### P10.6 — Skills: two plain columns, no verdict

Files: `web/src/app/jobs/[id]/page.tsx`, `web/src/lib/opportunities/enrichment.ts`.

Delete the `competitiveness` section entirely — type, prompt, parser, render, and
its locked-block promise.

Replace with spec plate 02's treatment: a count ("6 of 9 you already have"), a
bar, then **two labelled groups** — what matched, what did not. Facts only. No
sentence anywhere assessing the user's chances.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a
component test asserting both groups render with the right members and that no
`competitiveness` copy remains.

### P10.7 — Poster fit as bullets

Files: `web/src/lib/opportunities/enrichment.ts`, event report page.

`posterFit.reasoning` becomes `posterFit.points: string[]` — two to four bullets.
Keep the verdict line, but per §5.3 it states what the call covers relative to the
user's declared topics rather than pronouncing on their chances.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— a paragraph reply is rejected rather than rendered as one long bullet; five
points are capped to four.

### P10.8 — Talk titles from lists and tables

Files: `web/src/lib/opportunities/page-text.ts` + test.

`extractPageHeadings` currently matches `<h1>`–`<h6>` only. Extend the candidate
set to include list items and table rows that look like programme entries —
`<li>` and `<td>` whose text is title-shaped — while keeping the existing
heading extraction intact.

**Keep the Phase 9 verbatim check exactly as strict.** Widen where a candidate may
come from; do not weaken what a candidate must satisfy.

Handle the truncation case: a source that renders "Ion exchange in the nuclear
power indust…" must not produce a title containing the ellipsis. Either recover
the full text from the link's `title`/`aria-label` attribute, or drop the
candidate.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/page-text.test.ts`
— a fixture shaped like the IAEA "Individual Papers/Chapters" list yields its
eight entries; a fixture whose link text is ellipsis-truncated yields either the
full title from an attribute or nothing, never a truncated string; the existing
heading tests still pass.

### P10.9 — Never sell a key to a key-holder

Files: `web/src/app/events/[id]/page.tsx`, `web/src/app/jobs/[id]/page.tsx`,
`web/src/components/reports/tier-upgrade-block.tsx`.

The locked block renders **only** when no provider is configured. Three states,
three different screens:

| State | What renders |
|---|---|
| no provider configured | the locked block, as today |
| provider configured, enrichment produced sections | the sections, no block |
| provider configured, enrichment produced nothing | **neither** — one short line saying why (the P9.9 copy already exists) |

**Acceptance:** `cd web && npx vitest run` with a component test covering all
three states, asserting the locked block is absent in the third and that the
explanation line renders exactly once.

### P10.10 — Do not lose the local tester's profile silently

Files: `web/src/store/profile.ts`, plus wherever the empty-profile state renders.

The profile lives in one browser's localStorage and nowhere else for a signed-out
user (§4). Make that visible rather than surprising:

1. When the app loads with no stored profile **and** no signed-in user, say so
   plainly — "Peer keeps your settings in this browser only. Sign in to sync
   them." — instead of dropping straight into onboarding as though the user were
   new.
2. Add an export/import of the profile as a JSON file, so a local tester can move
   settings between browsers without an account.

Do **not** write the profile to `.local-data/` — that path is a benchmark
snapshot and must not become a second live source of truth.

**Acceptance:** `cd web && npx vitest run src/store/profile.test.ts` — export
produces a document that import restores to an identical profile; importing
malformed JSON leaves the existing profile untouched. Plus a component test for
the first-load message.

---

## §8. SESSION LOG — APPEND BEFORE YOU STOP

    ### Session <n> — <agent> — <date>
    - Tasks completed this session: <IDs>
    - Left IN_PROGRESS or BLOCKED: <IDs, and exactly what state the code is in>
    - Test/typecheck status at stop time: <numbers>
    - Anything I changed that was NOT in the plan, and why:
    - What the next agent should watch out for:

*(No sessions logged yet.)*

---

## §9. WHEN ALL PHASES ARE DONE

1. Confirm every ledger row reads `DONE` (or `SKIPPED` / `BLOCKED` with a reason).
2. Run the full gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`
   (still exactly the one pre-existing error). **Do not suppress the live benchmark.**
3. **Print a real job report and a real event report to PDF and put them side by
   side with `Peer-design-spec-original.pdf` plates 02 and 03.** Section for
   section, the built report must now match the plate. Attach what you saw. A
   passing suite is not evidence for this phase.
4. Check the three locked-block states by hand, including the one where a
   configured key produced nothing.
5. `npm run kill-orphans` and verify no node process is still listening.
6. Delete every temporary or diagnostic file.
7. Commit. Do **not** open a PR.
8. Create `HANDOFF-phase10-report-back-to-spec-COMPLETE.md` at the repository root:

        # HANDOFF COMPLETE
        **Branch:** <branch>  **Finished:** <ISO>  **Status:** COMPLETE | PARTIAL | BLOCKED

        ## Ledger summary
        <counts, and which IDs are not DONE>

        ## Evidence
        <test output, typecheck output, and what the side-by-side PDF comparison showed>

        ## What I could not do / am unsure about
        <be specific — the most useful section for the reviewer>

        ## Anything I changed that was NOT in the plan
        <list with justification>

Never put a credential in it.
