# HANDOFF — Phase 8: the reports are shipping, and they are bad

**Planner / Reviewer:** Claude. **Implementer:** you (any agent).
**Created:** 2026-07-31. **Status:** see the Progress Ledger in §2 — that is the source of truth.

**Design spec:** https://claude.ai/code/artifact/c373776b-047b-48eb-8e9f-3c69e3e281de

**Predecessors:** `HANDOFF-report-overhaul.md` (Phases 1–6, 24/24 DONE) and
`HANDOFF-phase7-tier12-enrichment.md` (9/10 DONE, P7.10 blocked). Both merged
into `main`. Read their §6 ground rules — they still apply unchanged.

**Why this phase exists:** the user printed a real job report and a real event
report to PDF and read them. Both are bad in ways no unit test caught, because
every defect here is about *what the user sees on the page*, not about whether a
function returns the right shape. §4 quotes the actual output.

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

### Phase 8A — Navigation

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P8.1 | Back returns to the tab the user came from, not Dashboard | DONE | `cd web && npx vitest run && npx tsc --noEmit` — 76 files / 602 tests passed; typecheck exit 0. Runtime: `/jobs/jobweb:dkc7hq` Back restored `/?tab=jobs`; unknown tab normalised to Dashboard. |

### Phase 8B — The action row (both reports)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P8.2 | One row, and the same Interested / Not interested pair the paper report uses | DONE | `cd web && npx vitest run` — 76 files / 605 tests passed; store transition and single-row component tests passed. Visual: event + job at 375 px and 1280 px, no overflow; desktop rows stayed on one line and mobile kept the feedback pair together. |

### Phase 8C — Event report

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P8.3 | Page furniture must never enter the attendee roster | DONE | `cd web && npx vitest run src/lib/opportunities/` — 25 files / 231 tests passed; AABC fixture retained 3 genuine entries and rejected all 9 page-furniture labels |
| P8.4 | Judged rows the model rejects are dropped, not rendered | DONE | `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts` — 1 file / 17 tests passed; all 6 quoted rejections produced no rows and mixed output retained exactly 3 |
| P8.5 | "What each talk is about" takes real talks or renders nothing | DONE | `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts` — 1 file / 19 tests passed; generic-only input produced no section and 0 provider calls, mixed input sent only real titles |
| P8.6 | The description must start at a sentence boundary | DONE | `cd web && npx vitest run && npx tsc --noEmit` — 76 files / 612 tests passed with benchmark override unset; TypeScript clean; §4 text starts `It will review`, removes `[...]`, and ends with an ellipsis at a word boundary |
| P8.7 | Poster-fit answer is capped and leads with the verdict | DONE | `cd web && npx vitest run` — 76 files / 614 tests passed with benchmark override unset; a 180-word reason was capped to 60 words and the verdict remained first |
| P8.8 | Attendee list layout — full width, no squashed column | TODO | |

### Phase 8D — Job report

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P8.9 | Skills section lists the requirements it is counting, or does not render | TODO | |
| P8.10 | Section order: what the posting says before what the model inferred | TODO | |
| P8.11 | Strip extraction artefacts from title, subtitle and description | TODO | |

**Total: 11 tasks.**

---

## §3. MISSION

Phase 7 made the reports *do* something. This phase makes them *worth reading*.

The current output is not a near miss. An attendee list whose entries are
"Download Brochure", "Mailing List" and "Privacy Policy" — each with a paragraph
of AI commentary explaining that it is not an attendee — is worse than showing
nothing. A "what each talk is about" section that defines the English words
*tutorial*, *panel* and *keynote* is worse than showing nothing.

**The governing rule for this whole phase: a section with nothing real to say
must not render.** Every defect below is a variant of the code preferring to
fill space over leaving it empty. Reverse that preference everywhere.

---

## §4. MEASURED EVIDENCE — THE ACTUAL OUTPUT, DO NOT RE-DERIVE

From two PDFs the user exported on 2026-07-31 from `localhost:3000`.
Event: `/events/eventweb:lrdbsp` (26th Advanced Automotive Battery Conference).
Job: `/jobs/jobweb:dkc7hq` (R&D Lab Internship, American Battery).

### Baseline — do not regress

```
cd web
npx vitest run       →  74 test files, 598 tests, all passing
npx tsc --noEmit     →  clean, exit 0
npx eslint           →  exactly 1 error, PRE-EXISTING, not yours:
                        src/components/persona/quiz.tsx:46  react-hooks/set-state-in-effect
```

The suite includes a **live** benchmark (`src/lib/events/benchmark.test.ts`) that
hits real websites. It currently passes. **Do not skip it by pointing
`PEER_PROFILE_SNAPSHOT_PATH` at a nonexistent file.**

### Event report — "THE OTHER 9 ATTENDEES, JUDGED"

Verbatim entries, in order:

```
Download Brochure      → "This appears to be a document or action, not an attendee."
Companies A-K          → "This appears to be a category or group, not an individual attendee."
Battery Power Online   → (a real judgement)
Lithium Battery Power  → (a real judgement)
Battery Safety         → (a real judgement)
Executive Team         → "This appears to be a group within an organization, not an individual attendee."
Mailing List           → "This appears to be a communication channel, not an attendee."
Request Information    → "This appears to be an action, not an attendee."
Privacy Policy         → "This appears to be a document or legal statement, not an attendee."
```

**Six of nine are navigation and footer links from the conference website.** Two
separate failures stacked: the roster extractor scraped page furniture, and then
the enrichment paid a model to write a paragraph about each one — and the code
rendered the rejection instead of dropping the row. The model behaved correctly.
The code around it did not.

Note also that the section header still says "attendees" while the sub-heading
in the layout says "People", and the three genuine entries are publications, not
people.

### Event report — "WHAT EACH TALK IS ACTUALLY ABOUT"

Verbatim, all three entries:

```
tutorial   "A tutorial session is likely to provide in-depth instruction or a guided
            learning experience on specific topics, possibly related to advanced
            battery technologies or research methods."
panel      "A panel discussion typically involves several experts discussing a
            particular topic, offering diverse perspectives and engaging in Q&A…"
keynote    "A keynote address is a prominent speech delivered by a distinguished
            individual, usually setting the tone for the event…"
```

The section was fed `activities[]`, which for this event contains the **session
type words** `tutorial`, `panel`, `keynote` — not talk titles. The model, given a
word and asked what the talk is about, defined the word. Note the hedging
("is likely to", "typically", "usually") — the model signalled it had nothing.

### Event report — description starts mid-sentence

```
WHAT ACTUALLY HAPPENS THERE
than a quarter of a century. It will review the criteria necessary to achieve such
extended life in commercially manufactured Li-ion cells. [...] This work presents
an in situ diagnosis system of large capacity lithium-ion battery based on a
sponge-type battery swelling sensor, w
```

Three defects in one block: it begins mid-sentence, it contains a literal
`[...]` join marker, and it ends mid-word (`sensor, w`).

### Event report — poster fit runs to two printed pages

One unbroken paragraph, ~180 words, spilling from page 3 to page 4. The verdict
("Likely fit") is there, but everything after it is undifferentiated prose.

### Job report — the skills section is empty

```
SKILLS AND PROFILE GAPS
0 of 2 requirements match terms in your profile
Not matched in your profile
        ← nothing here
```

It counts two requirements and lists neither. The user is told they match 0 of 2
and cannot see what the 2 are.

### Job report — the posting's own words come last

Print order: `The role in three clean sentences` (model-written, page 2) …
then `What the role is` (extracted from the posting, page 3).

The user reads the model's rewrite first and the source material last. **§5 of
the Phase 7 handoff locked the opposite rule** — Tier 0 output is the trustworthy
layer and must lead.

### Job report — the timeline renders out of order

Print order on page 1: `TIMELINE` header → `SKILLS AND PROFILE GAPS` header →
the skills text → *then* the timeline's own data (`POSTED / TODAY / APPLY BY`).
The timeline's content lands after the next section's heading.

### Job report — extraction artefacts reach the screen

```
title/subtitle:   "…Research in Reno at American Battery" / "Apply now! · Reno, Nevada, United States"
description:      "…values innovation and hands-on learning. ] Tasks: Dive into hands-on research…"
facts:            chip "Visa not stated"  +  fact row "VISA / Visa not stated"
```

`Apply now!` is scraped call-to-action text sitting where the location belongs, a
stray `]` survives in the description, and the visa state is printed twice.

### The action row — user screenshot plus both PDFs

`Registered` and `Submitted` are wrapped in `flex flex-col` at
`app/events/[id]/page.tsx:346`, so they stack into a two-row column while
`Official site`, `Saved` and `Not interested` sit on one line beside them. The
result is a ragged L-shape.

There is also no `Interested`. The paper report offers a matched pair —
`moreLikePaper` and `notInterestedPaper`, rendered as thumbs — and the feed store
**already has `moreLikeEvent` (feed.ts:586) and `moreLikeJob` (feed.ts:589)**,
unused by these pages. There is no `notInterestedEvent` / `notInterestedJob` and
no `eventFeedback` / `jobFeedback` record; `paperFeedback` at feed.ts:571 is the
shape to copy.

### Back navigation — root cause

`app/page.tsx:165` — `const [activeType, setActiveType] = useState<FeedType>("dashboard")`.

The active tab is React state with a hardcoded default and **is never written to
the URL**; line 348 deliberately uses `history.replaceState` to keep filter
changes out of the history stack. Every report page links back with a plain
`<Link href="/">` (`events/[id]/page.tsx:818`, `jobs/[id]/page.tsx:~382`,
`papers/[id]/page.tsx:1018`).

So returning from a report re-mounts the home page fresh and lands on Dashboard,
always. **`router.back()` alone will not fix this** — the home page has no memory
of the tab to restore. The tab has to live in the URL first.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

1. **An empty section does not render.** No headers over nothing, no "None
   found", no placeholder. If a section has no real content, it is absent.
   *Because the current report's worst moments are all space-filling.*

2. **Never render the model's refusal.** If the model says an entry is not what
   was asked for, that is a signal to drop the row — not content to display.
   *Because "This appears to be a document or action, not an attendee" is the
   code telling the user it fed the model garbage.*

3. **Fix the extractor first, the prompt second.** Page furniture must not reach
   the model at all. Filtering at the render layer alone still pays for the call.
   *Because every junk row is a paid token and a wasted line of the user's time.*

4. **Tier 0 before Tier 1/2, always.** The posting's or programme's own words
   come first; the model's inference comes after, visually distinct. This was
   already locked in Phase 7 §5.5 and the job report violates it.

5. **Cap every generated block.** A verdict line plus at most ~60 words of
   reasoning. *Because an unbounded paragraph is where the user stops reading,
   and the poster-fit answer currently runs 180 words.*

6. **The tab belongs in the URL.** `/?tab=jobs` and equivalents, so that back,
   refresh, and a pasted link all restore the same view. *Because a tab held only
   in React state cannot survive any navigation, which is the actual bug.*

7. **Jobs and events get the same feedback pair as papers.** Interested and Not
   interested, same icons, same store shape. Not a bespoke variant.
   *Because the user noticed the inconsistency immediately, and the store is
   already half-built for it.*

---

## §6. GROUND RULES

### Branch and working directory

```
C:\I\Personal\Github - start up project\Peer
```

`main`, the feature branch, and both origin refs are all at the same commit —
Phases 1–7 are merged and pushed. **Work directly on a branch off `main`; do not
create a worktree.** This project is deliberately a single checkout.

**There is one uncommitted change in the working tree** —
`web/src/app/papers/[id]/page.tsx` moves "Why it fits you" from the lead
position to section 7 (59 lines in, 59 out). It is someone's in-progress edit.
**Leave it alone**; do not stage it, revert it, or build on it.

**This file lives at the repo root and the ledger in §2 is the copy you edit.**

### Framework

`web/AGENTS.md`: **this is not the Next.js you know.** Next 16.2.3, React 19.2.4.
Read the relevant guide in `web/node_modules/next/dist/docs/` before touching
routing or search params.

### Secrets

No API key is needed for any acceptance command here. User keys arrive as
`llmOverride` on the request body. **Never log, commit, or write a key to a
file.** Tests must pass with no provider configured.

### Commands

```
cd web
npx vitest run          # baseline: 74 files, 598 tests
npx tsc --noEmit        # must stay clean
npx eslint              # must stay at exactly 1 error (persona/quiz.tsx:46)
```

If you start the dev server, run `npm run kill-orphans` from `web/` afterwards
**and verify no node process is left listening** — a stale server silently killed
two fresh ones during an earlier session.

### DO NOT

- Do not render a section header with no content under it. See §5.1.
- Do not fix junk rows only at the render layer. See §5.3.
- Do not reorder so the model's text precedes the source text. See §5.4.
- Do not touch the uncommitted `papers/[id]/page.tsx` change.
- Do not add a second LLM call per report — Phase 7 §5.1 still holds.
- Do not skip the live benchmark.
- Do not open a PR. The reviewer goes first.

---

## §7. TASK SPECIFICATIONS

### P8.1 — Back returns to the tab the user came from

Files: `web/src/app/page.tsx`, and the back link in all three report pages.

1. Read the initial `activeType` from a `tab` search param, falling back to
   `"dashboard"` when absent or unrecognised.
2. Include `tab` in the existing `replaceState` sync at `page.tsx:~348`, so
   switching tabs updates the URL without pushing history entries.
3. Report pages navigate back with `router.back()` when there is in-app history,
   falling back to `/` otherwise. Keep a real `href` on the element so
   middle-click and open-in-new-tab still work.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a test
that `/?tab=jobs` mounts with Jobs active and an unknown value falls back to
Dashboard. Then verify by hand: open Jobs, open a job, press Back, land on Jobs.

### P8.2 — One action row, with Interested and Not interested

Files: `web/src/app/events/[id]/page.tsx`, `web/src/app/jobs/[id]/page.tsx`,
`web/src/store/feed.ts`.

Remove the `flex flex-col` wrapper at `events/[id]/page.tsx:346` so every control
sits on one row that wraps as a unit on narrow screens.

Add `Interested` beside `Not interested`, matching the paper report's icons and
states. Wire `Interested` to the existing `moreLikeEvent` / `moreLikeJob`. Add
`notInterestedEvent` / `notInterestedJob` and `eventFeedback` / `jobFeedback`
records modelled on `paperFeedback` (feed.ts:571), persisted the same way.

`Registered` / `Submitted` (events) and `Applied` (jobs) keep their current
behaviour — they are completion state, not feedback, and stay visually distinct
from the thumbs pair.

**Acceptance:** `cd web && npx vitest run` with a store test covering
interested → not-interested → cleared for both types, plus a component test that
the row renders as a single flex row. Confirm on screen at 375 px and 1280 px.

### P8.3 — Page furniture must never enter the roster

Files: `web/src/lib/opportunities/extract-roster.ts` (or wherever
`extractEventRoster` lives) + test.

Drop candidates that come from navigation, header, footer or aside regions, and
drop entries matching an action/document stop-list. The nine real failures to
cover: `Download Brochure`, `Companies A-K`, `Executive Team`, `Mailing List`,
`Request Information`, `Privacy Policy`, plus `Contact Us`, `Terms`, `Sitemap`.

Prefer structural filtering (element ancestry, link-to-text ratio) over a growing
word list; the stop-list is the backstop, not the strategy.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/` — a fixture
containing a real conference nav and footer yields zero roster entries from those
regions, and the three genuine entries from the AABC page still survive.

### P8.4 — Drop rejected rows instead of rendering them

Files: `web/src/lib/opportunities/enrichment.ts` + test.

The judged-attendee parser must discard any row whose judgement indicates the
entry is not an attendee. Do not render it, do not show it greyed out.

If **every** row is discarded, the whole section is absent (§5.1).

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— the exact six rejection strings from §4 produce zero rendered rows; a mixed
input of 3 real and 6 rejected produces exactly 3.

### P8.5 — "What each talk is about" takes real talks or nothing

Files: `web/src/lib/opportunities/enrichment.ts` + test.

Only send entries that plausibly name a talk. A bare session-type word
(`tutorial`, `panel`, `keynote`, `workshop`, `poster session`, `reception`) is
not a talk title — filter it before the call. If nothing survives, omit the
section and do not spend the tokens.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— `["tutorial","panel","keynote"]` yields no section and **zero provider calls**;
a mixed list sends only the real titles.

### P8.6 — Description starts at a sentence boundary

Files: the event description assembly (`lib/events/mapper.ts` or the report page)
+ test.

Trim any leading partial sentence, remove literal `[...]` join markers, and end
on a word boundary with a proper ellipsis rather than mid-word.

**Acceptance:** `cd web && npx vitest run` — the §4 string
(`"than a quarter of a century. … sensor, w"`) renders starting at `"It will
review…"`, contains no `[...]`, and does not end mid-word.

### P8.7 — Cap the poster-fit answer

Files: `web/src/lib/opportunities/enrichment.ts`, event report page.

Verdict line stays. Reasoning is capped at roughly 60 words (§5.5) and enforced
in code, not only asked for in the prompt.

**Acceptance:** `cd web && npx vitest run` — a 180-word reasoning string is
reduced; the verdict is never dropped.

### P8.8 — Attendee list layout

Files: `web/src/app/events/[id]/page.tsx`.

The list currently renders as a narrow squashed column against the left edge.
Give it the report's full content width, one entry per row, name and judgement
readable at 375 px and 1280 px.

Also reconcile the naming: the section header says "attendees", the sub-heading
says "People", and the surviving entries are publications. Pick one honest label.

**Acceptance:** screenshots at both widths, plus `npx vitest run` clean.

### P8.9 — Skills section lists what it counts, or does not render

Files: `web/src/app/jobs/[id]/page.tsx`.

"0 of 2 requirements match" must be followed by those 2 requirements. If the
requirement list is empty, the section does not render at all (§5.1) — never a
count with nothing under it.

**Acceptance:** `cd web && npx vitest run` — a job with 2 unmatched requirements
renders both; a job with none renders no section and no header.

### P8.10 — Section order and the timeline

Files: `web/src/app/jobs/[id]/page.tsx`.

Move `What the role is` (extracted) **above** `The role in three clean sentences`
(model-written), per §5.4.

Fix the timeline: its content currently renders after the next section's heading.
Check for absolute positioning or a stray fragment boundary around the
`TIMELINE` block.

**Acceptance:** a component test asserting the extracted description appears
before the model rewrite in DOM order, and that the timeline's dates render
inside the timeline section. Confirm against a printed PDF.

### P8.11 — Strip extraction artefacts

Files: `web/src/lib/opportunities/extract-*.ts` + tests.

Three concrete cases from §4:
1. `Apply now!` and similar call-to-action text must not land in the location
   subtitle.
2. A stray `]` (and other unbalanced bracket debris) must be stripped from
   descriptions.
3. The visa state must print once — chip or fact row, not both.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/` — a fixture
carrying all three artefacts yields clean output.

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
3. **Reproduce the user's own check.** Open the same two reports —
   `/events/eventweb:lrdbsp` and `/jobs/jobweb:dkc7hq` — print each to PDF, and
   read them. Every §4 defect must be gone. Attach what you saw to the completion
   report. A passing test suite is not evidence for this phase; the PDFs are.
4. Verify Back from each report returns to the originating tab.
5. `npm run kill-orphans` and verify no node process is still listening.
6. Delete every temporary or diagnostic file.
7. Commit. Do **not** open a PR.
8. Create `HANDOFF-phase8-report-quality-COMPLETE.md` at the repository root:

        # HANDOFF COMPLETE
        **Branch:** <branch>  **Finished:** <ISO>  **Status:** COMPLETE | PARTIAL | BLOCKED

        ## Ledger summary
        <counts, and which IDs are not DONE>

        ## Evidence
        <test output, typecheck output, and what the two re-printed PDFs showed>

        ## What I could not do / am unsure about
        <be specific — the most useful section for the reviewer>

        ## Anything I changed that was NOT in the plan
        <list with justification>

Never put a credential in it.
