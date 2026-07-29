# HANDOFF — Detailed card information for event / job

**Planner / Reviewer:** Claude (Opus 5), planning session 2026-07-29.
**Implementer:** you (any agent).
**Created:** 2026-07-29. **Status:** see the Progress Ledger in §2 — that is the source of truth.

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

**Total tasks: 24.**

### Phase 0 — Baseline

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P0.1 | Install deps in the worktree and confirm the baseline gate is green (73 tests, clean typecheck, clean lint) | DONE | `npx vitest run` → 6 files / 73 tests passed; `npx tsc --noEmit` → exit 0; `npx eslint .` → exactly 1 pre-existing error at `persona/quiz.tsx:46`, 0 warnings |

### Phase 1 — Pure logic in `lib/`, fully unit-tested

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P1.1 | `lib/opportunities/salary.ts` — `parseSalaryText()` for free-text salary strings (Remotive) | DONE | `npx vitest run src/lib/opportunities/salary.test.ts` → 1 file / 20 tests passed; all 18 measured Remotive strings have explicit assertions |
| P1.2 | `lib/opportunities/salary.ts` — `normalizeSalary()` for structured min/max/currency/period inputs, with a sanity floor | DONE | `npx vitest run src/lib/opportunities/salary.test.ts` → 1 file / 29 tests passed; all 6 measured Himalayas rows covered and garbage `50–1000 USD/monthly` rejected |
| P1.3 | `lib/opportunities/salary.ts` — `formatSalary()` display strings | DONE | `npx vitest run src/lib/opportunities/salary.test.ts` → 1 file / 35 tests passed; all periods, USD/EUR/ZAR, ranges, single values, and canonical missing label covered |
| P1.4 | `lib/opportunities/prestige.ts` — `eventPrestige()` from a CCF/CORE rank string | DONE | `npx vitest run src/lib/opportunities/prestige.test.ts` → 1 file / 6 tests passed; A*, A, B, C, mixed, and absent ranks covered |
| P1.5 | `lib/opportunities/prestige.ts` — `jobPrestige()` from company + source + description | DONE | `npx vitest run src/lib/opportunities/prestige.test.ts` → 1 file / 12 tests passed; every job tier covered |
| P1.6 | `lib/opportunities/urgency.ts` — shared deadline/date urgency buckets (extracted from the event detail page) | IN_PROGRESS | |
| P1.7 | `lib/opportunities/match-quality.ts` — score → percentage + band label | TODO | |
| P1.8 | `lib/jobs/summarize.ts` — `summarizeJob()`: 2–3 key sentences from a raw posting, no LLM | TODO | |
| P1.9 | `lib/jobs/summarize.ts` — `highlightSegments()`: split text into matched / unmatched spans | TODO | |

### Phase 2 — Data plumbing

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P2.1 | Add optional salary fields to `RawJobItem` | TODO | |
| P2.2 | Wire salary through the two keyless adapters (remotive free-text, himalayas structured) | TODO | |
| P2.3 | Wire salary through the three keyed adapters (adzuna, jsearch, usajobs) | TODO | |
| P2.4 | Add optional display fields to the `Job` type (additive block only) | TODO | |
| P2.5 | Add optional display fields to the `Event` type; stop prefixing rank into `shortDescription` | TODO | |
| P2.6 | `jobs/mapper.ts` populates the new `Job` fields | TODO | |
| P2.7 | `events/mapper.ts` populates the new `Event` fields | TODO | |
| P2.8 | Thread the user's location preferences into both mappers so location fit survives to the UI | TODO | |

### Phase 3 — Card UI

| ID | Task | Status | Verified (command + result) |
|----|------|--------|------------------------------|
| P3.1 | `components/ui/prestige-badge.tsx` | TODO | |
| P3.2 | `components/ui/facts-strip.tsx` — the shared time / place / money row | TODO | |
| P3.3 | `components/ui/urgency-bar.tsx` | TODO | |
| P3.4 | `components/ui/matched-terms.tsx` + `components/ui/highlighted-text.tsx` | TODO | |
| P3.5 | Rebuild `cards/event-card.tsx` to the six-row structure | TODO | |
| P3.6 | Rebuild `cards/job-card.tsx` to the six-row structure, including the summary | TODO | |
| P3.7 | Final gate: full suite + typecheck + lint + production build, and a real browser check at three widths in both themes | TODO | |

---

## §3. MISSION

The event and job cards in the feed are too thin. Today a card shows a title, one
line of metadata, a bare match percentage, and a one-sentence reason. A user
scanning the feed cannot tell whether an opportunity is worth their time.

This work rebuilds both cards around **five questions a researcher actually asks
in the first two seconds**: how prestigious is it, how well does it match me,
where is it, when is it (and when does it close), and how much does it pay.

**The product principle that drives every edge case:** *absence of information is
itself information.* When salary is unknown, the card says "salary not disclosed"
rather than hiding the row. When a conference has no ranking, it says so. A user
must never be left wondering whether the card is silent because the data is
missing or because nobody looked.

**Second principle:** the card must justify its own recommendation. The scoring
pipeline already knows *which* of the user's topics matched — that information is
currently computed and thrown away. Surfacing it turns an unexplained "87%" into
"87% — matched: solid-state battery, in-situ characterization."

---

## §4. MEASURED EVIDENCE — DO NOT RE-DERIVE THIS

Everything in this section was measured on 2026-07-29 against the live APIs and
the current `main` (commit `e8e8440`). **Trust it. Re-measuring is a waste of
your session.**

### 4.1 Baseline gate — MEASURED IN *THIS* WORKTREE, after `npm install`

```
npx vitest run     →  6 test files, 73 tests, all passing        ✅
npx tsc --noEmit   →  clean, exit 0                              ✅
npx eslint .       →  1 PRE-EXISTING error (see below)           ⚠
```

Your work must not reduce the test count. It should raise it substantially.

**The one lint error already exists on `main` and is not yours:**

```
web/src/components/persona/quiz.tsx:46:7
  react-hooks/set-state-in-effect — Calling setState synchronously within an effect
```

That file is unrelated to cards. **Do not fix it** — it would be an unreviewed
change to someone else's feature buried in a card PR. Just make sure you do not
add a *second* error. The bar for your work is: `npx eslint .` reports this one
error and nothing else.

Dependencies are already installed in this worktree, so P0.1 is a re-confirmation
rather than a first run.

### 4.2 Salary availability per job source — PROBED LIVE

This is the riskiest assumption in the whole plan, so it was tested directly.

| Source | Field(s) | Shape | Measured coverage | Keys needed |
|---|---|---|---|---|
| **remotive** | `salary` | **free text, very messy** | **78 %** (28 / 36 sampled) | none |
| **himalayas** | `minSalary`, `maxSalary`, `currency`, `salaryPeriod` | structured numbers | **21 %** (21 / 100 sampled) | none |
| **arbeitnow** | — | **no salary field at all** | **0 %** | none |
| adzuna | `salary_min`, `salary_max`, `salary_is_predicted` | structured | not probed (needs key) | ADZUNA_APP_ID + KEY |
| jsearch | `job_min_salary`, `job_max_salary`, `job_salary_period`, `job_salary_currency` | structured | not probed (needs key) | JSEARCH_API_KEY |
| usajobs | `PositionRemuneration[]` → `MinimumRange`, `MaximumRange`, `RateIntervalCode` | structured | not probed (needs key) | USAJOBS_API_KEY + UA |

**Arbeitnow genuinely has no salary data** — its response keys are exactly
`slug, company_name, title, description, remote, url, tags, job_types, location, created_at`.
Do not go looking for it.

### 4.3 Real Remotive salary strings — USE THESE AS YOUR TEST FIXTURES

Every one of these was returned by the live API. The parser must handle all of
them. Note the hourly/annual mix, the thousands-separator inconsistency, the
European comma-as-decimal typo, and the "OTE" prefix.

```
$18 - $22/hr
$30k - $100k
$45,000 - $50,000
$14/hr
$36k
$90 - $150 /hour
$120 - $170 /hour
$150k - $230k
$170k - $200k
$31,2k- $52k          <-- comma used as a decimal point, and no space before the dash
$80k - $100k
$55k - $100k
OTE $25k - $35k       <-- "on-target earnings" prefix
$3k - $10k
$50-$75 /hour         <-- no spaces at all
$20k -$35k            <-- asymmetric spacing
$12K                  <-- capital K, single value
$120k - $220k
```

Eight of the 36 sampled postings returned `""` (empty string), not `null`.

### 4.4 Real Himalayas structured salaries — USE THESE TOO

```
800   – 1500    USD  / monthly
1000  – 2000    USD  / monthly
50    – 1000    USD  / monthly     <-- garbage data, must be rejected by the sanity floor
210000– 280000  USD  / annual
22000 – 26000   ZAR  / monthly     <-- non-USD currency
64000 – 125000  EUR  / annual      <-- non-USD currency
```

Two consequences you must design for: **periods are not always annual**, and
**currencies are not always USD**. Also 79 % of Himalayas rows have
`minSalary: null, maxSalary: null` while still reporting `salaryPeriod: "annual"`
— a non-null period does **not** imply a usable salary.

### 4.5 Event registration fees — CONFIRMED UNAVAILABLE

No event source (`ccfddl`, `confstech`, `researchseminars`, `eventweb`) exposes a
registration-fee field, and the LLM extraction module on the sibling
`facets-and-daily-pool` branch does not extract one either (grepped: zero hits
for salary / fee / price / registration-cost). **Event cards get no money row.**
This is a locked decision — see §5.

### 4.6 Data that is already fetched and then thrown away

This is the cheap win. None of it needs a new network call.

| Data | Where it exists today | Where it dies |
|---|---|---|
| Conference rank (`CCF A`, `CORE A*`) | `RawEventItem.rank` | `events/mapper.ts` stuffs it into the front of `shortDescription` as `"CCF A · …"` — invisible as structured data |
| Event subject tags | `RawEventItem.tags` | never copied to `Event` |
| Which of the user's topics matched | `ScoredEventItem.matchedKeywords` / `ScoredJobItem.matchedKeywords` | flattened into one prose sentence by `reasonFor()`, then dropped |
| Location fit score (0–1) | computed inside `scoreEvents` / `scoreJobs` | consumed by the weighted sum, never returned |
| Employment type (full-time / intern) | `RawJobItem.employmentType` | never copied to `Job` |
| Source id (which board it came from) | `RawJobItem.source` | never copied to `Job` |
| **The whole job description** | `RawJobItem.description` (up to 2400 chars, HTML already stripped) | never copied to `Job` — this is why there is no summary today |

### 4.7 The detail pages are already ahead of the cards

`app/events/[id]/page.tsx` already implements a deadline countdown, an
urgency colour scale, and a deadline→event timeline bar.
`app/jobs/[id]/page.tsx` already implements a property strip and signal chips.
**Read both before writing new UI.** Much of Phase 3 is compressing patterns that
already exist rather than inventing them — and the urgency colour logic in
particular should be *extracted and shared*, not duplicated (that is task P1.6).

### 4.8 Existing building blocks you should reuse, not rebuild

`components/ui.tsx` (one file, ~22 KB) already exports:
`Callout`, `PropertyStrip`, `Property`, `PullQuote`, `Signal`, `FactChip`,
`SectionHeading`, `Tag`, `LinkChip`, `ActionBar`, `FeedbackRow`, `DetailSection`,
`LinkRow`, `EmptyState`, `LoadingSkeleton`, `Relevance`, `SecretInput`.

`lib/format.ts` already exports:
`parseDate`, `formatDate`, `formatTimeAgo`, `formatDayAge`, `daysUntil`,
`formatDayDistance`, `formatAgeInWords`, `formatCount`, `formatMatchPct`.

`components/ui/card-shell.tsx` is the card surface recipe — restyle cards there,
not by pasting classes.

`components/icons.tsx` exports 11 icons.

### 4.9 There is no component-test infrastructure

`package.json` has vitest but **no** `@testing-library/*` and no jsdom setup. All
6 existing test files live under `src/lib/`. Do **not** add a React testing stack
— that is scope creep and a new dependency. This constraint is exactly why §5
requires all card logic to live in pure functions.

---

## §5. DESIGN DECISIONS — ALREADY LOCKED, DO NOT REOPEN

**D1. Every card behaviour that can be a pure function must be a pure function in
`lib/`, unit-tested. The card component is a thin renderer.**
Reason: there is no component-test harness (§4.9) and adding one is out of scope.
Logic in `lib/` is the only logic we can actually verify. If you find yourself
writing an `if` inside JSX, that condition belongs in `lib/`.

**D2. The card is six rows, in this order: prestige + type + match · title ·
facts strip (time / place / money) · urgency bar · why-it-matches · actions.**
Reason: the order matches the order a scanning user asks the questions. Do not
reorder to suit layout convenience.

**D3. Cards are allowed to get taller. Do not hide information behind hover.**
Reason: the whole point is fast assessment; a hover-reveal defeats it and does
not exist on touch devices. Roughly three cards per screen is the accepted cost.

**D4. Never render an empty money row — render "Salary not disclosed" instead.**
Reason: the product principle in §3. The same applies to an unranked conference
and to a posting with no date.

**D5. Event cards have no money row at all.**
Reason: measured in §4.5 — no source provides registration fees, so a permanent
"unknown" row would be noise rather than information. Revisit only if a source
starts providing it.

**D6. A salary is only displayed when it survives a sanity check.**
Reason: measured garbage like `50–1000 USD/monthly` (§4.4) would actively
mislead. Reject a range whose annualized floor is below ~5 000 or whose ceiling
exceeds ~2 000 000, and reject a range where max < min.

**D7. Show the original currency and the original period. Do not convert.**
Reason: no FX rate source exists in this repo, rates go stale, and a wrong
converted number is worse than an honest `€64k–125k / yr`. Normalize the
*period* label only when the source states it.

**D8. The job summary is extracted, never generated by an LLM.**
Reason: the repo invariant is that Tier 0 must be fully useful with zero API
keys. An LLM summary would make the card's core content key-dependent. Pull the
most informative sentences out of the description text instead.

**D9. Matched terms are highlighted by wrapping spans, not by injecting HTML.**
Reason: `dangerouslySetInnerHTML` on third-party posting text is an XSS hole.
`highlightSegments()` returns an array of `{text, matched}` and React renders it.

**D10. All new fields on `Event` and `Job` are optional, and go in one clearly
marked additive block at the end of each interface.**
Reason: the sibling `facets-and-daily-pool` branch also edits these two
interfaces (§6). An additive block at a predictable location makes that merge
trivial instead of painful.

---

## §6. GROUND RULES

### Branch and working directory — ALREADY SET UP

```
C:\I\Personal\Github - start up project\Peer-detailed-cards
        (branch: detailed-card-information-for-event-job)
```

Based off **`main`** at commit `e8e8440`. Reason for basing on `main` rather than
either sibling branch: both siblings are unmerged and still moving, and inheriting
an in-flight refactor would make it impossible to tell which failures are yours.

**This file lives at the root of that worktree, and the ledger in §2 is the copy
you edit.** Commit it alongside your code.

Do not create another worktree or branch. Do not check out anything else.

### ⚠ Other agents are working in this repo right now — these files are OFF-LIMITS

Two sibling worktrees have live, unmerged work. `git worktree list`:

```
…\Peer                              [main]
…\Peer-detailed-cards               [detailed-card-information-for-event-job]   <-- you
…\Peer-event-job-relevance-refactor [event-job-relevance-refactor]              <-- active
…\Peer-facets                       [facets-and-daily-pool]                     <-- active
```

**Do not modify these files.** You may freely *read from* and *call into* them.

| File | Owned by | Note |
|---|---|---|
| `lib/events/scoring.ts`, `lib/jobs/scoring.ts` | relevance-refactor | +120 / +77 lines pending |
| `lib/scoring/keyword.ts`, `lib/scoring/term-expand.ts` | both siblings | |
| `lib/opportunities/shared.ts` | both siblings | **call `locationFit()` from it — do not edit it** |
| `lib/opportunities/query-gen.ts` | both siblings | |
| `lib/preferences/ledger.ts` | facets | +188 lines pending |
| `lib/jobs/sources/jobweb.ts`, `lib/events/sources/eventweb.ts` | relevance-refactor | the *other* five job adapters are yours to edit |
| `store/feed.ts`, `store/profile.ts` | facets | |

Two files you **must** touch that a sibling also touches — keep the diff surgical:

- `types/index.ts` — facets adds `place?`, `facetPreferenceReason?`, and facet
  types. Follow **D10**: append one clearly-commented block, touch nothing else.
- `lib/jobs/pipeline.ts` and `lib/events/pipeline.ts` — relevance-refactor edits
  these. You are allowed **one line each**: the `scoredJobToJob` /
  `scoredEventToEvent` call site, to pass the new second argument (task P2.8).
  Change nothing else in those two files.

### Framework/version warning — READ THIS BEFORE WRITING ANY COMPONENT

`web/AGENTS.md` says, and it is not boilerplate:

> This is NOT the Next.js you know. This version has breaking changes — APIs,
> conventions, and file structure may all differ from your training data. Read
> the relevant guide in `node_modules/next/dist/docs/` before writing any code.

This project is on **Next.js 16.2.3 with React 19.2.4**. Your training data is
probably wrong about both. Consult `node_modules/next/dist/docs/` rather than
recalling. Existing cards are `"use client"` components wrapped in `next/link` —
match that pattern.

Styling is **Tailwind v4** with a custom semantic token set (`text-heading`,
`text-text-muted`, `bg-surface`, `text-accent`, `bg-accent-dim`, `border-border`,
`text-red`, …). Use the existing tokens. Do not introduce raw hex colours, and do
not add a new colour scale — the theme has six user-selectable accents and
hardcoded colours will break in five of them.

### Secrets

No API keys are required for any task in this plan. The three keyed job sources
(adzuna, jsearch, usajobs) must be implemented from their documented response
shapes (§4.2) and tested against **local fixtures**, not live calls.

Never commit a key, never log one, never paste one into a test file. If you find
yourself wanting a key to verify something, write a fixture instead and note the
limitation in the session log.

### Commands

Run everything from `web/`.

```
npx vitest run          # baseline: 6 files / 73 tests passing — must not regress
npx tsc --noEmit        # must stay clean (exit 0)
npx eslint .            # must stay at exactly 1 error — the pre-existing quiz.tsx
                        # one from §4.1. Any second error is yours to fix.
npm run build           # must succeed (final gate only)
```

`node_modules` is already installed here. Do not delete it or re-run
`npm install` unless something is actually broken.

### DO NOT

- Do not touch any file in the off-limits table above.
- Do not add a React component-testing dependency (§4.9).
- Do not add any paid or LLM-backed dependency — the card must work with zero keys.
- Do not convert currencies (D7).
- Do not use `dangerouslySetInnerHTML` (D9).
- Do not change the existing `Relevance` component's props — other surfaces
  (`paper-card.tsx`) render it. Add a new component instead if you need different
  behaviour.
- Do not open a pull request. The reviewer goes first.
- Do not leave scratch scripts, fixture dumps, or diagnostic files in the repo.

---

## §7. TASK SPECIFICATIONS

### P0.1 — Baseline

Dependencies are **already installed** — the planner ran `npm install` and the
full gate in this worktree (§4.1). This task is a 2-minute re-confirmation that
your environment agrees, not a fresh setup.

Run the three gate commands from `web/` and record the numbers.

**Acceptance:** `npx vitest run` reports 73 passing; `npx tsc --noEmit` exits 0;
`npx eslint .` reports exactly the one pre-existing `quiz.tsx` error from §4.1
and nothing else. Paste the counts into the Verified column.

---

### P1.1 — `parseSalaryText()`

**File:** create `web/src/lib/opportunities/salary.ts` and
`web/src/lib/opportunities/salary.test.ts`.

Parse a free-text salary string into
`{ min: number, max: number, currency: string, period: "hour"|"month"|"year" } | null`.

Every string in §4.3 is a required test case. Specifically it must handle:
`k`/`K` suffix expansion, comma thousands separators, a comma used as a decimal
point (`$31,2k` → 31200), missing spaces around the dash (`$50-$75`), a trailing
period marker in several spellings (`/hr`, `/hour`, ` /hour`), a leading `OTE`
prefix, and a single value with no range (`$12K` → min = max = 12000).

Return `null` for `""`, for whitespace, and for anything it cannot confidently
parse. Silent wrong answers are far worse than nulls here.

Default the period to `"year"` only when no period marker is present **and** the
value is above 1000 — `$14` with no marker is an hourly rate, not a salary.

**Acceptance:** `npx vitest run src/lib/opportunities/salary.test.ts` — all 18
strings from §4.3 covered by explicit assertions, all passing.

---

### P1.2 — `normalizeSalary()`

**Same files.**

Takes structured input `{ min?, max?, currency?, period? }` (the shape Himalayas,
Adzuna, JSearch and USAJobs all provide in some spelling) and returns the same
normalized object or `null`.

Must implement the **D6** sanity check. Annualize internally *for the check only*
(hourly × 2080, monthly × 12); the returned object keeps the original period per
**D7**. Reject when the annualized floor < 5 000, the annualized ceiling
> 2 000 000, or max < min. Handle `min` present with `max` absent, and vice versa.

Required cases from §4.4: the six real Himalayas rows, including
`50–1000 USD/monthly` which **must be rejected**, and the `null/null` case which
must return `null` even though its period says `"annual"`.

**Acceptance:** `npx vitest run src/lib/opportunities/salary.test.ts` passing,
with an explicit assertion that the garbage row is rejected.

---

### P1.3 — `formatSalary()`

**Same files.**

Turn a normalized salary into a display string. Compact where it helps:
`$150k–230k / yr`, `€64k–125k / yr`, `$18–22 / hr`, `R22k–26k / mo`,
`$36k / yr` (single value, no dash). Use the correct symbol for USD/EUR/GBP and
fall back to the ISO code plus a space for anything else (`ZAR 22k–26k / mo` is
acceptable if you prefer that to inventing symbols — pick one and be consistent).

Also export the not-disclosed constant used by the UI, so **D4** has exactly one
spelling in the codebase.

**Acceptance:** `npx vitest run src/lib/opportunities/salary.test.ts` passing,
covering all three periods, at least two currencies, and the single-value case.

---

### P1.4 — `eventPrestige()`

**File:** create `web/src/lib/opportunities/prestige.ts` + test.

Input: the raw rank string (`"CCF A"`, `"CORE A*"`, `"CCF B · CORE A"`,
`undefined`). Output: `{ tier: "top"|"strong"|"solid"|"unranked", label: string }`.

`A*` or a standalone `A` → `top`; `B` → `strong`; `C` → `solid`; absent →
`unranked` with a label that says so plainly (**D4**). Mixed strings take the
best rank present. There is existing precedent in `lib/events/scoring.ts`'s
`scoreRank()` — **read it for the regex conventions, do not edit that file.**

**Acceptance:** `npx vitest run src/lib/opportunities/prestige.test.ts` passing.

---

### P1.5 — `jobPrestige()`

**Same files.**

Jobs have no external ranking, so derive a signal:
`{ tier: "bigTech"|"nationalLab"|"academic"|"startup"|"unknown", label }`
from company name, source id, and the first few hundred characters of the
description.

`lib/jobs/scoring.ts` already contains the regexes for exactly this
(`BIG_TECH_RE`, `ACADEMIC_RE`, `STARTUP_RE`). That file is **off-limits to edit**
— copy the patterns into your new module with a comment noting the origin and
that they were duplicated deliberately to avoid touching a file another agent
owns. Note the duplication in your session log so the reviewer can decide whether
to unify them after both branches land.

**Acceptance:** `npx vitest run src/lib/opportunities/prestige.test.ts` passing,
with at least one case per tier.

---

### P1.6 — Shared urgency buckets

**File:** create `web/src/lib/opportunities/urgency.ts` + test.

`app/events/[id]/page.tsx` has a local `urgencyColor(days)` returning text/bg/dot
classes and a label, with thresholds `< 0` closed, `≤ 14` soon, `≤ 60` coming up,
else upcoming. **Extract that logic**, keep the thresholds identical, and have
the detail page import it instead of defining its own copy.

Add a job-side variant for posting age: `≤ 7` fresh, `≤ 30` recent, else stale.

Return semantic tokens, not raw colours.

**Acceptance:** `npx vitest run src/lib/opportunities/urgency.test.ts` passing,
covering both sides of every threshold, **and** `npx tsc --noEmit` clean proving
the detail page now consumes the shared version.

---

### P1.7 — `matchQuality()`

**File:** create `web/src/lib/opportunities/match-quality.ts` + test.

Input the 0–1 relevance score, output `{ pct: number, band, label }` with bands
`strong` (≥ 0.9), `relevant` (0.7–0.89), `marginal` (< 0.7), plus a
`null`/`undefined` passthrough. Reuse `formatMatchPct` from `lib/format.ts` for
the percentage so the card and the detail pages never disagree by a rounding step.

**Acceptance:** `npx vitest run src/lib/opportunities/match-quality.test.ts`
passing, including boundary values 0.7, 0.89, 0.9 and `undefined`.

---

### P1.8 — `summarizeJob()`

**File:** create `web/src/lib/jobs/summarize.ts` + test.

Input the plain-text description (already HTML-stripped, up to 2400 chars — see
§4.6) plus the matched keyword list. Output 2–3 sentences, ≤ ~240 chars total,
that tell a researcher what the role actually *is*.

Approach — extractive, no LLM (**D8**): split into sentences, score each by
whether it contains a matched keyword, whether it starts a responsibilities or
requirements section, sentence position (earlier is usually the role summary),
and length (drop fragments under ~40 chars and boilerplate over ~300). Drop
sentences that are obvious noise: equal-opportunity statements, benefits lists,
"about us" company history, application instructions. Return the top-scoring
sentences **in their original order**, not in score order — reordered sentences
read as gibberish.

Return `""` when the description is empty or nothing survives; the card falls
back to the existing match reason.

Write fixtures from real postings. You can pull a handful with:
`curl -s "https://remotive.com/api/remote-jobs?limit=10"` — but commit the
fixture text, not a live call.

**Acceptance:** `npx vitest run src/lib/jobs/summarize.test.ts` passing, with at
least 3 real-posting fixtures asserting the output is non-empty, under the length
cap, and excludes an equal-opportunity boilerplate sentence present in the input.

---

### P1.9 — `highlightSegments()`

**Same files.**

Input a string plus the term list. Output `Array<{ text: string, matched: boolean }>`
that concatenates back to exactly the input string — assert that round-trip
property in a test, it catches almost every bug in this kind of function.

Case-insensitive, whole-word-ish matching, longest term first so
`"battery"` inside `"solid-state battery"` doesn't produce a nested split.
Overlapping matches merge. Empty term list returns one unmatched segment.
Regex-escape every term — topic strings contain `+`, `(` and `.` in the wild and
an unescaped term will throw.

**Acceptance:** `npx vitest run src/lib/jobs/summarize.test.ts` passing,
including the concatenation round-trip and a term containing `+` or `(`.

---

### P2.1 — Salary fields on `RawJobItem`

**File:** `web/src/lib/jobs/types.ts` (note: relevance-refactor adds two unrelated
fields to `JobsFeedMeta` in this file — stay out of that interface).

Add optional fields to `RawJobItem` covering both shapes: a raw text passthrough
and structured min / max / currency / period.

**Acceptance:** `npx tsc --noEmit` clean and `npx vitest run` still 73+.

---

### P2.2 — Salary in the two keyless adapters

**Files:** `lib/jobs/sources/remotive.ts`, `lib/jobs/sources/himalayas.ts`, plus a
new test file.

Remotive: pass `salary` through `parseSalaryText()`. Himalayas: pass
`minSalary`/`maxSalary`/`currency`/`salaryPeriod` through `normalizeSalary()`.
Both adapters already export a pure `…ToRawItem()` function — test through that,
no network in tests.

Do **not** touch `arbeitnow.ts`; §4.2 proves there is nothing to wire.

**Acceptance:** `npx vitest run src/lib/jobs/sources/` passing, with fixtures
taken verbatim from §4.3 and §4.4.

---

### P2.3 — Salary in the three keyed adapters

**Files:** `lib/jobs/sources/adzuna.ts`, `jsearch.ts`, `usajobs.ts`, plus tests.

Add the documented fields from §4.2 to each adapter's response interface and map
them through `normalizeSalary()`. USAJobs needs `RateIntervalCode` translated
(`PA` = per year, `PH` = per hour, `PM` = per month) — treat any unrecognized
code as unknown and return no salary rather than guessing.

Adzuna has `salary_is_predicted` (`"1"` when the number is Adzuna's *estimate*,
not the employer's). Carry that through and have the card label it as estimated —
per **D4**, a guessed number presented as fact is exactly the failure this
project is trying to avoid.

These sources need keys, so tests run against local fixtures built from the
documented shapes. That is expected; note it in the session log.

**Acceptance:** `npx vitest run src/lib/jobs/sources/` passing, at least two
fixture cases per adapter including one where salary is absent.

---

### P2.4 — New display fields on `Job`

**File:** `web/src/types/index.ts`. Follow **D10** strictly — one appended block,
clearly commented, all fields optional.

Add: normalized salary, salary-is-estimated flag, employment type, source id,
the extracted summary, the matched terms array, and the location-fit number.

**Acceptance:** `npx tsc --noEmit` clean; `git diff types/index.ts` shows a
single contiguous added block inside `interface Job` and no other changes.

---

### P2.5 — New display fields on `Event`, and un-prefix the rank

**Files:** `web/src/types/index.ts`, `web/src/lib/events/mapper.ts`.

Add optional `rank`, `tags`, matched terms, and location fit to `Event` (same
D10 rules).

Then fix the data loss in `events/mapper.ts`: it currently builds
`shortDescription` as `` `${item.rank} · ${item.description}` ``. Stop doing
that — put `rank` in its own field and leave the description clean. **Check the
event detail page still reads correctly afterwards**, since it renders
`shortDescription` under an "About" heading and will now be missing the rank
prefix it used to show.

**Acceptance:** `npx tsc --noEmit` clean, `npx vitest run` green, and a new
mapper test asserting `shortDescription` no longer starts with the rank while
`rank` is populated.

---

### P2.6 — `jobs/mapper.ts` populates the new fields

**File:** `web/src/lib/jobs/mapper.ts` + a new `mapper.test.ts`.

Populate every field added in P2.4 from the `ScoredJobItem`: salary from the raw
item, `matchedTerms` from `item.matchedKeywords` (this is the data §4.6 says is
currently thrown away), summary from `summarizeJob(item.description, item.matchedKeywords)`,
plus employment type and source.

**Acceptance:** `npx vitest run src/lib/jobs/mapper.test.ts` passing, asserting
a fully-populated `ScoredJobItem` produces every new field, and a minimal one
produces `undefined`s without throwing.

---

### P2.7 — `events/mapper.ts` populates the new fields

**File:** `web/src/lib/events/mapper.ts` + `mapper.test.ts`. Same pattern as P2.6
for rank, tags and matched terms.

**Acceptance:** `npx vitest run src/lib/events/mapper.test.ts` passing.

---

### P2.8 — Thread location preferences into the mappers

**Files:** `lib/jobs/mapper.ts`, `lib/events/mapper.ts`, and **one line each** in
`lib/jobs/pipeline.ts` and `lib/events/pipeline.ts`.

`locationFit()` is computed inside the scorers and discarded (§4.6), and the
scorers are off-limits. So: give both mapper functions an optional second
parameter carrying the user's location preferences, call
`locationFit()` from `lib/opportunities/shared.ts` (**import only — do not edit
that file**), and store the result.

At the pipeline call sites, `req.locationPreferences` is already in scope —
`runJobsPipeline` reads it at the `scoreJobs` call, and the events pipeline
mirrors it. Change only the `.map(scoredJobToJob)` / `.map(scoredEventToEvent)`
line.

Make the parameter optional so existing callers and tests keep compiling.

**Acceptance:** `npx vitest run` green with a new test asserting a job in a
preferred city scores 1 and an unrelated on-site city scores 0.4; plus
`git diff --stat` showing **at most 2 changed lines** in each pipeline file.

---

### P3.1 — `PrestigeBadge`

**File:** `web/src/components/ui/prestige-badge.tsx`.

Renders the output of `eventPrestige()` / `jobPrestige()` as a small pill. Tier
drives the token: top → accent, strong → tag, solid → muted, unranked/unknown →
faint with an explicit "unranked" label (**D4**). No logic in the component —
it receives an already-computed tier (**D1**).

Follow the existing badge styling in `paper-card.tsx` (the `typeLabel` pill) so
the three card types stay visually consistent.

**Acceptance:** `npx tsc --noEmit` and `npx eslint .` clean.

---

### P3.2 — `FactsStrip`

**File:** `web/src/components/ui/facts-strip.tsx`.

The shared time / place / money row for both card types. Takes an array of
`{ icon, label, tone }` and lays them out with wrapping, so the event card can
pass 2 facts and the job card 3 without a second component.

Must degrade on narrow screens by wrapping, never by horizontal scroll or
truncation of the money value.

Reuse `Property` / `FactChip` from `components/ui.tsx` if either fits — check
before building new (§4.8).

**Acceptance:** `npx tsc --noEmit` and `npx eslint .` clean.

---

### P3.3 — `UrgencyBar`

**File:** `web/src/components/ui/urgency-bar.tsx`.

The compact card version of the deadline countdown. Consumes P1.6's bucket.
Events: "CFP closes in 18 days" plus a thin progress bar. Jobs: "Posted 3 days
ago" with the freshness tone, no bar.

`app/events/[id]/page.tsx` has a full-size `Timeline` — read it, match the visual
language, but keep the card version to a single line plus bar.

**Acceptance:** `npx tsc --noEmit` and `npx eslint .` clean.

---

### P3.4 — `MatchedTerms` and `HighlightedText`

**File:** `web/src/components/ui/matched-terms.tsx` and `highlighted-text.tsx`.

`MatchedTerms` renders up to 3 matched topic chips with a `+n` overflow, matching
the existing overflow pattern already in `job-card.tsx`.

`HighlightedText` renders `highlightSegments()` output — matched segments get an
accent-tinted background. **Wrapping spans only, no HTML injection (D9).**
Highlighting must remain legible in all six accent themes: use `bg-accent-dim`
with normal text colour rather than an accent text colour on a tinted background.

**Acceptance:** `npx tsc --noEmit` and `npx eslint .` clean.

---

### P3.5 — Rebuild `event-card.tsx`

Six rows per **D2**: prestige + type + match · name · facts (date range, location
with fit indicator) · urgency bar (CFP deadline — currently missing from the card
entirely and the single most actionable field on it) · matched terms + reason ·
existing `ActionBar`.

Keep the `<Link>` wrapper, `cardShell()`, the existing save/dismiss wiring, and
the `animate-fade-in-up` entrance. No money row (**D5**).

**Acceptance:** `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` all
clean.

---

### P3.6 — Rebuild `job-card.tsx`

Same six rows, plus the two things this task exists for:

- **The summary.** Render `job.summary` through `HighlightedText` so the parts
  matching the user's profile are visibly highlighted inside the prose. Fall back
  to `job.matchReason` when the summary is empty.
- **The money row.** Show the formatted salary, or "Salary not disclosed"
  (**D4**), and mark Adzuna estimates as estimated (P2.3).

Keep the existing `keyRequirements` chips with their `+n` overflow.

**Acceptance:** `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` all
clean.

---

### P3.7 — Final gate

1. `npx vitest run` — all green, count materially above 73.
2. `npx tsc --noEmit` — clean.
3. `npx eslint .` — clean.
4. `npm run build` — succeeds.
5. Start the dev server and load the feed. Check **both** card types at mobile
   (375 px), tablet (768 px) and desktop (1280 px) widths, in **light and dark**.
   Confirm: nothing overflows horizontally, the money row shows the
   not-disclosed text when data is missing, highlighted spans are legible, and
   the card is still fully clickable through to the detail page.
6. Delete any fixture-dump or scratch files you created.

Note in the session log which parts of step 5 you could not verify and why.

**Acceptance:** all four commands clean, plus a written record in the ledger of
what you saw at each width. This is the one task whose acceptance is not purely
a command — be honest about what you actually checked.

---

## §8. SESSION LOG — APPEND BEFORE YOU STOP

Every agent appends an entry before ending its session. Never edit someone
else's entry.

```
### Session <n> — <agent> — <date>
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
2. Run the full gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`.
3. Re-run the real-world check: dev server, both card types, three widths, both themes.
4. Delete every temporary or diagnostic file.
5. Commit everything on the branch. Do **not** open a PR — the reviewer goes first.
6. Create `HANDOFF-detailed-cards-COMPLETE.md` at the **root of this worktree**:

```
# HANDOFF COMPLETE
**Branch:** detailed-card-information-for-event-job
**Finished:** <ISO>  **Status:** COMPLETE | PARTIAL | BLOCKED

## Ledger summary
<counts, and which IDs are not DONE>

## Evidence
<test output, typecheck output, build output, what you saw in the browser>

## What I could not do / am unsure about
<be specific — the most useful section for the reviewer>

## Anything I changed that was NOT in the plan
<list with justification>
```

Its appearance signals the reviewer. Never put a credential in it.
