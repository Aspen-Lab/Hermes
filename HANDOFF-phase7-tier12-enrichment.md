# HANDOFF — Phase 7: make the locked block tell the truth

**Planner / Reviewer:** Claude (reviewer of the Phase 1–6 build). **Implementer:** you (any agent).
**Created:** 2026-07-30. **Status:** see the Progress Ledger in §2 — that is the source of truth.

**Design spec:** https://claude.ai/code/artifact/c373776b-047b-48eb-8e9f-3c69e3e281de
Plates 02 and 03 contain the locked "Also in this report with an AI key" blocks.
**Those blocks are the contract this phase has to satisfy** — they currently
promise eight things and deliver none of them.

**Predecessor:** `HANDOFF-report-overhaul.md` (Phases 1–6, all 24 tasks DONE and
reviewed). Read its §6 ground rules — they still apply unchanged.

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

### Phase 7A — Shared enrichment plumbing

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P7.1 | Enrichment types, prompt builder, and the 7-day client cache | DONE | `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts` - 1 file, 6 tests passed |
| P7.2 | `/api/jobs/report` — Tier gate, BYOK override, graceful null | DONE | `cd web && npx vitest run src/app/api/jobs/report/route.test.ts` - 1 file, 3 tests passed |
| P7.3 | `/api/events/report` — same shape | DONE | `cd web && npx vitest run src/app/api/events/report/route.test.ts` - 1 file, 3 tests passed |

### Phase 7B — Job report enrichment (spec plate 02)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P7.4 | Job enrichment prompt + strict parser for the four promised sections | IN_PROGRESS | |
| P7.5 | Job report renders the four sections and hides the locked block only when they render | TODO | |

### Phase 7C — Event report enrichment (spec plate 03)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P7.6 | Event enrichment prompt + strict parser for the four promised sections | TODO | |
| P7.7 | Judged attendees merge back into the existing roster without duplicating rows | TODO | |
| P7.8 | Event report renders the four sections and hides the locked block only when they render | TODO | |

### Phase 7D — Cost control and honesty

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P7.9 | Hard cost ceiling: one call per item, token caps, zero calls without a provider | TODO | |
| P7.10 | Provider vision capability: one source of truth instead of two | TODO | |

**Total: 10 tasks.**

---

## §3. MISSION

Every job and event report currently ends with a grey block headed *"Also in
this report with an AI key"*, listing four things each that an AI key would
unlock. A user who connects a key sees the block disappear — **and nothing new
appear.** The report is byte-for-byte identical.

That is worse than not shipping the block. It is a promise the product does not
keep, on the exact screen where the user is deciding whether the key is worth
paying for.

This phase implements the eight promised features and makes the block's
disappearance mean something.

**The constraint that shapes the architecture:** job and event reports are
currently **free** — no AI call is made for them at any tier. This phase is the
first thing to put them on the meter. A careless implementation roughly doubles
a user's monthly bill (see §4). One call per opened item, cached, is the design.

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

Measured on 2026-07-30 against this branch. Trustworthy. Re-measuring wastes your session.

### Baseline — do not regress

```
cd web
npx vitest run       →  64 test files, 545 tests, all passing (vitest 4.1.8)
npx tsc --noEmit     →  clean, exit 0
npx eslint           →  exactly 1 error, PRE-EXISTING, not yours:
                        web/src/components/persona/quiz.tsx:46
                        react-hooks/set-state-in-effect
```

The 545 includes a **live** benchmark (`src/lib/events/benchmark.test.ts`) that
hits real websites and skips itself when no live profile snapshot is present. It
caught a real regression during review. **Do not skip it by pointing
`PEER_PROFILE_SNAPSHOT_PATH` at a nonexistent file** — that is how the last
build's self-report came out green while the suite was actually failing.

### What the locked block promises today

`TierUpgradeBlock` renders `{title, description}` rows and returns `null` when
`providerConfigured` is true. Current copy — this is the contract:

**Job report (plate 02):**
1. *How competitive this actually is* — reads the requirements against the user's profile and says where they'd stand
2. *Sponsorship read when the posting is silent* — judges the employer's track record instead of leaving it at "not stated"
3. *The role in three clean sentences* — rewritten, rather than the posting's own best sentences
4. *What to emphasise in your application* — which of the user's papers and methods to lead with

**Event report (plate 03):**
1. *The other N exhibitors, judged* — which strangers are worth the user's day
2. *What each talk is actually about* — reads the programme abstracts, not just session titles
3. *A day-by-day plan* — which sessions to attend and who to find, in order
4. *Is your work a fit for the poster call* — compares the call's scope against the user's project

### The data these features consume already exists

Phase 2 built the Tier 0 extractors. The enrichment does **not** re-fetch pages;
it consumes what is already on the object:

```ts
Job:   summary, keyRequirements, matchedTerms, roleKind, employmentType,
       salary, applicationDeadline, startDate, contractLength,
       applicationMaterials, visa: { state, evidence, country }
Event: activities[], organisations: EventOrg[], people: EventPerson[],
       fees, registrationDeadline, travelGrant, invitationLetter, deadline
EventOrg  = { name, descriptor?, relevance?, atEvent? }
EventPerson = { name, role?, institution?, relevance?, speaking? }
```

`relevance` and `atEvent` / `speaking` are populated at Tier 0 **only for
entries the user already has history with** (an org in a saved job, a person who
wrote a paper in the feed). Everything else has `name` + `descriptor` and
nothing more. **Those are exactly the rows P7.6 has to judge.**

### Cost — this is the hard part, and the reason for §5's rules

Current measured spend for a user reading 10 papers/day with deep report on
(30-day month, their own key):

| Provider | Today | If this phase adds one large-tier call per opened item, uncapped |
|---|---:|---:|
| DeepSeek | $2.1 | ~$3.0 |
| Gemini | $2.4 | ~$4.6 |
| OpenAI | $5.0 | ~$11.4 |
| Anthropic | $19.8 | ~$30.5 |

The estimate assumes 13 jobs + 4 events opened per day at ~2,500 input /
~900 output tokens each on the large tier. **On Anthropic that is a 54%
increase.** It is only acceptable because of the caching and single-call rules
in §5 — an implementation that calls per section, or re-calls on every open,
multiplies it by four or by thirty respectively.

Provider prices used (fetched 2026-07-30, per million tokens, large tier):
Anthropic Sonnet 5 $3/$15 · OpenAI gpt-5.4-mini $0.75/$4.50 ·
Gemini 2.5 Flash $0.30/$2.50 · DeepSeek v4-pro $0.435/$0.87.

### The vision flag (P7.10) — smaller than it looks

Three facts, all verified:

1. `PROVIDER_MODELS[x].vision` is **read by nothing**. Grep the whole of `src/`
   — the only occurrences are its own declaration and the five literals.
2. The gate that actually works is `if (!provider?.generateVisionJsonText) return null`
   in `lib/figures/vision-match.ts`. Anthropic, OpenAI, Gemini and Qwen define
   that method; **DeepSeek deliberately omits it**, with a comment saying so.
3. **The user is already told.** `components/profile/ai-setup.tsx` renders an
   amber note for DeepSeek: *"Important: DeepSeek cannot process images in Peer."*

So there is no user-facing gap. What is left is one maintenance hazard: a second
source of truth that nothing consults and that will silently drift from the
adapters. That is P7.10, and it is the smallest task here.

One related fact worth knowing but **out of scope**: figure matching calls
`resolveProvider()` with no override, so it always runs on the **site's**
provider, never the user's BYOK key. Do not "fix" that in this phase.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

1. **One LLM call per opened item. Not per section.** All four sections of a
   report come back from a single request with a single JSON schema. *Because
   four calls is four times the bill for output that shares all of its input.*

2. **Cache exactly like the paper report does.** `localStorage`, keyed by item
   id + profile-context hash + provider id, 7-day TTL for a successful
   enrichment and 6 hours for a failed one. Copy the shape from
   `app/papers/[id]/page.tsx` (`PAPER_REPORT_CACHE_*`). *Because without it,
   re-opening a saved job re-bills the user every time.*

3. **Enrichment runs on open, not on feed build.** Never enrich the whole pool.
   *Because the user opens perhaps 15% of what Peer finds, and the other 85%
   would be pure waste.*

4. **The locked block hides only when real enrichment renders.** Not when a
   provider merely resolves. If the call fails, times out, or returns
   unparseable JSON, the block stays visible and the report degrades to Tier 0.
   *Because the current bug is precisely that the block's absence promises
   something that isn't there.*

5. **Tier 0 output is never replaced, only added to.** The extractive summary,
   the quoted visa sentence, the matched-history roster rows all stay exactly as
   they are; enrichment appends new sections and fills empty fields. *Because a
   quoted sentence from the posting is more trustworthy than a rewrite of it,
   and the user has no way to tell which they are looking at once it's rewritten.*

6. **Never let the model invent an attendee.** For P7.6, the model may only
   judge names that already exist in `organisations[]` / `people[]`. Its output
   is matched back by exact name; **an unmatched name is dropped, not added.**
   *Because a fabricated speaker on a conference page is the single most
   damaging error this feature could make.*

7. **Sponsorship judgment is labelled as judgment.** The Tier 0 `visa.evidence`
   quote and a Tier 1/2 "this employer usually sponsors" read must never render
   in the same visual treatment. *Because one is a fact from the posting and the
   other is a guess about the employer, and a user planning a move needs to know
   which is which.*

8. **Large tier for the whole call.** Not small, not split. *Because every one of
   the eight features is judgment rather than extraction, and small-tier
   judgment on someone's career decision is worse than no judgment.*

---

## §6. GROUND RULES

### Branch and working directory

```
C:\I\Personal\Github - start up project\Peer      (branch: feature/summary-report-revamp)
```

Same branch as Phases 1–6 — this is the same unmerged feature. **Do not create a
branch or a worktree.** This project is deliberately a single checkout.

**This file lives at the repo root and the ledger in §2 is the copy you edit.**

### Ownership — check before touching `lib/llm/`

As of 2026-07-30 a second agent owned `web/src/app/welcome/**`,
`web/src/components/profile/ai-setup.tsx`, and `web/src/lib/llm/**`.
**P7.10 has to edit `lib/llm/provider-models.ts`.** Before starting P7.10, ask
the reviewer whether that ownership still stands. If it does, mark P7.10
`BLOCKED` and finish everything else — it is the least valuable task here.

Every other task in this phase stays clear of those paths.

### Framework

`web/AGENTS.md`: **this is not the Next.js you know.** Next 16.2.3, React 19.2.4.
Read the relevant guide in `web/node_modules/next/dist/docs/` before writing
route handlers. The existing pattern to copy is `app/api/papers/report/route.ts`.

### Secrets

No API key is needed for any acceptance command here — every one is an offline
unit test with a stubbed provider. User keys live in the browser profile store
and arrive as `llmOverride` on the request body. **Never log, commit, or write a
key to a file.** Tests must pass with no provider configured.

### Commands

```
cd web
npx vitest run          # baseline: 64 files, 545 tests
npx tsc --noEmit        # must stay clean
npx eslint              # must stay at exactly 1 error (persona/quiz.tsx:46)
```

Do not start the dev server unless a task needs it. If you do, run
`npm run kill-orphans` from `web/` afterwards **and verify no node process is
left listening** — a stale server from an earlier session blocked port 3000 and
silently killed two fresh servers during this review.

### DO NOT

- Do not add a second LLM call per report. See §5.1.
- Do not enrich during the feed build. See §5.3.
- Do not rewrite or delete Tier 0 output. See §5.5.
- Do not fix the figure-matching provider split (§4, last paragraph). Out of scope.
- Do not touch `lib/papers/deep-report.ts` or the paper report pipeline.
- Do not skip the live benchmark by redirecting `PEER_PROFILE_SNAPSHOT_PATH`.
- Do not open a PR. The reviewer goes first.

---

## §7. TASK SPECIFICATIONS

### P7.1 — Enrichment types, prompt builder, cache

Files: new `web/src/lib/opportunities/enrichment.ts` + test.

Define `JobEnrichment` and `EventEnrichment` result types matching the eight
promised sections, a `buildEnrichmentContext(profile)` helper (topics, career
stage, project text, authorised countries — the same fields the paper report's
`contextHint` uses), and the cache read/write pair with the TTLs from §5.2.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— cache hit, cache miss, expiry at both TTLs, and a key that changes when the
provider id changes.

### P7.2 — `/api/jobs/report`

Files: new `web/src/app/api/jobs/report/route.ts` + test.

POST `{ job, contextHint, llmOverride? }`. Resolve the provider exactly as
`app/api/papers/report/route.ts` does. **If no provider resolves, return
`{ enrichment: null, noLlm: true }` with status 200** — never an error, never a
partial object.

One `generateJsonText` call, `tier: "large"`, `maxTokens: 1200`.

**Acceptance:** `cd web && npx vitest run src/app/api/jobs/report/route.test.ts`
— returns `noLlm` with no provider and makes zero provider calls; returns a
parsed enrichment with a stubbed provider; returns `enrichment: null` when the
stub returns unparseable text.

### P7.3 — `/api/events/report`

Same shape, `maxTokens: 1600` (the roster makes the output longer).

**Acceptance:** `cd web && npx vitest run src/app/api/events/report/route.test.ts`
— same three cases.

### P7.4 — Job enrichment prompt and parser

Files: `web/src/lib/opportunities/enrichment.ts` + test.

Four fields, all optional — a missing field means that section does not render:

```ts
competitiveness: { verdict: string; reasoning: string }
sponsorshipRead: { likelihood: string; basis: string }   // only when visa.state === "not-stated"
roleSummary: string[]                                     // exactly 3 sentences
emphasise: string[]                                       // 2–4 bullets
```

Feed it: role title, company, `summary`, `keyRequirements`, `matchedTerms`,
`roleKind`, `salary`, `visa.state`, plus the profile context.

Gotchas already known:
- `sponsorshipRead` must be **absent** when `visa.state` is `"sponsors"` or
  `"wont-sponsor"` — the posting already answered, and a guess on top of a fact
  is noise. Enforce this in code, not only in the prompt.
- `roleSummary` must be exactly 3 entries; reject and drop the field otherwise.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— a stated-visa job yields no `sponsorshipRead`; a 4-sentence `roleSummary` is
dropped rather than truncated; a response missing every field parses to an empty
enrichment without throwing.

### P7.5 — Job report renders the four sections

Files: `web/src/app/jobs/[id]/page.tsx`.

Sections in spec order, each hidden when its field is absent. `sponsorshipRead`
renders **next to** the Tier 0 visa evidence quote and in a visually distinct
treatment (§5.7) — the quote keeps its current styling, the judgment gets the
muted "inferred" treatment.

The locked block's `providerConfigured` prop becomes
`Boolean(enrichment && hasAnySection(enrichment))` — **not** "a provider
resolved" (§5.4).

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a
component test: with enrichment, the four sections render and the locked block
does not; with `enrichment: null` and a provider configured, the locked block
**still renders**.

### P7.6 — Event enrichment prompt and parser

Files: `web/src/lib/opportunities/enrichment.ts` + test.

```ts
judgedAttendees: { name: string; worthIt: boolean; why: string }[]
talkSummaries: { title: string; about: string }[]
dayPlan: { day: string; items: string[] }[]
posterFit: { fits: boolean; reasoning: string }
```

Feed it the **un-judged** rows only — entries in `organisations[]` / `people[]`
whose `relevance` is empty. Those with a Tier 0 `relevance` already have a
reason and must not be re-judged.

**§5.6 is the load-bearing rule here.** Match every returned `name` back to an
existing roster entry by exact string; drop anything that does not match. Write
the test for a hallucinated name explicitly.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— a returned name absent from the input roster is dropped; an entry that already
had Tier 0 `relevance` is not sent to the model and not overwritten.

### P7.7 — Merge judged attendees into the roster

Files: `web/src/app/events/[id]/page.tsx` or a helper beside it.

A judged entry moves from the plain "everyone else" list into the cards above,
carrying its `why`. It must appear **once** — not in both lists.

**Acceptance:** `cd web && npx vitest run` with a test asserting a roster of 30
where 5 are judged renders 5 cards and 25 plain rows, total 30, no duplicates.

### P7.8 — Event report renders the four sections

Files: `web/src/app/events/[id]/page.tsx`.

Same locked-block rule as P7.5.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus the
locked-block-still-renders-on-null case.

### P7.9 — Cost ceiling

Files: tests across the routes; a small guard module if you need one.

Prove the three rules that keep §4's estimate honest:
1. Opening one report makes **exactly one** provider call.
2. Opening the same report twice within the TTL makes **one** call total.
3. With no provider configured, **zero** calls and zero network requests.

**Acceptance:** `cd web && npx vitest run src/app/api/jobs/report/route.test.ts src/app/api/events/report/route.test.ts`
— a call-counting stub proves all three for both routes.

### P7.10 — One source of truth for vision

Files: `web/src/lib/llm/provider-models.ts` and its consumers.
**Check ownership first — see §6.**

The `vision: boolean` field is read by nothing (§4). Either delete it and derive
the fact from whether the adapter defines `generateVisionJsonText`, or keep the
field and add the test that fails when it disagrees with the adapters. **Deleting
is preferred** — one fact, one place.

Leave the DeepSeek amber note in `ai-setup.tsx` alone; it is correct and is the
user-facing disclosure.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus either
grep showing the field is gone, or a test that flips a provider's adapter and
fails.

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

1. Confirm every ledger row reads `DONE` (or `SKIPPED` / `BLOCKED` with a stated reason).
2. Run the full gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`
   (still exactly the one pre-existing error). **Do not suppress the live benchmark.**
3. Real-world check, both halves:
   - With **no** provider configured: open a job report and an event report.
     Both must be readable and the locked block must be visible on both.
   - With a provider configured: the same two reports must show the new sections
     and no locked block.
   Then `npm run kill-orphans` and verify no node process is still listening.
4. Delete every temporary or diagnostic file.
5. Commit on `feature/summary-report-revamp`. Do **not** open a PR.
6. Create `HANDOFF-phase7-tier12-enrichment-COMPLETE.md` at the repository root:

        # HANDOFF COMPLETE
        **Branch:** feature/summary-report-revamp  **Finished:** <ISO>  **Status:** COMPLETE | PARTIAL | BLOCKED

        ## Ledger summary
        <counts, and which IDs are not DONE>

        ## Evidence
        <test output, typecheck output, both halves of the real-world check, measured call counts>

        ## What I could not do / am unsure about
        <be specific — the most useful section for the reviewer>

        ## Anything I changed that was NOT in the plan
        <list with justification>

Never put a credential in it.
