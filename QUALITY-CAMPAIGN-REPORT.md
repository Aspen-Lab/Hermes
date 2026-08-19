<p align="center">
  <img src="assets/logo.png" alt="Peer" width="110" />
</p>

<h1 align="center">Jobs &amp; Events Report Quality Campaign</h1>

<p align="center">
  <em>How Peer's job and event deep reports went from "frequently wrong in ways a reader
  would notice" to a verified, measured, documented standard — and what it cost to get there.</em>
</p>

<p align="center">
  <b>Status:</b> complete, merged to <code>main</code> ·
  <b>Duration:</b> 2026-07-31 → 2026-08-19 (20 days) ·
  <b>Rounds:</b> 47 ·
  <b>Commits:</b> 959 ·
  <b>Tests:</b> 1,600 → 2,442, all green
</p>

---

## Table of contents

- [The one-paragraph version](#the-one-paragraph-version)
- [1. What was broken](#1-what-was-broken)
- [2. What we built](#2-what-we-built)
- [3. How we know it works](#3-how-we-know-it-works)
- [4. How it was built — the method](#4-how-it-was-built--the-method)
- [5. What we deliberately did *not* ship](#5-what-we-deliberately-did-not-ship)
- [6. What is still open](#6-what-is-still-open)
- [7. Where to look](#7-where-to-look)
- [In plain English](#in-plain-english)

---

## The one-paragraph version

Peer's daily briefing surfaces jobs and events discovered by live web search. Web search
returns *pages*, not *records* — an encyclopedia article, a careers-office index, a stock-market
press release and a real job posting all look alike to a naive pipeline. This campaign closed
that gap on both surfaces, in two phases: **Phase 1** for the keyless Tier-0 reports, **Phase 2**
for the LLM-enriched Tier 1/2 reports. Both phases closed under the same rule: **two consecutive
full measurement rounds with zero new defect classes, each sealed by an independent
re-measurement** in a *different* live window than the one that produced the finding. The result
is not "we fixed some bugs" — it is a report surface where every rendered field is correct or
honestly absent, every remaining imperfection is a named cost with a measured price and a written
reopen condition, and every fix ships with the evidence corpus that proved it, as executable tests.

| | Before | After |
| --- | --- | --- |
| Wrong employer names on job cards | routine (job titles, project names, careers offices, job-board brands) | 0 across 8 independent measurement windows |
| Non-jobs rendered as job postings | Wikipedia articles, lab blog posts, search-results pages | 0 |
| Non-events rendered as conferences | job-listing blogs, investor PR, shareholder AGMs, listing hubs | 0 |
| Same conference shown twice | routine across sources | 0 (three-pass dedup, exhaustively replayed) |
| Invented / wrong dates | — | **0, at every census ever taken** |
| LLM hallucinations (Phase 2) | — | **0** — every quoted string verified as a literal substring of the source page |
| Visual conformance to the design spec | drifted | 0 differences, held for the final 10 rounds |
| Test suite | ~1,600 | **2,442, all green** |

---

## 1. What was broken

These are real, witnessed specimens recorded during the campaign — not hypotheticals. Each one
was a card a reader would actually have been shown.

**Job reports — the employer field was frequently not an employer:**

```
"BALDER Project (Licensing Support for a Molten Salt Reactor)"   ← a project name (real PSI internship)
"Research Technologist 1"                                        ← a job title
"Internship battery R&D"                                         ← a job title
"Membrane Scientist for Electrodialysis"                         ← a job title
"EV.Careers"                                                     ← the job board's own brand
"Career Connections Center University of Florida"                ← a university careers office
"Kairos Power, Alameda, California, United States"               ← a real employer with an address welded on
```

**Job reports — pages that were not job postings at all:**

```
en.wikipedia.org/wiki/Topochemical_polymerization    ← an encyclopedia article, rendered as a posting
foundry.lbl.gov/2025/07/11/slowing-down-to-speed-up/ ← a national lab's blog post
jobright.ai  "Jobright: Your AI Job Search Copilot"  ← a job board's search-results page
```

**Event reports — pages that were not events:**

```
"Ion Exchange Mumbai Job Openings Check here"                    ← a job-listings blog post
"Birchtech plans 4 water conference stops as PFAS removal…"      ← an investor press release
"Ion Exchange sets 62nd AGM for September 11, 2026"              ← a corporate shareholders' meeting
"Job Postings Archive - Ion Exchange"                            ← a job archive page
electrochem.org/upcoming-meetings                                ← a listing hub, rendered as one event
```

**Event reports — the same conference shown as two cards:**

```
"AABC 2026 - Advanced Automotive Battery Conference"     @ events.evwire.com
"26th Advanced Automotive Battery Conference (AABC) | December 7-10, 2026 | San Diego, CA"
                                                          @ advancedautobat.com
                                                          ↑ one real conference, two cards
```

**Event reports — a malformed date silently deleted the whole Dates tile:**

```
source page published:  "2026-3-3T09:00-4:00"   ← valid components, non-standard padding
every date formatter:   null
the deep report:        the "Dates" tile vanished entirely, with no indication a date existed
```

**Tier 1/2 (LLM) reports — the worst class we found: confidently wrong content.**

```
event:    an ion-exchange technical training course (rsc.org)
programme picker chose:  the site's own sitewide navigation link, "Career talks and events"
report then rendered:    a talk titled "ChemCareers 2026: Finding a job after 50"
                         ↑ a real talk — from a completely different event
```

---

## 2. What we built

### 2.1 Search-provider migration (Vertex Gemini grounding)

Mid-campaign the quota-capped search APIs (Tavily, Adzuna, USAJobs, JSearch) had to be retired
from the measurement path. A new adapter, [`web/src/lib/sources/gemini-search.ts`](web/src/lib/sources/gemini-search.ts),
was designed from a live probe of the grounding API's real behaviour and shipped within two rounds:

- Grounding URIs are Google redirect stubs — the adapter resolves each one, then fetches the
  resolved page **once** to recover both the real page `<title>` and its `og:description`.
- A row whose real title can't be recovered is **dropped, never faked** — "no partial row, no
  placeholder, no host-as-title."
- A 25-second per-source hard timeout: one hung search can never stall a briefing.

The provider seam (explicit override → Gemini → Brave → Tavily) is shared by all three surfaces,
so they cannot drift apart. The live benchmark suite runs green on Gemini as a continuous
acceptance check.

### 2.2 Job reports — the honest-silence doctrine

The employer-candidate chain now carries ~16 independent negative guards. A candidate that fails
any guard is removed; the next candidate wins, or the field renders **nothing**.

> **The rule:** silence always beats a wrong name. And no guard may ever delete a *real*
> organisation name — every guard ships with a must-keep corpus proving zero false drops.

Guards added by this campaign include: role-description text in the employer slot; job-board brand
names; project/programme labels (structurally, so real organisations like `Project HOPE` and
`Project Management Institute` survive by design); careers-office labels; truncated candidates;
host boilerplate; address tails (trimmed, never rejected).

Page-kind guards were added because a job report must contain jobs: encyclopedia hosts (all
language subdomains), date-structured lab-blog paths (with a job-vocabulary safety net so a genuine
posting at such a URL survives), brand-tagline search-results pages, and careers-section roots.

### 2.3 Event reports — eight ingestion kind guards

Each answers "is this page actually one event?": index pages · hub/listing pages · news articles
(extended twice: financial-newswire ticker paths, and PR headline shapes — each verb added **only**
after a live witness) · paper/abstract pages · event-artefact pages (the slides *of* an event are
not the event) · earnings calls · job-listing content — all with a `looksLikeEvent` rescue so
genuine **career fairs and job fairs stay**, because a job fair *is* a real event you attend.

Field integrity work:

- Place values flow only through the guarded location parser; a page's own `schema.org` `Event`
  declaration outranks keyword guesses.
- **"Absence is not evidence"**: an empty search snippet can no longer disqualify a row *or*
  incriminate one — this alone recovered ~100 wrongly-refused rows per measurement window.
- **Dates:** a near-ISO normalizer repairs padding-only defects, guarded by a calendar round-trip
  check that makes inventing a date structurally impossible. (`new Date("2026-02-30")` does not
  throw — it silently becomes March 2. The round-trip catches exactly that.)
- Double-escaped HTML entities in titles decoded idempotently (`R&amp;amp;D` → `R&D`).

### 2.4 Cross-source deduplication (three passes)

| Pass | What it does |
| --- | --- |
| **1. Key normalization** | strips ordinals (`26th`) and short all-caps acronym parentheticals (`(AABC)`) from the name half of the dedup key |
| **2. Score-aware second pass** | runs *after* scoring and expiry, so an expired sibling structurally cannot resurrect through a merge; the higher-scored row survives |
| **3. Containment pass** | a short title that is a contiguous, word-boundary-safe substring of a longer one (≥4 distinct tokens, same year) merges |

Pass 3 was validated by an **exhaustive 666-pair replay** of every full title preserved in the
campaign's own artefact tables: it merged exactly the three known same-event pairs and nothing
else. It was later vindicated organically in the wild — a live window contained the Chicago
*Solid-State Battery Summit* and an India *Battery Summit*, and the 4-token floor correctly kept
two genuinely different conferences apart.

> **Binding rule throughout:** a **false merge is worse than a duplicate** — merging two different
> events deletes a real one from the briefing. The must-NOT-merge corpus always outranked the
> must-merge pair.

### 2.5 Tier 1/2 — the LLM-enriched reports (Phase 2)

- All **11 LLM-path fields** inventoried and verified rendering inside the plate-conformant shells
  (7 LLM-only sections + 4 provenance-upgraded fields). **Zero new layout defects** — they reuse
  Phase 1's validated shells.
- A **three-part quality rubric** replaced literal template-matching (the design spec only mocks
  the *locked* teaser state): **layout conformance · fidelity-to-page · field-contract form.**
- **Fidelity is enforced mechanically**: every string the model quotes is checked to be a literal
  normalized substring of the fetched page. Across three independent measurement rounds — including
  the reviewer's own independent live calls — **that check never failed**.
- **F-P2-01** (the wrong-event contamination above) was traced to a one-line asymmetry: of three
  extraction paths in the same file, two stripped page furniture and the third never did. Fixed,
  tested, and verified at three layers plus two fresh live windows.
- Typography doctrine completed (source-prose = serif, Peer's voice = sans, headings = sans) and a
  five-victim styling trap (tailwind-merge vs. the custom text scale) closed at the root.

### 2.6 Visual parity with the design spec

A 20-item art/layout census against plates 02 (Job report) and 03 (Event report) of
`Peer-design-spec-original.pdf` was driven to **zero differences** and held there for the final
ten rounds. The spec's own rule — *"Fields Peer can't find are hidden rather than shown empty"* —
was verified as the implemented behaviour on both deep reports, quoted from the source document
rather than inferred.

---

## 3. How we know it works

This is the part that took the time. Every claim above is backed by measurement, not by review.

**The measurement protocol, per census round:**

1. Five independent live pulls per surface, against the real network, with a fresh no-op cache
   each time — never a fixture, never a replay.
2. Every row in every final pool read and classified: correct · explained-by-a-named-cost · or a
   finding.
3. Both deep reports rendered from real live rows through the shipped components and compared
   against the design plates.
4. Findings ranked by what a reader loses, each traced to the exact clause that admitted it.
5. **The reviewer never closes the gate.** A separate independent re-measurement, in a *different*
   live window, must agree before anything is declared done.

**Why step 5 exists — it earned its keep.** At the end of Phase 1 the census agent measured the
first "double zero" round. The independent re-measurement then drew a window containing a row the
first agent's windows never saw: a stock-market site's "Ion Exchange sets 62nd AGM" page rendered
as a conference. No one was wrong — the pool changes hourly — but the gate did not close, one more
fix shipped, and the protocol proved it was worth its cost.

**Closing evidence:**

| Measure | Result |
| --- | --- |
| Independent measurement windows at Phase 1 close | **8**, across two rounds, zero new defect classes |
| Independent measurement windows at Phase 2 close | **4**, zero new defect classes |
| Invented or wrong dates, all censuses, entire campaign | **0** |
| LLM hallucinations, Phase 2, all rounds | **0** (substring-verified) |
| Visual differences vs. the design plates | **0**, ten consecutive rounds |
| Rendering-layer files changed since the last exhaustive visual walk | **0**, verified over 120+ commits |
| Final gate | **100 files / 2,442 tests, all passing** |

---

## 4. How it was built — the method

The campaign ran as a disciplined loop with four separated roles and one shared, append-only
state file. The separation is the point: the agent that *measures* is never the agent that
*decides a fix is good enough*.

| Role | Does | Never does |
| --- | --- | --- |
| **A — measurer** | live censuses, ranks findings, verifies shipped fixes in the wild | fixes anything; closes the gate |
| **B — investigator** | reproduces by direct execution, designs bounded fixes, tests them adversarially against must-keep corpora | writes product code |
| **C — implementer** | ships the approved design verbatim, with the corpus as tests | judges scope; improvises when a design conflicts with a locked test — it **stops and files the conflict** |
| **Manager (owner-side)** | verifies every turn independently, rules on every policy question, re-measures with its own fresh window before any close | accepts a self-report |

**Scale of the effort:**

| | |
| --- | --- |
| Rounds | **47** (38 in Phase 1, 9 in Phase 2) |
| Numbered rulings on record | **117** |
| Commits on the branch | **959** |
| Elapsed | 20 days |
| Product code + tests changed | 129 files, **+36,003 lines** in `web/src` |
| Audit trail | **91,520 lines** ([`MULTIAGENT-report-parity.md`](MULTIAGENT-report-parity.md)) |
| Test suite | ~1,600 → **2,442** |

**Practices worth stealing:**

- **Write-as-you-go.** Every item commits and pushes the moment it lands. Mid-round crashes,
  context loss and account limits happened repeatedly and cost **zero** work: an agent that died
  mid-handoff had its draft committed verbatim, with attribution, by the reviewer.
- **Every fix ships its corpus as tests.** Not "we tested it" — the must-catch specimens,
  must-keep rows and adversarial constructions are all in the suite, so the next change cannot
  quietly undo this one.
- **Refusals are recorded as carefully as fixes** (see §5). "We considered and rejected X, here is
  the measurement" is a first-class outcome.
- **The audit runs upward.** Twice, the investigating agent overturned the reviewer's own written
  classifications using receipts from the archive — including one commissioned "fix" that would
  have deleted an event the campaign had been protecting for 30 rounds. Both corrections stand in
  the log with the reviewer's error named.
- **Instrument bugs are disclosed, not hidden.** Harness mistakes, a credential-handling slip, two
  flaky-test identities lost to truncated logs — each was reported, verified, and turned into a
  sharpened standing rule rather than quietly patched.
- **A convergence criterion instead of an unreachable absolute.** The original bar was "zero
  differences." Against a live pool that changes hourly, that has no finite end — each window has a
  small chance of drawing a never-before-seen page shape. It was replaced mid-campaign with:
  *two consecutive full rounds with zero **new defect classes**; recurrences of already-recorded
  classes are maintenance and do not reset the clock.* That is what made "done" both rigorous and
  reachable.

---

## 5. What we deliberately did *not* ship

Judgement is visible in the refusals. Each of these was designed, measured, and then rejected on
its own evidence — with the reason and the reopen condition written down.

| Refused | Why, measured |
| --- | --- |
| A "positive employer-name test" (tell a real org acronym from a department acronym) | `CSE` (a department) and `BD`/`INL`/`BMS` (real companies) are structurally identical — same length, same capitalisation, same everything. Separating them needs to know what the letters *stand for*. A partial fix shipped instead; three residuals named rather than faked. |
| Relaxing the same-host rule to reach off-site conference agendas | The one real off-host agenda was a client-rendered app with no static content — relaxing bought nothing. Worse: in the scoring experiment a "Schedule a Call" button outranked the real agenda link. The relaxation would have admitted worse than it recovered. |
| Mining prose for dates when a page publishes none | Tested: 2 of 7 single-match specimens would have shipped a **wrong** date — one was a Nobel laureate's date of death, one an abstract-submission deadline. 29% wrong-attribution is far past what "never invent a date" permits. |
| A generic `<time>`-tag reader | Its only live witness was a trap: the tags belonged to unrelated sidebar articles. It would have invented a date from a neighbouring story. |
| A standalone "AGM" veto for events | Four constructed scholarly-society "AGM + conference" titles all false-dropped. Learned societies hold AGMs too. |
| A per-host rule for the stock-news site | One host is not a class. A path-*structure* signal shipped instead, generalising across every site using the same convention without naming one. |

**Accepted named costs** (each with a measured price and a written reopen trigger): most event
pages simply do not publish a machine-readable date, so ~85–97% of event rows render no date —
verified page-by-page as a *source-side* gap, not a pipeline defect; conference programmes that
exist only behind lead-gen PDF forms or in client-rendered apps render an empty section; short
topic-acronym collisions (a lacrosse club's "LCO Summer" vs. lithium cobalt oxide) can rarely reach
a pool — no regex can know what letters mean, and the LLM tier is where that fix belongs.

---

## 6. What is still open

Recorded honestly, none blocking, each with a reopen condition:

1. A 116-person staff-roster page can still be admitted as a single posting (the conjoined-section
   grammar's noun list doesn't cover "staff" / three-item Oxford-comma lists).
2. A cosmetic name-prefix blemish (`"Meeting Summary-…"` as an event name) — the LLM naming path is
   its natural fix.
3. An unambiguous-US-date extraction lead (`06/16/2026` — day > 12 proves the month, so the day is
   recoverable losslessly). Unwitnessed twice; not built on speculation.
4. The acronym-collision design bar: a **second** job-surface witness reopens it as a design item.
5. A product question for the owner, not a defect: job postings have no age rule anywhere in the
   pipeline. Should a two-year-old posting still be shown?

---

## 7. Where to look

| What | Where |
| --- | --- |
| Narrative summary + Phase 2 addendum | [`docs/handoff/PHASE1-REPORT-PARITY.md`](docs/handoff/PHASE1-REPORT-PARITY.md) |
| Complete audit trail — every measurement, design, implementation and ruling (117) | [`MULTIAGENT-report-parity.md`](MULTIAGENT-report-parity.md) |
| The design spec the reports are measured against | `Peer-design-spec-original.pdf` |
| Phase 1 merge | `ca4366a` |
| Phase 2 merge | `700983c` |
| Search adapter | [`web/src/lib/sources/gemini-search.ts`](web/src/lib/sources/gemini-search.ts) |
| Job ingestion + guards | [`web/src/lib/jobs/sources/jobweb.ts`](web/src/lib/jobs/sources/jobweb.ts) |
| Event ingestion + guards | [`web/src/lib/events/sources/eventweb.ts`](web/src/lib/events/sources/eventweb.ts) |
| Event dedup (three passes) | [`web/src/lib/events/dedup.ts`](web/src/lib/events/dedup.ts) |
| LLM enrichment | [`web/src/lib/opportunities/enrichment.ts`](web/src/lib/opportunities/enrichment.ts) |

Run the suite yourself:

```bash
cd web && npm test
```

---

### In plain English

Peer finds jobs and conferences by searching the web. The problem is that the web hands back
*pages*, and a page about a job and a page that merely mentions jobs look almost identical to a
computer. So Peer was showing people the wrong things: an encyclopedia article dressed up as a job
posting, a company's shareholder meeting listed as a conference, a job title printed where the
employer's name should be, and the same conference twice because two websites wrote its name
differently.

This campaign fixed that — and, more importantly, built a way to *prove* it is fixed. Every day
for three weeks, the reports were measured against real live data, one card at a time. Anything
wrong was traced to the exact line of code that let it through, fixed, and locked with a test so it
cannot come back. Anything that couldn't be fixed honestly was written down as a deliberate,
priced decision instead of being quietly ignored — because a report that says nothing is better
than a report that says something false. The rule the whole project runs on is simple: **when Peer
isn't sure, it stays quiet.**

The finish line was not "we ran out of bugs to find." It was: two full rounds of fresh
measurements, by two independent checks in different data windows, finding no new *kind* of
problem. That happened twice — once for the basic reports, once for the AI-enhanced ones — and
then the work shipped.
