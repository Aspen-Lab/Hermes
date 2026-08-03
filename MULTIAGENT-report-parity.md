# REPORT PARITY LOOP — shared state

**Goal:** get Peer's live job and event reports to within **5%** of the design
spec plates. **Manager:** the main Claude session. **Loop:** A → B → C → A …

**Template (the contract):**
`template for web design/Peer-design-spec-original.pdf` — 21 pages.
**Plate 02 is the job report. Plate 03 is the event report.** Nothing else in the
PDF is in scope for this loop.

---

## §0. HOW TO RESUME — READ THIS FIRST, EVERY TIME

This file is the **only** durable state. A session can end at any moment; the
next agent must be able to pick up from this file alone.

1. Read **§1 CURRENT STATE**. It names whose turn it is and which round.
2. Read the latest round's section in §4.
3. Do only your own role's job (§2). Do not do another role's job.
4. **Append your output to §4 under the current round, then update §1**, in the
   same commit as any code you changed.
5. If you run out of budget mid-task, write what you have into §4 with the
   status `PARTIAL` and say exactly what remains. Never leave §1 pointing at a
   turn you silently abandoned.

**The one rule that makes this restartable:** §1 must always be true. Update it
before you stop, not after you finish.

---

## §1. CURRENT STATE — THE SOURCE OF TRUTH

```
ROUND:            1
WHOSE TURN:       B
STATUS:           A COMPLETE
LAST DIFFERENCE:  50%
GATE (<5%):       NOT MET
```

**History of measured difference, newest last:** _(A appends one line per round)_

| Round | A's measured difference | Verdict |
|---|---|---|
| 1 | 50% | 8 of 32 plate elements absent, 16 wrong shape/order/copy, 8 exact. Gate not met. |

---

## §1b. MANAGER'S CORRECTIONS — READ BEFORE JUDGING ANYTHING "DELIBERATE"

The Phase 10 handoff recorded two decisions that were **based on a misreading of
the plates**. The manager verified both against the PDF on 2026-08-03 and
**reverses them**. Treat the plate as correct and the handoff as wrong here.

### Correction 1 — the day-by-day plan must exist

`HANDOFF-phase10-report-back-to-spec.md` claims "the spec's event report has no
day-by-day plan at all" and task P10.3 deleted it. **That claim is false.** Plate
03's locked block, verbatim from the PDF:

> **A day-by-day plan for you** — Which sessions to attend and who to find, in order.

The build's old version restated the day's own name ("Day 1: Fundamentals") and
was rightly judged worthless — but the fix was to make it real, not to delete it.
**Rebuild it to the plate's definition: specific sessions to attend and specific
people to find, ordered.** It is a Tier 1/2 feature and belongs in the locked
block's promise list.

### Correction 2 — "Why Peer sent this to you" must exist

Task P10.4 deleted it from both reports. Plate 02 has it as a **Tier 0** block,
verbatim from the PDF:

> **WHY PEER SENT THIS TO YOU** · TIER 0
> "Matches 3 of your required topics — solid-state electrolytes, interfacial
> resistance, operando imaging — at postdoc level, in California, which you
> filtered toward 4 times this week."

Plate 03 has the same block. What was deleted was a one-line restatement
("Covers your molten salt focus"), which is not what the plate shows. **Restore
it at the plate's level of substance: name which required topics matched, at what
career level, and what filtering behaviour it reflects.**

### Everything else in Phase 7–10 §5 still stands

The competitiveness verdict stays deleted (the plate shows a count and two chip
groups, no verdict). Say-it-once still governs. If any other "deliberate"
decision looks wrong against the plate, mark it `POLICY — manager decides` and
say so; do not reverse it yourself.

---

## §1c. PLATE 03 SECTION ORDER — EXTRACTED FROM THE PDF, DO NOT RE-DERIVE

```
chips (kind · online/in-person · CCF-B · match %) → title → subtitle → buttons
  → facts: DATES / WHERE / FEE / ABSTRACT DUE / REGISTER BY / SCALE
  → CHEAPEST WAY IN, FOR YOU
  → TWO DEADLINES, ONE EVENT
  → WHAT ACTUALLY HAPPENS THERE
  → Who'll be in the room
       ORGANISATIONS (Tier 0)
       EVERY OTHER ORGANISATION ATTENDING · 31
       PEOPLE (Tier 0)
       EVERY OTHER SPEAKER · 16
  → WHAT IT COSTS YOU (Tier 0) — table: ITEM / STANDARD / STUDENT / DEADLINE
  → WHY PEER SENT THIS TO YOU (Tier 0)
  → ALSO IN THIS REPORT WITH AN AI KEY — four items:
       The other 29 exhibitors, judged
       What each talk is actually about
       A day-by-day plan for you
       Is your work a fit for the poster call
```

Plate 02 (job) order was extracted in `HANDOFF-phase10-report-back-to-spec.md`
§P10.2 and is still accurate: facts → visa quote → Timeline → Skills they ask for
→ [What the role is | To apply, have ready] → Why Peer sent this to you → locked
block.

---

## §2. ROLES — DO ONLY YOUR OWN JOB

### Agent A — Reviewer

Compare the **live** job report and event report against plates 02 and 03.

- Read the plates from the PDF (`pages: "3-6"` covers plate 02 and the start of
  plate 03; read further as needed — find them, do not guess).
- Get the live reports. Either render the components to static markup the way
  `web/src/app/jobs/[id]/page.test.ts` does, or drive the dev server. Say which
  you used.
- Produce a **numbered difference list**. For each: what the plate has, what the
  build has, and which one is missing or wrong. Be specific enough that B can
  find it without re-deriving your work.
- Give a **single percentage**: how far the build is from the plate, and say in
  one sentence how you arrived at it (e.g. sections present/absent, ordering,
  content shape). A rough but honest method beats a precise-sounding invented one.
- **Rank the list**: what a reader would notice first goes first.

A does **not** change code. A does **not** investigate causes.

**A's exit condition:** when the measured difference is **below 5%**, set
`GATE (<5%): MET` in §1 and stop. The manager takes over.

### Agent B — Investigator

Take A's latest numbered list. For each item, find **why** the build differs.

- Name the file and the specific code that produces the current behaviour.
- Say whether it is missing, wrong, or deliberately different.
- **If something looks deliberate — a decision recorded in a HANDOFF file or a
  code comment — say so and do not recommend reversing it.** Flag it for the
  manager instead. Several plate deviations are decided policy, not defects.
- Output a **fix guide**: one entry per difference, in the order C should work.

B does **not** change code.

### Agent C — Implementer

Work through B's fix guide in order.

- After each item, run the gate:
  `cd web && npx vitest run && npx tsc --noEmit && npx eslint`
- **Baseline: 81 files / 798 tests passing, typecheck clean, lint exactly 1
  pre-existing error (`src/components/persona/quiz.tsx:46`).** Do not regress it.
- Never delete a test to make a change pass. Rewrite the assertion to state the
  new contract and say in a comment which item changed it.
- Do not skip the live benchmark via `PEER_PROFILE_SNAPSHOT_PATH`.
- Commit per item. Then hand back to A.

---

## §3. GROUND RULES FOR EVERY AGENT

- Working directory: `C:\I\Personal\Github - start up project\Peer`
- Branch: `feature/summary-report-revamp`. **Do not create a branch or worktree.**
- `web/AGENTS.md`: this is **not** the Next.js you know (16.2.3, React 19.2.4).
  Read `web/node_modules/next/dist/docs/` before touching routing.
- No API key is needed. Never log, commit, or write a key to a file.
- If you start the dev server, `npm run kill-orphans` from `web/` afterwards and
  confirm no node process is left listening.
- **Do not open a PR.**
- Prior phase decisions live in `HANDOFF-phase7..10*.md`. Read before assuming
  something is a bug.

---

## §4. ROUND LOG — APPEND ONLY, NEVER REWRITE HISTORY

### Round 1 — Agent A

**STATUS: COMPLETE.** Measured difference **50%**. 9 differences on the job
report, 15 on the event report, plus 4 extra blocks the plate does not have.

#### How I got the build

`renderToStaticMarkup` + `createElement` on the exported `JobReport` and
`EventReport`, run through vitest as a throwaway spec (`web/src/zz-parity-render.test.ts`,
deleted after the dump — the working tree is clean). No dev server, no orphans.

Fixture — deliberately maximal so nothing scores as missing for lack of data:

- **Job** — a full plate-02 clone: `roleKind: "postdoc"`, `employmentType`,
  `contractLength`, salary range, `postedDate` / `applicationDeadline` /
  `startDate`, `visa.state: "sponsors"` with evidence, `relevanceScore: 0.91`,
  9 `keyRequirements` with 6 `matchedTerms`, a 3-sentence `summary`, 4
  `applicationMaterials`, `matchReason`, `linkPosting`.
- **Event** — a full plate-03 clone: `type: "summit"`, `date` + `endDate`,
  `deadline`, `registrationDeadline`, `expectedSize: 2400`, `rank: "CCF-B"`,
  `travelGrant`, `invitationLetter: true`, **6 `fees` rows** matching the plate's
  cost table exactly, 6 `activities`, **25 `organisations`** (3 with
  `relevance`+`atEvent`, 22 plain), **18 `people`** (2 with `relevance`+`speaking`,
  16 plain), `shortDescription`, `relevanceReason`, both links,
  `relevanceScore: 0.88`, `careerStage: "PhD Year 4"`, a populated
  `rosterContext`.
- Rendered **four states**: job Tier 0, job enriched (full `JobEnrichment`),
  event Tier 0, event enriched (full `EventEnrichment` incl. `talkSummaries`,
  `judgedAttendees`, `posterFit`). Plus a fifth junk-requirements job to answer
  the skills question below.

Plate text extracted with PyMuPDF: plate 02 = PDF pages 2–4 (the locked block
runs onto page 4), plate 03 = PDF pages 4–9. Letter-spacing normalised.

---

#### A. JOB REPORT — 9 differences, ranked

**1. `W H Y  P E E R  S E N T  T H I S  TO  YO U` · TIER 0 — MISSING SECTION.**
Plate has a Tier 0 block with a substantive paragraph: "Matches 3 of your
required topics — solid-state electrolytes, interfacial resistance, operando
imaging — at postdoc level, in California, which you filtered toward 4 times
this week." Build renders **nothing**. `job.matchReason` was populated in the
fixture; `grep` confirms neither `matchReason` nor `facetPreferenceReason` is
referenced anywhere in `web/src/app/jobs/[id]/page.tsx`. Confirms §1b Correction 2.

**2. `S K I L L S  T H E Y  A S K  F O R` — WRONG SHAPE + WRONG COPY.**
Plate: one heading with `NEW` and `TIER 0` badges, the line "6 of 9 you already
have", then **one flat wrapping row of chips** — the ones you have are
highlighted and carry a trailing `✓`, the gaps are plain chips in the same row.
Build: heading "Skills and profile gaps"; a **progress bar** (`role="progressbar"`,
`aria-valuenow`); the line "6 of 9 requirements match terms in your profile";
then a **two-column split** with sub-headings "Matched in your profile" and
"Not matched in your profile", each a bulleted `<ul>` with `✓` / `○` glyphs.
Four separate gaps: heading copy, count copy, chips→two lists, and an extra
progress bar the plate does not have. No `NEW` / `TIER 0` badges.

**3. Skills footnote — MISSING.** Plate prints, under the chips: "Highlighted
chips come from your Required and Explore topics plus your project text. The
plain ones are the gaps — worth seeing before you spend an evening on the
application." Build prints no explanation of where the chips came from.

**4. Facts row — WRONG SHAPE, 2 of 7 tiles missing, all sub-lines missing.**
Plate has **seven** tiles, each a label, a value, **and a second grey line**:
`SALARY` $95k – $120k / "per year · from posting"; `TYPE` Postdoc /
"Full-time · 3-yr contract"; `LOCATION` Los Altos, CA / "Hybrid · US";
`STARTS` Jan 2027 / "flexible"; `APPLY BY` Sep 15 / **"47 days left"**;
`POSTED` Jul 22 / **"8 days ago"**; `VISA` Sponsors / "stated in the posting".
Build renders **five** tiles (Salary, Employment, Posted, Apply by, Starts) with
**no second line on any of them**. `LOCATION` and `VISA` tiles do not exist.
The two countdowns ("47 days left", "8 days ago") — the highest-value numbers on
the row — appear nowhere in the report. Label copy also differs: "Employment"
vs plate `TYPE`.

**5. Locked block — 2 of 4 plate items missing, 1 item present that the plate
does not list.** Plate's four:
  1. "How competitive this actually is" — "Reads the requirements against your
     CV-level profile and says where you'd stand." → **absent from the build's
     list.** `POLICY — manager decides`: §1b keeps the *rendered* competitiveness
     verdict deleted, but this is the locked-block *promise*, a different thing,
     and the plate does show it. Flagging, not recommending a reversal.
  2. "Sponsorship read when the posting is silent" — "Judges this employer's
     track record instead of leaving it at 'not stated'." → present, **different
     copy**: "Judge the employer's likely position without confusing inference
     with posting evidence."
  3. "The role in three clean sentences" — "Rewritten from the posting rather
     than the posting's own best sentences." → **absent.** `POLICY` — P10.2
     merged this into "What the role is".
  4. "What to emphasise in your application" — "Which of your papers and methods
     to lead with, given this team's work." → present, **different copy**:
     "Identify which parts of your declared work and methods should lead."
Build has an extra third item, "What this employer actually asks for", which is
not on the plate.

**6. `TO  A P P LY,  H AV E  R E A D Y` — WRONG SHAPE, 3 of 4 labels missing.**
Plate is four **labelled** rows: `MATERIALS` "CV, 1-page research statement, 3
references" / `ELIGIBILITY` "PhD awarded by start date" / `TEAM` "Energy &
Materials, 14 researchers" / `SEEN ON` "Adzuna · reposted from employer site".
Build renders an unlabelled `<ul>` of `job.applicationMaterials` — the four
strings print, but nothing says which is eligibility, which is the team, which
is the source. `Job` has no field for the last three.

**7. Skills section prints scraped junk verbatim — NO GUARD. CONFIRMED.**
Rendered a job whose `keyRequirements` were `["web job listing", "tesla.com",
"Apply now", "Sign in", "Solid-state electrolytes", "careers page"]`. Output:
`1 of 6 requirements match terms in your profile`, and site chrome listed under
**"Not matched in your profile"** — i.e. the report tells the reader that
"tesla.com" and "Sign in" are skills they are missing. `skillComparison()` in
`web/src/app/jobs/[id]/page.tsx` only trims and de-duplicates; there is no
plausibility filter at the report layer. Whether junk reaches the field is
upstream and is B's to trace.

**8. Action row + subtitle copy.** Plate button: "Apply on employer site ↗";
build: "Apply ↗". Plate: "✓ Mark as applied"; build: "Applied". Plate has one
feedback control, "Not interested"; build has a pair, "Interested" +
"Not interested" (extra). Plate subtitle is three segments — "Toyota Research
Institute · Los Altos, CA · Hybrid (3 days on-site)"; build prints two, no work
mode (`Job` has only `isRemote`, no hybrid state).

**9. Visa quote loses its attribution.** Plate: the blockquote ends
"— from the job description". Build prints the quote with no source line.
(Correct behaviour otherwise: the quote is suppressed in the enriched state
because it moves into "Sponsorship read". That matches say-it-once.)

**Extra, not on the plate (job):** in the enriched state the build renders two
sections the plate never shows — "What this employer actually asks for" and
"What the person would actually do". `POLICY` — P10.2 territory; flagged only.

**What already matches on the job report:** header chips, H1, `TIMELINE`
(section, order, four points, "Today" accented), `WHAT THE ROLE IS` as bullets,
locked-block header + "Connect a key" link.

---

#### B. EVENT REPORT — 15 differences, ranked

**1. `W H Y  P E E R  S E N T  T H I S  TO  YO U` · TIER 0 — MISSING SECTION.**
Plate: "Matches 3 required topics, has both an open poster call and a recruiting
fair, and the abstract deadline is 92 days out — the only event in your pool
with all three." Build renders nothing; `event.relevanceReason` was populated and
`grep` finds no reference to it (or to `facetPreferenceReason`) in
`web/src/app/events/[id]/page.tsx`. Confirms §1b Correction 2.

**2. `E V E RY  OT H E R  O RG A N I S AT I O N  AT T E N D I N G  ·  3 1` —
MISSING SECTION. CONFIRMED.** Plate makes the long tail its own titled block
with a live count, a "Filter this list" input, a `★` column with the explainer
"Star anyone Peer got wrong. It moves to the top here, and every future event
highlights them automatically.", and the closing footnote "Nothing is collapsed
behind a '+29' — Peer's guess about what matters to you is not good enough to
hide anything." Build: the 22 plain organisations simply run on underneath the
same "Organisations" `<h3>` as the 3 Tier 0 cards, with no divider, **no count**,
no filter box and no explainer. Star buttons themselves **are** present on every
row (`☆`) — only the heading, count, filter and explanatory copy are missing.

**3. `E V E RY  OT H E R  S P E A K E R  ·  1 6` — MISSING SECTION. CONFIRMED.**
Same structure, same four missing pieces, plus the plate's own footnote "Full
name, role and institution for everyone, pulled from the event's own speaker
page. Nobody is collapsed." Build runs the 16 plain speakers on under "People".

**4. Section order is wrong — `WHAT IT COSTS YOU` is three sections too early.**
Plate order (§1c): cheapest → two deadlines → what actually happens there →
who'll be in the room (orgs + tail + people + tail) → **what it costs you** →
why Peer sent this → locked block. Build order: cheapest → deadline timeline →
**what it costs you** → what actually happens there → roster → talks → poster
fit → locked block. The cost table jumps the queue ahead of both the programme
and the roster.

**5. `A day-by-day plan for you` — MISSING. CONFIRMED.** Plate's locked block
lists four items; item 3 is "A day-by-day plan for you — Which sessions to
attend and who to find, in order." Build's locked block has three items and no
day plan, and no rendered day-plan section in the enriched state either.
Confirms §1b Correction 1: this is **missing**, not deliberately absent.

**6. Facts row — MISSING; 4 of 6 tiles have no home anywhere.** Plate has six
tiles with sub-lines: `DATES` "Mar 8 – 11, 2027" / "Mon – Thu"; `WHERE`
"San Diego, US" / "in person · hybrid keynotes"; `FEE` "$480" / "student $180 ·
early bird to Jan 9"; `ABSTRACT DUE` "Oct 30" / "92 days left"; `REGISTER BY`
"Feb 20" / "on-site registration available"; `SCALE` "~2,400" / "last edition".
Build has no tile row at all — just a two-cell When/Where grid inside the header.
`FEE`, `ABSTRACT DUE` and `REGISTER BY` survive further down (cost table,
deadline strip) but are gone from the top; **`SCALE` appears nowhere** —
`event.expectedSize` (2400 in the fixture) is never referenced in the component.
Date copy also differs: build prints "Monday, March 8, 2027 · Mar 11, 2027"
(full weekday for the start, abbreviated for the end, joined by "·") where the
plate prints "Mar 8 – 11, 2027" with "Mon – Thu" beneath.

**7. `T W O  D E A D L I N E S ,  O N E  E V E N T` — heading MISSING, and the
strip is 3 points not 4.** Plate: a titled section with four milestones —
**Today**, Abstract Oct 30, Register Feb 20, Event Mar 8. Build: `DeadlineTimeline`
renders a bare `<ol>` with **no `ReportSection` wrapper and therefore no
heading**, three points only (Submit by / Register by / Event), and **no "Today"
marker** — even though the job report's own `Timeline` does include Today.
Label copy: "Submit by" vs plate "Abstract".

**8. "Cheapest way in, for you" — PRESENT, but wrong copy and printed twice.
REFUTES the expected gap.** The section exists (`CheapestCallout`) and sits
correctly right under the header. Two problems. (a) Copy: plate writes a
sentence a person can act on — "Student ticket in person before Jan 9, with a
travel grant — $180, applied for alongside the abstract you were going to write
anyway." Build emits a mechanically assembled string — "$180 student rate ·
Registration, in person · by Early bird ends Jan 9 · $620 after" — which never
mentions the travel grant and ends by quoting the *higher* price. (b) The same
line is printed **a second time** inside the cost table's header row
("Cheapest way in, for you: …"), a say-it-once violation.

**9. `W H AT  AC T UA L LY  H A P P E N S  T H E R E` — chips lose their
highlighting, and the copy is mangled.** Plate: six chips, **three carry `✓`**
and are highlighted because they line up with your topics. Build: all six render
as identical plain tag chips, no `✓`, no highlight — the "which of these matters
to me" signal is gone. Worse, every chip is pushed through `formatEventType()`,
which strips hyphens and title-cases: "Symposium: solid-state interfaces" →
**"Symposium: Solid State Interfaces"**; "Tutorial: cell-scale modelling" →
**"Tutorial: Cell Scale Modelling"**; "Poster session — open call" →
**"Poster Session — Open Call"**. That helper is for enum values like
`job-fair`, not for prose.

**10. Happenings footnote — MISSING.** Plate: "Highlighted because they line up
with your topics and because you're a PhD 4 looking at industry — the poster
call and the recruiting fair are the two you'd be sorry to miss." Build prints
no such line, which is consistent with #9 (nothing is highlighted to explain).

**11. Costs-table footnote — MISSING.** Plate closes the table with "Full price
with no grant would be $620 plus four nights. The gap between the two is the
reason this line sits at the top of the report." Build ends at the last row.

**12. Roster heading — WRONG COPY, and the counts line is missing.**
Plate: `Who'll be in the room`, with a sub-line "5 of 34 exhibitors and 3 of 18
speakers concern you". Build: "Organisations and people at the event", and in
the enriched state it appends "· 2 judged" — a count of what the model produced,
not the plate's "how many of them matter to you". No `TIER 0` badges on the
`ORGANISATIONS` / `PEOPLE` sub-headings either.

**13. Costs table — DATE BUG corrupts a factual cell.** The columns are exactly
right (`ITEM` / `STANDARD` / `STUDENT` / `DEADLINE`) — **this refutes the
expected gap.** But `formatFeeDeadline()` runs every deadline string through
`formatDate()` first, so the Hotel-block deadline **"Rate held until Feb 6"
renders as "Feb 6, 2001"** — an invented year printed as fact. Free-text
deadlines that happen to contain a month and a day are silently reinterpreted.
("Early bird ends Jan 9 · $620 after", "Allow 3 weeks" and "Apply with your
abstract" pass through intact, so the bug only bites some rows — which makes it
harder to notice, not less serious.)

**14. Header chips — 2 of 4 missing.** Plate: `Industry summit + career fair` ·
`CCF-B` · `88% match`, plus the in-person/online chip (§1c). Build: `Summit` ·
`In person` · `88% match`. The **rank chip is absent** — `event.rank` ("CCF-B")
is never referenced in the component — and the secondary kind ("+ career fair")
has nowhere to live.

**15. Subtitle line and the abstract button.** Plate subtitle: "San Diego
Convention Center · in person, streamed keynotes · 4 days" — venue, format,
duration. Build has no subtitle at all; the When/Where grid replaces it, and
duration is never stated. Plate has two primary links, "Register ↗" **and
"Submit abstract ↗"**; build has one link plus two completion pills
("Registered", "Submitted") and the extra "Interested" control.

**Extra, not on the plate (event):** (a) a lead paragraph inside "What actually
happens there" — the plate has chips + footnote there, no prose; (b) the
"Travel grant: …" callout and the "Invitation letters are available." line are
printed in that section **and** as rows in the cost table, so the fixture shows
both facts twice (say-it-once); (c) the "· N judged" suffix on the roster
heading.

**What already matches on the event report:** H1; the `ORGANISATIONS` Tier 0
cards (name, descriptor, relevance sentence, "At this event · …" line, star) and
the `PEOPLE` Tier 0 cards (name, role · institution, relevance, "Speaking · …");
the cost table's four column headers; the locked-block header + "Connect a key";
"What each talk is actually about" and "Is your work a fit for the poster call"
in the enriched state.

---

#### C. The number

**50% different.**

Method: I inventoried the plates into **32 discrete elements** a reader would
perceive as a thing on the page — 14 on plate 02, 18 on plate 03 (a heading, a
tile row, a footnote paragraph, a locked-block list each count as one). I scored
each **1** if the build renders it in the right place with the right shape,
**0.5** if it is present but in the wrong shape, wrong order or materially wrong
copy, and **0** if it is absent. Result: **8 exact, 16 half, 8 absent →
16 / 32 = 50% matched, 50% different.** The four extra blocks the plate does not
have are *not* penalised, so 50% is, if anything, generous.

Per report: job **8.5 / 14 ≈ 61% matched**; event **7.5 / 18 ≈ 42% matched**.
The event report is the weaker of the two by a wide margin.

#### D. The pre-flagged gaps — verdicts

| Expected gap | Verdict |
|---|---|
| Day-by-day plan | **CONFIRMED missing** (event item 5) — locked-block promise and section both gone |
| "Why Peer sent this to you" | **CONFIRMED missing on both reports** (job item 1, event item 1) |
| "Cheapest way in, for you" | **REFUTED — it exists** (event item 8), but wrong copy and duplicated |
| "Two deadlines, one event" | **PARTLY REFUTED** (event item 7) — the strip exists, its heading and its "Today" point do not |
| "Every other organisation attending · N" | **CONFIRMED missing** (event item 2) |
| "Every other speaker · N" | **CONFIRMED missing** (event item 3) |
| Costs table ITEM/STANDARD/STUDENT/DEADLINE | **REFUTED — columns are exactly right** (event item 13); the defects there are position, a missing footnote, and a date-parse bug |
| Job skills = real requirements or scraped junk | **CONFIRMED no guard** (job item 7) — junk prints verbatim and is framed as a skill gap |

#### E. Notes for B

- Every gap above was reproduced against a **maximal** fixture, so none of them
  is "the data was thin". Where a field simply does not exist on the type
  (`ELIGIBILITY` / `TEAM` / `SEEN ON`; hybrid work mode; secondary event kind),
  I said so.
- Three items are marked `POLICY — manager decides`, not defects: the two absent
  job locked-block promises ("How competitive this actually is", "The role in
  three clean sentences") and the two extra enriched job sections. Do not
  recommend reversing them; surface them.
- The date-parse bug in the cost table (event item 13) is a live correctness
  defect, not just a parity gap. Worth ranking early in the fix guide even
  though it is #13 by visual prominence.
