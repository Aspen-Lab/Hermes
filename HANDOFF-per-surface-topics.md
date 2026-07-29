# HANDOFF — Per-surface Required/Explore topics + day-locked search inputs

**Planner / Reviewer:** Claude. **Implementer:** you (any agent).
**Created:** 2026-07-28. **Status:** see the Progress Ledger in §2 — that is the source of truth.

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
- **One commit per task minimum**, including the ledger update.

---

## §2. PROGRESS LEDGER — THE SOURCE OF TRUTH

Statuses: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED` · `SKIPPED`

### Phase 1 — Storage, migration, day-lock

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P1.1 | Add the four new per-surface topic fields + `activeSearchInputs` to `UserProfile` and `defaultProfile` | DONE | `npx tsc --noEmit` — passed (exit 0) |
| P1.2 | Store setters for Events and Jobs Required/Explore | DONE | `npx vitest run src/store/profile.test.ts` — 1 passed |
| P1.3 | Persist migration v2 → v3: copy existing topics into all three surfaces | DONE | `npx vitest run src/store/profile.test.ts` — 3 passed |
| P1.4 | `promoteSearchInputs()` — pending → active, once per local day | DONE | `npx vitest run src/store/profile.test.ts src/lib/opportunities/pool-cache.test.ts` — 9 passed |
| P1.5 | Run promotion once on store hydration | DONE | `npx vitest run src/store/profile-hydration.test.ts` — 1 passed; `npx tsc --noEmit` — passed |

### Phase 2 — Pipelines read the day-locked values

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P2.1 | Feed request builders send **active** (never pending) per-surface topics | DONE | `npx vitest run src/store/feed-request-body.test.ts src/store/profile-hydration.test.ts` — 2 passed; `npx tsc --noEmit` — passed |
| P2.2 | Events pool uses Events topics; Jobs pool uses Jobs topics | DONE | `npx vitest run src/store/feed-request-body.test.ts` — 2 passed |
| P2.3 | Paper feed uses Papers topics | DONE | `npx vitest run src/store/feed-request-body.test.ts` — 3 passed |
| P2.4 | Editing topics today does **not** change today's cache key | DONE | `npx vitest run src/lib/opportunities/daily-pool-cache.test.ts` — 5 passed; same key and zero second-build calls |
| P2.5 | `EVENT_QUERY_BUDGET` 18 → 16 | DONE | `npx vitest run src/lib/opportunities/query-budget.test.ts` — 2 passed; `query-gen.test.ts` — 5 passed |

### Phase 3 — Papers daily cache

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P3.1 | Cache the paper-side web discovery layer once per local day | DONE | `npx vitest run src/lib/feed/paper-daily-cache.test.ts ...pool-cache*.test.ts` — 15 passed; `npx tsc --noEmit` — passed |
| P3.2 | Repeat paper feed loads make zero additional search calls | TODO | |

### Phase 4 — Onboarding walkthrough

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P4.1 | Topics step renders three `TopicsField` blocks (Papers / Events / Jobs) | TODO | |
| P4.2 | Events and Jobs prefill from Papers as the user types | TODO | |
| P4.3 | One-line purpose description beside each of the three | TODO | |
| P4.4 | Step gating still requires only Papers Required ≥ 1 | TODO | |

### Phase 5 — Profile settings

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P5.1 | Profile settings shows three `TopicsField` sets instead of one | TODO | |
| P5.2 | Same descriptions as onboarding | TODO | |

### Phase 6 — Tab panels

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P6.1 | Collapsible Required/Explore panel under the search box on Papers, Events, Jobs | TODO | |
| P6.2 | "Active now" / "Pending tomorrow" shown when they differ | TODO | |
| P6.3 | "Changes take effect in tomorrow's search." line | TODO | |

**Total tasks: 21**

---

## §3. MISSION

Peer currently drives Papers, Events, and Jobs from **one** shared Required/Explore topic list. A researcher's desired papers, conferences, and jobs are genuinely different targets, so each surface gets its **own** list.

Two rules shape the whole design:

1. **Peer searches once per local day, per surface.** Editing topics must never trigger a search today — the edit lands in **tomorrow's** search. This is why active/pending day-locking exists (§5.3) and it is the single easiest thing to get wrong.
2. **The three lists are independent after onboarding.** Papers seeds Events and Jobs during the walkthrough, and after that nothing propagates. Paper interests shift constantly; conference and job targets barely move.

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

### 4.1 Baseline you must not regress

```
Branch: facets-and-daily-pool   HEAD: d93cf4c
npx vitest run   → 296 passed | 1 skipped (the key-gated live benchmark)
npx tsc --noEmit → clean
npx eslint src/lib → clean
```

### 4.2 Search budget — the hard constraint

Tavily plan is **1000 searches/month**. Every search costs a credit; **results per search are free** (that is why `RESULTS_PER_SEARCH = 10`).

```
Events 16 + Jobs 12 + Papers 4 = 32/day
32 × 31 = 992/month              ← fits the longest month
```

`EVENT_QUERY_BUDGET` is currently **18** and must become **16** (P2.5). Papers currently spend **up to 4 per feed load with no cache at all** — that is the leak P3.1 closes.

### 4.3 Pieces that already exist — reuse, do not rebuild

| What | Where | Note |
|---|---|---|
| Required/Explore control | `TopicsField` in `web/src/components/profile/field-kit.tsx:554` | Props: `{required, soft, onChangeRequired, onChangeSoft}`. Render it three times. |
| Daily pool cache | `web/src/lib/opportunities/pool-cache.ts` | `derivePoolCacheKey` already hashes topics + careerStage + locations + date |
| Events daily build | `buildDailyEventPool` in `web/src/lib/events/pipeline.ts:186` | Copy this shape for Papers in P3.1 |
| Paper pipeline entry | `runFeedPipeline` in `web/src/lib/feed/pipeline.ts:33` | Has **no** daily cache today |
| Paper web discovery | `runTavilyDiscovery` in `web/src/lib/feed/tavily-discovery.ts` | Issues up to 4 searches, uncached |
| Onboarding topics step | `web/src/app/welcome/page.tsx:255-278` | Currently one `TopicsField` |
| Onboarding step gating | `web/src/app/welcome/completeness.ts:69` | `researchTopics.length > 0` |
| Store persist version | `web/src/store/profile.ts:418` | Currently `version: 2` |

### 4.4 Feedback direction is already correct — do not touch it

`ORIGIN_INFLUENCE` in `web/src/lib/preferences/ledger.ts:58` already implements the agreed rule and is **out of scope**:

```
paper: { paper: 1,   event: 0,    job: 0 }
event: { paper: 0.8, event: 1,    job: 0 }
job:   { paper: 0.5, event: 0.25, job: 1 }
```

Papers influence events strongly and jobs moderately; events leak weakly into jobs; nothing flows back into papers.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

### 5.1 Field naming — reuse, do not rename

`researchTopics` and `softTopics` **stay exactly as they are** and simply become "the Papers pair". Add four new fields for the other two surfaces.

The reason is blast radius: `researchTopics` is read by the paper pipeline, the digest context hint, advisor seed discovery, the onboarding completion check, and the header meta row. Renaming touches all of them for zero user-visible benefit.

### 5.2 Seeding happens once, during onboarding

Onboarding asks for all three, with Events and Jobs **prefilled from Papers** as the user types. After onboarding, nothing propagates between surfaces — ever.

There is deliberately **no** read-time fallback and **no** "never set" state. An earlier design had those; it was rejected as too complex. Onboarding is guaranteed to run before any tab or pool build, so a straight copy at that moment has no gap.

### 5.3 Day-locked search inputs — the part most likely to go wrong

Topics are part of the pool cache key. If the pipeline reads the **live** topics, then editing a topic changes the key, misses today's cache, and **triggers a search immediately** — breaking rule 1 silently.

So the profile stores two versions:

- **pending** — what the fields in the UI write to (`researchTopics`, `eventRequiredTopics`, …)
- **active** — what today's search actually used

Shape:

```ts
interface SurfaceTopics { required: string[]; explore: string[] }

interface ActiveSearchInputs {
  papers: SurfaceTopics;
  events: SurfaceTopics;
  jobs: SurfaceTopics;
  careerStage?: CareerStage;
  locationPreferences: string[];
  promotedOn: string;   // YYYY-MM-DD, local calendar date
}
```

On store hydration, if `promotedOn` is not today's local date, copy pending → active and stamp today. **Every feed request sends `active`.** Nothing else may reach the cache key.

`careerStage` and `locationPreferences` are frozen too — they are in the cache key and have exactly the same problem.

Promotion is client-side and therefore per-device. Accepted for now; note it, do not solve it.

### 5.4 Editing is unlimited

There is no cap on how often topics may be edited. Editing costs nothing because it does not search. Do not add a limit.

### 5.5 Three places show the same data

Profile settings shows all three sets together. Each of Papers / Events / Jobs shows only its own, under the search box. One source of truth, three views — editing in either place is the same edit.

---

## §6. GROUND RULES

### Branch and working directory — ALREADY SET UP

```
C:\I\Personal\Github - start up project\Peer-facets      (branch: facets-and-daily-pool)
```

Work here. **Do not create another worktree or branch. Do not `git checkout` anything else** — sibling directories have branches checked out and in use.

This file lives at the worktree root and the ledger in §2 is the copy you edit. Commit it alongside your code.

### Product nouns

Use the app's own on-screen names verbatim: **Papers**, **Events**, **Jobs**, **All**, **Required**, **Explore**, **Profile**. Never invent or translate a label.

### Next.js version — CRITICAL

`web/AGENTS.md`: *"This is NOT the Next.js you know."* Next.js **16.2.3**, React **19.2.4**. Before touching routing, server components, or data fetching, read the local guide in `node_modules/next/dist/docs/`. Do not write Next.js from memory.

### Secrets

A global pre-commit hook blocks commits containing real API keys. **Do not bypass or disable it.** The Tavily key lives in `web/.local-data/profile.json` (gitignored) — never log it, never commit it. Tests needing it must skip cleanly when absent so CI stays green. `PEER_PROFILE_SNAPSHOT_PATH` overrides the snapshot path.

### Commands (from `web/`)

```bash
npx vitest run          # baseline: 296 passed, 1 skipped
npx tsc --noEmit        # must be clean
npx eslint src          # must be clean on changed files
```

### DO NOT

- **Do not change `ORIGIN_INFLUENCE`** — the feedback direction is already correct (§4.4).
- **Do not rename `researchTopics` / `softTopics`** (§5.1).
- **Do not add a read-time fallback or a "never set" state** (§5.2).
- **Do not let live topic values reach the cache key** (§5.3) — this is the one that silently breaks the feature.
- **Do not add a limit on editing** (§5.4).
- Do not leave temporary or diagnostic files in the repo.

---

## §7. TASK SPECIFICATIONS

### Phase 1 — Storage, migration, day-lock

**P1.1** `web/src/types/index.ts`: add `eventRequiredTopics`, `eventExploreTopics`, `jobRequiredTopics`, `jobExploreTopics` (all `string[]`) and `activeSearchInputs?: ActiveSearchInputs` to `UserProfile`; add empty defaults to `defaultProfile`. Export `SurfaceTopics` and `ActiveSearchInputs` per §5.3.
**Acceptance:** `npx tsc --noEmit` clean.

**P1.2** `web/src/store/profile.ts`: setters `updateEventTopics`, `updateEventSoftTopics`, `updateJobTopics`, `updateJobSoftTopics`, mirroring the existing `updateTopics` / `updateSoftTopics`.
**Acceptance:** unit test asserting each setter writes only its own field.

**P1.3** Bump persist `version: 2` → `3` and extend `migrate` so an existing stored profile copies `researchTopics` → `eventRequiredTopics` and `jobRequiredTopics`, and `softTopics` → `eventExploreTopics` and `jobExploreTopics`, **only when those are empty**. Must be idempotent.
**Acceptance:** test migrating a v2 profile fixture, and a second run that does not overwrite user edits.

**P1.4** `promoteSearchInputs(profile, today)` — pure function returning the profile with `activeSearchInputs` refreshed from pending when `promotedOn !== today`, unchanged otherwise. Use the app's existing local-calendar-date helper (`localCalendarDate` in `web/src/lib/opportunities/pool-cache.ts`), not `toISOString().slice(0,10)`, so the day boundary matches the pool cache.
**Acceptance:** tests for first run (no active yet), same-day no-op, and next-day promotion.

**P1.5** Call promotion once when the profile store finishes hydrating, before any feed request fires.
**Acceptance:** test asserting a feed request built immediately after hydration carries the promoted values.

### Phase 2 — Pipelines read the day-locked values

**P2.1** `web/src/store/feed.ts`: `opportunityRequestBody` and the paper feed request must read from `activeSearchInputs`, never from the pending fields. Events send the Events pair, Jobs the Jobs pair, Papers the Papers pair. `careerStage` and `locationPreferences` also come from `activeSearchInputs`.
**Acceptance:** test that mutating pending topics leaves the generated request body unchanged.

**P2.2 / P2.3** Confirm each pipeline receives its own surface's topics end to end.
**Acceptance:** tests asserting the events request carries Events topics and not Papers topics, and the same for jobs and papers.

**P2.4** The behavioural test that protects the whole feature: build today's pool, edit topics, build again the same day — **the cache key must be identical and no search may fire.**
**Acceptance:** test with a counting fetch spy asserting zero calls on the second build after an edit.

**P2.5** `EVENT_QUERY_BUDGET` 18 → 16 in `web/src/lib/opportunities/query-budget.ts`, and update the budget comment to the 16 + 12 + 4 = 32/day figures.
**Acceptance:** existing `query-budget.test.ts` updated and passing.

### Phase 3 — Papers daily cache

**P3.1** Give the paper-side web discovery layer the same once-per-local-day cache the opportunity pools use. Reuse `PoolCache` and `derivePoolCacheKey` with `surface: "papers"` rather than inventing a second mechanism. **Only the search layer is cached** — the free academic sources (OpenAlex, arXiv, PubMed, Semantic Scholar, DBLP) must keep running live on every load, since they cost nothing and freshness matters.
**Acceptance:** test showing a second same-day paper feed load performs zero search calls while still returning papers.

**P3.2** Confirm the combined daily spend.
**Acceptance:** a test asserting one full day of builds issues at most 16 event + 12 job + 4 paper searches.

### Phase 4 — Onboarding walkthrough

**P4.1** In the topics step (`web/src/app/welcome/page.tsx:255`), render three `TopicsField` blocks labelled **Papers**, **Events**, **Jobs**.

**P4.2** While the user is still on this step, typing into Papers mirrors into Events and Jobs — but stop mirroring for a surface as soon as the user edits that surface directly, so their edit is not overwritten by later Papers typing.
**Acceptance:** test that Papers typing prefills both, and that after editing Events, further Papers typing no longer changes Events.

**P4.3** One line under each, in this spirit — match the app's existing copy tone:
- Papers — *Seeds your daily paper search.*
- Events — *Seeds your daily event search. Edit if you want different conferences than papers.*
- Jobs — *Seeds your daily job search.*

**P4.4** `web/src/app/welcome/completeness.ts:69` still gates on Papers Required only. Events and Jobs must never block progress.
**Acceptance:** existing `completeness.test.ts` still passes, plus a case with empty Events/Jobs.

### Phase 5 — Profile settings

**P5.1 / P5.2** Replace the single `TopicsField` in `web/src/app/profile/page.tsx` with three, clearly grouped and labelled, reusing the P4.3 descriptions.
**Acceptance:** `npx tsc --noEmit` and `npx eslint src/app/profile/page.tsx` clean; manual note in the ledger that all three render and persist.

### Phase 6 — Tab panels

**P6.1** A collapsible Required/Explore panel under the search box on Papers, Events, and Jobs, editing the same store fields. Default **expanded on Papers**, **collapsed on Events and Jobs** — paper interests change often, the other two rarely. Not shown on **All**.

**P6.2** When pending differs from active for that surface, show both:

```
Active now        battery · molten salt
Pending tomorrow  battery · molten salt · sodium-ion
```

Without this the edit looks like it did nothing, because today's feed still reflects yesterday's topics.

**P6.3** Always show `Changes take effect in tomorrow's search.` under the panel.
**Acceptance:** component test covering the differ/not-differ states, plus tsc and eslint clean.

---

## §8. SESSION LOG — APPEND BEFORE YOU STOP

```markdown
### Session <n> — <agent> — <ISO date>
- Tasks completed this session: <IDs>
- Left IN_PROGRESS or BLOCKED: <IDs, and exactly what state the code is in>
- Test/typecheck status at stop time: <numbers>
- Anything I changed that was NOT in the plan, and why:
- What the next agent should watch out for:
```

*(No sessions logged yet.)*

---

## §9. WHEN ALL PHASES ARE DONE

1. Confirm every ledger row reads `DONE` (or `SKIPPED` with a stated reason).
2. Run the full gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`.
3. Re-run the live events benchmark (key-gated) and confirm it still passes.
4. Delete every temporary or diagnostic file.
5. Commit everything on the branch. **Do not open a PR** — the reviewer goes first.
6. Create `HANDOFF-per-surface-topics-COMPLETE.md` at the worktree root:

```markdown
# HANDOFF COMPLETE
**Branch:** <name>   **Finished:** <ISO>   **Status:** COMPLETE | PARTIAL | BLOCKED

## Ledger summary
<counts, and which IDs are not DONE>

## Evidence
- `npx vitest run` output
- `npx tsc --noEmit` output
- Proof that editing topics today does not trigger a search
- Measured searches consumed by one full day of builds

## What I could not do / am unsure about
<be specific — the most useful section for the reviewer>

## Anything I changed that was NOT in the plan
<list with justification>
```

Its appearance signals the reviewer. **Never put a credential in it.**
