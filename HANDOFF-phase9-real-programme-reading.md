# HANDOFF — Phase 9: let the user's own AI read the actual page

**Planner / Reviewer:** Claude. **Implementer:** you (any agent).
**Created:** 2026-08-01. **Status:** see the Progress Ledger in §2 — that is the source of truth.

**Design spec:** https://claude.ai/code/artifact/c373776b-047b-48eb-8e9f-3c69e3e281de

**Predecessors, all merged and pushed to `main`:**
`HANDOFF-report-overhaul.md` (Phases 1–6, 24/24), `HANDOFF-phase7-tier12-enrichment.md`
(9/10, P7.10 blocked), `HANDOFF-phase8-report-quality.md` (11/11).
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

### Phase 9A — Tier 0: widen the session-type checklist

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P9.1 | Add the researched session types, with false-positive guards | TODO | |

> **P9.1 is blocked on a research pass that is running now** — 50 real conference
> sites worldwide, recording every session-type word they use. The findings land
> in §4 under "Tier 0 vocabulary research" before this task starts. **Do not
> invent the word list from memory.** If §4 still says PENDING, mark P9.1
> `BLOCKED` and start at P9.2.

### Phase 9B — Tier 1/2: fetch and read the real page

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P9.2 | Server-side page text pipeline: fetch, clean, cap | TODO | |
| P9.3 | Programme-page discovery for events (one extra page, never more) | TODO | |
| P9.4 | Feed page text into the existing single call, both routes | TODO | |
| P9.5 | Event talks: real titles, each quotable from the fetched text | TODO | |
| P9.6 | Job specifics: real requirements and duties, each quotable | TODO | |
| P9.7 | Render the new sections; locked block hides only when they render | TODO | |

### Phase 9C — Honesty and cost

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P9.8 | Cost ceiling: one call, one or two fetches, hard token cap, proven | TODO | |
| P9.9 | Say why a section is missing instead of showing nothing | TODO | |

**Total: 9 tasks.**

---

## §3. MISSION

Two different problems, deliberately solved two different ways.

**Tier 0 stays a checklist.** The existing detector answers "does this event have
a poster session, a career fair, a hackathon?" by scanning for known words and
emitting a tag. That is the right design for a free tier and it works. Phase 9
only widens its vocabulary — it does **not** turn it into a title extractor.

**Tier 1/2 becomes real reading.** Every conference and every job posting is
one-off. There is no pattern that generalises across them, which is why the
checklist can never answer "what is this particular talk about" or "what does
this particular employer actually want". The only thing that can is a model that
reads the page.

So: at report time, fetch the item's own page, and hand the text to **the user's
own configured model** along with everything Peer already extracted. Let it find
the real session titles, the real requirements, the real specifics.

**What this fixes.** Today the event report's "What each talk is actually about"
never appears for anyone — measured across the whole local pool, the tick-box
detector only ever yields nine generic labels and zero real titles. The locked
block still promises the feature. Phase 9 makes the promise true.

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

Measured 2026-07-31 and 2026-08-01 on this branch.

### Baseline — do not regress

```
cd web
npx vitest run       →  77 test files, 624 tests, all passing
npx tsc --noEmit     →  clean, exit 0
npx eslint           →  exactly 1 error, PRE-EXISTING, not yours:
                        src/components/persona/quiz.tsx:46  react-hooks/set-state-in-effect
```

The suite includes a **live** benchmark (`src/lib/events/benchmark.test.ts`) that
hits real websites and currently passes. **Do not skip it by pointing
`PEER_PROFILE_SNAPSHOT_PATH` at a nonexistent file.**

### Why the talk section is empty today — root cause, already diagnosed

`extractActivities` in `lib/opportunities/event-details.ts` loops over 12
hardcoded `{label, pattern}` pairs, searches the page text for each pattern, and
on a hit pushes **the label** — a fixed string that never comes from the page.
The 12 labels are:

```
poster session, workshop, tutorial, panel, career fair, job fair,
exhibition, networking, hackathon, mixer, symposium, keynote
```

Its output therefore cannot contain anything else. Scanning all 81 events in the
local pool cache found exactly 9 distinct values, all from that list, and **zero
real talk titles**. Phase 7 wired `activities[]` into the "what each talk is
about" prompt on the strength of the field name. The field holds session *types*,
not session *titles* — a planning error, not an implementation bug.

### What a fetched page actually costs

Measured against live sites (icml.cc, neurips.cc, electrochem.org, euraxess,
careers.ornl.gov, nature.com, jobs.ac.uk, academicjobsonline.org):

| | raw HTML | visible text after stripping |
|---|---:|---:|
| smallest real page | 47 KB | ~2 KB |
| typical | 100–180 KB | 7–15 KB |
| largest | 310 KB | ~19 KB |
| JS shells (not usable) | 0.2–6 KB | ~2 KB |

So one page adds roughly **500–5,000 tokens** of input; a conference programme
page can be at the top of that range. Two pages, worst case, approach 12,000.

### The bill this changes — read before designing

Reports were free until Phase 7. Current measured monthly spend for a user
reading 10 papers/day with deep report on, 30-day month, **their own key**:

| Provider | Before Phase 7 | Today | With Phase 9 page reading |
|---|---:|---:|---:|
| DeepSeek | $2.1 | ~$3.0 | ~$4.8 |
| Gemini | $2.4 | ~$4.6 | ~$8.5 |
| OpenAI | $5.0 | ~$11.4 | ~$22 |
| **Anthropic** | **$19.8** | **~$30.5** | **~$46** |

Assumptions: 13 jobs + 4 events opened per day; input rises from ~2,500 to
~10,000 tokens, output from ~900 to ~1,400. Prices per million tokens, large
tier, fetched 2026-07-30: Anthropic Sonnet 5 $3/$15 · OpenAI gpt-5.4-mini
$0.75/$4.50 · Gemini 2.5 Flash $0.30/$2.50 · DeepSeek v4-pro $0.435/$0.87.

**On Anthropic this is a further 50% on top of Phase 7.** It is only defensible
because §5's cap, single-call and seven-day cache rules hold. Deployed Peer is
BYOK-only, so this is the user's own spend, not the operator's — which makes the
cap a matter of respect rather than of the operator's budget.

### What already exists and must be reused, not rebuilt

- `lib/opportunities/page-fetch.ts` — `fetchPageHtml(url)` and
  `fetchPagesConcurrently(urls)`. 12 s timeout, 2 MB response cap, concurrency 8,
  a known-unfetchable host list, and a Peer user-agent. **Use it.**
- `lib/opportunities/shared.ts` — `stripHtml`.
- `lib/opportunities/enrich.ts` — the "keep the result only if something was
  actually extracted" pattern. Same philosophy applies here.
- `lib/opportunities/enrichment.ts` — the single-call prompt builders, the strict
  parsers, the exact-name matching that drops anything the model invents, and the
  7-day / 6-hour cache.
- Output caps today: events `maxTokens: 1600`, jobs `maxTokens: 1200`.

### Tier 0 vocabulary research

**PENDING** — a research pass over 50 conference sites worldwide is running. It
will report a frequency table of every session-type word found, recommended
additions that appeared on at least 3 of 50 sites, and a false-positive analysis
(for example: a page containing "solar panel" or "panel data" must not be tagged
as having a discussion panel). **P9.1 does not start until those findings replace
this paragraph.**

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

1. **Still exactly one model call per opened item.** The fetched page text joins
   the existing prompt; it does not get its own call. *Because Phase 7 §5.1 set
   this and the cost table above assumes it — a second call doubles the bill for
   input that is already in context.*

2. **Hard cap of 40,000 characters of page text per item, across all pages
   fetched.** Truncate at a paragraph boundary, never mid-word. *Because a
   conference site can serve 300 KB, and an uncapped prompt turns one expensive
   report into an unbounded one.*

3. **At most one extra page for an event. Zero for a job.** Follow a single
   programme/schedule/agenda link from the event page; if none is found, use the
   page you already have. *Because link-following is where a fetcher turns into a
   crawler, and a crawler is a different product with different risks.*

4. **Every extracted title, requirement or duty must appear verbatim in the
   fetched text.** Match it back; drop anything that does not. *Because a
   fabricated session title on a conference page, or an invented requirement on a
   job posting, is the most damaging error this feature can make — the user would
   plan travel or write an application around it.*

5. **Tier 0 output is never replaced.** The tick-box tags, the extracted
   deadlines, the quoted visa sentence all stay exactly as they are. Phase 9 adds
   sections. *Because the extracted layer is the trustworthy one and the user
   must be able to tell the two apart.*

6. **Fail soft, always.** A fetch that times out, 404s, or returns a JavaScript
   shell means the new sections are absent and the report renders as it does
   today. Never an error, never a spinner that never ends. *Because the page
   being unreachable is normal, not exceptional.*

7. **The fetch is cached with the enrichment, not separately.** One fetch per
   item per seven days, riding the existing cache. *Because re-opening a saved
   conference must not re-fetch and re-bill.*

8. **The user's key does the reading.** The fetch is server-side; the model call
   uses their configured provider. No provider, no fetch — the request must not
   even leave Peer. *Because there is no point paying for bandwidth to build a
   prompt nobody will send.*

---

## §6. GROUND RULES

### Branch and working directory

```
C:\I\Personal\Github - start up project\Peer      (branch: feature/summary-report-revamp)
```

`main`, the branch, and both origin refs are all at the same commit as of
2026-08-01. **Work on this branch; do not create a worktree or a new branch.**
This project is deliberately a single checkout.

**This file lives at the repo root and the ledger in §2 is the copy you edit.**

### Framework

`web/AGENTS.md`: **this is not the Next.js you know.** Next 16.2.3, React 19.2.4.
Read the relevant guide in `web/node_modules/next/dist/docs/` before touching
route handlers.

### Secrets

No API key is needed for any acceptance command here — every one is an offline
test with a stubbed provider and a stubbed fetch. User keys arrive as
`llmOverride` on the request body. **Never log, commit, or write a key to a
file.** Tests must pass with no provider configured.

### Commands

```
cd web
npx vitest run          # baseline: 77 files, 624 tests
npx tsc --noEmit        # must stay clean
npx eslint              # must stay at exactly 1 error (persona/quiz.tsx:46)
```

If you start the dev server, run `npm run kill-orphans` from `web/` afterwards
**and verify no node process is left listening**.

### DO NOT

- Do not add a second model call per report. See §5.1.
- Do not follow more than one link, and never follow a link off the event's own host. See §5.3.
- Do not let a title reach the screen that is not quotable from the fetched page. See §5.4.
- Do not change `extractActivities`' role from checklist to extractor. Widening its word list (P9.1) is the only change it gets.
- Do not fetch anything when no provider is configured. See §5.8.
- Do not skip the live benchmark.
- Do not open a PR. The reviewer goes first.

---

## §7. TASK SPECIFICATIONS

### P9.1 — Widen the Tier 0 session-type checklist

**Blocked until the research in §4 lands.** Files:
`web/src/lib/opportunities/event-details.ts` + test.

Add the recommended session types to `ACTIVITY_PATTERNS`. For each one, add a
`rejectContext` guard where the research flagged a false-positive risk — the
existing `panel` entry, which already rejects "data panel" and "survey panel", is
the pattern to copy.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/event-details.test.ts`
— every recommended word is detected in a realistic sentence, and every
false-positive phrase from the research is **not** detected.

### P9.2 — Server-side page text pipeline

Files: new `web/src/lib/opportunities/page-text.ts` + test.

Fetch a URL with the existing `fetchPageHtml`, strip to visible text, collapse
whitespace, drop nav/footer regions using the same approach
`event-roster.ts` already uses, and cap at the §5.2 limit at a paragraph
boundary. Return `null` when the page is unusable.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/page-text.test.ts`
— a 300 KB fixture caps at the limit and ends at a paragraph boundary; a
JavaScript shell returns null; a fetch rejection returns null rather than throwing.

### P9.3 — Programme-page discovery

Files: `web/src/lib/opportunities/page-text.ts` + test.

From the event page HTML, find at most one link whose visible text or href
suggests the programme (`program`, `programme`, `schedule`, `agenda`, `sessions`,
`talks`, `speakers`). **Same host only.** Return the resolved absolute URL, or
null.

**Acceptance:** same test file — a fixture with several candidate links yields the
best single one; a fixture with an off-host "programme" link yields null; a
fixture with no candidates yields null.

### P9.4 — Feed page text into the existing single call

Files: `web/src/app/api/events/report/route.ts`,
`web/src/app/api/jobs/report/route.ts`, `web/src/lib/opportunities/enrichment.ts`.

Resolve the provider **first**. Only if a provider exists, fetch (event: page +
at most one programme page; job: the posting page). Add the text to the existing
prompt under a clearly labelled key. Raise `maxTokens` to 2000 for events and
1600 for jobs.

**Acceptance:** `cd web && npx vitest run src/app/api/events/report/route.test.ts src/app/api/jobs/report/route.test.ts`
— with no provider: **zero fetches and zero model calls**; with a provider: exactly
one model call and at most two fetches for an event, one for a job.

### P9.5 — Event talks: real titles, quotable

Files: `web/src/lib/opportunities/enrichment.ts` + test.

```ts
talkSummaries?: Array<{ title: string; about: string }>
```

Titles must come from the fetched text. Verify each returned title appears in the
fetched text (normalised for whitespace and case) and **drop any that does not**.
If none survive, omit the section — do not fall back to the tick-box tags.

**Acceptance:** `cd web && npx vitest run src/lib/opportunities/enrichment.test.ts`
— a title absent from the fetched text is dropped; a title present is kept; a
response of only generic labels yields no section.

### P9.6 — Job specifics, quotable

Files: `web/src/lib/opportunities/enrichment.ts` + test.

```ts
specificRequirements?: string[]   // what this employer actually asks for
specificDuties?: string[]         // what the person would actually do
```

Same verbatim rule as P9.5. These sit alongside the existing four job sections,
not replacing them.

**Acceptance:** same file — invented requirements are dropped; quotable ones are
kept; an empty result omits both sections.

### P9.7 — Render the new sections

Files: `web/src/app/events/[id]/page.tsx`, `web/src/app/jobs/[id]/page.tsx`.

New sections render only when populated. The locked block's `providerConfigured`
stays `Boolean(enrichment && hasAnySection(enrichment))` — Phase 8 got this right,
do not regress it.

**Acceptance:** `cd web && npx vitest run && npx tsc --noEmit` clean, plus a
component test that the locked block **still renders** when enrichment is null
with a provider configured.

### P9.8 — Cost ceiling, proven

Files: tests across both routes.

Prove four things with counting stubs:
1. No provider → zero fetches, zero model calls.
2. One opened event → one model call, at most two fetches.
3. One opened job → one model call, exactly one fetch.
4. Re-opening within the cache TTL → zero of both.

**Acceptance:** `cd web && npx vitest run src/app/api/events/report/route.test.ts src/app/api/jobs/report/route.test.ts`
— all four proven for both routes.

### P9.9 — Say why a section is missing

Files: both report pages.

When the new sections are absent, the report currently says nothing, and the user
cannot tell "no key" from "nothing on the page" from "the fetch failed". Add one
short line naming which it was. Three states, three sentences, no jargon.

**Acceptance:** a component test covering all three states, each rendering its own
line and never more than one.

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
3. **Reproduce the check by hand, and attach what you saw.** Open a real
   conference report and a real job report with a provider configured. The talk
   section must contain titles you can find on the actual conference website. Open
   one with no provider — the report must render exactly as it does today. A
   passing suite is not evidence for this phase; the real pages are.
4. Report the measured token count of one real event prompt and one real job
   prompt, so the §4 cost table can be checked against reality.
5. `npm run kill-orphans` and verify no node process is still listening.
6. Delete every temporary or diagnostic file.
7. Commit. Do **not** open a PR.
8. Create `HANDOFF-phase9-real-programme-reading-COMPLETE.md` at the repository root:

        # HANDOFF COMPLETE
        **Branch:** <branch>  **Finished:** <ISO>  **Status:** COMPLETE | PARTIAL | BLOCKED

        ## Ledger summary
        <counts, and which IDs are not DONE>

        ## Evidence
        <test output, typecheck output, what the real pages showed, measured prompt sizes>

        ## What I could not do / am unsure about
        <be specific — the most useful section for the reviewer>

        ## Anything I changed that was NOT in the plan
        <list with justification>

Never put a credential in it.
