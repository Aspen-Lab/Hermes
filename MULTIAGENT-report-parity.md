# REPORT PARITY LOOP — shared state

**Goal:** get Peer's live job and event reports to **0% different** from the
design spec plates — every element the plate carries, in its shape and order. **Manager:** the main Claude session. **Loop:** A → B → C → A …

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
WHOSE TURN:       C  (the manager is doing C's remaining work directly)
STATUS:           C PARTIAL — 14 of B's 20 items done
LAST DIFFERENCE:  50%   (not re-measured since; A runs next)
GATE (0%):        NOT MET

DONE:      B-01 B-02 B-03 B-04 B-05 B-06 B-07 B-08 B-09 B-10 B-11 B-12 B-15 B-16
REMAINING: B-13 B-14 B-17 B-18 B-19 B-20
GATE NOW:  81 files / 815 tests passing, typecheck clean, lint 1 pre-existing
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

## §1d. MANAGER'S RULINGS ON B's SIX POLICY ITEMS — BINDING

Decided 2026-08-03. **The plate is a mock made before several of these features
existed, and the user has since given explicit instructions that override it.**
Where the two conflict, the user's instruction wins and the plate loses.

| # | Item | Ruling |
|---|---|---|
| 1 | Locked promise "How competitive this actually is" | **Stay deleted, and do NOT restore the promise.** The user's instruction was explicit: "peer 不应该用来评价，只摆事实……判断要交给用户自己来" — Peer presents facts, the reader judges. Advertising a feature we will not build is the exact dishonesty Phase 7 existed to remove. |
| 2 | Locked promise "The role in three clean sentences" | **Stay merged, promise stays out.** The content is delivered under "What the role is". Listing it separately would promise a second copy of something already on the page. |
| 3 | The two quoted-specifics job sections | **Keep.** Phase 9 built them, they quote the posting verbatim, and the user has seen them working. The plate predates the feature. Do not delete real content to match a mock. |
| 4 | The event description paragraph | **Keep.** The user asked for it directly — their complaint was that it read like copy-paste, not that it should not exist. Improving it is P10.1's job, already done. |
| 5 | The "Interested" button | **Keep.** The user asked for it in as many words: "也不存在 interested 这一选项。非常的糟糕。" |
| 6 | Travel grant and invitation letter printed twice | **Follow the plate: move them into the cost table and delete the duplicate.** This is the only one of the six where the plate is right — it removes a repetition, which say-it-once already requires. |

### Consequence for A's scoring — read this, A

Items 1–5 are **settled**. They are differences from the plate that will never be
closed. **A must exclude them from the percentage** — remove them from the
denominator, do not count them as matched. Say in each round's log how many
elements were excluded by ruling, so the number stays honest.

This exclusion is what makes a 0% target reachable at all: five differences
exist on purpose, and without dropping them from the denominator no build could
ever score zero. **Nothing else may be excluded without a new manager ruling.**

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

**A's exit condition — raised by the manager on 2026-08-03:** the target is now
**0%, not 5%.** Every element plate 02 and plate 03 carry must be present, in the
plate's shape and in the plate's order. Set `GATE (0%): MET` in §1 only when you
find **zero** unexplained differences, then stop — the manager takes over.

This is a strict bar and it is meant to be. Do not round down, do not call a
difference cosmetic in order to clear the gate, and do not stop reporting
something because it has already appeared in three rounds. If you believe a
remaining difference genuinely cannot or should not be closed, do **not** quietly
drop it — mark it `POLICY — manager decides`, leave the gate NOT MET, and let the
manager rule. Deciding what may remain is the manager's job, not yours.

The only elements excluded from the count are the ones already ruled on in §1d.

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

---

### Round 1 — Agent B

**STATUS: COMPLETE.** Every numbered item in A's two lists investigated, plus
the four extras. **28 items classified:** 8 `MISSING`, 10 `WRONG SHAPE`,
1 `WRONG ORDER`, 2 `WRONG DATA`, 1 `EXTRA`, 6 `POLICY — manager decides`.

I did not change code. I read the components, the enrichment library, the
scoring/mapper pipeline, the deleted P10.3 commits, and re-extracted plates 02
and 03 from the PDF with PyMuPDF to check three claims myself.

#### Three things I found that change the shape of the work

1. **The invented year is worse than reported.** It is not only the Hotel row.
   `"Oct 30"` — the plate's own Abstract-submission deadline — also becomes
   `"Oct 30, 2001"`. Any deadline string containing a month and a day is
   corrupted; only strings with *no* parseable date survive. See B-01.

2. **"Cheapest way in, for you" appearing twice is on the plate.** I read plate
   03 directly. The top callout and a second, *shorter* line at the head of the
   cost table are both in the PDF (page 8: "Cheapest way in for you: student
   ticket in person before Jan 9, with a travel grant — $180."). It is also a
   recorded decision (`HANDOFF-report-overhaul.md` §P3.2: "appears **twice** and
   both are deliberate") and a test asserts `toHaveLength(2)`. **Do not delete
   either one.** The defect is the wording, and that the build prints the *same*
   machine-assembled string in both places where the plate prints a written
   sentence up top and a compressed restatement below. See B-11.

3. **The day plan's verification machinery was never removed.** P10.3 deleted
   the type, prompt rule, parser and render — but `parseEventEnrichment` still
   builds `verifiedTalkTitles` and `acceptedPlanAttendeeNames`
   (`web/src/lib/opportunities/enrichment.ts:622-623, 660, 706`) and nothing
   reads them. The prompt's `outputSchema` also still carries a `dayPlan` block
   (`enrichment.ts:602-607`) with no matching rule and no parser — the model is
   still being asked for a field that is silently discarded. Rebuilding the day
   plan is largely re-wiring dead code that is already there. See B-04.

---

#### Fix guide — work top to bottom

Ordering rule: correctness first, then shared helpers other items depend on,
then missing sections by reader impact, then shape and copy.

---

##### B-01 — The invented date. `WRONG DATA`. **Do this first.**

**Cause.** `web/src/app/events/[id]/page.tsx:137-139`:

```ts
function formatFeeDeadline(value: string | undefined): string | undefined {
  return formatDate(value) ?? clean(value);
}
```

`formatDate` → `parseDate` (`web/src/lib/format.ts:16-23`). `parseDate` only
special-cases a bare `YYYY-MM-DD`; everything else goes to `new Date(iso)`.
V8's legacy date parser skips tokens it does not recognise and **defaults a
missing year to 2001**. Verified in this repo's Node:

```
new Date('Rate held until Feb 6')  -> Tue Feb 06 2001
new Date('Allow 3 weeks')          -> Invalid Date
```

`formatFeeDeadline` is called at two sites: the DEADLINE cell
(`page.tsx:535`) and inside `cheapestWayIn` (`page.tsx:191`), so the fabricated
year can also reach the top-of-report callout.

**Scope is wider than A found.** Plate 03's DEADLINE column is free text —
"Early bird ends Jan 9 · $620 after", "Open until the event", "Oct 30", "Apply
with your abstract", "Rate held until Feb 6", "Allow 3 weeks". **`"Oct 30"` is
also corrupted to `"Oct 30, 2001"`.** Nothing in that column carries a year, so
nothing in that column may print one.

**Why it does not fire on today's live data.** `event-details.ts`
normalises scraped fee deadlines to `YYYY-MM-DD` via `normalizeJobDate` before
storing them (`web/src/lib/opportunities/event-details.ts:167-183`), so
production rows are ISO today. It fires on cached, imported and hand-authored
rows — and it will fire on *every* row the moment the column carries what the
plate shows. Fixing it is a precondition for the rest of the cost-table work,
not an optional cleanup.

**Correct behaviour.** A fee deadline is source text, not a date value. Print
it verbatim. Format it **only** when the whole string is a machine date —
`/^\d{4}-\d{2}-\d{2}(T|$)/`. Anything else goes through `clean()` untouched.
**A deadline that carries no year must never acquire one.**

**Fix direction.** In `web/src/app/events/[id]/page.tsx`, guard
`formatFeeDeadline` with the ISO test before calling `formatDate`. Do not
change `parseDate` itself — it is shared by papers, jobs and the feed, and
tightening it globally is a much larger blast radius than this item needs.

**Risk.** `web/src/app/events/[id]/page.test.ts:127` asserts
`"$250 student rate · Early bird · by Apr 15, 2027"` from an ISO fixture
(`deadline: "2027-04-15"`). The ISO guard keeps that green. Add a new
assertion that a free-text deadline round-trips unchanged and never contains
"2001". `web/src/lib/format.test.ts:21-24` covers `parseDate("not-a-date")`
only — it does not cover a string with a date fragment inside it.

---

##### B-02 — Give `EventReport` a `nowMs` prop. `MISSING`. **Unblocks B-05 and B-09.**

**Cause.** `EventReport` (`web/src/app/events/[id]/page.tsx:806-846`) takes no
clock. `JobReport` already does (`web/src/app/jobs/[id]/page.tsx:396`,
supplied by `useState(Date.now)` at line 802). Plate 03 needs "92 days left"
under ABSTRACT DUE and a "Today" milestone; neither can be computed without one.

**Fix direction.** Add a required `nowMs: number` prop to `EventReport`,
supplied by `EventDetailPage` the same way the job page does it — a
`useState(Date.now)` captured once per mount. **Do not call `Date.now()` inside
the component**: every existing event report test renders through
`renderToStaticMarkup` with fixed fixtures and would become time-dependent.

**Risk.** `web/src/app/events/[id]/page.test.ts` has a single `renderReport`
helper (lines 25-55) — add `nowMs` there once and all 15 tests keep working.
Pick a constant like the job test's `NOW = Date.parse("2026-07-30T12:00:00Z")`.

---

##### B-03 — "Why Peer sent this to you", both reports. `MISSING`. (A: job 1, event 1)

**Cause.** Deleted by P10.4 in commit `cb3b9a8`. The event render block that
went is visible in `git show cb3b9a8 -- "web/src/app/events/[id]/page.tsx"`:
a `ReportSection title="Why Peer sent it"` printing `event.relevanceReason`
with `event.facetPreferenceReason` beneath. The job report's equivalent went in
the same commit. Neither `matchReason` nor `relevanceReason` nor
`facetPreferenceReason` is referenced in either page component now — A's grep
is correct, I re-ran it.

**Reversed by §1b Correction 2.** This is `MISSING`, not policy.

**The data already exists and is better than the deleted one-liner suggested.**

- `web/src/lib/jobs/scoring.ts:233-252` — `reasonFor` assembles
  `"Matches your <up to 3 matched topics> focus"` + `"fits a <career stage>
  profile"` + `"remote-friendly"`, joined with " · ".
- `web/src/lib/events/scoring.ts:101-121` — same shape, plus deadline distance
  in days and the rank string.
- `web/src/lib/preferences/ledger.ts:686-691` — `facetPreferenceReason` returns
  `"Because you often view <label>"`. That is the plate's "which you filtered
  toward 4 times this week" clause, minus the count.

**Fix direction.**

- Job: `web/src/app/jobs/[id]/page.tsx`, a `ReportSection` titled
  **"Why Peer sent this to you"** placed **after** the role/materials two-column
  grid (`page.tsx:620-662`) and **before** `TierUpgradeBlock`. Body = the
  paragraph from `job.matchReason`; append `job.facetPreferenceReason` as a
  second line when present. Hide the whole section when both are empty.
- Event: same heading, in `web/src/app/events/[id]/page.tsx` **after** "What it
  costs you" and **before** the locked block (per §1c). Body = the same, from
  `event.relevanceReason` / `event.facetPreferenceReason`.
- Both are Tier 0 blocks on the plate. Render them with no key configured.

**Substance gap to note, not to solve here.** The plate names the matched
topics, the career level, the region and the filtering count. `reasonFor`
currently supplies topics + career level; region and the count are not in the
string. Render what exists — do not pad it with invented specifics. If the
manager wants the plate's full sentence, that is a scoring-layer change and a
separate item.

**Risk.** Two job tests assert `not.toContain("Why Peer sent it")`
(`web/src/app/jobs/[id]/page.test.ts:104` and `:158`). The plate's heading is
**"Why Peer sent this to you"**, which does not contain that substring —
both assertions stay green *provided the heading is spelled the plate's way*.
Do not reuse the old "Why Peer sent it" wording. Line 104 sits in the sparse-job
test whose fixture has `matchReason: ""`, so the section correctly stays hidden
there anyway.

---

##### B-04 — The day-by-day plan. `MISSING`. (A: event 5)

**Reversed by §1b Correction 1.** The plate's definition is the whole spec:

> **A day-by-day plan for you** — Which sessions to attend and who to find, in order.

Specific sessions and specific people, ordered. **Not day names.** The old
implementation restated the day's own name and was rightly judged worthless;
rebuilding it as it was is not the fix.

**Cause — exactly what was removed, across two commits.**

`cb3b9a8` (`web/src/lib/opportunities/enrichment.ts`):

- the type member
  ```ts
  dayPlan?: Array<{ day: string; items: string[] }>;
  ```
- the caps `MAX_EVENT_PLAN_DAYS = 3`, `MAX_EVENT_PLAN_ITEMS_PER_DAY = 4`
- the prompt rule, whose verbatim clause is the part worth keeping:
  > "Every item must be either an exact title also returned in talkSummaries or
  > an exact name from unjudgedAttendees. Never use any other page speaker name,
  > abstract, or description."
- the parser block, which filtered each item through
  `verifiedTalkTitles` / `acceptedPlanAttendeeNames`
- the `hasEventEnrichment` clause

`cb3b9a8` (`web/src/app/events/[id]/page.tsx`): the render — a
`ReportSection title="A day-by-day plan"` with an `<h3>` per day and a numbered
`<ol>` of items.

`93f1b8e` (`web/src/app/events/[id]/page.tsx`): the locked-block promise
`{ title: "A day-by-day plan", description: "Order the sessions and people that
best match your declared priorities." }`.

**What survived and must be reused.** `parseEventEnrichment` still builds both
validation sets and never reads them:

```
enrichment.ts:622   const verifiedTalkTitles = new Set<string>();
enrichment.ts:623   const acceptedPlanAttendeeNames = new Set<string>();
enrichment.ts:660     acceptedPlanAttendeeNames.add(normalizeVerbatim(attendee.name));
enrichment.ts:706     verifiedTalkTitles.add(normalizeVerbatim(talk.title));
```

`enrichment.ts:602-607` still asks the model for a `dayPlan` in `outputSchema`
with no rule and no parser behind it. So the plumbing is half-standing.

**Fix direction — rebuild to the plate, not to the old shape.**

1. **Type** (`enrichment.ts`, `EventEnrichment`): a flat **ordered list**, not a
   day-keyed map. Something shaped like
   `plan?: Array<{ kind: "session" | "person"; label: string; when?: string }>`.
   Ordering is the feature; a `day` field is what made the old one restate day
   names. If a `when` exists it comes from the already-verified talk `when`.
2. **Prompt rule**: restore the deleted rule's verbatim clause **unchanged** —
   every entry must be an exact `talkSummaries` title or an exact
   `unjudgedAttendees` name. Change only the framing: ask for an ordered
   walk-through of the event, not a per-day grouping. Cap it (4-8 entries).
3. **outputSchema**: replace the stale `dayPlan` block at `enrichment.ts:602`
   with the new field. Do not leave both.
4. **Parser**: reinstate the filter using `verifiedTalkTitles` and
   `acceptedPlanAttendeeNames` — they are already populated, in the right order,
   at the right point in the function. Drop any entry that matches neither. If
   nothing survives, omit the field. **This is the Phase 9 §5.4 verbatim rule
   and it is what makes the plan unable to invent a session.**
5. **`hasEventEnrichment`**: add the new field back to the boolean.
6. **Render** (`events/[id]/page.tsx`): a `ReportSection` titled **"A day-by-day
   plan for you"**, an ordered list, each row = the session title or person
   name, plus the verified time when present. Place it in the enriched flow with
   the other AI sections.
7. **Locked-block promise** (`EVENT_TIER_UPGRADE_ITEMS`): restore as item 3 of
   4, with the plate's exact copy — title **"A day-by-day plan for you"**,
   description **"Which sessions to attend and who to find, in order."**

**Cache.** `ENRICHMENT_CACHE_STORAGE_KEY` is at `v4` (`enrichment.ts:97`) and
the comment there records why it was bumped: a shape change shipped against a
seven-day cache and the report crashed on old entries. Adding a field is
additive and safe, but the render must still tolerate a cached entry that lacks
it. Follow the pattern in the `posterFit` tests
(`web/src/app/events/[id]/page.test.ts:404-437`).

**Risk — five assertions state the current contract and must be rewritten, not
deleted:**

- `web/src/app/events/[id]/page.test.ts:215-217` — comment "P10.3 deleted the
  day-by-day plan" and `expect(html).not.toContain("A day-by-day plan")`
- `web/src/lib/opportunities/enrichment.test.ts:717-718` —
  `expect("dayPlan" in prompt.rules).toBe(false)`
- `enrichment.test.ts:841` and `:862` — `expect("dayPlan" in (parsed ?? {})).toBe(false)`
- `enrichment.test.ts:881` — test named "keeps quoted titles or supplied names
  and **emits no day plan**"

Per §2, rewrite each assertion to state the new contract and comment which item
changed it. Lines 841 and 862 are the ones that matter most — they assert the
plan is not emitted when the talk cap trims a title. The rebuilt parser must
keep that behaviour: **a plan may not reference a talk the cap dropped.**

---

##### B-05 — Event facts row: six tiles with sub-lines. `MISSING`. (A: event 6) — needs B-02

**Cause.** There is no tile row. `web/src/app/events/[id]/page.tsx:926-948`
renders a two-cell When/Where grid inside `<header>` and nothing else. `FEE`,
`ABSTRACT DUE`, `REGISTER BY` survive further down; **`SCALE` appears nowhere** —
`event.expectedSize` is declared at `web/src/types/index.ts:148` and written by
nothing. I grepped the whole tree: the mapper
(`web/src/lib/events/mapper.ts:120-153`) never sets it.

**Plate 03's six tiles, verbatim:**

| Label | Value | Sub-line |
|---|---|---|
| DATES | Mar 8 – 11, 2027 | Mon – Thu |
| WHERE | San Diego, US | in person · hybrid keynotes |
| FEE | $480 | student $180 · early bird to Jan 9 |
| ABSTRACT DUE | Oct 30 | 92 days left |
| REGISTER BY | Feb 20 | on-site registration available |
| SCALE | ~2,400 | last edition |

**Fix direction.** Replace the When/Where grid with a tile row shaped like the
job report's `FactTile` (`jobs/[id]/page.tsx:270-294`) extended with a second
line — see B-06, build the shared shape once. Date copy: the plate collapses a
range to `"Mar 8 – 11, 2027"`; the build prints
`formatDate(date, "full") + " · " + formatDate(endDate)` at
`events/[id]/page.tsx:934-935`, which yields "Monday, March 8, 2027 · Mar 11,
2027". Add a range formatter (same month → one month name, one year).
"92 days left" uses `daysUntil` + `formatDayDistance` from
`web/src/lib/format.ts:83-105` with the `nowMs` from B-02.

**`SCALE` is dead in production.** Tell the manager rather than faking it:
render the tile only when `expectedSize` is set, and note that until the mapper
populates it the tile will never appear on a real event. Populating it is an
extraction change (`event-details.ts`), out of scope for this loop.

**Risk.** No test asserts the When/Where grid by name. Several assert dates
appear somewhere in the HTML, which a tile row still satisfies.

---

##### B-06 — Job facts row: seven tiles, sub-lines, two countdowns. `WRONG SHAPE`. (A: job 4)

**Cause.** `buildJobFacts` (`web/src/app/jobs/[id]/page.tsx:147-182`) returns at
most six facts and `JobFact` has no field for a second line
(`page.tsx:84-89`). `LOCATION` is only built when `job.isRemote` is true
(`page.tsx:168-170`, labelled "Work mode" / "Remote"), so a non-remote job gets
no location tile at all. `visa` is in the `JobFactKey` union (`page.tsx:81`) but
no `visa` entry is ever pushed — the visa state is shown only as a header chip.

**Plate 02's seven tiles:** SALARY `$95k – $120k` / "per year · from posting";
TYPE `Postdoc` / "Full-time · 3-yr contract"; LOCATION `Los Altos, CA` /
"Hybrid · US"; STARTS `Jan 2027` / "flexible"; APPLY BY `Sep 15` /
**"47 days left"**; POSTED `Jul 22` / **"8 days ago"**; VISA `Sponsors` /
"stated in the posting".

**Fix direction.** Add an optional `detail?: string` to `JobFact`, render it as
a third line in `FactTile`, and fill it per tile:

- SALARY — value drops the period suffix that `formatSalary` appends
  (`web/src/lib/opportunities/salary.ts`, final line returns `"$95k–120k / yr"`);
  detail = "per year" + ("estimated" when `salaryIsEstimated`, else "from
  posting").
- TYPE — relabel "Employment" → **"TYPE"**; value = `ROLE_LABELS[job.roleKind]`;
  detail = `employmentType` + `contractLength`.
- LOCATION — **new tile, always when `job.location` exists**, not only when
  remote. Detail = "Remote" when `isRemote`. `Job` has no hybrid state
  (`web/src/types/index.ts:175-224` has only `isRemote`), so the plate's
  "Hybrid · US" cannot be reproduced — print what exists.
- APPLY BY / POSTED — details are the two countdowns, from `daysUntil` +
  `formatDayDistance` and `formatDayAge` in `web/src/lib/format.ts`, using the
  `nowMs` prop the component already receives.
- VISA — **new tile** from `job.visa.state`, with the existing `visaTone`
  (`page.tsx:139-145`) for colour; detail = "stated in the posting" when
  `visa.evidence` exists.

**Risk — four assertions break, all in `web/src/app/jobs/[id]/page.test.ts`:**

- `:141` `expect(html.match(/data-job-fact=/g)).toHaveLength(6)` — becomes 8 for
  that fixture (adds LOCATION and VISA)
- `:142` `expect(html.match(/Sponsorship available/g)).toHaveLength(1)` — a VISA
  tile makes it 2 unless the tile uses the plate's shorter value ("Sponsors")
- `:143` `expect(html).not.toContain('data-job-fact="visa"')` — directly reverses
- `:93` `toHaveLength(2)` and `:105` `not.toContain("Visa")` in the sparse-job
  test — that fixture has no `visa` and no `location`… **but it does have
  `location: "Chicago, IL"` from `baseJob`**, so a LOCATION tile appears and
  `:93` becomes 3. Rewrite it to 3.

The test at `:110` is already named "renders all seven supported facts" while
asserting six — the rename is overdue.

---

##### B-07 — "Every other organisation attending · 31" and "Every other speaker · 16". `MISSING`. (A: event 2, 3)

**Cause.** `RosterSection` (`web/src/app/events/[id]/page.tsx:574-804`) splits
each roster into a card list and a plain list with `.filter(...)` at lines
660-661 and 700-701, but both halves live under the **same** `<h3>` —
"Organisations" (`:655-657`) and "People" (`:728`). There is no second heading,
no count, no filter input and no explainer. `StarButton` (`:546-572`) is already
on every row, so only the frame is missing.

**Plate 03 wants, for each tail:** its own heading with a live count, a
"Filter this list" input, a `★` column header, the explainer

> Star anyone Peer got wrong. It moves to the top here, and every future event
> highlights them automatically.

and a closing footnote — orgs: "Nothing is collapsed behind a '+29' — Peer's
guess about what matters to you is not good enough to hide anything."; speakers:
"Full name, role and institution for everyone, pulled from the event's own
speaker page. Nobody is collapsed."

**Fix direction.** One local component used twice — heading + count + filter
input + explainer + rows + footnote — parameterised by title, count, explainer
and footnote. Count = the plain-list length, computed live so it tracks
starring. The filter input needs local state; keep it inside that component so
`EventReport` stays a pure render.

**Risk.** `web/src/app/events/[id]/page.test.ts:83-101` asserts 30
`data-roster-row="organisation"` and `not.toMatch(/show more|collapsed/i)`.
The word **"collapsed"** appears in both plate footnotes — that assertion will
fail on correct copy. Rewrite it to assert the plate's sentences are present and
that no row is hidden, which is what it was actually protecting.

---

##### B-08 — Event section order. `WRONG ORDER`. (A: event 4)

**Cause.** `EventReport`'s JSX order (`web/src/app/events/[id]/page.tsx`):
cheapest callout `:964` → `DeadlineTimeline` `:965` → **"What it costs you"
`:967-971`** → "What actually happens there" `:973-1004` → `RosterSection`
`:1007` → talks `:1016` → poster fit `:1067` → locked block `:1097`.

§1c's plate order: cheapest → two deadlines → what actually happens there →
who'll be in the room → **what it costs you** → why Peer sent this → locked
block.

**Fix direction.** Move the "What it costs you" block from `:967` to sit
**after** `RosterSection` and **before** the "Why Peer sent this to you" section
from B-03. Note the layout constraint: `RosterSection` deliberately sits outside
the `max-w-[720px]` wrapper (`:1005-1015`) so the roster runs full-width. Moving
the cost table means opening a new `max-w-[720px]` wrapper after it — the file
already does exactly this at `:1015`, so follow that pattern.

**Risk.** `web/src/app/events/[id]/page.test.ts:132-134` asserts the cheapest
line precedes "Submit by". Both stay at the top, so it holds. No test asserts
the cost table's position. The talks/poster-fit order test at `:208-216` is
unaffected.

---

##### B-09 — "Two deadlines, one event": no heading, 3 points not 4, no Today. `WRONG SHAPE`. (A: event 7) — needs B-02

**Cause.** Two separate gaps.

- `DeadlineTimeline` is rendered bare at `web/src/app/events/[id]/page.tsx:965`
  — `<DeadlineTimeline milestones={milestones} />` with no `ReportSection`
  wrapper, so no heading is emitted at all. Every other block on the page is
  wrapped; this one was missed.
- `deadlineMilestones` (`page.tsx:209-237`) builds only submission /
  registration / event. There is no "Today" point, even though the job
  report's `buildTimeline` (`jobs/[id]/page.tsx:184-206`) has one and accents it.

**Fix direction.** Wrap the call in `<ReportSection title="Two deadlines, one
event">`. Add a `today` milestone to `deadlineMilestones`, first, accented,
using the `nowMs` from B-02 — mirror `buildTimeline` exactly so the two reports
agree. Relabel `"Submit by"` → **`"Abstract"`** per the plate, and drop the
`sm:grid-cols-3` at `:452` to a 4-column grid.

**Risk.** `page.test.ts:132-134` uses `html.indexOf("Submit by")` as the anchor
for the ordering assertion — relabelling breaks it. Repoint it at the new
heading, which is a better anchor anyway.

---

##### B-10 — "Skills they ask for": chips, footnote, junk guard. `WRONG SHAPE` + `MISSING`. (A: job 2, 3, 7)

**Cause — the render.** `web/src/app/jobs/[id]/page.tsx:553-618`. Heading is
`"Skills and profile gaps"` (`:554`). A `role="progressbar"` div at `:555-567`
that the plate does not have. The count line at `:568-572` reads "N of M
requirements match terms in your profile". Then a `md:grid-cols-2` split at
`:573` with sub-headings "Matched in your profile" / "Not matched in your
profile" and two `<ul>`s carrying `✓` and `○` glyphs.

**Cause — the junk.** `skillComparison` (`page.tsx:220-245`) only trims and
de-duplicates. Upstream, `keyRequirements` in `web/src/lib/jobs/mapper.ts:51-68`
takes `item.tags` verbatim, filtered only by `length > 0 && length <= 60`. So
"tesla.com", "Apply now" and "Sign in" reach the field intact and print as
skills the reader is missing. A's repro is correct.

**Plate 02 wants:** heading **"SKILLS THEY ASK FOR"** with `NEW` and `TIER 0`
badges; the line **"6 of 9 you already have"**; **one flat wrapping row of
chips** — matched ones highlighted with a trailing `✓`, gaps plain, same row;
then the footnote

> Highlighted chips come from your Required and Explore topics plus your project
> text. The plain ones are the gaps — worth seeing before you spend an evening on
> the application.

**Fix direction.**

1. Rename the heading to the plate's. Add `NEW` / `TIER 0` badges — a small
   local badge span; nothing shared exists yet.
2. Delete the progress bar outright. §5.1 say-it-once: the count line already
   states the ratio.
3. Change the count copy to "N of M you already have".
4. Replace the two-column split with one wrapping chip row over
   `[...matched, ...unmatched]` in that order, matched chips accented with a
   trailing `✓`. Keep the `data-skill-requirement="matched" | "unmatched"`
   attributes — several tests key off them and they are the only machine-
   readable signal of which chip is which.
5. Add the footnote paragraph under the chips.
6. **Junk guard.** Put it at the report layer inside `skillComparison`, not
   upstream — `item.tags` feeds cards, search and the preference ledger, and
   tightening it there changes ranking. Reject a requirement that looks like
   site chrome: contains a URL or bare domain, is a known call-to-action
   ("apply now", "sign in", "register", "log in", "view job", "share", "save
   job", "back to results"), or is a single word that is a nav verb. Return
   `null` from `skillComparison` when nothing survives so the section hides
   rather than printing an empty chip row.

**Risk — five assertions in `web/src/app/jobs/[id]/page.test.ts`:**

- `:145-146` `toContain('role="progressbar"')` and `aria-valuenow="67"` — both
  removed with the bar
- `:151`, `:202`, `:216` — the heading string "Skills and profile gaps"
- `:203` — "0 of 2 requirements match terms in your profile"
- `:205-206` — `data-skill-requirement="unmatched"` count of 2 (survives if the
  attributes are kept)

Add a new test for the junk guard using A's fixture (`["web job listing",
"tesla.com", "Apply now", "Sign in", "Solid-state electrolytes", "careers
page"]`) asserting that only the real skill renders.

---

##### B-11 — "Cheapest way in, for you": the wording. `WRONG SHAPE`. (A: event 8)

**The duplication is not a defect — see finding 2 above. Keep both sites.**

**Where the wording is generated.** `cheapestWayIn`
(`web/src/app/events/[id]/page.tsx:160-207`), the return at `:198-204`:

```ts
text: `${selected.value} ${tierLabel} · ${selected.fee.label}${
  cutoff ? ` · by ${cutoff}` : ""
}`,
```

**The two render sites.**

- `CheapestCallout` — `page.tsx:432-443`, rendered at `:964`, directly under the
  header. This is plate 03's top block. **Survives.**
- `CostsTable`'s header row — `page.tsx:494-498`, `<strong>Cheapest way in, for
  you:</strong> {cheapest.text}`. This is plate 03 page 8's line. **Also
  survives**, but the plate's version there is *shorter* than the top one.

**What the plate prints.**

- Top: "Student ticket in person before Jan 9, with a travel grant — $180,
  applied for alongside the abstract you were going to write anyway."
- Table head: "Cheapest way in for you: student ticket in person before Jan 9,
  with a travel grant — $180."

**Three defects in the generated string.**

1. It is field-concatenation, not a sentence: "$180 student rate · Registration,
   in person · by Early bird ends Jan 9 · $620 after". The " · by " prefix
   glued onto a free-text deadline is where "by Early bird ends Jan 9" comes
   from — B-01's guard makes that visible, it does not fix it.
2. **It ends by quoting the higher price.** "$620 after" is the tail of the
   deadline string. The one line whose job is to name the cheapest way in
   finishes with the most expensive number on the page.
3. **It never mentions the travel grant**, though `event.travelGrant` is read
   two lines away at `page.tsx:879`.

**Fix direction.** Return structured parts from `cheapestWayIn` — price, tier
word, what it buys, the cutoff, and whether a travel grant applies — and
assemble a sentence at each render site: the long form up top, the short form
in the table head. Take only the date-ish head of a compound deadline for the
"before X" clause; never paste a clause containing a second price.

**Risk.** `web/src/app/events/[id]/page.test.ts:126` asserts
`toHaveLength(2)` — **keep this assertion, it encodes the plate.** `:127`
asserts the exact mechanical string and must be rewritten to the new sentence.

---

##### B-12 — "What actually happens there": chips and footnote. `WRONG SHAPE` + `MISSING`. (A: event 9, 10)

**Cause.** `web/src/app/events/[id]/page.tsx:978-989` maps every activity
through `formatEventType` (`page.tsx:131-135`), which strips hyphens and
title-cases every word. All six chips get identical plain `tag` styling — no
`✓`, no highlight. There is no footnote.

**Correction to A's item 9.** `formatEventType` mangling prose is real but does
not fire on live data. `activities` in production is a **fixed lowercase
vocabulary** produced by `extractActivities`
(`web/src/lib/opportunities/event-details.ts:26-66, 311-331`): "poster session",
"workshop", "tutorial", "panel", "career fair", "exhibition", "keynote",
"plenary", … Title-casing those is correct. A's fixture used plate-style prose
("Symposium: solid-state interfaces"), which the extractor never emits.

So there are two separate things here:

- **Real bug:** `formatEventType` is an enum humaniser applied to a field that
  may carry prose from cached or model-supplied data. Restrict it to
  single-token-ish labels, or only capitalise the first letter.
- **Real parity gap that C cannot close alone:** the plate's chips are specific
  session names; the build's vocabulary is generic labels. Flag it; do not
  invent richer chips.

**Fix direction for the highlight.** Plate 03 marks three of six with `✓`
"because they line up with your topics". `EventReport` already has
`context.declaredTopics` in scope (`page.tsx:850-855`, built by
`EventDetailPage` at `:1221-1247` from research topics + Required + Explore).
Match each activity against `event.matchedTerms` and `context.declaredTopics`;
matched chips get the accent style and a trailing `✓`. Then add the footnote —
it only makes sense once something is highlighted:

> Highlighted because they line up with your topics and because you're a PhD 4
> looking at industry — the poster call and the recruiting fair are the two you'd
> be sorry to miss.

The career-stage clause needs `careerStage`, which `EventReport` already
receives (`page.tsx:808`). Generalise the sentence; do not hardcode "PhD 4".

**Risk.** `page.test.ts:333-368` renders `activities: ["tutorial"]` and asserts
the generic talk-definition guard — unaffected by chip styling.

---

##### B-13 — Costs-table footnote. `MISSING`. (A: event 11)

**Cause.** `CostsTable` (`web/src/app/events/[id]/page.tsx:485-544`) ends at
`</table>`. No footer.

**Plate:** "Full price with no grant would be $620 plus four nights. The gap
between the two is the reason this line sits at the top of the report."

**Fix direction.** Add a footer paragraph inside the bordered container. The
first sentence is derived (highest standard price + nights) and only renders
when both numbers exist; the second sentence is static and explains why the
cheapest line is repeated at the top — which is exactly the justification for
keeping B-11's duplication. Nights are not a field on `Event`, so render the
grant-vs-full gap only, and drop the "plus four nights" clause rather than
inventing it.

**Risk.** None — no test touches the table footer.

---

##### B-14 — Roster heading copy and the counts line. `WRONG SHAPE`. (A: event 12)

**Cause.** `RosterSection` builds `rosterLabel`
(`web/src/app/events/[id]/page.tsx:641-646`) as "Organisations and people at the
event" / "Organisations at the event" / "People at the event", then appends
` · ${judgedCount} judged` at `:650`.

**Plate:** heading **"Who'll be in the room"**, sub-line **"5 of 34 exhibitors
and 3 of 18 speakers concern you"** — how many matter to *you*, not how many the
model processed. `ORGANISATIONS` and `PEOPLE` sub-headings carry `TIER 0` badges.

**Fix direction.** Fixed heading "Who'll be in the room". Replace the "· N
judged" suffix with the plate's counts line: matched-with-a-reason over total,
for each of the two groups. Both numbers are already computed inside the
component — the `.filter(({ reason, starred }) => reason || starred)` at `:660`
and `:730` gives the numerator, `organisations.length` / `people.length` the
denominator. Add `TIER 0` badges to the two `<h3>`s (same badge component as
B-10).

**Risk — three assertions in `web/src/app/events/[id]/page.test.ts`:**

- `:99` `toContain("Organisations at the event")`
- `:100` `not.toContain("attendees")` — safe, the plate says "exhibitors"
- `:208` `html.indexOf("Organisations at the event · 1 judged")` — this is the
  ordering anchor for the AI-sections test; repoint it at the new heading

---

##### B-15 — Header chips: the rank chip is missing. `MISSING`. (A: event 14)

**Cause.** `web/src/app/events/[id]/page.tsx:916-922` renders exactly three
chips: `formatEventType(event.type)`, online/in-person, match %. `event.rank`
is set by the mapper (`web/src/lib/events/mapper.ts:146`) and read by **nothing**
in the report.

**Fix direction.** Add a `HeaderChip` for `event.rank` between the format chip
and the match chip, per §1c's order. Guard on presence — most events have no
rank.

**The plate's "+ career fair" has nowhere to live.** `Event.type` is a single
`EventType`; there is no secondary kind on the type
(`web/src/types/index.ts:131-164`). Do not synthesise one.

**Observation for the manager, not a fix.** §1c lists an online/in-person chip
in the header, and it is authoritative so C should keep the existing chip. But
the PDF's chip row on plate 03 reads only "Industry summit / + career fair /
CCF-B / 88% match" — "in person" appears in the subtitle and in the WHERE tile
sub-line, not as a chip. Manager's call; low stakes either way.

---

##### B-16 — Event subtitle and the abstract button. `MISSING`. (A: event 15)

**Cause.** There is no subtitle element at all — the When/Where grid at
`page.tsx:926-948` sits where the plate's subtitle goes. `EventActionRow`
(`:336-411`) renders **one** primary link (`primaryHref` / `primaryLabel`,
chosen at `:865-870`) plus two `CompletionPill`s and the feedback pair.

**Plate:** subtitle "San Diego Convention Center · in person, streamed keynotes
· 4 days" — venue · format · duration. Two primary links: **"Register ↗"** and
**"Submit abstract ↗"**.

**Fix direction.** Add a subtitle `<p>` under the `<h1>`, joining venue
(`event.location`), format (online / in person, plus a hybrid note when one
exists) and duration (computed from `date` → `endDate`; the day count is
derivable, unlike "streamed keynotes" which is not a field). Once B-05 moves
When/Where into the tile row, the grid comes out and the subtitle takes its
place. For the second button: the abstract link is not a distinct field —
`linkRegistration` and `linkOfficial` are all there is
(`web/src/types/index.ts:153-154`). Render "Submit abstract ↗" only when
`event.deadline` exists and point it at the official site; do not fabricate a
second URL.

**Risk.** `page.test.ts:152-153` asserts `">Registered<"` and `">Submitted<"`
pills exist — leave both pills in place. `:58-81` asserts exactly one action row
and one feedback pair — a second link inside the same row keeps that true.

---

##### B-17 — "To apply, have ready": 3 of 4 labels have no field. `WRONG SHAPE` + data gap. (A: job 6)

**Cause.** `web/src/app/jobs/[id]/page.tsx:644-660` renders an unlabelled `<ul>`
over `distinct(job.applicationMaterials)`. Plate 02 has four **labelled** rows:
MATERIALS / ELIGIBILITY / TEAM / SEEN ON.

**Only MATERIALS has a field.** `Job` (`web/src/types/index.ts:175-224`) has
`applicationMaterials` and `sourceId` — nothing for eligibility or team.

**Fix direction.** Convert the `<ul>` to a definition-list shape with a label
column so MATERIALS is labelled correctly and the other rows can appear when
their data arrives. Add **SEEN ON** now — `job.sourceId` is populated by the
mapper (`web/src/lib/jobs/mapper.ts:144`) and is exactly the plate's "Adzuna ·
reposted from employer site" slot. Leave ELIGIBILITY and TEAM out: adding fields
to `Job` plus extraction for them is a separate piece of work, and the plate's
own rule is that absent fields hide rather than show empty.

**Risk.** None found — no test asserts the materials markup.

---

##### B-18 — Job action row and subtitle copy. `WRONG SHAPE`. (A: job 8)

**Cause.** `JobActionRow` (`web/src/app/jobs/[id]/page.tsx:323-386`): the apply
link's label is `"Apply"` at `:357`; `CompletionPill label="Applied"` at `:374`;
`OpportunityFeedbackPair` at `:379` renders both "Interested" and "Not
interested". The subtitle at `:480-486` joins company and location only.

**Plate:** "Apply on employer site ↗", "✓ Mark as applied", **one** feedback
control ("Not interested"), and a three-segment subtitle "Toyota Research
Institute · Los Altos, CA · Hybrid (3 days on-site)".

**Fix direction.** Relabel the link and the pill. The third subtitle segment is
a work mode `Job` does not have — only `isRemote` — so print "Remote" when true
and stop there.

**The Interested/Not-interested pair is `POLICY — manager decides`.** The pair
is a deliberate shared control (`web/src/components/opportunities/feedback-pair.tsx`)
used on both reports, and two tests assert both buttons exist
(`jobs/[id]/page.test.ts:71-72`, `events/[id]/page.test.ts:79-80`). Dropping
"Interested" to match the plate would remove a working preference signal from
both reports. Listed again in the POLICY section below.

**Risk.** `jobs/[id]/page.test.ts:188` asserts `">Applied<"` — "✓ Mark as
applied" breaks it. Rewrite. `events/[id]/page.test.ts:152-153` asserts the
event pills, unaffected.

---

##### B-19 — Visa quote loses its attribution. `MISSING`. (A: job 9)

**Cause.** `web/src/app/jobs/[id]/page.tsx:508-512` renders the blockquote with
the quote and nothing else. Plate 02 closes it with "— from the job
description".

**Fix direction.** Add the attribution line inside the blockquote. Note the
enriched-state suppression at `:508` (`&& !enrichment?.sponsorshipRead`) is
correct say-it-once behaviour and A agreed — leave it.

**Risk.** `jobs/[id]/page.test.ts:144` asserts the quote text is present;
appending an attribution keeps that true.

---

##### B-20 — Locked-block copy, both reports. `WRONG SHAPE`. (A: job 5, and the event equivalent)

**Cause.** `JOB_TIER_UPGRADE_ITEMS` (`web/src/app/jobs/[id]/page.tsx:34-50`) and
`EVENT_TIER_UPGRADE_ITEMS` (`web/src/app/events/[id]/page.tsx:45-61`).

**Plate 02's four, verbatim:**

1. How competitive this actually is — "Reads the requirements against your
   CV-level profile and says where you'd stand." → **absent.** `POLICY`, see below.
2. Sponsorship read when the posting is silent — "Judges this employer's track
   record instead of leaving it at 'not stated'." → present, **wrong description**.
3. The role in three clean sentences — "Rewritten from the posting rather than
   the posting's own best sentences." → **absent.** `POLICY`, see below.
4. What to emphasise in your application — "Which of your papers and methods to
   lead with, given this team's work." → present, **wrong description**.

Build's extra third item "What this employer actually asks for" is not on the
plate. `POLICY`.

**Plate 03's four, verbatim:**

1. The other 29 exhibitors, judged — "Reads the full list and tells you which
   strangers are worth your day." → build has "Organisations and people, judged"
   / "Show which unfamiliar people and organisations are worth your time."
2. What each talk is actually about — "Reads the programme abstracts, not just
   the session titles." → build has different copy.
3. A day-by-day plan for you — "Which sessions to attend and who to find, in
   order." → **absent**, restored by B-04.
4. Is your work a fit for the poster call — "Compares the call's scope against
   your project and says yes or no." → build has different copy. **"says yes or
   no" conflicts with Phase 10 §5.3** ("Peer presents, the user judges"). Keep
   the build's non-verdict description; flagged below.

**Fix direction.** Update descriptions 2 and 4 on the job report and 1 and 2 on
the event report to the plate's wording. The event's item 1 count ("The other 29
exhibitors") is live data, not a constant — either make the title dynamic from
the plain-list length or use a neutral title without a number. Do not print a
hardcoded 29.

**Risk.** None. `web/src/components/reports/tier-upgrade-block.test.tsx` renders
its own two-item fixture, not the page constants, so editing the constants
touches no assertion. The event report's locked-block item count is asserted
nowhere either.

---

#### `POLICY — manager decides` — six items, not touched

I am not recommending a reversal on any of these.

**P-1. Job locked block: "How competitive this actually is."** On plate 02 as
promise 1. Deleted by P10.6 (`cb3b9a8`) under Phase 10 §5.3 "Peer presents, the
user judges". §1b keeps the *rendered* verdict deleted but is silent on the
locked-block *promise*, which is a different thing. Restoring the promise while
the feature stays deleted would advertise something Peer will not do.
`jobs/[id]/page.test.ts:273` asserts its absence.

**P-2. Job locked block: "The role in three clean sentences."** On plate 02 as
promise 3. P10.2 merged the feature into "What the role is".
`jobs/[id]/page.test.ts:274` asserts its absence.

**P-3. Two extra job sections in the enriched state** — "What this employer
actually asks for" (`jobs/[id]/page.tsx:664-680`) and "What the person would
actually do" (`:682-698`). Neither is on plate 02. Both are Phase 9's
quoted-specifics feature, ordered by
`jobs/[id]/page.test.ts:263-272`. Deleting them removes the verbatim-quoting
work Phase 9 delivered.

**P-4. The event report's description paragraph.** A listed the lead paragraph
in "What actually happens there" (`events/[id]/page.tsx:975-977`) as extra, and
plate 03 genuinely has no prose block anywhere — chips and a footnote only.
But that paragraph is where `resolveEventReportDescription` and the Tier 1/2
`condensedDescription` land. Deleting it deletes the event description feature
outright, Tier 0 and Tier 1/2, and breaks
`events/[id]/page.test.ts:370-401`. Too big to fold into a parity fix.

**P-5. The "Interested" control.** Plate 02 and 03 both show only "Not
interested"; the build renders a pair via the shared
`OpportunityFeedbackPair`. Removing it drops a live preference signal from both
reports and breaks four assertions. See B-18.

**P-6. Travel grant and invitation letter printed twice.** A's event extra (b).
The build prints them as prose in "What actually happens there"
(`events/[id]/page.tsx:990-1002`); plate 03 has both as **rows in the cost
table** ("Travel grant / — / 30 available / Apply with your abstract"; "Visa
invitation letter / On request / On request / Allow 3 weeks") and nowhere else.
Moving them means synthesising table rows from `event.travelGrant` /
`event.invitationLetter`, which are not `EventFee`s. That is a shape decision,
not a copy fix.

**Also for the manager, not a policy conflict:**

- Phase 10 §5.5 states the day plan's only purpose was talk times and that "the
  fix belongs in the list itself". §1b Correction 1 supersedes that. The `when`
  field on talks is additive and should stay; B-04 does not undo it.
- `event.expectedSize` is declared but never populated by any mapper, so the
  plate's SCALE tile cannot appear on real data. See B-05.
- `Job` has no hybrid work mode and no eligibility/team fields; `Event` has no
  secondary kind and no abstract-specific URL. Four plate elements therefore
  cannot be fully reproduced without type and extraction changes. Named in
  B-06, B-15, B-16 and B-17.

---

#### Notes for C

- **Test files that will need assertion rewrites, in one place:**
  `web/src/app/jobs/[id]/page.test.ts` (B-03, B-06, B-10, B-18),
  `web/src/app/events/[id]/page.test.ts` (B-01, B-02, B-04, B-07, B-09, B-11,
  B-14), `web/src/lib/opportunities/enrichment.test.ts` (B-04, three
  assertions). `web/src/components/reports/tier-upgrade-block.test.tsx` needs
  nothing — it uses its own fixture items.
- **Do not delete a test to make a change pass** (§2). Rewrite the assertion to
  state the new contract and comment which B-item changed it.
- **B-01 and B-02 come first** because B-05, B-09 and B-11 all depend on them.
  Everything after B-04 is independent and can be reordered if something blocks.
- **Two shared shapes are worth building once** rather than four times: the
  fact tile with a sub-line (B-05 and B-06), and the small `NEW` / `TIER 0`
  badge (B-10 and B-14).
