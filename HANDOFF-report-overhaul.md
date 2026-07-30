# HANDOFF — paper summary + job/event report overhaul

**Planner / Reviewer:** Claude (this session). **Implementer:** you (any agent).
**Created:** 2026-07-30. **Status:** see the Progress Ledger in §2 — that is the source of truth.

**Design spec (read it before coding):** https://claude.ai/code/artifact/c373776b-047b-48eb-8e9f-3c69e3e281de
12 numbered plates. Every task below cites the plate it implements. The spec is
the agreed visual and behavioural contract — build what it shows, not your own
interpretation of the task title.

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

### Phase 1 — Papers: the summary moves onto the card (spec plate 01)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P1.1 | Store per-paper digest sentences in the feed store, keyed by paper id | DONE | `cd web && npx vitest run src/store/feed.test.ts` — 1 file, 4 tests passed |
| P1.2 | Paper tile renders the sentence, with an abstract-derived fallback | DONE | `cd web && npx vitest run src/components/cards` — 1 file, 4 tests passed |
| P1.3 | Remove the "Today's highlights" block from the Papers tab | DONE | `cd web && npx vitest run && npx tsc --noEmit` — 51 files, 451 tests passed; typecheck clean; no `DailyDigest` reference in `page.tsx` |

### Phase 2 — Tier 0 extraction (spec plates 02, 03, 08, 10)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P2.1 | Extend the Job and Event types with the new optional fields | DONE | `cd web && npx tsc --noEmit && npx vitest run` — typecheck clean; 51 files, 451 tests passed |
| P2.2 | Job posting-page extractor: deadline, start date, contract, materials | DONE | `cd web && npx vitest run src/lib/opportunities/job-details.test.ts` — 1 file, 8 tests passed |
| P2.3 | Visa three-state extractor with country-scoped phrase sets | DONE | `cd web && npx vitest run src/lib/opportunities/visa.test.ts` — 1 file, 14 tests passed |
| P2.4 | Role-kind classifier: internship / phd / postdoc / staff / faculty | DONE | `cd web && npx vitest run src/lib/jobs/role-kind.test.ts src/lib/jobs/scoring.test.ts` — 2 files, 37 tests passed |
| P2.5 | Event page extractor: fees, registration deadline, activities | DONE | `cd web && npx vitest run src/lib/opportunities/event-details.test.ts` — 1 file, 6 tests passed |
| P2.6 | Event roster extractor: organisations and people with titles | DONE | `cd web && npx vitest run src/lib/opportunities/event-roster.test.ts` — 1 file, 5 tests passed |
| P2.7 | Wire all extractors into the enrichment step, with a JS-shell guard | DONE | `cd web && npx vitest run src/lib/opportunities/enrich.test.ts` — 1 file, 8 tests passed |

### Phase 3 — The reports (spec plates 02, 03, 10)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P3.1 | Rebuild the job report | DONE | `cd web && npx vitest run && npx tsc --noEmit` — 56 files, 498 tests passed; 1 live benchmark skipped per §4; sparse + rich job report component tests passed; typecheck clean |
| P3.2 | Rebuild the event report | DONE | `cd web && npx vitest run && npx tsc --noEmit` — 57 files, 500 tests passed; 1 live benchmark skipped per §4; 30-organisation component test passed; typecheck clean |
| P3.3 | Shared "with an AI key" locked block, on all three reports | DONE | `cd web && npx vitest run src/components/reports/tier-upgrade-block.test.tsx` — 1 file, 2 tests passed |

### Phase 4 — Applied state and Saved (spec plates 05, 12)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P4.1 | Per-accent `--color-done` tokens, light and dark | DONE | `cd web && npx vitest run && npx tsc --noEmit` — 58 files, 502 tests passed; 1 live benchmark skipped per §4; typecheck clean; grep confirmed light + both dark theme declarations |
| P4.2 | Applied / registered / submitted state in the store, synced | DONE | `cd web && npx vitest run src/store/feed.test.ts` — 1 file, 7 tests passed; set/unset, persistence, implicit save and saved-payload round-trip covered |
| P4.3 | Saved page: kind segmentation, done controls, tinted cards | TODO | |
| P4.4 | The same controls on the job and event reports | TODO | |

### Phase 5 — Dashboard (spec plate 06)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P5.1 | Daily activity ledger with 90-day retention | TODO | |
| P5.2 | Rename the All tab to Dashboard and build the layout | TODO | |
| P5.3 | The deadlines board | TODO | |

### Phase 6 — Search and filters (spec plates 04, 07, 09, 11)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P6.1 | Widen events past conferences: kinds, classifier, queries | TODO | |
| P6.2 | Internship query lane with cycle-aware year | TODO | |
| P6.3 | Jobs filters: Where, When, Role type, Visa | TODO | |
| P6.4 | Work authorisation country list, in Profile settings | TODO | |

**Total: 24 tasks.**

---

## §3. MISSION

Peer's Papers tab makes you read the same information twice — once in a summary
block, once on the cards. Its job and event reports are nearly empty, so opening
one is a waste. Its All tab repeats the other tabs. This overhaul fixes all
three, and adds the two things that decide whether a research job is worth
applying to at all: whether it sponsors a visa, and whether internships are
findable.

**The principle that drives the architecture:** Tier 0 — no AI key of any kind —
must produce a *complete, shorter* report, never a skeleton with holes. Anything
that needs a model to reason is left out entirely and named in a locked block at
the foot of the report. Nothing renders as "—" and nothing renders as "Peer
could not extract this." This follows the repo's own rule in `AGENTS.md`: "Tier 0
must remain useful without model keys."

This is achievable because **job and event data was never AI-generated.** A model
is used in exactly one place in those pipelines: rewriting search queries
(`generateSearchQueries`, gated on `aiTier >= 2`). Scoring, dedup, keyword
matching and the extractive job summary already run without a key.

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

All of this was measured on 2026-07-30 against the current branch. It is
trustworthy. Re-measuring it is a waste of your session.

### Baseline — this is what you must not regress

```
npx vitest run       →  50 test files, 446 tests, all passing (vitest 4.1.8, ~14s)
npx tsc --noEmit     →  clean, exit 0
npx eslint           →  1 error, PRE-EXISTING, not yours:
                        web/src/components/persona/quiz.tsx:46
                        react-hooks/set-state-in-effect
```

**Do not fix the persona quiz lint error** and do not add new ones. "Lint clean"
in this repo means "still exactly one error, still that one."

Framework versions: **Next 16.2.3, React 19.2.4.** See §6 for why this matters.

### Probe 1 — aggregator descriptions do NOT contain the new fields

Fetched live from the three keyless job sources the app already ships, and
pattern-matched their `description` text:

| Field probed | remotive (n=35) | arbeitnow (n=175) | himalayas (n=20) |
|---|---|---|---|
| visa mentioned at all | 3% | 5% | 5% |
| application deadline | 0% | 2% | 0% |
| start date | 0% | 1% | 10% |
| application materials | 0% | 0% | 0% |
| contract length | 3% | 5% | 5% |
| salary text | 89% | 20% | 30% |

**Conclusion: do not try to extract the new fields from the source API's
`description`.** They are not there. These three sources are remote-tech boards,
which is not the population Peer's users care about.

### Probe 2 — the posting page DOES contain them, and is reachable

Fetched live with the app's own user-agent, from the hosts Peer's users actually
end up on:

```
JOB / CAREER HOSTS                                    reachable 6/6
  200  jobs.ac.uk             317 KB   deadline, salary, contract
  200  euraxess.ec.europa.eu  186 KB   deadline, visa            + JSON-LD present
  200  nature.com/naturecareers 110 KB deadline, materials, salary, contract
  200  careers.ornl.gov        48 KB   visa
  200  usajobs.gov            315 KB   salary
  200  academicjobsonline.org   6 KB   nothing — JS shell, no server-rendered text

EVENT / CONFERENCE HOSTS                              reachable 5/6
  403  mrs.org                          blocks the bot outright
  200  electrochem.org        143 KB   activities                + JSON-LD present
  200  neurips.cc             158 KB   submission deadline, activities
  200  icml.cc                 71 KB   submission deadline, activities,
                                       travel grant, invitation letter
  200  conferences.oreilly.com 228 KB  activities
  200  acs.org                 0.2 KB  nothing — redirect/JS shell
```

**Four conclusions you can build on directly:**

1. Extraction must run against the **posting/event page**, fetched by the
   existing `fetchPagesConcurrently` in `web/src/lib/opportunities/page-fetch.ts`.
   That path already exists and already works.
2. **Try JSON-LD first.** EURAXESS and electrochem.org both ship it, and
   `extractOpportunityPageDetails` already parses it. Regex is the fallback.
3. **Roughly 15–20% of pages yield nothing** — either blocked (mrs.org, 403) or a
   JavaScript shell with no server-rendered text (academicjobsonline 6 KB,
   acs.org 0.2 KB). This is expected and must degrade silently.
4. A page under ~20 KB of extracted text is almost certainly a JS shell. Treat it
   as unusable rather than extracting garbage from it. There is already an
   `UNFETCHABLE_HOSTS` list in `page-fetch.ts` — the size guard belongs next to it.

### Git state

```
branch  feature/summary-report-revamp  at e47602b  (fast-forwarded to main on 2026-07-30)
main    e47602b "Guide AI key setup and align provider models"
```

That last commit landed **after** this plan was written and it touches
`welcome/page.tsx`, `welcome/completeness.ts`, `components/profile/ai-setup.tsx`
and the whole `lib/llm/providers/` tree, including a new `lib/llm/provider-models.ts`.
Tasks P3.3 and anything that asks "is a provider configured?" must build on that
code, not on what you might remember from before it landed.

**That commit is another agent's live work, not settled history.** It is the
reason for the off-limits list in §6. Your branch already contains it, so you
need nothing further from `main` — do not pull again mid-run.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

Each is a product-owner decision with its reason. The reason is there so you can
extend the decision to cases this document did not foresee.

1. **Tier 0 reports are complete, not partial.** A field with no value is not
   rendered at all — no "—", no "not found", no empty row. *Because a report full
   of blanks reads as broken software, while a shorter report reads as a shorter
   report.*

2. **The locked block sits at the foot of every report, always in the same
   place.** It lists real section titles, one line each on what they would do, and
   grey bars standing in for text. Never fabricated sample content, never a
   countdown, never a modal. *Because the goal is to inform, and fake content
   would make every real part of the report untrustworthy too.*

3. **"Done" is blue, not green.** Saved job and event cards are already tinted by
   `--color-relevance`, a fixed green that deliberately ignores the accent
   (`opportunityRelevanceCardProps` sets the card background from it). An applied
   card tinted green would be indistinguishable from a well-matched one. Blue is
   unclaimed, cool against every warm ground, and reads as filed. *Rule for any
   future accent: pick the hue furthest from the accent that is not already
   spoken for — green means match quality, red means destructive, amber means
   warning — then drop saturation about a third below the accent.*
   **Indigo is the exception** and takes deep teal, because indigo is itself blue.

4. **Colour is never the only signal.** The word — Applied, Registered,
   Submitted — always sits beside the mark. *Because colour alone fails for
   colour-blind users and in sunlight.*

5. **An event tints on the first tick, not the last.** Registering and submitting
   an abstract are separate acts with separate deadlines and get separate
   controls, stacked in the corner. Either one tints the card; whatever is still
   outstanding stays marked in red on the card and in the Dashboard. *Because you
   have acted on it, and the outstanding item is tracked by its own deadline
   rather than by withholding the tint.*

6. **Nothing in "Who'll be in the room" is ever collapsed.** No "+29". Every
   organisation and every speaker is listed, with full name, role and institution
   for people. Each row has a ★ that tells Peer this one matters — it moves to the
   top and every future event highlights it. *Because Peer's guess about what
   matters to the user is not good enough to justify hiding anything; the user
   named CATL specifically as something Peer would have buried.*

7. **Work authorisation is a country list, not a switch.** The user says where
   they can already work; every posting is judged against its own country. *Because
   Peer searches globally — a German aggregator, a US federal source, two global
   remote boards, open web discovery — so one switch would apply US rules to a
   Munich job.* The phrase sets are per country: US (`H-1B`, `authorized to work
   in the US`, `CPT/OPT`), UK (`Skilled Worker visa`, `right to work in the UK`),
   EU (`EU Blue Card`), Canada, Australia. Everywhere else falls back to generic
   wording, and where there is no phrase set Peer says nothing rather than guessing.

8. **The CPT/OPT internship exception is US-only** and fires only when the posting
   is in the US. *Because a UK internship runs on a Student visa's work
   permission and a German one on different rules again.*

9. **Events do not use the sponsorship model at all.** A conference needs a
   visitor visa and an invitation letter, not an employer sponsor. The event report
   handles that on its own and the work-authorisation setting does not touch it.

10. **In the jobs filters, only "Where" accepts typing.** Everything else is a
    fixed option set or is generated from what today's pool actually contains.
    *Because the generated chips carry true counts, and free text for a date range
    would be worse than four buttons.* A typed location with zero results today is
    **kept**, showing "nothing today, added to tomorrow's search" — the knob is
    what the user wants, the chips are what exists.

11. **The Dashboard does not report how hard Peer worked.** No source breakdown,
    no "searched N sources", no found→opened→saved funnel. It answers: what came in
    today, what am I holding, what expires next, what have I done. *Because the
    user does not care how many sources were queried; they care what is on their
    plate.*

12. **The internship lane is on by default for PhD stages only**, off for postdoc
    and research scientist, switchable in the profile. *Because an internship is
    noise to someone who already has a doctorate.*

---

## §6. GROUND RULES

### Branch and working directory — ALREADY SET UP

```
C:\I\Personal\Github - start up project\Peer        (branch: feature/summary-report-revamp)
```

Based off `main` at `e47602b`, fast-forwarded on 2026-07-30 so you have the new
AI-key setup and `lib/llm/provider-models.ts`.

**There is deliberately no separate worktree.** This project was consolidated to a
single checkout on 2026-07-29 after parallel worktrees caused the same problem to
be solved twice on two branches. Do not create a worktree. Do not create another
branch. Do not check out `main` or `local-profile-snapshot`.

**This file lives at the repo root, and the ledger in §2 is the copy you edit.**
Commit it alongside your code.

### ANOTHER AGENT IS WORKING IN THIS REPO — FILES YOU MAY NOT EDIT

A second agent is actively building in this same checkout and committing to
`main`. Its most recent commit is `e47602b` (2026-07-30 15:22). It owns these
paths and **you must not edit any file under them**:

```
web/src/app/welcome/**              onboarding wizard + completeness scoring
web/src/components/profile/ai-setup.tsx
web/src/lib/llm/**                  providers, provider-models, usage log
```

Read them freely — several tasks need to know what they export. Never change
them. If a task seems to require an edit there, it does not: re-read the task
spec, which has already been rewritten to route around them.

`web/src/app/page.tsx` is **shared** — that agent touched it in `e47602b` and may
again. Tasks P1.3 and P5.2 both change it. Keep those edits surgical and
self-contained so a later merge is mechanical rather than a rewrite.

Two more rules that follow from this:

- **Do not commit to `main`, and do not merge or rebase `main` into your branch
  mid-run.** It will move under you. Your branch is already based on `e47602b`,
  which is everything you need. The reviewer does the final merge.
- **Do not run the dev server** unless a task genuinely requires seeing something
  render — the other agent may have one running, and this project leaves orphaned
  Next.js workers on Windows. If you must, run `npm run kill-orphans` from `web/`
  after and verify the processes are gone.

### Framework — your training data is probably wrong here

`web/AGENTS.md` says it plainly: **this is not the Next.js you know.** The repo runs
**Next 16.2.3 with React 19.2.4**. APIs, conventions and file structure differ from
older releases. Before writing anything that touches routing, server components,
`params`, caching or metadata, **read the relevant guide in
`web/node_modules/next/dist/docs/`** rather than relying on memory. Heed
deprecation notices.

Note the existing pattern for dynamic routes: `params` is a `Promise` and is
unwrapped with React's `use()` — see `web/src/app/jobs/[id]/page.tsx`.

### Secrets

No API keys are needed for any task in this handoff — every acceptance command is
an offline unit test. Provider keys live in the user's browser (`feedAiApiKey` in
the profile store, local-only, never synced) and in server env vars. **Never log,
commit, or paste a key into a file.** Any test that would need a live key must
skip cleanly when it is absent so CI stays green.

### Commands

```
cd web
npx vitest run          # baseline: 50 files, 446 tests passing
npx tsc --noEmit        # must stay clean, exit 0
npx eslint              # must stay at exactly 1 error (persona/quiz.tsx:46)
```

Do **not** start the dev server unless you need to see something render. If you
do, this project leaves orphaned Next.js workers on Windows — run
`npm run kill-orphans` from `web/` afterwards and verify with Task Manager.

### DO NOT

- Do not fix `web/src/components/persona/quiz.tsx:46`. It is out of scope and its
  fix is a real React question, not a lint tidy-up.
- Do not change `--color-relevance` or the relevance card tint. Other surfaces
  depend on it and it is deliberately independent of the accent.
- Do not add a paid dependency or a new data source. Every task here is
  achievable with what is already in `package.json`.
- Do not touch the paper deep-report pipeline (`lib/papers/deep-report.ts`,
  `report-stream.ts`). Papers already have a good report; only the *card* changes.
- Do not open a PR. The reviewer goes first.
- Do not leave probe scripts, scratch files or `.only` in tests.

---

## §7. TASK SPECIFICATIONS

### P1.1 — Digest sentences into the store

Files: `web/src/store/feed.ts`, `web/src/components/digest/daily-digest.tsx`.

`/api/digest` already returns `bullets: { paperId, text }[]`, and `DailyDigest`
already caches them in `localStorage` under `peer-digest-cache`. Move that result
into the feed store as `paperSummaries: Record<string, string>` so any component
can read a paper's sentence by id, persisted through the existing `partialize`.

Keep the existing 12-hour cache TTL and the `noLlm` short-circuit.

**Acceptance:** `cd web && npx vitest run src/store/feed.test.ts` passes, plus a
new case proving a digest payload lands in `paperSummaries` keyed by paper id.

### P1.2 — The sentence on the card

Files: `web/src/components/cards/feed-tile.tsx` (the `PaperTile` function).

Spec plate 01, "Today · after". Body text becomes the paper's summary sentence in
the reading serif. Below it, one accent line: `Why you · <matched topics>`.
Author/venue line and the footer stay as they are.

Fallback chain when there is no summary — this is what makes it work with no AI
key: `paperSummaries[id]` → first two sentences of `summaryIntro` → the existing
`relevanceReason`. Never render an empty body.

**Acceptance:** `cd web && npx vitest run src/components/cards` passes, with a new
test asserting all three fallback rungs.

### P1.3 — Remove the highlights block

Files: `web/src/app/page.tsx`.

Delete the `showPaperDigest` render path and the `<DailyDigest>` usage. Keep the
`/api/digest` call itself — P1.1 now consumes it — but it no longer renders a
section of its own. Remove `selectedPaperId` / `onSelectPaper` plumbing if nothing
else uses it after the block is gone.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` — 446+ passing,
typecheck clean, and no reference to `DailyDigest` remains in `page.tsx`.

### P2.1 — Extend the types

Files: `web/src/types/index.ts`.

Add to `Job`, all optional so nothing existing breaks:
`applicationDeadline?: string` · `startDate?: string` · `contractLength?: string` ·
`applicationMaterials?: string[]` · `roleKind?: RoleKind` ·
`visa?: { state: "sponsors" | "not-stated" | "wont-sponsor"; evidence?: string; country?: string }`

Add to `Event`:
`registrationDeadline?: string` · `fees?: EventFee[]` · `activities?: string[]` ·
`organisations?: EventOrg[]` · `people?: EventPerson[]` · `travelGrant?: string` ·
`invitationLetter?: boolean` · `expectedSize?: number`

Where `EventOrg = { name: string; descriptor?: string; relevance?: string; atEvent?: string }`
and `EventPerson = { name: string; role?: string; institution?: string; relevance?: string; speaking?: string }`.

**Acceptance:** `cd web && npx tsc --noEmit` clean and `npx vitest run` still 446+.

### P2.2 — Job page extractor

Files: new `web/src/lib/opportunities/job-details.ts` + test.

Input: page HTML. Output: `{ applicationDeadline?, startDate?, contractLength?, applicationMaterials? }`.

Order: JSON-LD `JobPosting.validThrough` first (see `extractJsonLdOpportunities`,
already written), then labelled-line regex. Real phrasings measured on
jobs.ac.uk, nature.com and euraxess: `Application deadline:`, `Closing date`,
`apply by`, `Applications close`, `Review of applications will begin`,
`Start date`, `expected start`, `fixed-term`, `3-year`, `cover letter`,
`curriculum vitae`, `research statement`, `three letters of reference`.

Gotcha: a date with no year ("Closing date: 15 September") must resolve to the
**next** occurrence of that date, not the current year, or a September deadline
read in November lands in the past.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/job-details.test.ts`
— fixtures for at least 4 real phrasings plus one page with none of them, which
must return an empty object rather than throwing.

### P2.3 — Visa extractor

Files: new `web/src/lib/opportunities/visa.ts` + test.

Three states per decision 7 in §5. Country-scoped phrase sets for US, UK, EU,
Canada, Australia, plus a generic fallback. Signature takes the posting text and
the job's country; returns state, the matched sentence as `evidence`, and the
country the ruling applies to.

`wont-sponsor` must win over `sponsors` when both appear — postings often say
"we sponsor visas for some roles" then "this role requires existing authorisation".

Also: when the job's country is in the user's authorised list, the state is not
computed at all. That check belongs at the call site, not in this module.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/visa.test.ts` —
cases for all three states in at least two countries, the conflict case above,
and a US internship (which must not be flagged; see decision 8).

### P2.4 — Role-kind classifier

Files: new `web/src/lib/jobs/role-kind.ts` + test.

`internship | phd-position | postdoc | staff | faculty`. The regexes already exist
in `web/src/lib/jobs/scoring.ts` (`INTERN_RE`, `PHD_POSITION_RE`, `POSTDOC_RE`,
`RESEARCH_SCIENTIST_RE`, `FACULTY_RE`) — **extract them into this module and have
`scoring.ts` import them** rather than duplicating. Title is the strong signal,
description the weak fallback.

**Acceptance:** `cd web && npx vitest run src/lib/jobs/role-kind.test.ts src/lib/jobs/scoring.test.ts`
— new tests pass and the existing scoring tests still pass unchanged.

### P2.5 — Event page extractor

Files: new `web/src/lib/opportunities/event-details.ts` + test.

Fees (standard / student / online, with early-bird cutoff), registration deadline
(distinct from the submission deadline the `Event` type already has), travel
grants, invitation letters, and activities matched against a **fixed vocabulary**:
poster session, workshop, tutorial, panel, career fair, job fair, exhibition,
networking, hackathon, mixer, symposium, keynote.

Fixed vocabulary is the point — it is why this works without a model.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/event-details.test.ts`,
including a fixture derived from an icml.cc-shaped page (measured to contain
submission deadline, activities, travel grant and invitation letter).

### P2.6 — Event roster extractor

Files: new `web/src/lib/opportunities/event-roster.ts` + test.

Organisations from sponsor/exhibitor sections; people from speaker/programme
sections with name, role and institution. Return **everything found** — no
truncation anywhere in this module (decision 6).

Relevance is a lookup done by the caller, not here: an organisation matches if it
appears in the user's saved jobs or preference ledger; a person matches if they
authored a paper in the user's feed or their name matches a declared topic.

Honest limit to encode in the tests: a well-structured speaker page yields name +
role + institution; a prose page yields the name only. Both are acceptable
outputs. Do not invent a title you did not find.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/event-roster.test.ts`
— one structured fixture returning full triples, one prose fixture returning
names only, and neither dropping any entry.

### P2.7 — Wire it in

Files: `web/src/lib/opportunities/enrich.ts`, `web/src/lib/opportunities/page-fetch.ts`.

Call the four new extractors from `enrichJobCandidates` / `enrichEventCandidates`,
which already fetch the pages. Add the JS-shell guard next to `UNFETCHABLE_HOSTS`:
extracted text under ~20 KB means unusable, return early. Measured cases —
academicjobsonline.org at 6 KB and acs.org at 0.2 KB — must both be rejected.

Every extractor must be individually try/caught. One bad page must never lose the
other 39 in the batch.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrich.test.ts` —
existing cases still pass, plus a new case proving a 6 KB shell page enriches
nothing and does not throw.

### P3.1 — Job report

Files: `web/src/app/jobs/[id]/page.tsx`.

Spec plate 02, top to bottom: header chips (role kind, contract, visa, match) →
title, company, location → action row (Apply, Save, Mark as applied, Not
interested) → seven-tile fact strip including Visa → the visa evidence sentence
quoted underneath → timeline (posted → today → deadline → start) → skills you have
vs gaps with the ratio bar → what the role is → what to have ready → why Peer sent
it → the locked block from P3.3.

Every tile and section hides itself when its field is absent (decision 1).

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a
component test rendering a job with **only** the fields the aggregators actually
provide (title, company, location, salary, posted) and asserting no empty tile,
no "—", and no thrown error.

### P3.2 — Event report

Files: `web/src/app/events/[id]/page.tsx`.

Spec plate 03. Two things are easy to get wrong:

- The **"Cheapest way in, for you"** callout appears **twice** and both are
  deliberate: once as an accent-tinted block immediately above the two-deadline
  timeline near the top of the report, and again bolded at the head of the "What
  it costs you" table. It is the single most actionable line in the report.
- **"Who'll be in the room"** is its own full-width section below "What actually
  happens there", split into Organisations and People. Matched entries get a card
  with three lines: why they concern you, and what they are doing at this event.
  Everyone else gets a complete two-column roster with a ★ on each row. Nothing is
  collapsed.

Costs are a bordered table with a header row (Item / Standard / Student /
Deadline), not a faded key-value list — it was getting lost in the background.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a
component test asserting that an event with 30 organisations renders 30 rows.

### P3.3 — The locked block

Files: new `web/src/components/reports/tier-upgrade-block.tsx` + test.

One component, used at the foot of the paper, job and event reports. Props: a
list of `{ title, description }`. Renders the eyebrow "Also in this report with
an AI key", the rows with a lock glyph, grey bars standing in for text, and a
"Connect a key" affordance that links to the existing AI setup panel.

**It must not render at all when a provider is configured.**

`lib/llm/` belongs to the other agent and is being changed right now, so do not
import from it in three places. Create one thin adapter you own — e.g.
`web/src/components/reports/provider-configured.ts` — that reads the current
provider state and exports a single boolean helper. Every report imports the
adapter. If the other agent reshapes `lib/llm/provider-models.ts`, exactly one
file of yours needs fixing.

Never fabricated sample content (decision 2).

**Acceptance:** `cd web && npx vitest run src/components/reports/tier-upgrade-block.test.tsx`
— renders with no provider, renders nothing with a provider configured.

### P4.1 — Done colour tokens

Files: `web/src/app/globals.css`.

Add `--color-done` and `--color-done-dim` to every theme block: the light `:root`,
the `html[data-mode="dark"]` block, and the `@media (prefers-color-scheme: dark)`
block — **there are two dark blocks and the file's own comment says to keep them
in sync.**

Values from spec plate 12: `#2b5c8f` light / `#7aaee0` dark for ember, rose,
marigold, sage and violet; `#0f6f6a` / `#4fb3ac` for indigo only.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, and grep
proves `--color-done` appears in all three theme blocks.

### P4.2 — Applied state

Files: `web/src/store/feed.ts`, `web/src/app/api/saved/route.ts` if needed.

`appliedAt: Record<string, string>` for jobs; events need two —
`registeredAt` and `submittedAt`. Persist through `partialize` like `readItems`.

Sync **inside the existing saved-item payload** rather than adding a table: the
saved route already upserts an arbitrary JSON `payload`, so the state rides along
with the item and follows the user across devices with no migration.

**Acceptance:** `cd web && npx vitest run src/store/feed.test.ts` — set, unset,
persist and round-trip through the saved payload.

### P4.3 — Saved page

Files: `web/src/app/saved/page.tsx`, `web/src/components/cards/job-card.tsx`,
`web/src/components/cards/event-card.tsx`.

Spec plate 05. Segmented control (All / Papers / Events / Jobs with counts), a
To-do vs Done filter, the control in the card's top-right corner with its word to
the left, and the done tint on the card. Papers get no control.

Events get two stacked pill controls, Registered and Submitted; **either one
tints the card** (decision 5) and the outstanding deadline stays red.

**Acceptance:** `cd web && npx vitest run src/components/cards` plus a new saved
page test: a job with `appliedAt` renders the tint and the word; an event with
only `registeredAt` also renders the tint and still shows its abstract deadline
in the danger colour.

### P4.4 — The same controls on the reports

Files: `web/src/app/jobs/[id]/page.tsx`, `web/src/app/events/[id]/page.tsx`.

So the user can mark it the moment they hit submit rather than returning to Saved.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean.

### P5.1 — Activity ledger

Files: new `web/src/lib/dashboard/activity-ledger.ts` + test.

One row per local day: counts of papers, events and jobs that arrived, and which
of the user's required topics they hit. Plus running state per saved item: read,
applied, registered, submitted, and its deadline. Browser storage, **90-day
retention, pruned on write.** No server, no key.

Use `web/src/lib/local-calendar-date.ts` for day boundaries — it already exists
and the feed's day-locking depends on the same notion of "today".

**Acceptance:** `cd web && npx vitest run src/lib/dashboard/activity-ledger.test.ts`
— append, aggregate over a range, and prune beyond 90 days.

### P5.2 — Dashboard

Files: `web/src/app/page.tsx`.

Rename the tab from `All` to `Dashboard` — label, the `FeedType` union, and any
copy that says "All". Spec plate 06: today's three counts plus "you saved N",
the 14-day stacked chart, "What you're holding" as applied/done ratios, and the
required-topic coverage panel.

**Removed and must not come back:** the source breakdown, the "Peer searched N
sources" headline, the found→opened→saved→applied funnel (decision 11).

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, and grep
finds no "Where it came from" or "sources for you" string left in the app.

### P5.3 — Deadlines board

Files: `web/src/app/page.tsx` or a component under `components/dashboard/`.

Full width. Sorted by **time remaining, not by save date**. Each row: days left,
title, kind and state, an urgency bar, and the action chip. Done rows go blue and
sink to the bottom.

**Acceptance:** `cd web && npx vitest run` with a test asserting sort order for a
mixed set including one overdue and two done items.

### P6.1 — Widen events

Files: `web/src/types/index.ts` (`EventType`), `web/src/lib/events/mapper.ts`,
`web/src/lib/opportunities/query-gen.ts`.

Add `job-fair`, `career-fair`, `summit`, `expo`, `hackathon` to `EventType`.
Classify from title and description so it works for sources that label nothing.
Add recruiting-event query templates to `templateEventQueries` so Peer looks for
them deliberately instead of hoping a conference feed lists one.

**Acceptance:** `cd web && npx vitest run src/lib/events/mapper.test.ts src/lib/opportunities/query-gen.test.ts`
— classifier cases for each new kind, and career-fair queries present in the output.

### P6.2 — Internship lane

Files: `web/src/lib/opportunities/query-gen.ts`, `web/src/lib/opportunities/query-budget.ts`.

Reserve a fixed share of `JOB_QUERY_BUDGET` for internship phrasings so a general
query cannot crowd them out — that is the current failure. Terms: research
intern, PhD intern, co-op, summer placement, student researcher.

**Cycle-aware year:** internships for a given summer open the previous autumn, so
the year in the query is the *next* cycle. In July 2026 the query says "Summer
2027", not 2026. `isExpiredPosting` in `scoring.ts` already drops past cycles —
read it before writing this, it is the mirror image of the same rule.

Gate on stage: PhD years only by default (decision 12).

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/query-gen.test.ts`
— an internship query is always present for a PhD profile, absent for a research
scientist, and names the next cycle year when the clock is set to July.

### P6.3 — Jobs filters

Files: `web/src/components/opportunities/opportunity-facet-panel.tsx`,
`web/src/lib/opportunities/facets.ts`, `web/src/app/page.tsx`.

Spec plate 07. Sits under the Jobs topics panel in the same collapsible card.

- **Where** — the only typed control. Autocomplete from the existing gazetteer in
  `structured-extract.ts` (`CONFERENCE_CITIES`, `COUNTRY_NAMES`), each suggestion
  showing today's count. Anywhere / Prefer / Only these. **A location with zero
  results today is kept**, showing "nothing today, added to tomorrow's search"
  (decision 10), and is written to `locationPreferences` so it steers tomorrow.
- **Role type**, **Visa**, **When** — generated or fixed options, tap only.
  Internship appears as its own chip with a count in the pool row, so it is
  findable rather than merely present.
- Visa defaults from the profile's authorised-country list; `wont-sponsor` is
  hidden with a one-tap override.

**Acceptance:** `cd web && npx vitest run src/components/opportunities src/lib/opportunities/facets.test.ts`
— filtering by role kind and by visa state both narrow the pool correctly, and a
zero-result typed location does not empty the list.

### P6.4 — Work authorisation country list

Files: `web/src/app/profile/page.tsx`, `web/src/types/index.ts`,
`web/src/store/profile.ts`.

**Scope changed on 2026-07-30 to avoid a collision.** Spec plate 11 shows this as
a step in the welcome walkthrough. The walkthrough belongs to another agent right
now (see §6), so build the setting itself and **not** the wizard step:

Add `authorisedCountries: string[]` to the profile — the countries where the user
can already work without a sponsor — with a multi-select field in Profile
settings, near the existing location preferences. Default empty, which means
"unknown" and shows everything labelled rather than hiding anything.

This is the whole functional dependency: P6.3's visa filter reads
`authorisedCountries`, and P2.3's extractor is skipped for jobs in those
countries. The wizard step is only an onboarding entry point and is **deferred**
— note it in your session log so the reviewer can schedule it once the welcome
flow is free.

Do not edit anything under `web/src/app/welcome/`.

**Acceptance:** `cd web && npx vitest run src/store/profile.test.ts` — the field
round-trips through the store and its persistence, and defaults to an empty array
for an existing profile that has never seen it.

---

## §8. SESSION LOG — APPEND BEFORE YOU STOP

Every agent appends an entry before ending its session. Never edit someone
else's entry.

    ### Session <n> — <agent> — <date>
    - Tasks completed this session: <IDs>
    - Left IN_PROGRESS or BLOCKED: <IDs, and exactly what state the code is in>
    - Test/typecheck status at stop time: <numbers>
    - Anything I changed that was NOT in the plan, and why:
    - What the next agent should watch out for:

*(No sessions logged yet.)*

---

## §9. WHEN ALL PHASES ARE DONE

1. Confirm every ledger row reads `DONE` (or `SKIPPED` with a stated reason).
2. Run the full gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`
   (still exactly the one pre-existing error).
3. Re-run the real-world check: start the dev server, open a job report and an
   event report for real items in today's pool, and confirm both are readable
   with **no AI provider configured**. Then run `npm run kill-orphans`.
4. Delete every temporary or diagnostic file.
5. Commit everything on `feature/summary-report-revamp`. Do **not** open a PR —
   the reviewer goes first.
6. Create `HANDOFF-report-overhaul-COMPLETE.md` at the repository root:

        # HANDOFF COMPLETE
        **Branch:** feature/summary-report-revamp  **Finished:** <ISO>  **Status:** COMPLETE | PARTIAL | BLOCKED

        ## Ledger summary
        <counts, and which IDs are not DONE>

        ## Evidence
        <test output, typecheck output, the Tier 0 report check, measured numbers>

        ## What I could not do / am unsure about
        <be specific — the most useful section for the reviewer>

        ## Anything I changed that was NOT in the plan
        <list with justification>

Its appearance signals the reviewer. Never put a credential in it.
