# Tier-0 Daily Report Parity — the `feature/summary-report-revamp` campaign

> Merged to `main` directly per the project owner's instruction (no PR). This document is the
> PR-quality description that instruction required: **Part 1** describes every piece of
> functionality this branch added; **Part 2** tells the story of how it was built — a
> multi-agent "ABC loop" that ran for 38 rounds under a zero-tolerance quality gate.
> The complete audit trail (every measurement, design, implementation, and ruling) lives in
> `MULTIAGENT-report-parity.md` (~90,000 lines, Rulings 1–108).

---

## Part 1 — What this branch delivers

Peer's Tier-0 (no-LLM) daily briefing produces deep reports for **jobs** and **events**
discovered by live web search. This branch took both reports from "frequently wrong in
visible ways" to **verified parity with the design spec** (`Peer-design-spec-original.pdf`):
every rendered field is either correct or honestly absent, the layout matches the plates,
and every remaining imperfection is a named, measured, deliberately-accepted cost with a
recorded reopen condition.

### 1. Search-provider migration: Vertex Gemini grounding (Ruling 75)

- **`web/src/lib/sources/gemini-search.ts`** — a new search adapter built on Gemini
  grounding. Grounding URIs are Google redirect stubs, so the adapter resolves each via
  HEAD + `redirect:"manual"`, then fetches the resolved page once to recover BOTH the real
  page `<title>` and `og:description` (one fetch, two fields). Rows whose title cannot be
  recovered are dropped, never faked ("no partial row, no placeholder, no host-as-title").
- Provider seam (`web-search.ts` + shared `resolveWebSearchProvider`): explicit override →
  gemini (Vertex present + Tavily disabled) → Brave → Tavily. All three surfaces share one
  implementation.
- All quota-capped APIs (Tavily, Adzuna, USAJobs, JSearch) retired from the test path; the
  live benchmark suite runs green on Gemini as a continuous live-acceptance check.
- Source-level hard timeout (25 s) so one hung search can never stall a report; measured
  whole-source loss rate ~2.5–20% per window, accepted and tracked as a named cost.

### 2. Job report correctness

**Employer field ("honest silence" doctrine, Ruling 32):** the employer candidate chain now
carries ~16 independent negative guards. A candidate that fails any guard is removed; the
next candidate wins or the field renders nothing. Silence is always preferred to a wrong
name, and no guard may delete a real organisation name (every guard ships with a
must-keep corpus proving zero false drops). Guards added by this campaign include:

- role-description text in the employer slot (`Research Technologist 1`, `Internship
  battery R&D`, `Membrane Scientist…`) — role-word veto;
- job-board brand names as employers (`EV.Careers`) — board-domain-brand veto;
- project/programme labels (`BALDER Project (Licensing Support for a Molten Salt
  Reactor)`) — structural veto on `<label> Project (<long description>)`, which protects
  real orgs like `Project HOPE` and `Project Management Institute` by design;
- careers-office labels, truncated candidates, host boilerplate, address tails (trimmed,
  never rejected), and more.

**Page-kind guards (a job report must contain jobs):**

- encyclopedia hosts (`wikipedia.org`, all language subdomains) rejected;
- date-structured publishing paths (`/YYYY/MM/DD/…` lab blogs) rejected unless the title
  carries real job vocabulary (the safety net that keeps genuine postings);
- brand-tagline search-results pages (`"Jobright: Your AI Job Search Copilot"`) rejected
  via URL-leaf + host-brand conjunction;
- careers-section roots extended to static-page extensions (`careers.htm`) and compounds
  (`career-paths`).

### 3. Event report correctness

**Eight ingestion kind guards** now decide "is this page actually one event?":
index pages, hub/listing pages (extended with `meetings` and hyphen-qualified compounds
like `upcoming-meetings`), news articles (extended twice: financial-newswire ticker paths
`/news/BCHT/`, and PR headline shapes `X plans 4 …` / `X sets 62nd …` — with each verb
added only after a live witness), paper/abstract pages, event-artefact pages (slides/
proceedings/posters of an event are not the event), earnings calls, and job-listing
content (`job openings`, repeated `jobs`, `job postings archive`) — with a
`looksLikeEvent` rescue so genuine career fairs and job fairs always stay.

**Field integrity:**

- place values flow only through the guarded location parser; a page's own schema.org
  `Event` declaration outranks keyword guesses (channel L);
- "absence is not evidence": an empty search snippet can no longer disqualify a row
  (recovered ~100 wrongly-refused rows per window) — nor incriminate one;
- dates: a near-ISO normalizer repairs padding-only defects (`2026-3-3T09:00-4:00` →
  `2026-03-03T09:00-04:00`) with a calendar round-trip check that makes inventing a date
  impossible (`Feb 30` passes `new Date` by silently becoming March 2 — the round-trip
  catches exactly this). **Zero invented dates were measured across the entire campaign**
  (Ruling 62b held at every census);
- double-escaped HTML entities in titles decoded idempotently (`R&amp;amp;D` → `R&D`).

**Cross-source dedup (three passes):** the same real conference arriving from multiple
sites now renders one card:

1. key normalization — ordinals (`26th`) and short all-caps acronym parentheticals
   (`(AABC)`) stripped from the name half of the dedup key;
2. a second, score-aware pass positioned AFTER scoring/expiry — an expired sibling
   structurally cannot resurrect through a merge; the higher-scored row survives;
3. a containment pass — a short title that is a contiguous, word-boundary-safe substring
   of a longer one (≥4 distinct tokens, same year) merges; proven on a 666-pair exhaustive
   replay to merge exactly the known same-event pairs and nothing else.

### 4. Visual parity with the design spec

A 20-item art/layout census against the spec's plates (typography roles, accent tokens,
label sweeps, section order, tile structure) was driven to **zero differences** and held
there for the final ten rounds. The spec's own rule — "Fields Peer can't find are hidden
rather than shown empty" — is verified as the implemented behavior on both deep reports.

### 5. Test infrastructure

- Suite grew from ~1,600 to **2,425 tests / 100 files**, all green at merge.
- New `events/dedup.test.ts` suite; every guard carries its corpus (must-catch,
  must-keep, adversarial constructions) as executable tests.
- Live-benchmark flake identified by name and classified (single-run benchmark-only red
  with green re-run = named flake; anything else = stop).
- Gate discipline: full-capture logging on every run; identity-first on any red.

### 6. The named-cost registry (deliberate, measured trade-offs)

Every remaining imperfection is recorded with its price and its reopen condition:

| cost | why it is accepted |
|---|---|
| ~85–97% of pool events render no date | measured source-side: pages don't publish machine-readable dates; the alternative is inventing them (15-row page-by-page classification on file) |
| honest-silent employer on ~half of job rows | silence beats a wrong name; every silent row traced |
| `The Battery Saloon` (no-text page) excluded | rescuing it admits two wrong-page classes (2/9 measured) |
| bare-hostname event names on titleless pages | the "honest host" is the only value nothing rejected |
| short-acronym topic collisions (`LCO` casino/lacrosse) can rarely reach a pool | no regex can know what letters stand for; the LLM tier is the real fix; reopen bar: a second job-surface witness |
| ~10% of pulls lose one source to the 25 s timeout | a hung source may never stall the report |

---

## Part 2 — How it was built: the ABC loop, 38 rounds

### The machine

Four roles, strict separation, one shared memory:

- **Agent A — the measurer.** Runs live censuses (5 pulls per surface per window), compares
  every rendered field against the offered corpus and the design plates, ranks findings.
  A never fixes and never closes the gate.
- **Agent B — the investigator/designer.** Takes A's findings, reproduces them by direct
  execution of the shipped code, designs bounded fixes, and adversarially tests every
  design against must-keep corpora before recommending. B never writes product code.
- **Agent C — the implementer.** Ships B's designs verbatim, with the corpus as tests.
  When an approved design breaks a locked test, C STOPS and files the conflict instead of
  improvising.
- **The manager** (main session) verifies every turn independently — re-running gates,
  re-executing key claims, spot-checking citations — rules on every policy question
  (Rulings 1–108), and re-measures with its own fresh window before anything closes.

State lives in one file (`MULTIAGENT-report-parity.md`): an in-place current-state header
(with a push-race turn lock that let a laptop session, a second local writer, and an
hourly cloud routine share the work without collisions) plus an append-only round log.
Every item is committed and pushed the moment it lands, so a mid-turn death loses nothing —
one implementer died mid-handoff and its draft was committed verbatim by the manager with
attribution (a recorded precedent, used again after account-limit deaths).

### The arc

- **Rounds ~1–20:** the heavy lifting — field extraction, the guard chains, the visual
  census machinery, scoring gates. Finding rates ran high (7+ per census).
- **Rounds 21–27:** the strict gate era. The owner ruled the gate at literal 0% of ALL
  differences (value and visual), with the manager's independent re-measurement required
  before any close. Visual reached zero for the first time in round 29.
- **Round 28 (the provider crisis):** quota-capped search APIs were burning free tiers; the
  owner banned them all mid-campaign. The Gemini grounding adapter was probed, designed,
  shipped, and ratified live within two rounds; costs of the switch (redirect title loss,
  timeout flakes) were measured and either fixed or priced.
- **Rounds 30–36 (convergence):** finding rates decayed 3 → 2 → 1 → 1 → 1 → 1, and the
  finds got progressively shallower — wrong values, then wrong page-kinds, then duplicate
  cards, then a single stock-news AGM headline. Mid-stretch the owner cut costs by
  downgrading all three agents from Opus to Sonnet; the manager tracked quality
  seat-by-seat for 24 data points and recorded no degradation.
- **Round 36 (the near-close):** A measured the first double-zero census. The manager's
  mandatory fresh-window re-measurement then caught one more row A's windows never drew —
  proving the two-window close protocol was worth its cost, and simultaneously that a
  literal-0% gate against an hourly-changing live pool might never terminate.
- **Rounds 37–38 (the close):** the owner replaced the literal gate with a convergence
  criterion — two consecutive full rounds (four independent measurement windows) with zero
  NEW defect classes; recurrences of recorded classes count as maintenance. Candidate
  round 1 passed with two maintenance items; in the final maintenance round the audit ran
  UPWARD — the investigator overturned both of the manager's own classifications with
  archive receipts (one commissioned "fix" would have deleted an event the campaign had
  protected for 30 rounds), and both items correctly resolved with zero code. Candidate
  round 2 then ran clean, and Phase 1 closed.

### What the process bought

- **Zero regressions ever shipped**: every fix carries its corpus as tests; the gate never
  merged red.
- **Nothing explained away**: every accepted imperfection has a measurement, a price, and
  a reopen trigger — several "obvious fixes" were refused because the evidence showed they
  would delete real data (the refusals are recorded with the same rigor as the fixes).
- **An audit trail that audits its own auditors**: agents corrected the manager's record
  twice with receipts; instrument bugs (harness mistakes, a credential-handling slip, two
  lost flake identities) were self-disclosed, verified, and turned into sharpened standing
  rules rather than hidden.

Phase 2 — the same campaign for the Tier 1/2 LLM-enriched deep reports — begins next,
with its own baseline census and this document's named-cost registry as the starting
backlog.

---

## Addendum — Phase 2: the Tier 1/2 LLM report campaign (closed)

Phase 2 ran the same ABC machinery against the LLM-enriched deep reports (9 rounds,
Rulings 109–117), measured over the local Vertex Gemini path. What it delivered:

- **The 11-field LLM inventory verified**: 7 LLM-only sections (specific requirements/
  duties, sponsorship read, emphasis on jobs; talk summaries, plan, poster fit on
  events) + 4 provenance-upgraded fields, all rendering inside the plate-conformant
  shells with zero new layout defects.
- **A three-part quality rubric** replaced literal plate-matching for LLM content
  (the spec only mocks the locked state): layout conformance, fidelity-to-page
  (every claim substring-verified against the fetched source), field-contract form.
  **Zero hallucinations were observed in any census** — across three independent
  measurement rounds the strictest check (every quoted string a literal substring of
  the real page) passed on every call, including the manager's own.
- **One content-correctness defect found and fixed (F-P2-01)**: the programme-page
  picker could select a site's own navigation link, bleeding another event's content
  into the report. Root cause was a one-line asymmetry (the third extraction path
  never stripped page furniture like its two siblings); fixed, tested, and verified
  across three layers and two fresh live windows.
- **The serif/sans doctrine completed**: source-prose = serif, Peer's voice = sans,
  headings = sans; a five-victim styling trap (tailwind-merge vs the custom text
  scale) closed at the root with a general fix.
- **Honest costs recorded**: programme pages that exist only behind lead-gen PDF
  forms or in client-rendered SPAs yield an empty section by design (empty-over-wrong
  is the campaign's binding failure direction — proven the right call when the
  alternative scored a "Schedule a Call" button above the real agenda).

Final gate: **2,442 tests, all green.** Both phases closed under the same convergence
criterion: two consecutive clean rounds, each sealed by the manager's independent
fresh-window re-measurement.
