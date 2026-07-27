# HANDOFF — Faceted event/job filtering + daily pool build

**Planner / Reviewer:** Claude. **Implementer:** you (any agent).
**Created:** 2026-07-27. **Status:** see the Progress Ledger in §2 — that is the source of truth.

---

## §1. HOW TO USE THIS DOCUMENT — READ FIRST, EVERY TIME

This document is **resumable**. A previous agent may have completed part of the work.

### If you are starting or resuming, do exactly this:

1. **Read the Progress Ledger (§2).** It is the source of truth for what is done. Do **not** trust the code, your memory, or any summary — trust the ledger.
2. **Find the first task whose status is not `DONE`.** That is where you start. Do not redo `DONE` tasks.
3. **Verify the last `DONE` task still passes** by running its acceptance command (listed in the task spec). If it fails, fix that first and note it in the session log.
4. **Set that task's status to `IN_PROGRESS`** in the ledger, commit the ledger change, then do the work.
5. **When the task's acceptance command passes,** set status to `DONE`, fill in the "Verified" column with the command output summary, and **commit the ledger together with the code**.
6. Repeat until all tasks are `DONE` or you must stop.
7. **Before you stop for any reason,** append a Session Log entry (§8) and commit. Never stop without updating the ledger.

### Non-negotiable rules for the ledger

- **Update it as you go, not at the end.** If you finish 3 tasks then crash, the ledger must already show 3 `DONE`.
- **`DONE` means the acceptance command passed.** Not "I wrote the code." Not "it looks right." If you cannot run the command, the status is `BLOCKED`, not `DONE`.
- **One commit per task minimum**, including the ledger update. This makes progress durable in git history.
- If you discover a task is already done by someone else, mark it `DONE` and note who/where in the ledger.

---

## §2. PROGRESS LEDGER — THE SOURCE OF TRUTH

Statuses: `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED` · `SKIPPED`

### Phase 1 — Detail-page enrichment (gets real locations and dates)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P1.1 | HTML page fetcher with timeout, UA, concurrency cap, never-throws | DONE | `npx vitest run src/lib/opportunities/page-fetch.test.ts` — 1 file, 7 tests passed |
| P1.2 | JSON-LD (schema.org Event / JobPosting) extractor | DONE | `npx vitest run src/lib/opportunities/structured-extract.test.ts` — 1 file, 3 tests passed |
| P1.3 | og:/meta tag extractor + date+city parsing from og:title | DONE | `npx vitest run src/lib/opportunities/structured-extract.test.ts` — 1 file, 5 tests passed |
| P1.4 | Body-text city fallback with gazetteer | DONE | `npx vitest run src/lib/opportunities/structured-extract.test.ts` — 1 file, 9 tests passed |
| P1.5 | Structured `place` field on events + jobs; hybrid keeps city AND isOnline | DONE | `npx vitest run src/lib/opportunities/place-flow.test.ts` — 1 file, 2 tests passed; `npx tsc --noEmit` — clean |
| P1.6 | Wire enrichment into the events pipeline | DONE | `npx vitest run src/lib/opportunities/enrich.test.ts` — 1 file, 3 tests passed; key-gated `npx vitest run src/lib/events/benchmark.test.ts` — 1 passed, 4/8 cities (50%), Cambridge = Chicago |
| P1.7 | Wire enrichment into the jobs pipeline | DONE | `npx vitest run src/lib/opportunities/enrich.test.ts src/lib/opportunities/structured-extract.test.ts` — 2 files, 14 tests passed; `npx tsc --noEmit` — clean; shared P1.6 live benchmark already passed at 50% / Cambridge = Chicago |

### Phase 2 — Daily pool build + cache (fixes credit budget)

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P2.1 | Pool cache interface + cache-key derivation | DONE | `npx vitest run src/lib/opportunities/pool-cache.test.ts` — 1 file, 3 tests passed; `npx tsc --noEmit` — clean |
| P2.2 | Disk cache adapter (local dev only) | DONE | `npx vitest run src/lib/opportunities/pool-cache-disk.test.ts` — 1 file, 3 tests passed; `npx tsc --noEmit` — clean |
| P2.3 | Supabase cache adapter (production; no-op when unconfigured) | DONE | `npx vitest run src/lib/opportunities/pool-cache-supabase.test.ts src/lib/opportunities/pool-cache-disk.test.ts` — 2 files, 6 tests passed; `npx tsc --noEmit` and targeted ESLint — clean |
| P2.4 | Wire both pipelines to build-once-per-day | DONE | `npx vitest run src/lib/opportunities/daily-pool-cache.test.ts src/lib/opportunities/pool-cache.test.ts src/lib/opportunities/pool-cache-disk.test.ts src/lib/opportunities/pool-cache-supabase.test.ts` — 4 files, 12 tests passed, including zero-network second builds and concurrent single-flight; `npx tsc --noEmit` and targeted ESLint — clean |
| P2.5 | Query budget: 18 event queries / 12 job queries | DONE | `npx vitest run src/lib/opportunities/query-gen.test.ts src/lib/opportunities/query-budget.test.ts src/lib/jobs/sources/jobweb.test.ts` — 3 files, 28 tests passed; adapter fetch spies enforce 18 event / 12 job searches; `npx tsc --noEmit` and targeted ESLint — clean |

### Phase 3 — API contract

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P3.1 | Return full scored pool + facet counts | TODO | |
| P3.2 | topN 5→10; `diversifyByType` cap 3→5 | TODO | |
| P3.3 | Bypass `MIN_SCORE` when any facet filter is active | TODO | |

### Phase 4 — UI

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P4.1 | Always-visible facet panel (counts + clickable, merged summary/control) | TODO | |
| P4.2 | Pagination: 10 at a time, "show 10 more" | TODO | |
| P4.3 | Green 3-tier relevance colour on the whole card | TODO | |
| P4.4 | Wire the tab search box to filter events/jobs | TODO | |

### Phase 5 — Facet preference learning

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P5.1 | Record facet selections as weak preference signals | TODO | |
| P5.2 | Boost cap + faster decay than explicit signals | TODO | |
| P5.3 | Surface the reason on the card ("because you often view Chicago") | TODO | |

---

## §3. MISSION

Peer shows a researcher a daily feed of events and jobs. Relevance was fixed in PR #15. **This work adds the ability to filter that feed by date and location, and makes the pool big enough for filtering to be meaningful.**

### The product principle that drives the architecture

> Peer searches **once per day**. Refreshing the page must **never** re-run the search. The user sees the same pool all day; it refreshes tomorrow.

This is not only a cost measure — it is what makes detail-page enrichment possible at all (too slow for a request, fine for a daily build) and what keeps facet counts stable across refreshes.

### Why location/date filtering matters

Location and time are **veto factors**, not ranking factors. A researcher who can only travel to Chicago cannot use a more-relevant Boston conference. So the user must be able to see **every** location in the pool and filter to it — even if those items ranked below the top 10.

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

All of this was measured against live sources. Trust it; do not spend tokens reproducing it.

### 4.1 The pool is currently too small for facets

With the real battery-materials profile, the current pipeline yields **6 events and 1 job** after the relevance gate. There is no hidden reservoir — "show me all Chicago events" would return ~1.

### 4.2 A wider query set fixes that

25 queries × 10 results:

```
RAW=244   UNIQUE_URLS=181   WITH_CITY=49 (27%, using a crude 5-minute regex)

CITY_FACETS: Chicago(11) Orlando(3) Denver(3) Berlin(2) Detroit(2)
             London(2) Amsterdam(2) San Diego(2) Phoenix(2) Paris(2)
             Texas(2) Nashville(2) Munich(1) New York(1) California(1)
```

**Chicago(11) is real.** The facet idea works once the pool is wide enough.

### 4.3 Detail pages are fetchable, free, and rich

Direct server-side `fetch` of 6 real result URLs:

| URL | Result | What it yields |
|---|---|---|
| `cambridgeenertech.com/solid-state-batteries` | 200, 713ms | `og:title` = **"Solid-State Battery Summit \| August 11-12, 2026 \| Chicago, IL + Virtual"** |
| `event.dlr.de/.../emea2026-workshop...` | 200, 1242ms | **JSON-LD `Event`**: `startDate: 2026-06-22T18:30:00+02:00`, `PostalAddress { addressLocality: "Oldenburg", addressCountry: "Germany" }` |
| `bluecurrent.com/event/solid-state-battery-summit-2026` | 200, 1314ms | "Chicago" in body text only |
| `inl.referrals.selectminds.com/jobs/...` | 200, 311ms | `og:title` = "...Internship in **United States**" |
| `10times.com/e1z2-0h5z-3pgr` | **403** | blocked (bot protection) |
| `battery-tech.net/battery-event/...` | **timeout** | unreachable |

**4 of 6 succeed (67%).** The two failures are aggregator mirrors — the canonical organiser page works, so nothing of value is lost.

### 4.4 Tavily cannot do this, and is not needed

Tavily's `include_raw_content` returns markdown-converted body text with **meta tags and JSON-LD stripped** — it discards the two highest-value signals. Its `/extract` endpoint costs credits. **Direct fetch is free, faster, and strictly better.** Do not add a new dependency for this.

### 4.5 Credit budget — hard constraint

Tavily plan: **1000 credits/month** ≈ **33 searches/day for everything**.

```
events   18 searches/day
jobs     12 searches/day
────────────────────────
         30/day = 900/month, 100 spare

detail-page fetching   0 credits (direct fetch)
page refresh           0 credits (cache hit)
```

Exceeding this budget is a bug, not a tuning choice.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

The product owner decided these. Implement them as written.

1. **One merged panel**, not two. The summary strip and the filter control are the same surface: always visible, tags show counts, tags are clickable to filter.
2. **Relevance colour: green, 3 discrete tiers**, applied to the whole card — low-opacity green tint plus a stronger left accent bar so text stays readable. Tier boundaries use **absolute** score thresholds, never normalised to the visible set (or a card changes colour day to day).
3. **Selecting any facet bypasses `MIN_SCORE`.** Explicit user intent outranks automatic quality filtering. Filtering to Chicago must never return an empty list when Chicago events exist.
4. **Facet learning is a weak signal**: capped boost, faster decay than save/dismiss, and visibly explained on the card. It must not create a filter bubble that buries a non-preferred location permanently.
5. **Both cache backends are required.** Supabase for the shipped product (all users); local disk for the owner's own development. Not either/or.
6. **Hybrid events keep both.** "Chicago, IL + Virtual" must set the city **and** `isOnline`. Filtering by "online" or by "Chicago" must both surface it. The current code detects "hybrid" and throws the city away — that is the bug.
7. **`topN` 5 → 10.** This is a cap ("up to 10"), not a quota — the score floor may legitimately yield fewer.

---

## §6. GROUND RULES

### Branch and working directory — ALREADY SET UP FOR YOU

Work in this directory, which is a dedicated git worktree:

```
C:\I\Personal\Github - start up project\Peer-facets      (branch: facets-and-daily-pool)
```

The branch is already created off `event-job-relevance-refactor` (PR #15, open and mergeable) — **not** `main`, because this work depends on `term-expand.ts`, `MIN_SCORE`, and `passesRequiredGate`, which only exist on that branch.

**Do not create another worktree or branch. Do not `git checkout` anything else** — other branches are checked out in sibling directories and are being used.

**This file lives at the root of that worktree, and the ledger in §2 is the copy you edit.** Commit it alongside your code. If PR #15 merges to `main` before you finish, rebase onto `main`.

Do not commit to `main`. Do not force-push. Do not touch the `local-profile-snapshot` branch (parked deliberately).

### Next.js version — CRITICAL

`web/AGENTS.md` says:

> **This is NOT the Next.js you know.** APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

Next.js **16.2.3**, React **19.2.4**. For routing, server components, or data fetching: **read the local docs first**. Do not write Next.js from memory.

### Secrets — a global pre-commit hook will block you

The machine has a global secret guard (`~/.githooks/pre-commit`). It aborts any commit containing real API keys. This is intentional. **Do not attempt to bypass it, and never disable it.**

- The Tavily key lives in `web/.local-data/profile.json` (gitignored). Read it for live tests; **never log it, never commit it, never paste it into a file.**
- Tests that need it must read it at runtime and **skip** when absent, so CI stays green.
- `PEER_PROFILE_SNAPSHOT_PATH` overrides the snapshot path — useful from a worktree.

### Commands (all from `web/`)

```bash
npx vitest run          # baseline for this branch: 172 passed, 1 skipped
npx tsc --noEmit        # must be clean
npx eslint src/lib      # must be clean on changed files
```

### DO NOT

- **Do not modify the paper pipeline** (`lib/feed/**`, `lib/sources/**`). Papers work correctly and are the reference implementation.
- **Do not change `scoreKeyword`'s default `scope: "all"` behaviour** — paper callers depend on it.
- **Do not add per-surface required/explore keyword sets.** Designed, deliberately deferred, out of scope here.
- **Do not add new paid API dependencies.** Detail-page fetching is free.
- **Do not leave diagnostic/temp files in the repo.** Delete them before committing.

---

## §7. TASK SPECIFICATIONS

### Phase 1 — Detail-page enrichment

**P1.1 — HTML page fetcher**
New `web/src/lib/opportunities/page-fetch.ts`.
- `fetchPageHtml(url): Promise<string | null>` — GET with a descriptive bot User-Agent, `redirect: "follow"`, 12s timeout, `Accept: text/html`. Returns `null` on any failure; never throws.
- `fetchPagesConcurrently(urls, limit = 8)` — bounded concurrency.
- Maintain an exported `UNFETCHABLE_HOSTS` list seeded with `10times.com`, `battery-tech.net` (measured 403 / timeout) and skip them without a request.
- Cap response size (~2MB) so a huge page cannot stall the build.
**Acceptance:** unit tests with mocked `fetch` covering success, 403, timeout, oversize, and concurrency limit. `npx vitest run src/lib/opportunities/page-fetch.test.ts`

**P1.2 — JSON-LD extractor**
New `web/src/lib/opportunities/structured-extract.ts`.
- Find every `<script type="application/ld+json">`, parse each, walk arrays **and** `@graph`.
- From `@type` of `Event` (or subtypes) / `JobPosting`, extract: `name`, `startDate`, `endDate`, `location.address.{addressLocality, addressRegion, addressCountry}`, `eventAttendanceMode`.
- Malformed JSON in one block must not discard the others.
**Acceptance:** test against a saved fixture of the DLR page asserting `Oldenburg` / `Germany` / `2026-06-22`. Save fixtures under `web/src/lib/opportunities/__fixtures__/`.

**P1.3 — og:/meta extractor**
Same file.
- Extract `og:title`, `og:description`, `og:site_name`.
- Parse a date range **and** a city out of them. Must handle the measured real case:
  `"Solid-State Battery Summit | August 11-12, 2026 | Chicago, IL + Virtual"` → `{ start: 2026-08-11, end: 2026-08-12, city: "Chicago", region: "IL", isOnline: true }`.
- Note `+ Virtual` / `& Virtual` / `Hybrid` sets `isOnline` **without** clearing the city (decision §5.6).
**Acceptance:** test against a saved Cambridge EnerTech fixture asserting exactly that object.

**P1.4 — Body-text city fallback**
Same file. Gazetteer of ~300 major conference cities + US state codes + country names. Whole-word matching, reuse `canonicalize` from `lib/scoring/term-expand.ts`. Lowest priority of the three layers.
**Acceptance:** test asserting `bluecurrent.com` fixture yields `Chicago`, and that a page with no city yields `undefined` rather than a false positive.

**P1.5 — Structured `place` on the item types**
- Add `place?: { city?: string; region?: string; country?: string }` to `RawEventItem` / `RawJobItem` and to the mapped `Event` / `Job` types.
- **`isOnline` / `isRemote` stay independent booleans.** Hybrid = `place` set AND online true.
- Update the mappers and the existing curated sources to populate `place` where they already have a place string (ccfddl `place`, confs.tech `city`/`country`, job boards' location).
**Acceptance:** `npx tsc --noEmit` clean + a test asserting a hybrid item has both `place.city` and `isOnline === true`.

**P1.6 / P1.7 — Wire into the pipelines**
- Enrich **only candidates that survive the relevance gate**, capped at 40 per surface (never all 181 — too slow, no benefit).
- Run inside the daily build (Phase 2), not on the request path.
- Enrichment failure must degrade silently: keep the item with whatever location it already had.
**Acceptance:** key-gated live test showing ≥50% of surviving events have a `place.city`, and that the Cambridge EnerTech benchmark event resolves to `Chicago`.

### Phase 2 — Daily pool build + cache

**P2.1 — Cache interface + key**
New `web/src/lib/opportunities/pool-cache.ts`.
- `PoolCache { get(key): Promise<CachedPool | null>; set(key, pool): Promise<void> }`.
- Key = stable hash of `surface` + profile signature (required topics, explore topics, career stage, location prefs) + **local calendar date**. Any of those changing produces a new key.
- Store the **scored, enriched pool plus facet counts**, not raw results.

**P2.2 — Disk adapter** (`NODE_ENV === "development"` only)
`web/.local-data/pool-cache/<key>.json`. Already gitignored — keep it that way.

**P2.3 — Supabase adapter**
Table `opportunity_pools (key text primary key, payload jsonb, created_at timestamptz)`. Include the SQL as a migration file or in a comment. **Must no-op cleanly when Supabase env vars are absent** (they are currently commented out in `.env.local`) — never throw, never block a local build.

**P2.4 — Wire the pipelines**
- Cache hit → return immediately, **zero** Tavily requests.
- Miss → build (search + enrich + score), store, return.
- Selection order: **cache the pool, not the top N.** `excludeIds` / novelty filtering applies to the *displayed slice*, never to the cached pool or the facet counts.

**P2.5 — Query budget**
Exported constants: 18 event queries, 12 job queries. Document the 33/day ceiling in a comment.

**Acceptance for Phase 2:** a test that builds the pool twice within one day with a counting `fetch` spy and asserts **zero** network calls on the second build. This is the single most important test in the phase.

### Phase 3 — API contract

**P3.1** Return the full scored pool (cap 200) plus facet counts: location (city, then country), month, and format (in-person / online / hybrid). Counts come from the **whole pool**, not the displayed slice.
**P3.2** `topN` 5 → 10; `diversifyByType` cap 3 → 5 (otherwise 10 slots cannot fill from conferences alone).
**P3.3** When any facet filter is active, skip the `MIN_SCORE` filter.
**Acceptance:** tests asserting facet counts match the full pool, and that a facet-filtered query returns items scoring below `MIN_SCORE`.

### Phase 4 — UI

Read `web/AGENTS.md` and the local Next.js docs before starting. Reuse the existing `components/search/filter-chip.tsx` idiom — do not invent a new control language.

**P4.1** Always-visible panel under the tab search box. Groups: 地点 / 时间 / 形式. Each tag shows a count. Clicking toggles a filter. Never collapsible (decision §5.1). Show the top N tags per group with a "more" affordance if the list is long.
**P4.2** Render 10 items, then a "show 10 more" button that appends the next 10. Sorted by relevance throughout.
**P4.3** Green 3-tier card colour. **Before choosing the exact ramp, load the `dataviz` skill** — it covers sequential palettes and light/dark accessibility, which this needs. Low-opacity tint + stronger left accent bar. Absolute thresholds. Must be legible in light and dark mode.
**P4.4** Wire the tab search box to filter the returned events/jobs pool client-side (title, description, place, tags). Papers keep their existing server-side search.

### Phase 5 — Facet preference learning

Extend the **existing** ledger in `lib/preferences/ledger.ts` — do not build a parallel system.

**P5.1** Record a facet selection as a weak signal under the existing `event` / `job` origins.
**P5.2** Cap the total boost facet history can contribute, and decay it faster than explicit save/dismiss signals. A user who filtered to Chicago once must still see Berlin next month.
**P5.3** When a facet-learned boost materially changed an item's position, say so on the card.
**Acceptance:** tests proving the boost is bounded, that it decays, and that a single facet click cannot outrank an explicit dismissal.

---

## §8. SESSION LOG — APPEND BEFORE YOU STOP

Every agent appends an entry here before ending its session. Never edit someone else's entry.

```markdown
### Session <n> — <agent name> — <ISO date>
- Tasks completed this session: <IDs>
- Tasks left IN_PROGRESS or BLOCKED: <IDs, and exactly what state the code is in>
- Test/typecheck status at stop time: <numbers>
- Anything I changed that was NOT in the plan, and why:
- What the next agent should watch out for:
```

*(No sessions logged yet.)*

---

## §9. WHEN ALL PHASES ARE DONE

1. Confirm every ledger row reads `DONE` (or `SKIPPED` with a stated reason).
2. Run the full gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`.
3. Run the live checks: the events benchmark must still pass, and the second pool build in a day must make zero network calls.
4. Delete every temporary/diagnostic file.
5. Commit everything on the branch. Do **not** open a PR — Claude reviews first.
6. Create `HANDOFF-FACETS-COMPLETE.md` at the repository root:

```markdown
# HANDOFF FACETS COMPLETE
**Branch:** <name>   **Finished:** <ISO>   **Status:** COMPLETE | PARTIAL | BLOCKED

## Ledger summary
<count DONE / TODO / BLOCKED, and which IDs are not DONE>

## Evidence
- `npx vitest run` output (pass/fail counts)
- `npx tsc --noEmit` output
- Live events benchmark top-10 with names, hosts, cities, dates
- Proof of the zero-network second build
- Measured Tavily searches consumed per daily build

## What I could not do / am unsure about
<be specific — this is the most useful section for the reviewer>

## Anything I changed that was NOT in the plan
<list with justification>
```

Its appearance signals Claude to review. **Never put an API key in it.**
