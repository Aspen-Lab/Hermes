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
ROUND:            3
WHOSE TURN:       B  (round-3 fix guide, items B3-01 ..)
STATUS:           ROUND-3 MEASUREMENT COMPLETE — 16% different (84% matched).
                  Run by the MANAGER, not an A subagent: four agents in a row
                  died on the account spend limit or a 600s stall. See §4
                  "Round 3" for why that makes this round less independent.
LAST DIFFERENCE:  16%   (13 differences: 5 job, 8 event — full ranked list in
                  §4 under "Round 3")
GATE (0%):        NOT MET

NEW FOR A:        **From round 4, A must ALSO measure against real search
                  results — at least 3 real events and 3 real jobs, run
                  through the current build's own pipeline, each rendered and
                  compared to the plate.** Set by the user on 2026-08-05:
                  rounds 1–3 all measured one hand-built maximal fixture per
                  report, so a fix can score perfectly there and still fail on
                  most of what a reader actually sees. Full instructions and
                  the exact pipeline entry points are in §2 under Agent A.

NEW RULING:       **§1g Ruling 19 REVERSES §1f Ruling 17.** Exclusion (j) is
                  withdrawn — `Summit` → `Industry summit` IS closable. Plate
                  04 defines it as the spec's display label for the `summit`
                  kind, the same way `Academic conference` labels `conference`.
                  Three rounds missed it because every brief scoped the
                  evidence to plates 02 and 03. **§1g adds two binding rules
                  for round 4: A reads the whole PDF once per loop, and a "no
                  honest source" claim must say where it looked.**

OPEN POLICY:      **Both resolved — see §1h. Asked the user directly, and
                  the two went opposite ways:**
                  (1) STARTS tile's `flexible` sub-line — **RULED IN (Ruling
                  20). B must guide it.** Follows the `workMode` (B2-06)
                  pattern: additive, optional, never a guess when the posting
                  is silent. Likely posting-text extraction, not an
                  aggregator field — see §1h for the `visa.ts` vs `jobWorkMode`
                  precedent comparison B should check first.
                  (2) both reports' "Why Peer sent this to you" closing
                  clauses — **RULED OUT (Ruling 21), permanently excluded as
                  items (k) and (l). B must NOT guide these.**

DONE:      B2-01 .. B2-18, all eighteen, each with its own commit and its own
           §4 log entry. Split across two C's: the first did B2-01..B2-08 and
           stalled at 600s committing B2-08 (nothing lost — it had committed
           per item, exactly why that rule exists); this second C resumed at
           B2-09 and finished B2-09..B2-18. B's guide itself was written by
           the MANAGER after two B subagents died writing nothing — §1
           stayed true through every one of those deaths, which is the only
           reason any of this was resumable.

           **Both POLICY halves C raised were ruled in §1f, and one of those
           rulings has since been REVERSED:**
             - B2-11's `Industry` qualifier (`"Summit"` → `"Industry
               summit"`) — §1f Ruling 17 excluded it as unsourceable.
               **§1g Ruling 19 REVERSES that: it is the spec's own label for
               the `summit` kind (plate 04). Exclusion (j) withdrawn.**
             - B2-17 gap 3, `looking at industry` — the profile DOES carry
               `Profile.industryVsAcademia`. C found it, refused to use it
               without a ruling, and recorded the field name. **RULED IN and
               BUILT as B2-19 by the manager.** The reader set that value
               themselves; printing it explains a highlight rather than
               guessing at one.
TODO:      **B writes the round-3 fix guide, items B3-01 onward**, covering
           **11 items**: the 10 already-closable differences in §4 "Round 3"
           (job findings 1, 3, 5; event findings 1, 2, 3, 4, 5, 7, 8) plus
           the newly-ruled-in STARTS `flexible` field (Ruling 20). **Do NOT
           write a guide item for job finding 4 or event finding 6** — both
           are permanently excluded as (k) and (l) per Ruling 21. Before
           starting, read §1g (withdraws exclusion (j), adds two rules about
           where evidence may be searched) and §1h (this round's two
           rulings, in full, with the extraction precedent for Ruling 20).

           Things round 3 could not check, for whoever picks them up: whether
           B2-04's contract-length expand/abbreviate pair reads right on real
           (not fixture) data, and whether B2-06's `workMode` inference from
           location text ever mis-fires. Both were exercised only against a
           hand-built fixture.
GATE NOW:  82 files / **850 tests, all 850 passing**, typecheck clean, 1
           pre-existing lint error (`src/components/persona/quiz.tsx:46`).
           848 of those are C's figure after each of its 18 commits — the gate
           was re-run per item, never batched. The last 2 are B2-19's.
FLAKE:     `src/lib/events/benchmark.test.ts` — a live Tavily-search
           integration test that only runs when a real API key is present in
           `.local-data/profile.json`, asserting a specific real event still
           appears in live search results. The first C verified it was
           already failing before any B2 work (stashed everything, reran
           against the prior commit). **This second C's session had a live
           key configured and the test PASSED on every gate run this
           session** — i.e. it is genuinely flaky run-to-run against live
           search results, not simply "currently broken." **MANAGER'S
           RULING stands regardless of which way it happens to fall on a
           given run: this is real-world data drift, not a regression. It is
           not C's to fix and A must not count it against the gate.** Fixing
           the benchmark's brittle assertion is a separate task.
NOTE:      B2-06 (round 2's first C) landed all three layers including
           extraction, which the guide had said to attempt only after
           committing the safe half. B2-18 (this C) caught two pre-existing
           tests the item broke that the guide's own risk section had not
           named — both rewritten, neither deleted, per §2/§3 — a reminder
           that "risk" sections in a B guide are a starting point, not a
           complete list; C must still watch the gate itself.
```

**History of measured difference, newest last:** _(A appends one line per round)_

| Round | A's measured difference | Verdict |
|---|---|---|
| 1 | 50% | 8 of 32 plate elements absent, 16 wrong shape/order/copy, 8 exact. Gate not met. |
| 2 | 22% | 0 of 32 plate elements absent, 14 wrong shape/copy, 18 exact (25/32). Gate not met — B-06 and B-12 only partially landed; fresh findings on date-granularity wording (job facts + Timeline) and event People-card content; one header-chip question still POLICY, unresolved since round 1. |
| 3 | 16% | 0 absent, 10 wrong shape/copy, 22 exact (27/32). Gate not met — 13 differences, 5 job and 8 event. **Measured by the MANAGER, not an A subagent** (four agents died on the spend limit or a stall), so this round is less independent than 1 and 2. Reversed §1f Ruling 17 after finding the kind label defined on plate 04; B2-15 landed for only one of its two table rows. Two open POLICY items. |

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

**§1e below is that new ruling.** It adds exclusions 7 and 8 and settles ten
round-2 questions. Read it too.

---

## §1e. MANAGER'S RULINGS ON ROUND 2 — BINDING

Decided 2026-08-03 after A's round-2 report (22% different). The manager
re-extracted plates 02 and 03 from the PDF independently before ruling. Where a
ruling says "verified", the manager read the raw PDF text, not A's or B's
summary of it.

### Ruling 7 — §1c is WRONG about plate 03's chip row. Corrected here.

**Verified.** Plate 03's chip row is literally four chips:

```
Industry summit / + career fair / CCF-B / 88% match
```

There is **no online/in-person chip**. The format lives in the subtitle:
`San Diego Convention Center · in person, streamed keynotes · 4 days`.
§1c's line `chips (kind · online/in-person · CCF-B · match %)` is a
transcription error made when §1c was written. **The corrected chip row is:
primary kind · secondary kind · rank · match %.**

A and B both flagged this independently and both were right. **This closes the
`POLICY` item; it is no longer open.**

**Consequence:** the build's `In person` chip is an extra the plate does not
have, *and* the subtitle B-16 added already prints "in person" — so the build
states the format twice. **Delete the chip. The subtitle keeps the fact.**

### Ruling 8 — Date and countdown wording: the report gets the plate's vocabulary.

**Verified from the PDF**, plate 02 and plate 03:

```
APPLY BY / Sep 15 / 47 days left        POSTED / Jul 22 / 8 days ago
STARTS   / Jan 2027 / flexible          ABSTRACT DUE / Oct 30 / 92 days left
```

Three rules the build currently breaks:

1. **No year** on a date inside the report's own horizon. `Sep 15`, not
   `Sep 15, 2026`.
2. **Days, not weeks or months.** 47 and 92 both stay in days. The current
   helpers bucket past 14 days and lose the number the reader is deciding on.
3. **The plate's phrasing:** `N days left` / `N days ago`, not `in N weeks` /
   `Nd ago`.

**Scope it to the report.** Do not change `web/src/lib/format.ts`'s shared
helpers — the feed and the papers view use the app's own relative-time
vocabulary and are not in this loop. Add report-scoped formatters, exactly the
blast-radius reasoning B used for B-01.

**One guard the plate cannot show you:** if a date is more than about twelve
months out, the year **must** appear, or `Mar 8` is ambiguous between two years.
Suppressing a year that is genuinely needed is a correctness bug, not parity.

### Ruling 9 — The contract-length "structural conflict" is not one. Reproduce both.

A wrote that the header chip (`Full-time · 3 years`) and the TYPE tile detail
(`Full-time · 3-yr contract`) cannot both come from one field. **That is
incorrect** — one field plus two formatters produces both. Both strings are
verified present on the plate (the facts row wraps across PDF pages 2 and 3,
which is why the TYPE sub-line looks absent if you only read page 2).

**Reproduce both, verbatim.** Yes, the plate states the same two facts twice in
two phrasings. Say-it-once is a manager principle; the plate is the contract the
user chose. **Where the two collide and the user has given no instruction, the
plate wins.** No type change, no field added.

### Ruling 10 — REGISTER BY's sub-line: suppress it, do not substitute.

Plate: `on-site registration available` — whether walk-in registration is open.
Peer does not track that. The build currently fills the slot with a countdown
(`in 6 months`).

**Remove the countdown and leave the sub-line empty.** A countdown implies the
deadline is hard; we do not know that it is. Filling an unavailable slot with a
different fact is the exact quiet dishonesty Phase 7 existed to remove.
**Excluded — see exclusion 7 below.**

### Ruling 11 — `TIER 0` badges: close it.

Plate prints a `TIER 0` badge on "Why Peer sent this to you" (both reports) and
on "What it costs you". Build prints none. The badge component already works —
the Skills section renders `New` + `Tier 0` correctly. Plain missing element.

### Ruling 12 — "Why Peer sent this to you" as one sentence: close it.

Plate shows one fused sentence; the build renders two paragraphs. B called this
a scoring-layer change. **It is not** — the scoring layer already produces both
clauses; joining them is a render decision. Fuse them.

### Ruling 13 — People cards need the short descriptor. Close it.

Plate's people cards carry five lines; the build carries four. The missing one
is the short descriptor (`2 papers in your feed`, `Matches a topic you typed`).
Organisations already have `descriptor` and it renders correctly, so the pattern
exists. Both plate examples are computable from local data with no AI key — a
count from the feed, and a string match against the profile. **Tier 0. Build it.**

### Ruling 14 — The compound event kind: in scope, mechanism is B's to find.

Plate: `Industry summit` + `+ career fair`. Build: `Summit`, and no second chip.
`Event.type` is a single coarse enum.

**In scope as one item.** B decides the mechanism. The activities list already
carries `Recruiting fair, day 3`, so a secondary kind may be derivable from data
already present. **If B finds no honest source for either half, say so and mark
it `POLICY — manager decides` rather than inventing a label.** Do not hardcode
"Industry".

### Ruling 15 — Travel grant and invitation letter: real table rows, `—` for what is missing.

Ruling 6 moved them into the cost table and that landed. But each renders as one
merged cell where the plate gives three columns. **Render them as proper
three-column rows.** Where a cell has no data, print `—` — the plate uses that
glyph itself. The invitation letter's `Allow 3 weeks` turnaround has no field
behind it; **leave that cell `—` and do not invent a number.**

### Ruling 16 — Activity chip mangling: close it.

`formatActivityLabel` still routes prose through the enum formatter, so
`vendor exhibition` becomes `Vendor Exhibition` and `early-career mixer` loses
its hyphen. Same bug class B-12 targeted, different trigger. B-12 narrowed the
trigger instead of fixing the rule. **Fix the rule:** an activity label is prose
unless it exactly matches a known enum value.

---

### The eight "no field exists" gaps — ruled as a category

Eight plate details name a fact Peer's data model does not carry. **C cannot
close these by editing a component**; they need extraction work, which is
outside this loop. Listed by name so the exclusion stays auditable:

| # | Plate detail | Where |
|---|---|---|
| a | `Hybrid · US` sub-line | job LOCATION tile |
| b | `Hybrid (3 days on-site)` | job subtitle, 3rd segment |
| c | `ELIGIBILITY` row | job "To apply, have ready" |
| d | `TEAM` row | job "To apply, have ready" |
| e | `· reposted from employer site` | job SEEN ON row |
| f | `streamed keynotes` | event WHERE tile and subtitle |
| g | venue name (`San Diego Convention Center`) | event subtitle |
| h | `plus four nights` | event costs footnote |

**Exception — (a) and (b) are the same missing fact, and it is worth building.**
Work mode (on-site / hybrid / remote) appears three times on plate 02 and
materially changes whether a person applies. `Job` carries only `isRemote`.
**Add a work-mode field and populate it where the posting states it.** That is
one item, in scope, and it closes (a) and (b) together.

**(c) through (h) are excluded — see exclusion 8.**

---

### Exclusions added to §1d — A, apply these from round 3 onward

**Exclusion 7 — REGISTER BY's sub-line** (Ruling 10). Permanently empty.

**Exclusion 8 — the six data-model gaps (c) through (h) above.** Excluded as
named items only. **Not** as a general licence to exclude anything labelled "no
field exists" — anything new of that shape is a fresh `POLICY` item for the
manager, not an automatic exclusion.

**A: re-list exclusions 7 and 8 by name in every round's log.** They must stay
visible. An exclusion that stops being mentioned quietly becomes permanent
without anyone deciding it should be.

---

## §1f. MANAGER'S RULINGS ON C's TWO POLICY ITEMS — BINDING

Decided 2026-08-05, after C investigated both and correctly declined to act on
either. **They go opposite ways, and the reason is the same distinction §1e
Ruling 14 was already drawing.**

### Ruling 17 — `Summit` → `Industry summit`: EXCLUDED. New exclusion item (j).

C searched the data model and found no industry/academic axis on `Event`.
There is none. The only way to produce the qualifier is to infer it — from the
exhibitor count, from the presence of a recruiting fair, from the organisations
attending.

**Peer does not do that.** The user's own instruction governs here:

> peer 不应该用来评价，只摆事实……判断要交给用户自己来

An event's character is a judgement. Labelling one "industry" from indirect
signals is exactly the inference §1d Ruling 1 already forbade. **The kind chip
prints `Summit`. This is a permanent difference from the plate.**

**A: add this to the exclusion list as item (j) and re-list it every round**,
alongside (c)–(i). If the manager ever funds an extraction change that
classifies events on a stated industry/academic axis, this reopens — not before.

### Ruling 18 — `looking at industry`: RULED IN. Built as B2-19.

This is **not** the same situation, and C was right to say so rather than
lumping the two together.

`Profile.industryVsAcademia` exists, the reader sets it themselves in Profile
settings, and both scoring pipelines already read it. Printing it back is not
an inference about anything — it is repeating the reader's own stated
preference in the sentence that explains why chips were highlighted.

**Implemented by the manager as B2-19** (commit `c423f15`), because it was a
small follow-up on C's own recorded findings rather than fresh work:

- A clause per stated lean — `industry`, `academia`, `startups`, `bigTech`.
- **`both` produces no clause.** It is the default every profile starts on, so
  it states no lean at all. "looking at both" would put a sentence on the page
  claiming a choice the reader never made.
- The clause cannot stand without the career stage. The plate's phrasing is one
  joined phrase ("because you're a PhD 4 looking at industry"); with no stage it
  would read "because you're looking at industry", which is a different and
  weaker claim.
- Gate after: 82 files / 850 tests passing, typecheck clean, lint unchanged.

**A: this was written by the manager, not by C. Scrutinise it like any other
change** — the manager implementing something does not make it correct.

---

## §1g. RULING 17 IS REVERSED — AND THE LESSON THAT MATTERS MORE

Decided 2026-08-05, during round 3's measurement.

### Ruling 19 — `Summit` → `Industry summit` is IN SCOPE. Exclusion (j) is withdrawn.

**Ruling 17 was wrong.** It excluded the kind label on the grounds that
producing "Industry summit" would mean inferring an event's character from
indirect signals, which the user's "只摆事实" instruction forbids.

That reasoning was sound. **The premise was false.** Plate **04** (PDF page 9)
prints the Events tab's kind filter with the spec's whole vocabulary:

```
Academic conference · 18    Workshop · 11    Career fair · 6
Industry summit · 5         Expo · 3         Seminar · 9      Hackathon · 2
```

`Industry summit` is simply the spec's **display label** for the `summit` kind,
as `Academic conference` is its label for `conference`. Nothing is being
inferred about any particular event. The build has no label map at all —
`formatEventType()` mechanically de-hyphenates and title-cases, which is also
why it prints `Career Fair` where the spec writes `Career fair`.

**Build the label map.** It closes the kind chip, the secondary chip, and the
casing everywhere a kind is printed.

### The lesson — this is the part to carry forward

**Three rounds and four agents missed this, because every brief said the same
thing: "plate 02 = pages 2–4, plate 03 = pages 4–9, nothing else is in scope."**
The answer was on page 9, in a plate nobody was asked to read.

Two rules follow, binding from round 4:

1. **A must read the WHOLE PDF once per loop, not only the two plates.** Skim
   the rest for anything that defines vocabulary, labels, counts or states the
   two plates use without defining. Report what you find even if it sits
   outside plates 02 and 03. The scope of the *fix* is still those two plates;
   the scope of the *evidence* is the whole document.
2. **A "no honest source exists" claim needs a search, not an absence.** C
   searched the data model and correctly found nothing; the manager accepted
   that and stopped. Neither searched the spec. Before ruling something
   unsourceable, say **where you looked** — and the spec is one of the places.

The failure was the manager's, not C's. C reported what it found and refused to
guess, which is exactly right. The manager ruled on a narrower search than the
question deserved.

---

## §1h. MANAGER'S RULINGS ON ROUND 3'S TWO POLICY ITEMS — BINDING

Decided 2026-08-05, after asking the user directly. **The two items went
opposite ways — read both, they are not a matched pair.**

### Ruling 20 — STARTS tile's `flexible` sub-line: RULED IN. B must guide it.

The user chose to build this. Follow the same shape as `workMode` (B2-06):
**additive, optional, never a guess.** `job.startDateFlexible` (or similar) is
`undefined` unless the posting itself says the start date can move; silence
means the field stays empty and the sub-line does not render, exactly like
every other optional detail on this row.

**Precedent for where the signal comes from — read both before choosing:**

- `jobWorkMode()` (`web/src/lib/jobs/mapper.ts:81-85`) derives `workMode` from
  the aggregator's own **location string** with a two-line regex — cheap,
  because the signal already arrives structured.
- `visa.ts` (`web/src/lib/opportunities/visa.ts`) derives `visa.state` and its
  evidence quote from the **posting page's free text** — heavier, because
  no aggregator field states visa policy.

**Start-date flexibility is almost certainly the second shape, not the
first.** No aggregator API field says "start date negotiable"; it will be a
sentence in the posting body, if it says anything. B should confirm this by
checking what job data the mapper actually receives, then design the
extraction accordingly — likely a small phrase-match list ("flexible start
date", "start date negotiable", "start date is flexible") similar in spirit to
`visa.ts`'s phrase sets, not copied verbatim.

**Render:** the STARTS tile's `detail`, next to `SALARY`/`TYPE`/`APPLY BY`/
`POSTED`/`VISA`, all of which already have one (`web/src/app/jobs/[id]/page.tsx`,
the facts-row block B2-06 already extended).

### Ruling 21 — Both "Why Peer sent this to you" closing clauses: RULED OUT. Permanently excluded.

The user chose **not** to build the filtering-count clause (job) or the
cross-pool comparison clause (event). Both needed new logic outside the report
layer — counting behaviour over time for the job, comparing one event against
every other tracked event for the event — and the user judged that scope not
worth it for this loop.

**Added to the exclusion list as items (k) and (l):**

- **(k)** — job "Why Peer sent this to you": the plate's closing clause names
  a region and a weekly filtering count (`"...in California, which you
  filtered toward 4 times this week"`). Permanently render the shorter form
  already in place (topics + career level, no region, no count).
- **(l)** — event "Why Peer sent this to you": the plate's closing clause is a
  comparative claim across the reader's whole pool (`"...the only event in
  your pool with all three"`). Permanently render the shorter form already in
  place (topics + count + deadline distance, no pool comparison).

**B must NOT write a guide item for either.** They are closed, not open —
treat them exactly like exclusions (a)–(j): re-list them by name every round
so they stay visible, never guide them, never let them silently re-enter the
active difference count.

---

## §2. ROLES — DO ONLY YOUR OWN JOB

### Agent A — Reviewer

Compare the **live** job report and event report against plates 02 and 03.

- Read the plates from the PDF (`pages: "3-6"` covers plate 02 and the start of
  plate 03; read further as needed — find them, do not guess). **§1g also
  requires you to skim the WHOLE PDF once per loop**, not only those two plates.
- Get the live reports. Either render the components to static markup the way
  `web/src/app/jobs/[id]/page.test.ts` does, or drive the dev server. Say which
  you used.

#### MANDATORY FROM ROUND 4 — measure against REAL search results, not only a fixture

Set by the user on 2026-08-05. **Rounds 1–3 all measured against a single
hand-built fixture per report, and that is not good enough.**

A hand-built fixture is *perfect* data: every optional field populated, every
string well-formed, every date parseable. Real events and jobs are not. A fix
that scores 1.0 against a maximal fixture can still be wrong for most of what
Peer actually shows a reader — a tile that renders beautifully with all six
fees present may collapse when a real event has one, or none.

**Every round, you must additionally:**

1. **Run a real search through the current build** — the same pipeline the app
   uses, not a stub.
2. **Take at least 3 real events and at least 3 real jobs** (6 minimum).
3. **Render each one** through `EventReport` / `JobReport` and compare against
   the plate.
4. **Report per-item results, not just an average.** Say how many of the 6
   render each plate element correctly. An element that works on 1 of 3 real
   events is a finding, even if the fixture renders it perfectly.

**How to run the real search — the mechanism already exists:**

- `buildDailyEventPool()` — `web/src/lib/events/pipeline.ts:186`
- `buildDailyJobPool()` — `web/src/lib/jobs/pipeline.ts:185`
- Map results with `scoredEventToEvent()` (`web/src/lib/events/mapper.ts:121`)
  and `scoredJobToJob()` (`web/src/lib/jobs/mapper.ts:104`).
- The real profile, including live API keys, is read from
  `.local-data/profile.json`. **`web/src/lib/events/benchmark.test.ts:25-37` is
  the working precedent — copy its profile-loading shape.** It also honours a
  `PEER_PROFILE_SNAPSHOT_PATH` override.

**Security, unchanged and absolute:** the key is read from that file at
runtime and used. **Never print it, never echo it into a log, never write it
into any file, never paste it into your report.** If a live key is not present,
say so plainly in your log and report the fixture-only result — do **not**
fabricate a live run, and do **not** go hunting for a key elsewhere.

**Both measurements go in your log**: the fixture score (comparable to rounds
1–3) and the real-data findings. The percentage stays keyed to the fixture
inventory so the round-over-round trend remains meaningful; real-data failures
are reported as their own numbered findings.
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
- **Write as you go. Do not batch your §4 write to the end.** Two agents have
  now died on the account's monthly spend limit with no warning — round 1's C
  (survived, because it had committed per item) and round 2's B (lost its entire
  investigation, because it had written nothing yet). **Append each finished
  item to §4 and commit it before starting the next one.** A partial guide in
  the file beats a complete one in a dead agent's context. The commit cost is
  trivial next to redoing the work.
- **Model:** A, B and C all run on **Sonnet**. Only the manager runs on Opus.
  Set by the user on 2026-08-03 to control spend — the account hit its monthly
  limit mid-way through round 1's C. Spawn every agent with an explicit
  `model: "sonnet"`; do not let it inherit the manager's model.
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

---

### Round 2 — Agent A

**STATUS: COMPLETE.** Measured difference **22%** (78% matched), down from
round 1's 50%. **0 elements now fully absent** (was 8), **14 present but wrong
shape/copy** (was 16), **18 exact** (was 8). Gate: **NOT MET**. Two of B's items
(B-06, B-12) landed only partially against the plate; everything else landed
as claimed, with several small residual gaps noted below. One header-chip
question inherited from B's round-1 log is still unresolved and is marked
`POLICY` again.

#### How I got the build

Same method as round 1: `renderToStaticMarkup` + `createElement` on the
exported `JobReport` and `EventReport`, through a throwaway vitest spec
(`web/src/zz-parity-render.test.ts`, deleted after — working tree left clean).
No dev server, no orphans. Ran `npx vitest run src/zz-parity-render.test.ts`
once to produce the HTML; did not re-run the full gate (typecheck/lint/full
suite) since that is C's job, not A's — the last recorded gate figure (81
files / 815 tests, typecheck clean, 1 pre-existing lint error) is from the
C-completion checkpoint and I did not re-verify it this round.

Fixture — rebuilt at least as maximal as round 1's, values chosen to match the
plate's own illustrative numbers wherever possible so output could be diffed
almost verbatim against the extracted plate text:

- **Job** — same shape as round 1's fixture (postdoc, full salary/visa/dates,
  9 `keyRequirements` with 6 `matchedTerms`, 4 `applicationMaterials`,
  `matchReason` + `facetPreferenceReason`, `sourceId`), with `postedDate:
  "2026-07-22"`, `applicationDeadline: "2026-09-15"`, `startDate:
  "2027-01-15"` against `nowMs = Date.parse("2026-07-30T12:00:00Z")` — the
  same constant B-02 suggested and the job test file already uses — so the
  plate's own "47 days left" / "8 days ago" numbers land exactly and any
  wording difference is directly comparable.
- **Event** — same shape as round 1's (summit, 6 fees incl. the exact plate
  deadline strings, 6 activities, `rank: "CCF-B"`, `travelGrant`,
  `invitationLetter: true`, `expectedSize: 2400`, `relevanceReason` +
  `facetPreferenceReason`, both link fields), 3 Tier-0 organisations + the
  plate's own 22-name tail, 2 Tier-0 people + the plate's own 16-name tail
  (both tail lists transcribed verbatim from the PDF, so tail counts and
  footnotes are directly comparable), `date: "2027-03-08"`, `endDate:
  "2027-03-11"`, `deadline: "2026-10-30"` (92 days out), `registrationDeadline:
  "2027-02-20"`.
- Rendered **five** states: job Tier 0, job enriched (full `JobEnrichment`
  incl. `sponsorshipRead`, `roleSummary`, `emphasise`, quoted-specifics —
  `competitiveness` also populated, to confirm it still renders nothing), a
  junk-requirements job (round 1's exact junk list, to re-confirm B-10's
  guard), event Tier 0, event enriched (full `EventEnrichment` incl.
  `judgedAttendees`, `talkSummaries`, `plan`, `posterFit`).

Plates re-extracted with PyMuPDF, same pages as round 1 (plate 02 = index 1–3
/ printed 2–4; plate 03 = index 3–8 / printed 4–9), letter-spacing normalised.
Text matched §1c's order and B's quoted excerpts exactly — no re-derivation of
the order, only used the fresh extraction to check exact copy.

---

#### A. JOB REPORT — 6 differences, ranked

**1. Facts row — structurally complete (7/7 tiles, B-06 landed) but four
content defects remain.** Rendered (`data-job-fact` block,
`web/src/app/jobs/[id]/page.tsx:204-278`):

- **SALARY prints its period twice.** Value renders `$95k–120k / yr`
  (`formatSalary()`'s own suffix, `page.tsx:214` — `value:
  formatSalary(job.salary)`, nothing strips it) *and* the detail line reads
  `per year · from posting`. B-06's own fix direction said "value drops the
  period suffix that `formatSalary` appends" — it does not. Plate value is
  `$95k – $120k` (no suffix, and spaced en dash with a repeated `$`, which the
  build also doesn't reproduce).
- **TYPE detail loses the plate's hyphen.** Renders `Full Time · 3-yr
  contract`; plate is `Full-time · 3-yr contract`. Cause:
  `humanize("full-time")` (`page.tsx:179-185`) replaces the hyphen with a
  space before title-casing, turning one word into two.
- **STARTS tile has no sub-line at all**, and its value carries a day-of-month
  the plate doesn't show. Rendered: value `Jan 15, 2027`, no detail div under
  it. Plate: value `Jan 2027`, detail `flexible`. Note for B: this one isn't a
  partial implementation of B-06 — B-06's own fix direction (§4 Round 1)
  never mentions a detail for STARTS, only SALARY/TYPE/LOCATION/APPLY
  BY/POSTED/VISA. C followed B exactly; B's instruction was itself
  incomplete.
- **APPLY BY / POSTED values carry a year the plate omits, and their
  countdown wording doesn't match the plate's style.** Rendered: `Sep 15,
  2026` / `in 6 weeks`, and `Jul 22, 2026` / `8d ago`. Plate: `Sep 15` / `47
  days left`, and `Jul 22` / `8 days ago`. Two separate gaps: `formatDate()`
  is called with its default "medium" style (`page.tsx:205-207`, no style
  argument) instead of a year-less one; and `formatDayDistance` /
  `formatDayAge` (`web/src/lib/format.ts:134-146`, `:109-121`) use the app's
  own relative-time vocabulary ("in N weeks", "Nd ago") rather than the
  plate's "N days left" / "N days ago" phrasing, and bucket into weeks past
  14 days where the plate stays in days. Confirmed in rendered output — no
  fixture choice avoids this, since the plate's own illustrative numbers (47,
  92, 8) all fall inside the ranges where the current helpers change units or
  abbreviate. Job test at `jobs/[id]/page.test.ts:190-191` pins the current
  ("in 2 weeks", "10d ago") wording, so this is the asserted contract, not an
  accident — it just isn't the plate's wording.
- LOCATION's missing sub-line (`Hybrid · US`) is unchanged from round 1 — no
  hybrid field exists on `Job`, already noted by B-06 as out of scope.

**2. Header chips — 2 of 4 chip texts diverge from the plate in wording.**
Round 1 listed header chips as already matching; a word-for-word check this
round finds otherwise. Rendered: `Postdoc` · `3-yr contract` · `Sponsorship
available` · `91% match`. Plate: `Postdoc` · `Full-time · 3 years` · `Visa
sponsorship` · `91% match`. The match-% and role chips are exact. The visa
chip's wording (`VISA_LABELS.sponsors = "Sponsorship available"`,
`page.tsx:90`) has simply never matched the plate's `Visa sponsorship` — not
something B-06 touched. The contract-length chip exposes a **structural
conflict**: the header chip (`page.tsx:584-586`) and the TYPE tile's detail
(finding 1) both read from the single `job.contractLength` field, but the
plate uses *two different strings* in those two spots (`Full-time · 3 years`
up top, `3-yr contract` in the tile). One field cannot produce both; whichever
value C picks, one of the two will read wrong. Not a simple copy fix — needs a
type/field decision.

**3. Timeline — same date-granularity gap as the facts row.** Round 1 called
this section an exact match; on closer inspection this round it carries the
identical defect as finding 1: `Posted Jul 22, 2026` / `Today Jul 30, 2026` /
`Apply by Sep 15, 2026` / `Starts Jan 15, 2027` render with full years (and
Starts with a day-of-month), where plate 02's own Timeline block reads `Posted
Jul 22` / `Today` / `Deadline Sep 15` / `Start Jan 2027` — no year except on
the month/year-only Start point. Same root cause (`formatDate()` called at
its default style), same fix likely closes both this and finding 1.

**4. "Why Peer sent this to you" — landed (B-03), two shape gaps remain.**
Heading and body render correctly and the section sits in the right place.
But: **(a)** no `TIER 0` badge — plate 02 prints one under this heading
(confirmed: `ReportBadge` is used nowhere in
`web/src/components/reports/why-peer-sent-this.tsx`, and grepping the
rendered HTML for `Tier 0` near this section finds nothing). **(b)** the body
and the facet-preference line render as **two separate paragraphs**
(`why-peer-sent-this.tsx:40-50`) where the plate shows **one fused sentence**.
This is the substance gap B already flagged as "note, not solve" (the
scoring layer doesn't produce the plate's single sentence) — still open, so
still worth counting as a difference from the plate's shape.

**5. "To apply, have ready" — labelled now (B-17 landed), still 2 of 4 rows
short.** MATERIALS and SEEN ON render as labelled rows exactly as B-17
specified. `CV, 1-page research statement, 3 references` is an exact match to
the plate's MATERIALS value. SEEN ON renders `Adzuna` — a real value, but
incomplete against the plate's `Adzuna · reposted from employer site` (`Job`
has no field for "reposted from employer site"; B-17 already flagged this as
out of scope). ELIGIBILITY and TEAM remain entirely absent — no fields exist,
exactly as B-17 said would remain true.

**6. Subtitle — still 2 of 3 segments.** `Toyota Research Institute · Los
Altos, CA`; plate's third segment `Hybrid (3 days on-site)` needs a work-mode
field `Job` doesn't have (only `isRemote`). Unchanged from round 1, already
flagged by B-18 as unclosable within the current type.

**What now matches exactly, confirmed by render:** Skills section — heading
`Skills they ask for`, `New` + `Tier 0` badges, count line `6 of 9 you already
have`, one flat chip row (6 matched-with-`✓` then 3 plain, in that order) —
byte-for-byte match to the plate. Skills footnote — verbatim match. Skills
junk-guard — re-confirmed with round 1's exact junk fixture; only
`Solid-state electrolytes` survives, all site-chrome filtered. Locked block
items — net of the two permanently-excluded promises (§1d items 1–2), the two
that remain (`Sponsorship read when the posting is silent`, `What to
emphasise in your application`) now carry the plate's **exact** description
text, in the plate's relative order. Locked-block header + "Connect a key"
link — unchanged, exact. Visa quote attribution — `— from the job
description` now present, exact. Action row — `Apply on employer site ↗`,
`Save`, `Mark as applied` (with a checkmark icon when checked) all exact; the
only remaining nominal extra, the `Interested` button, is excluded by §1d
item 5. What the role is (bullets) — exact. H1 — exact.

---

#### B. EVENT REPORT — 8 differences, ranked

**1. Facts row — structurally complete (6/6 tiles, B-05 landed) but four
tiles carry content defects.** Rendered (`web/src/app/events/[id]/page.tsx:324-384`):

- **FEE detail drops the early-bird clause.** Renders `student $180`; plate
  is `student $180 · early bird to Jan 9`. The code has the deadline value in
  scope two lines above (used elsewhere) but the FEE tile's `detail`
  (`page.tsx:348-355`) never appends it.
- **ABSTRACT DUE wording and granularity both miss.** Renders `in 3 months`;
  plate is `92 days left`. Same root cause as job finding 3 —
  `formatDayDistance` buckets 92 days into "months" and uses "in N" phrasing
  instead of the plate's "N days left".
- **REGISTER BY shows the wrong *kind* of information, not just the wrong
  words.** Renders a countdown, `in 6 months`; the plate's sub-line is a
  fixed qualitative note, `on-site registration available`, with no
  countdown at all. The code (`page.tsx:364-373`) applies the same
  `formatDayDistance` pattern used for ABSTRACT DUE, but the plate doesn't
  want a distance here — it wants a different fact Peer doesn't currently
  track (whether walk-in registration is open).
- **SCALE prints an abbreviated form the plate doesn't use.** Renders `~2.4k`
  (`formatCount()`, `web/src/lib/format.ts:164-169`); plate is `~2,400`
  (comma-grouped, not abbreviated). `last edition` detail is an exact match.
- WHERE's missing `hybrid keynotes` clause is unchanged from round 1 — no
  field, already flagged by B-05.

**2. "What actually happens there" chips — highlighting now works (B-12
landed), but the exact bug class B-12 targeted still reproduces on other
input.** 3 of 6 chips render with the accent style and a trailing `✓`,
matching the plate's own 3 exactly (`Poster session — open call ✓`,
`Symposium: solid-state interfaces ✓`, `Recruiting fair, day 3 ✓` — verbatim).
But 2 of the remaining plain chips are mangled: `vendor exhibition` →
**`Vendor Exhibition`**, and `early-career mixer` → **`Early Career Mixer`**
(hyphen lost, both words title-cased) — both are the plate's own example
text. Cause: `formatActivityLabel()` (`page.tsx:206-213`) treats any lowercase
phrase of ≤3 words with no punctuation besides space/hyphen as a "vocabulary
label" and runs it through `formatEventType()` (which strips hyphens and
title-cases). "vendor exhibition" and "early-career mixer" pass that test even
though they're prose activity names, not enum values — the same class of bug
B-12 was written to fix, just triggered by different strings than round 1's
fixture used. `Tutorial: cell-scale modelling` (has a colon, so fails the
"vocabulary" test) renders correctly, first-letter-only capitalised, an exact
match.

**3. Happenings footnote — present (B-04... B-12 landed) but wording
diverges from the plate.** Renders: "Highlighted because they line up with
your topics and with where you are — **PhD Year 4**. **Those are the ones**
you'd be sorry to miss." Plate: "Highlighted because they line up with your
topics and because you're a **PhD 4** looking at industry — **the poster call
and the recruiting fair** are the two you'd be sorry to miss." Three gaps:
the career-stage string is the full enum value (`PhD Year 4`) not the plate's
shorthand (`PhD 4`); the "looking at industry" clause is absent; and the
close is generic rather than naming the specific highlighted items. B-12's
own fix direction chose to generalise rather than hardcode "PhD 4" — a
reasonable trade-off — but the result is real, visible wording drift from the
plate that's worth recording.

**4. Costs table — core content fixed (B-01, B-08, B-13 all landed), four
smaller residuals remain.** No "2001" anywhere in any render (B-01 confirmed
fully fixed — grepped all five HTML dumps, zero hits), table sits in the
correct position (B-08 confirmed), footnote exists (B-13 confirmed). Residual
gaps: **(a)** no `TIER 0` badge on the "What it costs you" heading — plate
shows one, same gap as job/event's "Why Peer sent this to you". **(b)** the
table-head restatement reads `Cheapest way in, for you: Student ticket in
person…` — plate's table-head phrasing has **no comma** (`Cheapest way in for
you: student ticket…`) and lower-cases "student" after the colon; the build
reuses the same capitalised, comma'd string as the top callout instead of the
plate's distinct shorter form. **(c)** Travel grant and Visa invitation letter
now correctly live only in the table (Ruling 6 confirmed — no duplicate prose
block), but each renders as **one merged cell** (`30 available, apply with
your abstract`; `Available on request.`) where the plate shows **three
distinct columns** (`—`/`30 available`/`Apply with your abstract`;
`On request`/`On request`/`Allow 3 weeks`) — and the invitation letter's
`Allow 3 weeks` turnaround fact is **dropped entirely**, present nowhere in
the render. This is a known, explained trade-off (`event.travelGrant` /
`invitationLetter` are single free-text/boolean fields, not three-column
data) but the content loss is real. **(d)** footnote omits "plus four nights"
(explained — no nights field on `Event`; B-13 already flagged this).

**5. "Why Peer sent this to you" — same two gaps as the job report.** No
`TIER 0` badge; body and facet line render as two paragraphs where the plate
shows one fused sentence. Mechanism and placement (after costs table, before
locked block, per §1c) both confirmed correct.

**6. Header chips — rank chip landed (B-15), two other gaps remain, one of
them still `POLICY — manager decides`.** Rendered: `Summit` · `In person` ·
`CCF-B` · `88% match`. `CCF-B` is new and exact (B-15 succeeded). Remaining:
**(a)** the kind chip reads `Summit`, formatted from the enum
(`formatEventType(event.type)`); the plate's kind chip literally reads
`Industry summit` — a more specific label than the raw `EventType` value
produces. **(b)** the plate's second chip, `+ career fair`, still has nowhere
to live — `Event.type` is a single value, no secondary-kind field, already
flagged by B-15 as unfixable without a type change. **(c)** `POLICY,
inherited from B, still unresolved`: B's round-1 log flagged that a fresh
PDF read shows the plate's chip row may not include an "in person" /
"online" chip at all (it appears in the subtitle and the WHERE tile instead)
— contradicting §1c's own stated order (`kind · online/in-person · CCF-B ·
match %`). My own extraction agrees with B's re-reading: the raw plate text
for this row is `Industry summit / + career fair / CCF-B / 88% match`, with
no separate in-person/online line. I am not resolving this — §1c is the
document I was told not to re-derive, but it conflicts with what the PDF
literally shows here, and B already surfaced this without a ruling. Leaving
it `POLICY`.

**7. People Tier 0 cards — missing a short descriptor line the plate shows.
New finding.** Plate 03's two example people cards each carry **five**
distinct lines: name, role/institution, a short descriptor (`2 papers in your
feed` / `Matches a topic you typed`), a longer reason sentence, and a
`Speaking:` line. The build's `EventPerson` type
(`web/src/types/index.ts:123-129`) and the roster card render
(`page.tsx:1114-1164`) only carry **four**: name, role · institution, the
long reason (from `relevance`), and `Speaking ·`. There is no field
equivalent to `EventOrg.descriptor` (which organisation cards do have and
render — confirmed exact match on all 3 Tier-0 organisations). This is a real
content gap, not merely a wording one: the short "why you should care in one
glance" line the plate gives people has no home on the type. (Minor,
separately: role/institution join on `·` where the plate's own text reads as
a comma-joined clause; not scored as its own issue, noted for completeness.)

**8. Subtitle — landed (B-16), content is data-limited.** Renders `San
Diego, US · in person · 4 days`. Duration (`4 days`) is an exact match to the
plate's computed value. Venue and format are less specific than the plate's
`San Diego Convention Center · in person, streamed keynotes` because `Event`
carries a city-level `location`, not a venue name, and no "streamed keynotes"
field exists — both already flagged by B-16 as unclosable without new
extraction, not a code defect.

**What now matches exactly, confirmed by render:** "Cheapest way in, for you"
top callout — byte-for-byte match to the plate's sentence. "Two deadlines,
one event" — heading present, four milestones (`Today`, `Abstract`, `Register
by`, `Event`) in the plate's exact labels and order. Section order — now
exactly §1c's order (cheapest → deadlines → happenings → roster → costs →
why-peer-sent → locked block), confirmed by index positions in the rendered
HTML. "Who'll be in the room" heading + counts sub-line — exact pattern
match. Organisation Tier-0 cards + `Tier 0` badge — exact, all fields
verbatim on all 3 example organisations. Organisation tail — heading with
live count, filter input, star explainer and closing footnote all verbatim
matches. Speaker tail — same, and the count (`· 16`) is an exact match to the
plate's own number since the fixture reused the plate's real name list.
Locked block — all **four** items present, in order, with the plate's exact
description text on all four (only the first item's title omits a hardcoded
count, `29`, deliberately — B-20's own documented choice to avoid printing a
static number that would be wrong on real data). Action-row buttons —
`Register ↗` and `Submit abstract ↗` both present, exact labels (B-16
succeeded here). Date-invention bug — fully fixed, zero "2001" anywhere.

---

#### C. B-01 .. B-20 — confirmed against the rendered output, not the commit log

| Item | Verdict |
|---|---|
| B-01 (date-invention bug) | **Landed, exact.** No "2001" in any render. |
| B-02 (`nowMs` prop) | **Landed.** Powers every countdown and the Today milestone correctly. |
| B-03 (Why Peer sent this, both reports) | **Landed, not exact.** Section exists and is placed correctly; missing `TIER 0` badge on both reports; renders as two paragraphs where the plate shows one (job finding 4 / event finding 5). |
| B-04 (day-by-day plan) | **Landed, exact.** Heading, ordered list, session/person rows, locked-block promise text all match the plate. |
| B-05 (event facts row) | **Landed, not exact.** All 6 tiles present; FEE/ABSTRACT DUE/REGISTER BY/SCALE each carry a content defect (event finding 1). |
| B-06 (job facts row) | **Landed, not exact — the weakest of the twenty.** All 7 tiles present, but SALARY duplicates its period, TYPE loses a hyphen, STARTS has no sub-line, and APPLY BY/POSTED both show the wrong date granularity and wrong countdown wording (job finding 1). |
| B-07 (roster tails) | **Landed, exact.** Both tails match the plate verbatim: heading, count, filter, star explainer, footnote. |
| B-08 (section order) | **Landed, exact.** |
| B-09 (deadline strip heading + Today) | **Landed, exact.** |
| B-10 (skills chips + footnote + junk guard) | **Landed, exact.** Re-confirmed the junk guard with round 1's exact fixture. |
| B-11 (cheapest-way-in wording) | **Landed, mostly exact.** Top callout is byte-for-byte; the table-head restatement has a residual comma/capitalisation mismatch (event finding 4b). |
| B-12 (happenings chips + footnote) | **Landed, not exact.** Highlighting works, but the same mangling bug class it targeted still fires on other input (`Vendor exhibition` → `Vendor Exhibition`), and the footnote's wording diverges from the plate (event findings 2–3). |
| B-13 (costs footnote) | **Landed, not exact.** Present and mostly right; omits "plus four nights" (explained, no field). |
| B-14 (roster heading + counts) | **Landed, exact.** |
| B-15 (rank chip) | **Landed, exact** for the chip itself. The kind-label wording and the missing "+ career fair" chip are separate, pre-existing gaps outside B-15's stated scope (event finding 6). |
| B-16 (event subtitle + abstract button) | **Landed.** Subtitle and second button both present; remaining content gaps are data-limited, already flagged by B-16 itself (event finding 8). |
| B-17 (apply rows labelled) | **Landed as scoped.** MATERIALS + SEEN ON labelled and correct; ELIGIBILITY/TEAM correctly left absent, exactly as B-17 said would remain true. |
| B-18 (job action row + subtitle) | **Landed, exact** for the parts checked (`Apply on employer site ↗`, `Mark as applied`). |
| B-19 (visa quote attribution) | **Landed, exact.** |
| B-20 (locked-block copy, both reports) | **Landed, exact.** Job: both non-excluded promises match verbatim. Event: all 4 items match verbatim (title 1 deliberately omits a hardcoded count). |

**Net: 18 of 20 items landed exactly against the plate. B-06 and B-12 landed
as scoped but leave the plate element still visibly wrong** — named explicitly
per the round-2 mandate, not folded into "done."

---

#### D. The number

**22% different (78% matched).**

Method: reused round 1's inventory and scoring exactly — 32 discrete
perceived elements (14 job, 18 event), 1 point for an exact match, 0.5 for
present-but-wrong-shape/order/copy, 0 for absent. Round 1 didn't publish its
literal 32-line checklist, so I reconstructed it at the same granularity round
1 described ("a heading, a tile row, a footnote paragraph, a locked-block list
each count as one"); the reconstructed lists are implicit in sections A and B
above (every ranked difference plus every item in the "what now matches"
paragraphs is one element). Where I had to make a grouping call round 1 didn't
make explicit (e.g. treating the event's cross-cutting "section order" as its
own element, matching round 1's own item 4), I kept round 1's precedent.

**Result: 18 exact, 14 half, 0 absent → 25 / 32 = 78% matched, 22%
different.** Per report: job **11 / 14 ≈ 79% matched** (was 61%); event
**14 / 18 ≈ 78% matched** (was 42%). The two reports are now roughly level —
round 1's "event is the weaker by a wide margin" no longer holds.

**§1d exclusions — how many elements this actually removed: effectively
none, by count, but 3 of the 32 elements are scored net of an exclusion.**
The five ruled-settled differences don't map one-to-one onto my 32 elements,
because round 1's inventory already treats each report's whole locked-block
promise list as *one* element, not one element per promise. Concretely:

- §1d items 1–2 (job's two absent locked-block promises) are both
  sub-parts of **one** inventory element, "job locked-block items" — I scored
  that element against only the two promises that are allowed to exist, both
  of which now match exactly, so the element scores 1.0 rather than being
  penalised for the two that will never return.
- §1d item 5 (the "Interested" button) touches **two** elements, "job action
  row" and "event action row" — both scored against the plate-shown controls
  only, treating `Interested` as invisible to the count.
- §1d items 3–4 (the two job quoted-specifics sections, the event
  description paragraph) were never inside the 32 to begin with — round 1
  explicitly excluded "extra, not on the plate" content from the denominator,
  and both of these are exactly that kind of extra.

So: **0 whole rows removed from the 32**, but **3 of the 32 elements'
scores are computed net of the ruling** rather than being marked down for
content the manager says will never exist. Flagging this explicitly, as
instructed, so the 78%/22% figure is auditable rather than asserted.

---

#### E. Gate verdict

**GATE (0%): NOT MET.** Zero elements are fully absent, which is real
progress, but 14 of 32 are still present-with-a-defect, and two of those
(job facts row, event activity chips) are less than perfect implementations
of items B already marked done. None of the remaining gaps look
unclosable to me except one, carried over from round 1:

- **`POLICY — manager decides`: the event header-chip row.** §1c states the
  chip order is `kind · online/in-person · CCF-B · match %`. My own fresh PDF
  extraction of plate 03's header (page index 3) reads only `Industry summit
  / + career fair / CCF-B / 88% match` — no separate in-person/online chip;
  that information sits in the subtitle and the WHERE tile instead. B raised
  this exact tension in round 1 without a ruling ("Manager's call; low stakes
  either way"). It is still open. I am not deciding whether §1c's order or my
  fresh reading of the PDF governs here — flagging it again, unresolved.

Everything else found this round (job findings 1, 2, 3, 5, 6; event findings
1, 2, 3, 4, 5, 7, 8) is a normal fix, not a policy question, and belongs in
B's next fix guide.

---

### Round 2 — Agent B (done by the MANAGER, not a subagent)

**STATUS: IN PROGRESS.** Job items B2-01..B2-06 written and verified against the
code. Event items still to come.

**Why the manager is doing B's job.** Two subagent B runs were launched and both
died without writing anything: the first on the account's monthly spend limit
with a near-complete investigation in its context, the second on a 600-second
stall before it had written even its heading. Rather than burn a third attempt,
the manager took the role. **§1 stayed true through both deaths** — it still
read `WHOSE TURN: B`, so nothing had to be reconstructed.

Items are numbered **B2-nn** so they never collide with round 1's B-01..B-20.

---

#### B2-01 — Report date granularity and countdown wording. `WRONG SHAPE`. **Do this first — three findings collapse into it.**

Closes A's job findings 1 (APPLY BY / POSTED) and 3 (Timeline), and event
finding 1b (ABSTRACT DUE). Implements **Ruling 8**.

**Cause — two separate things, and the first is nearly free.**

*(a) The year.* `buildJobFacts` (`web/src/app/jobs/[id]/page.tsx:205-207`) and
`buildTimeline` (`:281-286`) both call `formatDate()` with **no style
argument**, so they get the default `"medium"` = `{month:"short",
day:"numeric", year:"numeric"}` → `"Jul 22, 2026"`.

**The styles the plate wants already exist** in `web/src/lib/format.ts:27-32`:

```
short:     { month: "short", day: "numeric" }   -> "Jul 22"      (plate: APPLY BY, POSTED)
monthYear: { month: "short", year: "numeric" }  -> "Jan 2027"    (plate: STARTS)
```

So (a) is a matter of passing the right style at four call sites. No new code.

*(b) The countdown vocabulary.* `formatDayDistance` (`format.ts:134-146`)
buckets `47` into `in ${Math.floor(47/7)} weeks` → `"in 6 weeks"`, and `92`
into months → `"in 3 months"`. `formatDayAge` (`:109-121`) returns `"8d ago"`
for a diff of 8. The plate wants `"47 days left"`, `"92 days left"`,
`"8 days ago"`.

**Fix direction — and a correction to Ruling 8's own wording.** Ruling 8 says
"scope it to the report, do not change the shared helpers." That is right about
the *blast radius* but wrong about the *location*. `format.ts`'s own header
comment (`:1-6`) records why:

> Before this module existed the app had five relative-time vocabularies
> ("2d ago" vs "2 days ago" vs "in 2 days") drifting across adjacent surfaces.

Hand-rolling a formatter inside a page is the exact thing that module exists to
prevent. **So: add two NEW exported functions to `format.ts`, and do not touch
the existing ones.** Something like `formatDaysLeft(days)` → `"47 days left"`
and `formatDaysAgo(days)` → `"8 days ago"`. The feed and papers keep calling
`formatDayDistance` / `formatDayAge` and are completely unaffected; the reports
call the new pair. One module, two vocabularies, each documented as to which
surface it serves.

**The guard Ruling 8 asks for.** A date more than ~12 months out must keep its
year, or `"Mar 8"` is ambiguous between two years. Put that test in the report's
call site, not in `format.ts` — it is a report policy, not a formatting fact.

**Risk.** `web/src/app/jobs/[id]/page.test.ts:190-191` pins the current
wording (`"in 2 weeks"`, `"10d ago"`). That is the asserted contract, so
**rewrite those assertions to the plate's wording and comment `B2-01`** — do not
delete them. Search the whole test suite for `d ago`, `in \d+ weeks`, and any
full-year date string asserted against a report render; A found two, there are
likely more.

---

#### B2-02 — SALARY prints its period twice. `WRONG SHAPE`. (A: job 1)

**Cause.** `formatSalary` (`web/src/lib/opportunities/salary.ts:177-187`) always
appends the period: its last line is

```ts
return `${prefix}${range} / ${period}`;
```

so the tile value renders `"$95k–120k / yr"`, while the tile's own detail line
(`jobs/[id]/page.tsx:215-217`) already reads `"per year · from posting"`. The
period is stated twice, two lines apart, in two different notations.

**Plate value:** `"$95k – $120k"` — no period suffix, **spaces around the en
dash**, and the `$` repeated on the upper bound. The build has none of the three.

**Fix direction.** Split the function rather than adding a flag: extract the
range-only part as a new export (`formatSalaryRange`) returning
`"$95k – $120k"`, and redefine `formatSalary` as that plus `" / ${period}"` so
every existing caller is byte-identical. The report's SALARY tile then calls
`formatSalaryRange`. Repeating the currency symbol on the upper bound and
spacing the dash both live in the new function.

**Risk.** `formatSalary` is used outside the report (cards / feed). Keeping it
defined in terms of the new function is what makes this safe — **verify by
grep that no caller's output changes**, and keep every existing salary
assertion green without edits. If any salary test needs editing, the split was
done wrong.

---

#### B2-03 — `humanize` destroys hyphenated compounds. `WRONG DATA`. (A: job 1)

**Cause.** `humanize` (`jobs/[id]/page.tsx:179-185`):

```ts
.replace(/[_-]+/g, " ")            // "full-time" -> "full time"
.replace(/\b\w/g, (l) => l.toUpperCase())   // -> "Full Time"
```

It strips the hyphen *then* title-cases every word. Plate: `"Full-time"`.

This is the same bug class as B-12's activity mangling (see B2-1x, event side):
a formatter written for enum slugs (`full_time`, `job-fair`) applied to values
that are already human prose.

**Fix direction.** `humanize` must keep hyphens that sit **inside a word** and
capitalise only the first letter of the whole value, not of every word.
`"full-time"` → `"Full-time"`; `"full_time"` → `"Full time"` (underscore is a
slug separator, hyphen is not). Check the other `humanize` call sites in the
file before changing it — if any depend on title-casing, give this one its own
function rather than changing shared behaviour.

**Risk.** Grep for `Full Time`, `Part Time` and any other title-cased
two-word employment type in the test suite.

---

#### B2-04 — Header chips: the contract chip and the visa chip. `WRONG SHAPE` + `WRONG DATA`. (A: job 2)

Implements **Ruling 9**.

**Cause — two independent gaps at `jobs/[id]/page.tsx:584-590`.**

*(a) The contract chip drops the employment type.* Line 584-585 renders
`<HeaderChip>{clean(job.contractLength)}</HeaderChip>` — contract length only.
Plate: `"Full-time · 3 years"`.

*(b) The visa chip's wording has never matched.* Line 589 renders
`VISA_LABELS[job.visa.state]` = `"Sponsorship available"` (`:89`). Plate:
`"Visa sponsorship"`. Note `VISA_TILE_LABELS` (`:101`) already exists as a
separate short-form map for the VISA tile (`"Sponsors"`), and the comment at
`:267-268` records why the two differ — so **the pattern of two label maps is
already established and correct.** Only the header map's wording is wrong.

**On Ruling 9 and the "one field cannot produce both" claim.** A reported that
the chip (`Full-time · 3 years`) and the TYPE tile detail (`Full-time · 3-yr
contract`) cannot both come from `job.contractLength`. Ruling 9 already
overruled that. Concretely, the cheap version:

1. **Normalise `contractLength` to the expanded duration** (`"3 years"`,
   `"18 months"`) wherever it is produced. Expanding is the reliable direction;
   abbreviating a stored `"3-yr contract"` back into `"3 years"` is not.
2. **Chip** renders `${employmentType} · ${contractLength}` verbatim.
3. **Tile detail** renders `${employmentType} · ${abbreviate(contractLength)}`,
   where `abbreviate` turns `"3 years"` into `"3-yr contract"` — a five-line
   parse of `(\d+)\s*(year|month)s?`.
4. **If it does not parse, print the value verbatim in both places.** Never
   invent a duration.

**If normalising at the source turns out to be unreliable on real postings, stop
and say so** — mark it `POLICY — manager decides` rather than shipping a
half-parsed duration. A wrong contract length is worse than an unabbreviated one.

**Risk.** Any test asserting `"Sponsorship available"` as a header chip, and
any asserting the header chip count.

---

#### B2-05 — STARTS tile: granularity, and one sub-line that cannot be built. `WRONG SHAPE`. (A: job 1)

**Cause.** `jobs/[id]/page.tsx:246`:

```ts
start ? { key: "start", label: "Starts", value: start } : undefined,
```

Two gaps. The value comes from `formatDate(job.startDate)` at default style →
`"Jan 15, 2027"`; plate shows `"Jan 2027"`. **Covered by B2-01** — pass
`"monthYear"`. And the object has **no `detail` at all**, where the plate shows
`"flexible"`.

**The `flexible` sub-line is not buildable and is now excluded.** It states
whether the start date is negotiable. `Job` carries no such field and nothing
upstream extracts one. This is a ninth instance of the §1e "no field exists"
category, which §1e explicitly says must come back to the manager rather than be
auto-excluded. **Manager's ruling, made here: excluded, same category, item (i).
A must list it alongside (c)–(h) from round 3 onward.**

So B2-05 is only the granularity half. C should make the STARTS tile print
`"Jan 2027"` with no sub-line.

---

#### B2-06 — Work mode on `Job`. `MISSING`. **The one item in this guide that touches extraction.**

Implements §1e's exception to the "no field exists" category — the only one of
the eight gaps ruled **in** scope, because it closes gaps (a) and (b) together
and appears three times on plate 02.

**Cause.** `Job` carries only `isRemote` (a boolean). Plate 02 needs a
three-state work mode in two places:

| Plate location | Plate text | Build today |
|---|---|---|
| LOCATION tile sub-line | `Hybrid · US` | `Remote` when `isRemote`, else nothing (`page.tsx:243`) |
| Subtitle, 3rd segment | `Hybrid (3 days on-site)` | segment absent |

**Fix direction — and an honest scope warning.** This is the largest item in the
guide and it spans three layers:

1. **Type** — add a work-mode field to `Job` in `web/src/types/index.ts`
   (`"on-site" | "hybrid" | "remote"`). Keep `isRemote` for now; do not migrate
   callers in this loop.
2. **Mapper / extractor** — populate it where the posting states it. **Only
   where the posting states it.** A posting that does not say must produce
   `undefined`, not a guess — inferring "probably on-site" from silence is the
   exact dishonesty Phase 7 removed.
3. **Render** — LOCATION tile sub-line, and the subtitle's third segment.

**C: do layers 1 and 3 first and commit them, then attempt layer 2.** If layer 2
turns out to need real extraction work, stop there, commit what works, and
report — a `Job` that carries the field with nothing populating it yet is a
usable checkpoint, and the render code is already correct for when data arrives.
The plate's `"(3 days on-site)"` detail is a **fourth** unbuildable fact; render
just the mode word (`"Hybrid"`), not the parenthetical.

**Risk.** `isRemote` is read in the feed, filters and scoring. **Do not change
what `isRemote` means or who reads it.** Adding a field beside it is safe;
replacing it is a different, larger change and is not in this loop.

---

#### B2-07 — `TIER 0` badges on three headings. `MISSING`. (A: job 4a, event 4a, 5)

Implements **Ruling 11**.

**Cause.** The badge component exists and works —
`web/src/components/reports/report-badge.tsx:14`, already used correctly by the
Skills section, which renders `New` + `Tier 0` and matches the plate byte for
byte. It is simply not applied to three headings the plate badges:

| Heading | File |
|---|---|
| Why Peer sent this to you (both reports) | `web/src/components/reports/why-peer-sent-this.tsx:36-38` |
| What it costs you | `web/src/app/events/[id]/page.tsx`, the costs `ReportSection` |

The `<h2>` in `why-peer-sent-this.tsx` carries only text; `ReportBadge` is not
imported in that file at all.

**Fix direction.** Import and render `ReportBadge` beside each heading, copying
the Skills section's markup so the three badges are visually identical. Because
`WhyPeerSentThis` is shared, one edit there fixes both reports.

**Risk.** Low. Grep for tests asserting the exact `<h2>` text of these sections —
a badge sibling should not break a `toContain` on the heading string, but check.

---

#### B2-08 — "Why Peer sent this to you" prints two paragraphs, plate prints one sentence. `WRONG SHAPE`. (A: job 4b, event 5)

Implements **Ruling 12**.

**Cause.** `why-peer-sent-this.tsx:40-50` renders `body` and `facet` as two
separate `<p>` elements. The plate shows a single flowing sentence.

**One thing A did not raise, and C will hit it immediately.** Fusing the two
paragraphs is not enough on its own, because `body` is **not a sentence**. The
scoring layer assembles it dot-separated — `reasonFor`
(`web/src/lib/jobs/scoring.ts`, and the event twin in
`web/src/lib/events/scoring.ts`) joins its clauses with `" · "`. So fusing gives
`"Matches your X focus · fits a Y profile — because you often view Z."`, which
is one paragraph of the same machine-assembled fragments, not the plate's prose.

**Fix direction, in this order:**

1. Join `facet` onto `body` as a trailing clause rather than a second
   paragraph. `facet` already reads `"Because you often view <label>"`, so it
   needs lower-casing and a connector when it follows text.
2. Change the scoring layer's own join from `" · "` to prose connectors, so the
   body reads as a sentence. **This is a scoring-layer change and Ruling 12
   authorises it** — B's round-1 note that it was out of scope was written
   before the manager ruled.
3. **Do not pad with specifics that do not exist.** The component's own comment
   (`:11-14`) records that the plate's paragraph names a region and a filtering
   count no field carries. That still holds. Print what exists as a sentence;
   do not invent the count.

**Risk.** Two job tests assert the *old* heading (`"Why Peer sent it"`) never
returns — `jobs/[id]/page.test.ts:104` and `:158`. Neither is affected by body
changes. Changing `reasonFor`'s join will break any scoring test asserting the
`" · "` form — rewrite those assertions to the new contract and comment `B2-08`.

---

#### B2-09 — The activity-label rule is a heuristic where it should be a lookup. `WRONG DATA`. (A: event 2)

Implements **Ruling 16**.

**Cause.** `formatActivityLabel` (`web/src/app/events/[id]/page.tsx:206-213`):

```ts
const isVocabularyLabel =
  /^[a-z0-9][a-z0-9 _-]*$/i.test(text) && text.split(/\s+/).length <= 3;
return isVocabularyLabel ? formatEventType(text) : text.charAt(0).toUpperCase() + text.slice(1);
```

B-12 wrote this to stop `"Symposium: solid-state interfaces"` being mangled, and
it works — because that string has a colon and fails the character-class test.
But the test asks **"does this look like a slug?"**, and ordinary prose passes
it: `"vendor exhibition"` and `"early-career mixer"` are both ≤3 words of
letters, spaces and hyphens, so both go to `formatEventType`, which strips
hyphens and title-cases → `"Vendor Exhibition"`, `"Early Career Mixer"`.

**The rule should be a membership test, not a shape test.** `EventType` is
declared at `web/src/types/index.ts:76`. A value is a vocabulary label **only if
it exactly matches a known enum value** (case-insensitively). Everything else is
prose and keeps its own capitalisation, with only the first letter raised.

**Fix direction.** Replace the regex heuristic with a lookup against the
`EventType` union (and whatever fixed activity vocabulary the extractor emits —
find it before assuming `EventType` is the whole list). Delete the word-count
test entirely; word count has nothing to do with whether a string is an enum.

**Risk.** `events/[id]/page.test.ts` asserts several activity chip labels.
Any that assert a title-cased prose activity are asserting the bug — rewrite to
the prose form and comment `B2-09`. Check the seeded/live activity vocabulary
too: if the extractor emits `"poster session"` and that is *not* in `EventType`,
the lookup list must include it or those chips lose their capitalisation.

---

#### B2-10 — Delete the `In person` header chip. `EXTRA`. (A: event 6)

Implements **Ruling 7**, which closed the `POLICY` item A left open.

**Cause.** Plate 03's chip row is four chips and none of them is a format chip:
`Industry summit / + career fair / CCF-B / 88% match`. The format lives in the
subtitle. §1c's line recording an `online/in-person` chip was a transcription
error and §1e corrects it.

**Compounding it:** B-16 added the subtitle, which already prints `in person`.
So the build now states the format **twice** — chip and subtitle.

**Fix direction.** Remove the in-person/online chip from the event header. Leave
the subtitle and the WHERE tile alone; both are on the plate.

**Risk.** Any test asserting the event header chip count, or asserting
`"In person"` appears in the header specifically. A test asserting `"in person"`
appears *somewhere* in the report still passes via the subtitle.

---

#### B2-11 — The compound event kind. `MISSING` / possibly `POLICY`. (A: event 6a, 6b)

Implements **Ruling 14**, which puts the mechanism in the investigator's hands
and forbids hardcoding.

**Cause.** The kind chip renders `formatEventType(event.type)` → `"Summit"`.
Plate shows **two** chips: `"Industry summit"` and `"+ career fair"`.
`Event.type` (`web/src/types/index.ts:76`) is a single coarse enum value.

**What I found, and where I stopped.**

- **The secondary kind looks derivable.** `event.activities` already carries
  `"Recruiting fair, day 3"` in the plate's own example data. A second chip
  built from a recognised activity — career fair, recruiting fair, job fair —
  is honest: it is a fact the event page stated, not an inference.
- **The `Industry` qualifier is NOT derivable and I found no source for it.**
  `EventType` has no industry/academic axis, and nothing upstream extracts one.
  Producing `"Industry summit"` would mean inventing the qualifier.

**Verdict: split the item.**

- **The `+ career fair` chip is a normal fix.** Build it from the activities
  list, matched against a small explicit vocabulary. Show it only when an
  activity actually matches; never guess.
- **`Summit` → `Industry summit` is `POLICY — manager decides`.** There is no
  honest source. **C must not attempt this half.** Manager: either accept
  `"Summit"` as a permanent difference, or fund an extraction change to classify
  events on an industry/academic axis.

---

#### B2-12 — FEE tile drops the early-bird clause. `WRONG SHAPE`. (A: event 1a)

**Cause.** `buildEventFacts` (`web/src/app/events/[id]/page.tsx:348-355`):

```ts
detail: student ? `student ${student}` : undefined,
```

Plate: `student $180 · early bird to Jan 9`. The early-bird deadline is on the
same `headline` fee row the tile already selected (`:329`) — the value is
literally in scope and is simply not read.

**Fix direction.** Append the deadline clause to the FEE detail when the
headline row carries one, in the plate's phrasing (`early bird to <date>`).
Reuse `formatFeeDeadline` (`:215-220`) so B-01's ISO guard still applies — **a
free-text fee deadline must not acquire a year.** Omit the clause when there is
no deadline; do not print an empty separator.

**Risk.** Tests asserting the FEE tile detail string exactly.

---

#### B2-13 — REGISTER BY's sub-line prints a countdown where the plate prints a different fact. `WRONG DATA`. (A: event 1c)

Implements **Ruling 10: suppress, do not substitute.**

**Cause.** `buildEventFacts` (`:364-373`) applies the same `formatDayDistance`
pattern it uses for ABSTRACT DUE, giving `"in 6 months"`. The plate's sub-line is
`"on-site registration available"` — whether walk-in registration is open, which
Peer does not track.

**Fix direction.** **Delete the `detail` from the REGISTER BY tile.** Render the
label and value only. Do not substitute the countdown: a countdown implies the
deadline is hard, and we do not know that it is.

**Excluded from parity scoring — exclusion 7.** A must keep listing it by name.

**Risk.** Any test asserting a REGISTER BY sub-line.

---

#### B2-14 — SCALE abbreviates a number the plate spells out. `WRONG SHAPE`. (A: event 1d)

**Cause.** `:378` — `value: \`~${formatCount(event.expectedSize)}\``.
`formatCount` (`web/src/lib/format.ts:164-169`) returns `"2.4k"` for 2400.
Plate: `~2,400`.

**Fix direction.** Use comma grouping for this tile, not the compact form.
`Intl.NumberFormat("en-US")` gives `"2,400"` directly. **Do not change
`formatCount`** — it is the app's compact-count vocabulary and other surfaces
rely on it.

**Note carried forward from B-05:** `event.expectedSize` is still never
populated by the mapper, so this tile does not appear on real events. The fix is
still correct; it just will not be visible until extraction fills the field.

**Risk.** Minimal — the tile only renders when `expectedSize` is set, which is
fixture-only today.

---

#### B2-15 — Travel grant and invitation letter render as merged cells. `WRONG SHAPE`. (A: event 4c)

Implements **Ruling 15**.

**Cause.** `supportRows` (`web/src/app/events/[id]/page.tsx:1310-1320`) builds
`{ label, detail }` — **two** fields — and renders each as one merged cell. The
cost table around them has four columns (`ITEM` / `STANDARD` / `STUDENT` /
`DEADLINE`), which the plate uses fully for these two rows.

**The two rows do not have the same problem, and must not get the same fix.**

- **Invitation letter — genuinely three columns.** `event.invitationLetter` is a
  boolean (`types/index.ts:147`). `true` means available on request for both
  ticket types, so `STANDARD` = `On request`, `STUDENT` = `On request`,
  `DEADLINE` = `—`. That is three real cells from the data we have. Build it.
  The plate's `Allow 3 weeks` turnaround has **no field**; Ruling 15 says leave
  that cell `—` and invent nothing.
- **Travel grant — one free-text blob.** `event.travelGrant`
  (`types/index.ts:146`) is a single string like `"30 grants available, apply
  with your abstract"`. The plate splits the equivalent across `—` /
  `30 available` / `Apply with your abstract`, but that is three facts a human
  separated. **Do not split the blob on a comma** — that is a guess that will
  mangle real strings. **Render the travel-grant row as a single cell spanning
  the value columns**, with the label in `ITEM`. The row stays aligned with the
  table and the text stays intact.

**Fix direction.** Give `supportRows` a shape that can express both: either
per-column values or one spanning value. Do not force the boolean row into the
blob's shape just to share one code path.

**Risk.** `events/[id]/page.test.ts:216` and `:249-250` supply both fields;
assertions on the merged-cell text will break. Rewrite them to the new column
contract and comment `B2-15`.

---

#### B2-16 — People cards are missing the short descriptor line. `MISSING`. (A: event 7)

Implements **Ruling 13**.

**Cause.** Plate 03's people cards carry five lines; the build renders four.
The missing one is the short descriptor — plate examples: `2 papers in your
feed`, `Matches a topic you typed`. `EventOrg` has a `descriptor` field and the
organisation cards render it correctly (A confirmed an exact match on all three
Tier-0 organisations); `EventPerson` (`web/src/types/index.ts:123-129`) has no
equivalent.

**Fix direction.** Add the field to `EventPerson` and render it in the same slot
the organisation card uses, so the two card types read alike. **Both plate
examples are Tier 0 — computable with no AI key:** one is a count over the local
feed (how many of this person's papers you already have), the other a string
match of the person against the profile's own topics. Produce it in the same
layer that already computes the long `relevance` sentence.

**Do not fill it from the model.** It is a Tier 0 line on the plate; sourcing it
from enrichment would make it disappear for users with no key, which is exactly
backwards.

**Risk.** Roster card snapshot/structure assertions in
`events/[id]/page.test.ts`. Adding a line changes the card's line count.

---

#### B2-17 — Happenings footnote wording. `WRONG SHAPE`. (A: event 3)

**Cause.** `web/src/app/events/[id]/page.tsx:1444-1451`:

```
Highlighted because they line up with your topics
{careerStage ? ` and with where you are — ${careerStage}` : ""}.
Those are the ones you’d be sorry to miss.
```

Plate: *"Highlighted because they line up with your topics and because you're a
**PhD 4** looking at industry — **the poster call and the recruiting fair** are
the two you'd be sorry to miss."*

**Three gaps, and they are not equally closable:**

1. **`PhD Year 4` vs `PhD 4`** — the build prints the full enum value.
   Closable: add a short display form for career stage. Check whether one
   already exists before adding a second mapping.
2. **The close is generic.** `"Those are the ones"` where the plate names the
   highlighted items (`"the poster call and the recruiting fair"`). **Closable
   and worth it** — the component already knows which activities are
   highlighted, so it can list them. This is the sentence's whole point: it
   tells the reader *which* two, not *that* there are two.
3. **`looking at industry` — investigate before building.** This is a sector
   preference. Find whether the profile carries one. **If it does not, mark
   `POLICY — manager decides` and leave the clause out — do not infer a sector
   from a career stage.**

**Risk.** `data-happenings-footnote` is asserted in
`events/[id]/page.test.ts`; any exact-text assertion breaks. Rewrite to the new
contract and comment `B2-17`.

---

#### B2-18 — The cost table's cheapest-way restatement reuses the top callout's string. `WRONG SHAPE`. (A: event 4b)

**Cause.** `web/src/app/events/[id]/page.tsx:748-753`:

```jsx
<strong>Cheapest way in, for you:</strong> {cheapest.short}
```

Plate's table-head form is `Cheapest way in for you: student ticket in
person…` — **no comma before "for you"**, and lower-case after the colon. The
top callout (`:645-653`) keeps the comma, and that one is correct: A confirmed
the top callout is a byte-for-byte match.

B-11 already established (and the comment at `:749-751` records) that both
sites are on the plate deliberately and that the defect was printing the *same*
machine string in both. B-11 fixed the top one. The table-head form is still
punctuated like the callout.

**Fix direction.** Give the table head its own label string without the comma,
and make `cheapest.short` start lower-case so it reads as a continuation of the
colon. Keep the top callout exactly as it is.

**Risk.** `events/[id]/page.test.ts` asserts the cheapest line appears **twice**
(`toHaveLength(2)`) — that count must stay 2. If the assertion matches on the
comma'd string it will drop to 1; repoint it at a substring common to both
forms, or assert each form separately.

---

#### Summary — 18 items

| Class | Count | Items |
|---|---|---|
| `WRONG SHAPE` | 9 | B2-01, B2-02, B2-05, B2-08, B2-12, B2-14, B2-15, B2-17, B2-18 |
| `WRONG DATA` | 3 | B2-03, B2-09, B2-13 |
| `MISSING` | 4 | B2-06, B2-07, B2-11 (part), B2-16 |
| `EXTRA` | 1 | B2-10 |
| `POLICY — manager decides` | 2 | B2-11 (the `Industry` qualifier), B2-17 gap 3 (`looking at industry`) |

**Work order for C: top to bottom as numbered.** B2-01 first — it collapses
three of A's findings and the styles it needs already exist. B2-02 and B2-03
next because they are small and independent. B2-06 is the largest and is
explicitly splittable; do the type and render layers first, commit, then attempt
extraction.

**One claim of A's was found incorrect** and is already overruled by Ruling 9:
the contract-length "structural conflict" is not one — one field plus two
formatters produces both plate strings (B2-04).

**New exclusion added by this guide:** item (i), the STARTS tile's `flexible`
sub-line (B2-05). No field, same category as (c)–(h).

**STATUS: COMPLETE.**

---

### Round 2 — Agent C

**STATUS: IN PROGRESS.** Baseline re-established before the first change, as
instructed: **81 files / 815 tests passing, typecheck clean, 1 pre-existing
lint error (`quiz.tsx:46`).** Matches §1's recorded figure exactly. Working
B2-01 → B2-18 in order, one commit per item, gate re-run after each.

- **B2-01 — LANDED.** Added `formatDaysLeft` / `formatDaysAgo` to
  `web/src/lib/format.ts` (report-only countdown vocabulary; `formatDayDistance`
  / `formatDayAge` untouched, still serve the feed/papers/cards). Added a new
  shared helper `web/src/components/reports/report-date.ts`
  (`reportShortDate`) implementing Ruling 8's year-guard (>~12 months out keeps
  the year), since that is report display policy, not a formatting fact, per
  Ruling 8's own instruction not to put it in `format.ts`. Applied to job
  `buildJobFacts` (posted/deadline/start) + `buildTimeline` (all 4 points) and
  event `buildEventFacts` (abstractDue/registerBy values, abstractDue's detail)
  + `deadlineMilestones` (all 4 points) — extended slightly beyond the item's
  three named findings (job 1, job 3, event 1b) to also cover the event
  report's deadline strip dates, since B-09 explicitly designed it to mirror
  the job Timeline "so the two reports agree"; leaving one fixed and the other
  on the old vocabulary would have broken that invariant again. Did **not**
  touch REGISTER BY's detail (still `formatDayDistance`, left for B2-13) or
  `formatFeeDeadline`'s cost-table date display (separate call site, not named
  by this item, verbatim-source-text policy owned by B-01/B-11). Rewrote the
  test assertions B2-01 named (job: sparse-job posted date, both countdown
  strings, all four Timeline points; event: Today milestone) to the plate's
  wording, each with a comment naming B2-01, per the never-delete-a-test rule.
  Added new unit tests for the two format.ts functions, a new dedicated
  `report-date.test.ts` for the year-guard, and a new assertion locking in the
  event ABSTRACT DUE fix (fixture's deadline is 92 days out, the plate's own
  number). **Gate: 82 files / 820 tests passing, typecheck clean, 1
  pre-existing lint error.** Commit: `9d76513`.

- **B2-02 — LANDED.** Added `formatSalaryRange` to
  `web/src/lib/opportunities/salary.ts` as an independent export (plate's
  tile format: spaced en dash, currency repeated on the upper bound, no
  period suffix); `formatSalary` itself untouched, verified byte-identical
  via a new test asserting its exact old output. Job report's SALARY tile now
  calls `formatSalaryRange`; the period lives only in the existing detail
  line. Rewrote the one test asserting the old `"$120k / yr"` tile value, and
  added a new assertion locking the non-equal-min/max case
  (`"$120k – $150k"`). **Gate: 82 files / 824 tests passing, typecheck clean,
  1 pre-existing lint error.** Commit: `abd0786`.

- **B2-03 — LANDED.** `humanize()` in `web/src/app/jobs/[id]/page.tsx` now
  converts underscores to spaces but leaves hyphens alone, and capitalises
  only the first letter of the whole phrase rather than every word —
  `"full-time"` → `"Full-time"`, `"part_time"` → `"Part time"`. No existing
  test asserted the old buggy output, so nothing needed rewriting; added two
  new assertions (one on the existing seven-facts fixture's TYPE detail line,
  one dedicated test covering both the hyphen and underscore paths). **Gate:
  82 files / 825 tests passing, typecheck clean, 1 pre-existing lint error.**
  Commit: `ed9b6e1`.

- **B2-04 — LANDED, with one deliberate deviation from the guide's literal
  step 1.** The guide's fix direction said to "normalise `contractLength` to
  the expanded duration wherever it is produced" — read literally, that means
  editing `extractContractLength` in `web/src/lib/opportunities/job-details.ts`.
  I did **not** touch that file: its own test is named "extracts...
  **a source-preserving** contract phrase" (`job-details.test.ts:59`), i.e.
  keeping the raw scraped text verbatim is itself a recorded, deliberate
  design choice, and §1e reserves extraction-layer changes for B2-06
  specifically ("the one item in this guide that touches extraction"). I
  implemented the expand/abbreviate pair as **render-layer** formatters in
  `web/src/app/jobs/[id]/page.tsx` instead — `expandContractLength` /
  `abbreviateContractLength`, both falling back to the verbatim input when no
  `<number> year(s)/month(s)` parses. This satisfies Ruling 9 (one field, two
  formatters, both plate strings reproduced) without reopening the
  extraction layer or its deliberately-named test. Also renamed the visa
  header chip `VISA_LABELS.sponsors` from "Sponsorship available" to "Visa
  sponsorship" (the other two states have no plate example, left unchanged).
  Rewrote the one test asserting the old wording, and added three new tests
  (expand+abbreviate together, the unparseable-fallback case, hyphen/underscore
  handled earlier by B2-03). **Gate: 82 files / 827 tests passing, typecheck
  clean, 1 pre-existing lint error.** Commit: `2747850`.

- **B2-05 — LANDED (via B2-01, verified here).** The granularity half (month +
  year only, no day-of-month) landed as part of B2-01's `formatDate(...,
  "monthYear")` change, and B2-01's commit already added the code comment
  documenting the "flexible" sub-line's exclusion (item (i), same "no field
  exists" category as (c)-(h)). No further code change was needed, but no
  test locked either half of the contract in specifically for the STARTS
  tile, so this item's commit adds one: asserts `"Oct 2026"` with no day, and
  that the tile has no `data-report-fact-detail` sibling at all (nothing
  invented for "flexible"). **Gate: 82 files / 828 tests passing, typecheck
  clean, 1 pre-existing lint error.** Commit: `bb145ff`.

- **B2-06 — LANDED, all three layers.** Split into two commits as instructed.
  **Layer 1+3** (`edd5212`): added `Job.workMode?: "on-site" | "hybrid" |
  "remote"` in `web/src/types/index.ts`, additive beside `isRemote` (nothing
  that reads `isRemote` changed). Render layer: LOCATION tile's sub-line and
  the subtitle's third segment both read a new `workModeLabel(job)` helper
  that prefers `workMode` and falls back to the old `isRemote`-only "Remote"
  behaviour, so every job scored before this field existed renders exactly as
  before. **Layer 2** (`632bbea`): populated in
  `web/src/lib/jobs/mapper.ts`'s `scoredJobToJob` via a new `jobWorkMode()` —
  turned out not to need new extraction work at all. It reuses the same
  hybrid-detection the facet/filter system already has
  (`opportunityFormat()` in `web/src/lib/opportunities/facets.ts` tests
  `/\bhybrid\b/i` against the location text) rather than inventing new logic:
  "hybrid" / "on-site" only when the location text says so, "remote" from the
  existing `isRemote` signal, `undefined` otherwise — never a guessed
  "on-site" default from silence. Both layers have new dedicated tests
  (`mapper.test.ts`'s new `workMode` describe block; a page-render test
  covering hybrid, on-site and the isRemote fallback). **Gate: 82 files / 833
  tests, 832 passing, typecheck clean, 1 pre-existing lint error.**

  **Unrelated discovery while gating this item**:
  `src/lib/events/benchmark.test.ts` (`describe.skipIf(!hasLiveKey)`, a live
  Tavily-search integration test gated on a real API key in
  `.local-data/profile.json`) started failing partway through this round —
  it asserts a specific real event ("Solid-State Battery Summit") appears in
  live search results, which is normal real-world data drift, not a code
  regression. **Confirmed unrelated to any B2 work**: stashed every
  uncommitted change and reran it in isolation against the last commit before
  B2-06 — it failed identically. Did not touch it, per "do not skip the live
  benchmark." Flagging for A/the manager so it isn't mistaken for something
  this loop broke; it is not one of the 18 items and its assertion was not
  edited.

- **B2-07 — LANDED.** Added `ReportBadge` (`Tier 0`) to
  `web/src/components/reports/why-peer-sent-this.tsx` (shared by both
  reports, so one edit fixes both) and to the event report's "What it costs
  you" `ReportSection`, copying the Skills section's exact markup pattern (a
  `<p>` of badges as the section's first child). Added three new assertions
  (job + event "Why Peer sent this to you", event "What it costs you") — no
  existing test needed rewriting, confirming B2-07's own low-risk read.
  **Gate: 82 files / 833 tests, 832 passing (1 pre-existing live-benchmark
  failure, see B2-06's note — unrelated, unchanged), typecheck clean, 1
  pre-existing lint error.** Commit: `98299bd`.

- **B2-08 — LANDED, exactly as scoped, including the scoring-layer half
  Ruling 12 authorised.** `web/src/components/reports/why-peer-sent-this.tsx`
  now renders one `<p>` instead of two: `body` and `facet` are fused, with
  `facet`'s leading "Because" lower-cased into a trailing clause and a single
  closing period. That alone would still have read as machine-joined
  fragments, since `reasonFor`'s own `" · "` join produced `body` in the
  first place — added `joinReasonClauses` (ordinary sentence conjunction:
  one clause stands alone, two join with "and", three or more become an
  Oxford-comma list) to both `web/src/lib/jobs/scoring.ts` and
  `web/src/lib/events/scoring.ts`, replacing their `" · "` joins. Nothing is
  padded with the region/count specifics the plate's own paragraph names but
  no field carries — same restraint the component's existing comment already
  documented. Rewrote the two job/event report tests that asserted the
  capitalised, un-fused `facetReason` string (the only assertions this
  touched — confirmed by grep, no test anywhere asserted the old `" · "`
  form), and added new scoring-layer tests proving a two-clause reason now
  joins with "and". **Gate: 82 files / 834 tests, 833 passing (1
  pre-existing live-benchmark failure, unrelated, unchanged), typecheck
  clean, 1 pre-existing lint error.** Commit: `2f6db13`.

**Continuation — a fresh C picks up at B2-09.** The C above stalled at 600s
while committing B2-08; nothing was lost, since it had committed per item as
§3 requires. Re-verified the baseline before touching anything: **82 files /
834 tests, 833 passing, typecheck clean, 1 pre-existing lint error
(`quiz.tsx:46`)** — matches §1 exactly. One note on the flaky benchmark: in
this session `src/lib/events/benchmark.test.ts` actually ran and passed (a
real Tavily key is configured in `.local-data/profile.json` here, and the
live search happened to resolve the event this time) — full clean run reads
**82 files / 834 tests passing**, i.e. the flake did not fire this round. Per
§1's own ruling this test is excluded from the gate either way; noting the
pass/fail is genuinely non-deterministic run to run, not something this round
changed.

- **B2-09 — LANDED.** `formatActivityLabel`
  (`web/src/app/events/[id]/page.tsx`) now tests membership against the real
  vocabulary instead of a shape heuristic. Exported `ACTIVITY_LABELS` from
  `web/src/lib/opportunities/event-details.ts` — the extractor's own 25-label
  list (`poster session`, `career fair`, `hands-on session`, …) — and added
  `eventTypes: EventType[]` to `web/src/types/index.ts`, kept beside the union
  the same way `careerStages` / `industryPreferences` already are (per B2-09's
  own warning: `EventType` alone is not the whole vocabulary). A label now
  goes through `formatEventType` only when it exactly matches, case-
  insensitively, one of those two lists; everything else keeps its own words
  and hyphens with only its first letter raised. The word-count test is gone
  entirely — it never told vocabulary from prose apart, only from length.
  **No existing test asserted the old heuristic's behaviour** — grepped the
  whole file; there was no chip-label or activity-highlighting coverage at
  all before this item — so nothing needed rewriting. Added one new test
  covering both a real vocabulary label (`"poster session"` → title-cased,
  unchanged) and the two prose strings this round's own A findings named
  (`"vendor exhibition"`, `"early-career mixer"` → first-letter only, hyphen
  intact). **Left `formatEventType` itself untouched**: a legitimately
  hyphenated vocabulary label (`"hands-on session"`) still loses its hyphen
  through it, exactly as it did before this item — the old heuristic already
  classified it as vocabulary, so this is pre-existing `formatEventType`
  behaviour, not a regression, and not named by this item. **Gate: 82 files /
  835 tests passing, typecheck clean, 1 pre-existing lint error.** Commit:
  `98da026`.

- **B2-10 — LANDED.** Deleted the `<HeaderChip>{event.isOnline ? "Online" :
  "In person"}</HeaderChip>` line from the event header
  (`web/src/app/events/[id]/page.tsx`). Ruling 7 closed the round-1 `POLICY`
  question this round's A log re-raised: the plate's chip row is kind ·
  secondary kind · rank · match %, no format chip, and the subtitle (B-16)
  already prints "in person" / "online" — the chip was a second statement of
  the same fact. Left the subtitle and the WHERE tile alone; only the header
  chip came out. No existing test asserted "In person" as a header chip or a
  header chip count, so nothing needed rewriting — added a new test that
  extracts just the header's chip-row `<div>` and asserts it, confirming the
  subtitle still states the format. **Gate: 82 files / 836 tests passing,
  typecheck clean, 1 pre-existing lint error.** Commit: `231122d`.

- **B2-11 — LANDED, split exactly as Ruling 14 requires.** Built the
  `+ career fair` half only. Added `secondaryEventKind(activities,
  primaryKind)` to `web/src/app/events/[id]/page.tsx`: matches each activity
  string (case-insensitively, substring) against a fixed three-term
  vocabulary — `"career fair"`, `"job fair"`, `"recruiting fair"` — and
  returns the first match verbatim (lower-case, as the plate prints it),
  never a generic "any X fair" pattern. Guarded against restating the primary
  kind a second time: a career-fair event whose own activities also say
  "career fair" gets no secondary chip. Rendered as `+ {secondaryKind}`
  between the primary kind chip and the rank chip, matching §1c's corrected
  order (Ruling 7). **Did not touch the `Industry` qualifier** — no field
  anywhere carries an industry/academic axis, Ruling 14 forbids hardcoding
  it, and this is one of the two items I was explicitly told not to attempt.
  Marking it `POLICY — manager decides` here, restating what B2-11 itself
  already said: the primary chip stays exactly `formatEventType(event.type)`
  with no qualifier. Added three new tests (no existing coverage of the
  header chip row existed before B2-10): the fixture that names "Recruiting
  fair, day 3" produces `+ recruiting fair` and leaves the primary chip as
  plain `Summit`; an event with no fair-type activity gets no secondary chip;
  a career-fair event whose own activities also say "career fair" does not
  duplicate itself. **Gate: 82 files / 839 tests passing, typecheck clean, 1
  pre-existing lint error.** Commit: `f0c9405`.

- **B2-12 — LANDED.** `buildEventFacts`'s FEE tile now appends an early-bird
  clause to its detail line when the headline fee row carries a deadline —
  `"student $180 · early bird to Jan 9"`, matching the plate. Reused
  `cutoffPhrase` (B-11's own extraction, already used by `cheapestWayIn`)
  rather than calling `formatFeeDeadline` directly: `cutoffPhrase` applies
  B-01's ISO guard AND pulls only the date-ish head off a compound string
  ("Early bird ends Jan 9 · $620 after" → "Jan 9"), so the detail line never
  acquires a fabricated year and never drags the trailing price along —
  exactly the two failure modes B-01 and B-11 already fixed elsewhere in this
  same file. Extended the existing fact-tiles test with a deadline on its fee
  fixture and two new assertions, scoped to just the FEE tile's own `<div>`
  (the cost table further down the same page legitimately prints the full
  compound deadline string, "$620" included, in its own DEADLINE column, so a
  page-wide `not.toContain` would have been a false positive). **Gate: 82
  files / 839 tests passing, typecheck clean, 1 pre-existing lint error.**
  Commit: `58f20fe`.

- **B2-13 — LANDED.** Implements Ruling 10. Deleted the `detail` field
  entirely from the REGISTER BY fact — it was the same `formatDayDistance`
  countdown pattern used for ABSTRACT DUE, but the plate's sub-line here is a
  fixed qualitative note ("on-site registration available") stating whether
  walk-in registration is still open, a fact Peer does not track. Printing a
  countdown in its place would imply the deadline is hard, which is not
  something we know — so the slot is left empty rather than filled with a
  different fact. This is a permanent difference from the plate — **exclusion
  7**, already named in §1e; re-listing it here per the standing instruction
  that A must keep excluded items visible every round. `formatDayDistance`
  became unused in this file as a result and was dropped from the import
  list. No existing test asserted this tile's old countdown text, so nothing
  needed rewriting — added a new test asserting the tile has no
  `data-report-fact-detail` sibling at all. **Gate: 82 files / 840 tests
  passing, typecheck clean, 1 pre-existing lint error.** Commit: `ecc9109`.

- **B2-14 — LANDED.** SCALE tile's value now reads `~2,400` instead of
  `~2.4k`. Added a small local `formatScaleCount` (comma grouping via
  `Intl.NumberFormat`) rather than changing `formatCount` in `format.ts` —
  that helper is the app's shared *compact* count vocabulary and other
  surfaces rely on it, same reasoning B2-01 used for the two new date
  formatters. `formatCount` became unused in this file and was dropped from
  the import. Rewrote the one existing assertion that pinned `"~2.4k"`,
  comment naming B2-14, and added a `not.toContain` for the old form. As
  B-05 already noted and this item leaves unchanged: `event.expectedSize` is
  still never populated by any mapper, so this tile does not appear on real
  data yet regardless of its formatting. **Gate: 82 files / 840 tests
  passing, typecheck clean, 1 pre-existing lint error.** Commit: `1557c14`.

- **B2-15 — LANDED, the two rows deliberately took different fixes, as the
  item required.** Added a `CostSupportRow` discriminated union
  (`{ kind: "span", detail }` | `{ kind: "columns", standard, student,
  deadline }`) so `CostsTable`'s support rows can express both shapes without
  forcing one through the other's code path. **Invitation letter** (a
  boolean) now renders three real cells: STANDARD and STUDENT both read
  `"On request"` (or `"Not provided"` when `invitationLetter === false`),
  DEADLINE reads `"—"` — the plate's own `"Allow 3 weeks"` turnaround has no
  field behind it, so that cell stays a dash rather than inventing a number,
  exactly as Ruling 15 requires. **Travel grant** (one free-text string a
  human wrote) still renders as a single cell spanning the value columns —
  splitting it on punctuation would be guessing at structure a real string
  might not share with the fixture's example. Rewrote the one test asserting
  the old merged-cell text (`"Available on request."`); the rewrite needed a
  small new helper, `costSupportRow(html, label)`, since a single regex
  trying to bound one row's start AND end while two rows share the same
  `data-cost-support-row` marker turned out fragile — splitting the HTML on
  `</tr>` and finding the chunk containing the row's own label is simpler and
  cannot cross into the neighbouring row. Also caught during testing: this
  React build renders `colSpan` camelCase in the static HTML output, not
  lowercase `colspan` — a real quirk of the non-standard Next.js/React
  version this repo pins (`web/AGENTS.md`), not a bug in my code; adjusted
  the assertion to match. Added a new test for `invitationLetter: false`.
  **Gate: 82 files / 841 tests passing, typecheck clean, 1 pre-existing lint
  error.** Commit: `078b594`.

- **B2-16 — LANDED.** Added `EventPerson.descriptor?: string` to
  `web/src/types/index.ts` (additive, mirrors `EventOrg.descriptor`'s shape
  and doc comment). Added `personDescriptor(item, context)` beside the
  existing `personReason` in `web/src/app/events/[id]/page.tsx`, same
  priority order as the reason function: an already-populated
  `item.descriptor` wins first, then a Tier 0 local computation — a count of
  this person's papers already in the feed (`context.paperAuthors` is a flat
  one-entry-per-paper-per-author list, so counting a normalised name in it
  literally counts their papers in the feed), then a name-in-declared-topic
  match, in that order, mirroring `personReason`'s own two fallbacks.
  **Deliberately not sourced from `enrichment`/the model** — Ruling 13 is
  explicit that this is a Tier 0 line, and pulling it from the model would
  make it vanish for a reader with no AI key configured, which is backwards.
  Rendered in the same slot the organisation card's own descriptor uses (same
  classes, same position: right after role/institution, right before the
  accent-coloured reason line), "so the two card types read alike" per the
  item's own wording. No existing test touched people-card internals this
  specifically, so nothing needed rewriting. Added three new tests, two using
  `createElement` directly (the existing `renderReport` helper does not
  expose a custom `rosterContext`, and this feature only fires with one): the
  paper-count branch, the topic-match fallback, and — importantly — a
  priority test that gives a person BOTH an explicit `descriptor` AND a
  matching paper-count signal, confirming the explicit value wins rather than
  merely that the fallback was unreachable. **Gate: 82 files / 844 tests
  passing, typecheck clean, 1 pre-existing lint error.** Commit: `4ad3c8c`.

- **B2-17 — LANDED, two of three gaps. The third is `POLICY — manager
  decides`, per instruction — investigated, not built either way.** Added
  `shortCareerStage` (checked `jobs/scoring.ts`'s and `events/scoring.ts`'s
  own `reasonFor` first — neither has a short form, both print the full
  `CareerStage` verbatim, so this is new, not a duplicate) and a local
  `joinNaturally` (mirrors `joinReasonClauses` from B2-08, kept local rather
  than imported since it joins chip labels, not scoring clauses — coupling a
  report component to the scoring module for a two-line join wasn't worth
  it). `happeningsFootnote(highlightedLabels, careerStage)` now builds a real
  sentence naming the actual highlighted chips (whatever the count — singular
  "is the one" vs plural "are the ones", Oxford comma at three or more)
  instead of the old generic "Those are the ones", and shortens the career
  stage to the plate's own form.

  **Gap 3 — "looking at industry".** Investigated as instructed: the profile
  DOES carry a sector preference — `Profile.industryVsAcademia:
  IndustryAcademiaPreference` (`"academia" | "industry" | "both" |
  "startups" | "bigTech"`, `web/src/types/index.ts`) — already read by both
  scoring pipelines (`JobScoringProfile.industryPreference`,
  `EventsFeedRequest["industryVsAcademia"]`) but never plumbed into
  `EventReport`'s props at all. **This is a materially different situation
  from B2-11's `Industry` qualifier**, which has no source anywhere. Here an
  honest source exists. I did not wire it in anyway: I was explicitly told
  this gap is one of two things not to attempt, the manager's to rule on —
  investigating whether the data exists is not the same as deciding whether
  showing it here is the right call (e.g. whether "both" or "bigTech" have a
  sensible clause at all). Marking `POLICY — manager decides` per
  instruction, with the field name on record so the manager's decision, if
  yes, is a small follow-up rather than a fresh investigation.

  Also **widened `page.test.ts`'s own `renderReport` helper**: its
  `careerStage` parameter was declared `= "PhD Year 3" as const` with no
  explicit annotation, so TypeScript inferred the parameter's type as the
  narrow literal `"PhD Year 3"` itself — every existing call happened to
  only ever pass that exact value or omit it, so this had never surfaced,
  but it silently rejected any other real `CareerStage` and I hit it
  immediately testing "PhD Year 4". Changed to an explicit `careerStage:
  CareerStage = "PhD Year 3"` annotation; every existing call is unaffected.
  Added four new tests: the full sentence with a shortened stage and two
  named activities, singular grammar at one, Oxford comma at three, and the
  career-stage clause fully absent when none is known (needed `createElement`
  directly for that last one — a JS default parameter still applies when
  `undefined` is passed explicitly, so `renderReport(event, undefined)` would
  have silently used "PhD Year 3" rather than genuinely testing the
  no-stage case). **Gate: 82 files / 848 tests passing, typecheck clean, 1
  pre-existing lint error.** Commit: `02f4e6a`.

- **B2-18 — LANDED. Last item in the guide.** `CostsTable`'s cheapest-way
  restatement now has its own label text, `"Cheapest way in for you:"` (no
  comma), and lower-cases the first letter of `cheapest.short` so it reads as
  a continuation of that colon (`"…for you: student ticket in person…"`) —
  added a small local `lowercaseFirst`. The top `CheapestCallout` is
  untouched: it keeps its comma and its capital letter, exactly as A
  confirmed byte-for-byte matched the plate. **Caught two pre-existing tests
  this broke, both rewritten, neither deleted, per §2/§3:** (1) the
  `toHaveLength(2)` count on `/Cheapest way in, for you/g` — the comma is no
  longer common to both sites, so this would have silently dropped to 1;
  repointed at `/Cheapest way in,? for you/g` (comma optional), exactly the
  fix the item itself specified, and added a same-test assertion confirming
  the two `<strong>` forms differ. (2) a second, older test ("names the
  travel grant and never signs off with the higher price") asserted the
  table-head's compressed form APPEARS CAPITALISED — that assertion is now
  false by design, since B2-18 lower-cases it on purpose; rewrote it to the
  lower-case form and added a `not.toContain` for the old capitalised
  table-head phrasing, plus a check that the callout itself still reads
  capitalised. Neither test had been named in the guide's own risk section
  (which only anticipated the count), so this was a live catch from actually
  running the gate, not something read off the plan. **Gate: 82 files / 848
  tests passing, typecheck clean, 1 pre-existing lint error.** Commit:
  `6eccd04`.

**All ten of C's items — B2-09 .. B2-18 — are now landed.** Combined with
the previous C's B2-01..B2-08, **all eighteen items in B's round-2 guide are
committed.** Handing back to A for the round-3 measurement.

---

### Round 3 — the MANAGER, doing A's job

**STATUS: COMPLETE.** Measured difference **16%** (84% matched), down from
round 2's 22% and round 1's 50%. Gate: **NOT MET** — 13 differences remain.

**Who ran this and why it matters.** Not an A subagent. Four agents in a row
died on the account's monthly spend limit or a 600s stall; the fourth got two
minutes in and wrote nothing. The manager ran the measurement directly rather
than retry a known-failing spawn. **A future A should treat this round's list
with the same suspicion it would give any other agent's** — and note that the
manager also wrote B2-19 and the whole round-2 guide, so this round has less
independence in it than rounds 1 and 2 did. That is a real weakness of this
round, stated plainly rather than papered over.

#### How I got the build

Same method as rounds 1 and 2: `renderToStaticMarkup` + `createElement` on the
exported `JobReport` and `EventReport` through a throwaway vitest spec
(`web/src/zz-parity-render.test.ts`), dumping five states to disk, then
stripping tags to plain text and diffing against the plate text. Spec and dumps
deleted; working tree clean. No dev server, no orphans.

Fixture: plate 02's and plate 03's own illustrative values throughout,
including the plate's real 22-organisation and 16-speaker tails transcribed
from the PDF, so counts and footnotes diff directly. `nowMs =
Date.parse("2026-07-30T12:00:00Z")` so the plate's own "47 days left" /
"8 days ago" / "92 days left" land exactly. New props supplied: `workMode:
"hybrid"` (B2-06), `sector: "industry"` (B2-19).

Plates re-extracted with PyMuPDF, pages 2-9, letter-spacing normalised.
**Both pages of plate 02's facts row were read** — round 2's A nearly concluded
the TYPE tile had no sub-line because the row wraps across pages 2 and 3.

**Gate re-run this round** (round 2's A skipped it): **82 files / 850 tests,
all 850 passing**, typecheck clean, exactly 1 pre-existing lint error
(`src/components/persona/quiz.tsx:46`). The `benchmark.test.ts` flake did not
fire this run.

---

#### THE FINDING THAT REVERSES A MANAGER RULING

**§1f Ruling 17 is WRONG and is hereby reversed. See §1g.**

Ruling 17 excluded `Summit` to `Industry summit` on the grounds that no honest
source exists and producing it would mean inferring an event's character. C
reported that, the manager accepted it, and **both were wrong** — because
neither read plate **04**.

Plate 04 (PDF page 9) is titled "Events widen past conferences" and prints the
Events tab's kind filter with its full vocabulary:

```
Academic conference · 18    Workshop · 11    Career fair · 6
Industry summit · 5         Expo · 3         Seminar · 9      Hackathon · 2
```

**`Industry summit` is the spec's display label for the `summit` kind**, exactly
as `Academic conference` is its label for `conference`. It is not a judgement
about a particular event. It is a label map, and the build has no label map at
all — `formatEventType()` (`web/src/app/events/[id]/page.tsx:209-213`) just
replaces hyphens with spaces and title-cases every word, which also produces
`Career Fair` where the spec writes `Career fair`.

This was in scope the whole time and three rounds missed it. The lesson for
the next A is in §1g.

---

#### A. JOB REPORT — 5 differences, ranked

**1. Timeline: three copy gaps and one extra line.** Plate: `Posted Jul 22` /
`Today` / `Deadline Sep 15` / `Start Jan 2027`. Build: `Posted Jul 22` /
`Today Jul 30` / `Apply by Sep 15` / `Starts Jan 2027`. (a) The build prints
the date under "Today"; the plate prints the word alone — the reader knows
what today is, and printing it makes the accented milestone read like just
another date. (b) `Apply by` vs plate `Deadline`. (c) `Starts` vs plate
`Start`. The same "Today" defect appears on the event report's deadline strip,
so one fix closes both.

**2. STARTS tile has no sub-line.** Plate: value `Jan 2027`, detail
`flexible`. Build: value `Jan 2027`, no detail element at all. Every other
tile on the row now carries one. `Job` has no field for start-date
flexibility. **New `POLICY — manager decides`** — it is a data-model gap, but
it was never listed in §1e's (a)-(i) table, so it cannot be auto-excluded
under exclusion 8's own terms. Round 2's A flagged the same thing and
correctly noted B-06's fix direction never mentioned it; the round-2 guide
then did not cover it either.

**3. LOCATION sub-line drops the country.** Plate: `Hybrid · US`. Build:
`Hybrid`. `workModeLabel(job)` is the tile's whole detail
(`web/src/app/jobs/[id]/page.tsx:334`) and never appends a country.
`OpportunityPlace.country` exists on the type (`web/src/types/index.ts:105`)
and `Job.place` is already optional-but-present. **Closable — the field
exists**, unlike finding 2.

**4. "Why Peer sent this to you" — the closing clause differs in substance.**
Plate: `...at postdoc level, in California, which you filtered toward 4 times
this week.` Build: `...at postdoc level — because you often view California.`
The section, heading, `TIER 0` badge, placement and one-sentence fusion are all
now exact (B2 closed those). What differs: the plate folds the region into the
match itself and gives a **count** of the filtering behaviour; the build
appends the facet reason as a trailing clause with no count. Round 1's B
flagged this as a scoring-layer change and deliberately scoped it out; it has
never been worked.

**5. Subtitle's third segment lacks its parenthetical.** Plate: `Hybrid (3
days on-site)`. Build: `Hybrid`. B2-06's `workMode` field closed the mode word
itself; the day count has no field. **Residual of excluded gap (b)** — scored
net of the exclusion, listed so it stays visible.

**What now matches exactly, confirmed by render:** header chips —
`Postdoc · Full-time · 3 years · Visa sponsorship · 91% match`, all four
byte-for-byte, closing round 2's finding 2 including the contract-length pair
that round 2's A believed impossible from one field (§1e Ruling 9 was right).
Facts row — 7 of 7 tiles, `SALARY $95k - $120k` with no duplicated period,
`TYPE Postdoc / Full-time · 3-yr contract` with the hyphen intact, `APPLY BY
Sep 15 / 47 days left`, `POSTED Jul 22 / 8 days ago`, `VISA Sponsors / stated
in the posting` — every year dropped and both countdowns in the plate's own
words (§1e Ruling 8 fully landed). Visa quote + `— from the job description`.
Skills section — heading, `New` + `Tier 0` badges, `6 of 9 you already have`,
one flat chip row, 6 with a check then 3 plain. Skills footnote — verbatim.
Junk guard — re-confirmed with round 1's junk fixture. What the role is. To
apply, have ready — `MATERIALS` and `SEEN ON` labelled, net of (c)(d)(e).
Locked block header + "Connect a key". Label casing is CSS `uppercase`, so
`Salary` in the markup renders as the plate's `SALARY` — **not** a difference.

---

#### B. EVENT REPORT — 8 differences, ranked

**1. Kind chip reads `Summit`; plate reads `Industry summit`.** See the
reversal above. The build has no `EventType` to label map at all. Closable, and
it also fixes `Career Fair` to `Career fair` casing wherever kinds are printed.

**2. Second chip reads `+ recruiting fair`; plate reads `+ career fair`.** The
build derives the secondary kind from the activity string
(`recruiting fair, day 3`) and prints the activity's own words. The plate
prints the canonical kind name from the same vocabulary as finding 1. With a
label map in place this becomes a mapping, not an invention: an activity that
resolves to the `career-fair` kind prints that kind's label.

**3. Travel grant is still one merged cell; the invitation letter beside it is
three columns.** Build renders `Travel grant | 30 available, apply with your
abstract` spanning the row, and directly beneath it `Visa invitation letter |
On request | On request | —`. Plate gives both three cells: travel grant is
`—` / `30 available` / `Apply with your abstract`. **§1e Ruling 15 landed for
one of the two rows and not the other.** The data is right there in
`event.travelGrant` and already comma-split in the rendered string.

**4. Costs footnote quotes the wrong price.** Build: `Full price with no grant
would be $480.` Plate: `Full price with no grant would be $620 plus four
nights.` `$620` is the after-early-bird price, which the table's own DEADLINE
cell carries (`Early bird ends Jan 9 · $620 after`). The build uses the
standard column instead, so the footnote **understates the gap it exists to
dramatise** — the whole point of the line is the distance between $180 and the
worst case. (`plus four nights` is excluded gap (h).)

**5. Locked-block item 1 omits its count.** Plate: `The other 29 exhibitors,
judged`. Build: `The other exhibitors, judged`. B2-20 dropped the number
deliberately, to avoid printing a static count that would be wrong on real
data — a sound instinct. But the count is **live** here: it is the untagged
roster tail's length, already computed and already printed by the "Every other
organisation attending · N" heading a few sections above. Print the real one.

**6. "Why Peer sent this to you" — closing clause differs in substance.**
Plate: `...the abstract deadline is 92 days out — the only event in your pool
with all three.` Build: `...92 days out — because you often view San Diego.`
The plate's close is a **comparative claim across the reader's pool**; the
build appends the facet reason. Same shape of gap as job finding 4, different
content, and the plate's version needs a cross-pool comparison the report
layer does not currently have.

**7. Deadline strip: the "Today" date and one label.** Build: `Today Jul 30`,
`Register by Feb 20`. Plate: `Today`, `Register Feb 20`. Same "Today" defect
as job finding 1(a) — one fix closes both reports.

**8. Happenings footnote's close names every chip in full.** Build:
`— Poster session — open call, Symposium: solid-state interfaces, and
Recruiting fair, day 3 are the ones you'd be sorry to miss.` Plate:
`— the poster call and the recruiting fair are the two you'd be sorry to
miss.` The build names all three highlighted chips with their full titles; the
plate names two in shorthand. **C's choice is defensible** — the plate's "the
two" only describes the plate's own fixture — but the result reads long and
repeats text the reader just saw three lines above, and the em-dash inside
`Poster session — open call` collides with the sentence's own em-dash. Listing
it as a difference, not asserting the plate is better.

---

#### C. B2-01 .. B2-19 — confirmed against rendered output

All nineteen landed. **Two landed only partially and are named:**

| Item | Verdict |
|---|---|
| B2-15 (travel grant / invitation letter as three columns) | **Half.** The invitation letter is three columns; the travel grant is still one merged cell. Event finding 3. |
| B2-20 (locked-block copy) | **Landed, one residual.** Event item 1's count was dropped as static; it is live-computable. Event finding 5. |

Everything else confirmed exact by render, including the two the manager wrote
(B2-19's sector clause, and the round-2 guide's Ruling 8/9 date and
contract-length work) — which does not make them independently reviewed.

---

#### D. The number

**16% different (84% matched).**

Method: same 32-element inventory and 1 / 0.5 / 0 scoring as rounds 1 and 2.
**22 exact, 10 half, 0 absent → 27 / 32 = 84% matched.**
Per report: job **12.5 / 14 ~ 89% matched**; event **14.5 / 18 ~ 81%**.

| Round | Difference | Absent | Half | Exact |
|---|---|---|---|---|
| 1 | 50% | 8 | 16 | 8 |
| 2 | 22% | 0 | 14 | 18 |
| 3 | 16% | 0 | 10 | 22 |

Every element scored net of the standing exclusions, per §1d/§1e.

#### E. Exclusions re-listed by name, as §1e requires every round

- **§1d 1-5** — locked promise "How competitive this actually is"; locked
  promise "The role in three clean sentences"; the two quoted-specifics job
  sections (and, as a corollary, their locked-block promise "What this employer
  actually asks for"); the event description paragraph; the "Interested" button.
- **Exclusion 7** — `REGISTER BY`'s sub-line. **Verified still empty this
  round**, which is the ruled-correct behaviour.
- **Exclusion 8** — (c) `ELIGIBILITY` row, (d) `TEAM` row, (e) `· reposted from
  employer site`, (f) `streamed keynotes` / `hybrid keynotes`, (g) venue name,
  (h) `plus four nights`. Gaps (a) and (b) were **not** excluded — B2-06 built
  the work-mode field and closed the mode word on both; job finding 5 records
  the parenthetical that remains.
- **§1f (j)** — `Summit` to `Industry summit`. **THIS EXCLUSION IS WITHDRAWN.**
  See §1g. It is a normal closable difference and is counted as one this round.

#### F. Open POLICY items

1. **STARTS tile's `flexible` sub-line** (job finding 2). No field on `Job`.
   Not covered by exclusion 8's named list, so it needs its own ruling rather
   than an automatic exclusion.
2. **The two "Why Peer sent this to you" closing clauses** (job finding 4,
   event finding 6). Both need work outside the report layer — a filtering
   count for the job, a cross-pool comparison for the event. Neither has been
   scoped. The manager should decide whether they are in scope for this loop or
   are a separate piece of work.

---

### Round 3 — Agent B

**STATUS: IN PROGRESS.** Read §0–§1h in full, then re-read §1/§1h a second time
after discovering the file was being edited concurrently (two commits landed
mid-read — `37a4cb7` adding §1h itself, `8e22255` adding A's round-4 real-search
mandate — both scoped to sections that don't change this round's TODO). Working
the 11 named items top to bottom: correctness first, then the two shared root
causes (the Timeline/deadline-strip "Today" bug, and the missing `EventType`
label map), then missing content by reader impact, then shape/copy. Writing and
committing one item at a time per §3.

I did not change code. Everything below was checked directly against the
current file contents (line numbers cited are from this session's reads, not
copied from an earlier round's log) and, where a risk is named, against the
actual test file to confirm the assertion exists and would actually break.

---

##### B3-01 — Costs footnote quotes the standard price, not the after-early-bird price. `WRONG DATA`. (Event finding 4) **Do this first — a real correctness bug, not just a parity gap.**

**Cause.** `costsFootnote()` (`web/src/app/events/[id]/page.tsx:928-946`) hunts
for "full price with no grant" by taking the highest `fee.standard` across all
rows:

```ts
const fullPrices = fees
  .flatMap((fee) => {
    const value = clean(fee.standard);
    const parsed = value ? parsePrice(value) : null;
    return parsed && value ? [{ value, parsed }] : [];
  })
  .filter(({ parsed }) => parsed.currency === cheapestPrice?.currency);
const full = fullPrices.sort(
  (left, right) => right.parsed.amount - left.parsed.amount,
)[0];
```

On the plate's own data shape, the headline "Early bird" row's `standard`
field is the *discounted* price ($480 — what you pay if you register during the
early-bird window). The true worst-case price ($620) exists only as trailing
text inside that **same row's `deadline` string**: `"Early bird ends Jan 9 ·
$620 after"`. `costsFootnote` never reads `fee.deadline`, so it reports $480 as
"full price with no grant" — understating the exact gap the sentence exists to
dramatise. Confirmed by reading the function directly; this is not a fixture
artefact.

**Fix direction.** Add a small helper that pulls a price out of the *tail* of a
compound deadline string — the part after the date-ish head `cutoffPhrase`
(`page.tsx:145-156`) already extracts. Split on the same `· ` delimiter
`cutoffPhrase` uses and regex-match a `$`/`€`/`£` amount in what's left. For
each fee row, the "full" candidate becomes
`max(parsePrice(fee.standard), priceAfterCutoff(fee.deadline))`, not
`fee.standard` alone. Reuse `parsePrice` (already in scope, `page.tsx:373-381`)
for both.

**Risk.** No existing test currently locks in the $480 bug. Grepped
`web/src/app/events/[id]/page.test.ts` for "480": it appears only in "renders
the plate's fact tiles and a venue-format-duration subtitle" (`:368-418`,
fixture at `:379-386`), which never checks `costsFootnote`'s output — that test
is unaffected either way. The one existing test that *does* check the footnote
text, "puts the travel grant and invitation letter in the cost table only"
(`:313-350`), uses a fixture where `fee.standard` is already `"$620"` directly
with **no** `deadline` field (`:322`) — nothing for the new helper to find, so
`max()` still picks `fee.standard` and
`expect(html).toContain("Full price with no grant would be $620.")` (`:346`)
stays green. **Add a new test**: `fees: [{ label: "Early bird", standard:
"$480", student: "$180", deadline: "Early bird ends Jan 9 · $620 after" }]`
must render `"Full price with no grant would be $620."`, not `"...$480."` —
this is the exact shape that exposed the bug and nothing today asserts it.

---

##### B3-02 — Timeline: "Today" prints a date, and two point labels don't match the plate's Timeline wording. `WRONG SHAPE`. (Job finding 1) **Shared mechanism with B3-03 (event finding 7) — do both files here.**

**Cause.** `buildTimeline()` (`web/src/app/jobs/[id]/page.tsx:375-399`):

```ts
const today = reportShortDate(new Date(nowMs).toISOString(), nowMs);
...
if (today) {
  points.push({ key: "today", label: "Today", value: today, accent: true });
}
...
if (deadline) points.push({ key: "deadline", label: "Apply by", value: deadline });
if (start) points.push({ key: "start", label: "Starts", value: start });
```

Three gaps: (a) the "Today" point computes and prints an actual short date
(`reportShortDate` of `nowMs` itself) as its value, where the plate shows the
bare word "Today" with nothing underneath — printing a date makes the one
accented milestone look like just another date instead of the anchor the
other three are measured against; (b) the deadline point is labelled `"Apply
by"`, plate's Timeline reads `"Deadline"`; (c) the start point is labelled
`"Starts"`, plate's Timeline reads `"Start"`.

**Renderer has no way to omit the value line today.** `TimelinePoint.value`
(`page.tsx:144-149`) is a *required* `string`, and the render
(`page.tsx:766-793`, value printed at `:783-785`) does `<p>{point.value}</p>`
unconditionally.

**Do not confuse this with the facts row — same label text, different
section, only one of them is wrong.** `buildJobFacts` (same file) uses the
identical strings `"Starts"` (`:341`) and `"Apply by"` (`:345`) as *tile*
labels for the STARTS and APPLY BY facts-row tiles, and those are already
confirmed exact matches to the plate's facts row (round 3's "what now matches"
list: `APPLY BY Sep 15 / 47 days left`, and the STARTS tile is untouched by
this item — see B3-06). **A blind find-and-replace of `"Apply by"` →
`"Deadline"` or `"Starts"` → `"Start"` across the file would break the
already-correct tiles.** Change only the Timeline's own two pushes —
`page.tsx:395` (`label: "Apply by"` → `label: "Deadline"`) and `page.tsx:397`
(`label: "Starts"` → `label: "Start"`) — inside `buildTimeline`, not
`buildJobFacts`.

**Fix direction.**
1. Make `TimelinePoint.value` optional (`value?: string`) and wrap the print
   at `page.tsx:783-785` in a conditional
   (`{point.value && <p ...>{point.value}</p>}`) — the same pattern already
   used for every optional `detail` line elsewhere on this page.
2. In `buildTimeline`, push the Today point with no `value` at all:
   `{ key: "today", label: "Today", accent: true }`.
3. Relabel the Timeline's deadline point to `"Deadline"` and its start point
   to `"Start"` — the two lines named above, nowhere else.
4. **This is one fix, not two — apply the identical change to
   `deadlineMilestones()`** (`web/src/app/events/[id]/page.tsx:571-606`). Its
   own Today line (`:580-583`) is the *same code, duplicated between files*:
   `const today = reportShortDate(new Date(nowMs).toISOString(), nowMs); if
   (today) { milestones.push({ key: "today", label: "Today", value: today,
   accent: true }); }`. `DeadlineMilestone.value` (`page.tsx:158-163`) needs
   the same optionality, and `DeadlineTimeline`'s render (`page.tsx:878-917`,
   value printed at `:904-906`) needs the same conditional. B3-03 covers the
   event report's *own* extra label gap on top of this shared piece — do not
   treat that item as "nothing left to do here."

**Risk — `web/src/app/jobs/[id]/page.test.ts:163-268`, "renders all seven
supported facts and the rich report in order," the `timelineSection` block at
`:249-267`:**
- `:258-259` — `expect(timelineSection).toContain("Today");
  expect(timelineSection).toContain("Jul 30");` — the second line **breaks**
  (no date prints under Today any more) and must become
  `expect(timelineSection).not.toContain("Jul 30")`.
- `:261` — `expect(timelineSection).toContain("Apply by");` — **breaks**, →
  `expect(timelineSection).toContain("Deadline")`. Any companion
  `not.toContain("Apply by")` must stay scoped to `timelineSection` (it
  already is, via the regex-matched section substring) — the facts-row tile
  a few hundred lines above still legitimately prints "Apply by," so a
  page-wide assertion would be a false failure.
- `:264` — `expect(timelineSection).toContain("Starts");` — **breaks**, →
  `expect(timelineSection).toContain("Start")`. **Careful:** `"Start"` is a
  substring of `"Starts"`, so a naive `.toContain("Start")` rewrite would pass
  whether or not the label actually changed and would prove nothing. Assert
  something that distinguishes them — e.g. `not.toMatch(/Starts\b/)` alongside
  it, or match the point's own label `<span>` exactly.
- `:118-119` (the sparse-job test) — `expect(html).not.toContain("Apply
  by"); expect(html).not.toContain("Starts");` — this fixture has no
  `applicationDeadline`/`startDate` at all, so neither label renders anywhere
  under any wording. **Unaffected**, no rewrite needed; noted so nobody
  "fixes" it by mistake.

---

##### B3-03 — Deadline strip: same "Today" bug as B3-02, plus its own "Register by" → "Register" gap. `WRONG SHAPE`. (Event finding 7) **Depends on B3-02's shared change; do that one first.**

**Cause, shared half.** Already fixed by B3-02 doing both files —
`deadlineMilestones()` (`web/src/app/events/[id]/page.tsx:571-606`) prints an
actual date under "Today" the same way `buildTimeline` did. Nothing further to
do here for that half once B3-02 lands; do not re-implement it separately.

**Cause, event-only half.** `deadlineMilestones` also pushes:

```ts
if (registration) {
  milestones.push({
    key: "registration",
    label: "Register by",
    value: registration,
  });
}
```

Plate 03's deadline strip reads bare `"Register"` (the *value*, e.g. `Feb 20`,
stays — only the label word "by" drops). This label has no job-side
counterpart to confuse it with; job's Timeline never had a registration point.

**Fix direction.** Change `label: "Register by"` to `label: "Register"` at
that one line. Nothing else about this milestone changes.

**Risk.** Grepped `web/src/app/events/[id]/page.test.ts` for `"Register by"`
and found only a *comment*, not an assertion — at `:456-458`, in "gives the
deadline strip its heading and a Today milestone" (`:447-473`):

> Anchored on the milestone keys, not the visible words: B-05's fact row sits
> above the strip and legitimately repeats "Abstract" and "Register by," so a
> text search finds the tile first.

The test's own author already anticipated this exact tile/milestone label
collision and deliberately asserts `data-deadline-milestone="[a-z]+"` **keys**
(`:459-466`: today/submission/registration/event), never the label text — so
relabelling the milestone to "Register" breaks **no** assertion in this test
beyond the same "Jul 30" one B3-02 already covers (`:471`,
`expect(html).toContain("Jul 30")` → `not.toContain("Jul 30")`). Confirmed by
reading the whole test, not just the grep hit. This is a good pattern to
recognise: the facts-row REGISTER BY tile (`data-event-fact="register-by"`,
tested separately at `:429-445`, "prints REGISTER BY with no invented
sub-line") keeps its own "Register by" label untouched — that tile is correct
today and this item does not touch it.

---

##### B3-04 -- Kind chip reads `Summit`; plate reads `Industry summit`. `WRONG DATA`. (Event finding 1) **Shared mechanism with B3-05 (event finding 2) -- build the map here.**

**Cause.** The primary chip renders `formatEventType(event.type)`
(`web/src/app/events/[id]/page.tsx:1634`), and `formatEventType`
(`:209-213`) is a mechanical humaniser:

```ts
function formatEventType(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
```

De-hyphenate, then title-case every word. There is no label map -- per Sec1g,
plate 04 (PDF page 9) is the spec's own `EventType` -> display-label
dictionary, and it title-cases only the *first* word of a multi-word label
(`Academic conference`, `Career fair`), not every word. `formatEventType`
produces `Career Fair`; the spec's own vocabulary page says `Career fair`.

**`formatEventType` is used for two different things and only one of them is
wrong.** It is also called inside `formatActivityLabel` (`:249-254`) for any
string that matches `KNOWN_ACTIVITY_LABELS` -- the union of `eventTypes` *and*
the broader `ACTIVITY_LABELS` vocabulary (`event-details.ts`), things like
`"poster session"`, `"hands-on session"`, `"keynote"` that are **not**
`EventType` values. B2-09 already confirmed the all-words-title-cased
behaviour is *correct* for that broader vocabulary and left it alone
deliberately. **Do not replace `formatEventType` wholesale** -- that would
re-break `"poster session"`: B2-09's own test locks in `>Poster Session<` for
it (`web/src/app/events/[id]/page.test.ts:492`), and that one must stay green.

**Fix direction.** Add a new, separate map keyed by the actual `EventType`
union (`web/src/types/index.ts:76-85`, imported as `eventTypes` already is at
this file's top):

```ts
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  conference: "Academic conference",
  workshop: "Workshop",
  seminar: "Seminar",
  meetup: "Meetup",
  "job-fair": "Job fair",
  "career-fair": "Career fair",
  summit: "Industry summit",
  expo: "Expo",
  hackathon: "Hackathon",
};
function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABELS[type];
}
```

Seven of the nine come straight off plate 04's own filter row (`Academic
conference`, `Workshop`, `Career fair`, `Industry summit`, `Expo`, `Seminar`,
`Hackathon`). **`Job fair` and `Meetup` are NOT sourced from the plate --
say so plainly.** Plate 04's filter row doesn't show either of those two
kinds at all. They follow the exact same title-case-first-word-only
convention every one of the seven plate-shown labels uses, so the risk of
being wrong is low, but it is a real gap: flag it to A/the manager as
"consistent with the pattern, not verified against the spec," not as
equally confirmed.

- Primary chip (`:1634`): `<HeaderChip>{eventTypeLabel(event.type)}</HeaderChip>`.
- `formatActivityLabel` (`:249-254`): when the candidate string resolves to an
  actual `EventType` (matching case-insensitively and hyphen/space-normalised
  -- `"career fair"` and `"career-fair"` must both hit `career-fair`), route
  through `eventTypeLabel`; only fall through to the existing
  `formatEventType`/first-letter-only branches for the rest of
  `KNOWN_ACTIVITY_LABELS`. A small normalised lookup does this:
  ```ts
  const EVENT_TYPE_BY_TEXT = new Map<string, EventType>(
    eventTypes.map((type) => [type.replace(/-/g, " "), type]),
  );
  function matchEventType(value: string): EventType | undefined {
    return EVENT_TYPE_BY_TEXT.get(value.trim().toLowerCase().replace(/-/g, " "));
  }
  ```

**Risk -- this ripples further than the primary chip, into two other places
that happen to use `"career fair"` as their example activity. Both are real
finds, not restatements of the round-3 log:**

1. **`web/src/app/events/[id]/page.test.ts:636-655`, "builds a secondary
   kind chip from a recognised fair activity"** -- `baseEvent({ type:
   "summit", ... })`, then:
   - `:653` `expect(header).toContain(">Summit<");` -- **breaks**, the primary
     chip now reads `Industry summit`. -> `expect(header).toContain(">Industry
     summit<")`.
   - `:654` `expect(header).not.toContain("Industry");` -- **breaks in the
     other direction** -- the label now legitimately contains "Industry." This
     assertion must be deleted or inverted, and its own comment (`:649-652`,
     "The 'Industry' qualifier has no honest source... the primary chip stays
     exactly what formatEventType produces from the raw enum value") is now
     stale and should be rewritten to explain the reversal (Sec1g) instead of
     citing the withdrawn ruling.
   - `:648` `expect(header).toContain("+ recruiting fair");` is B3-05's own
     target, not this item's -- see below.
2. **Three `happeningsFootnote` tests use `"career fair"` as a highlighted
   activity, and their expected strings will silently go stale** if only the
   header chip is checked before landing this:
   - `:500-524`, "names the highlighted activities and shortens the career
     stage...", `:519`: `"...Poster Session and Career Fair are the ones
     you'd be sorry to miss."` -> `"...Poster Session and Career fair are the
     ones..."`.
   - `:526-540`, "names the reader's own sector lean...", `:538`:
     `"...Poster Session and Career Fair are the ones"` -> `"...Career fair
     are the ones"`.
   - `:573-585`, "Oxford-commas three or more highlighted activities",
     `:583`: `"Poster Session, Career Fair, and Workshop are the ones..."` ->
     `"...Career fair, and Workshop..."`.
   - **`:542-557`, "prints no sector clause...", `:555` is *not* affected** --
     its assertion (`toContain("because you're a PhD 4 -- Poster Session")`) is
     a prefix check that stops before "Career Fair" would appear. Listed so
     nobody "fixes" a test that was never broken.
   These three come from `formatActivityLabel("career fair")` being fed
   through the SAME broken `formatEventType` path today (`"career fair"` is
   in `ACTIVITY_LABELS`, `event-details.ts:44`, as well as being the spaced
   form of the `career-fair` `EventType`) -- confirmed by reading
   `event-details.ts` and cross-checking `KNOWN_ACTIVITY_LABELS`'s
   construction (`page.tsx:245-247`). Fixing `formatActivityLabel` per this
   item's own fix direction changes all four sites (the chip render plus
   these three footnote strings) from one map -- that is the point of doing
   this as one shared mechanism rather than four separate patches.

Grepped the whole `web/src` tree for `"Career Fair"` (capital F) and for any
test asserting a bare `>Conference<`/`"Conference"` chip (the *other* common
default-fixture type, `baseEvent`'s own default is `type: "conference"`,
`:23`) -- no test asserts the primary chip's text for the default type, so the
`Conference` -> `Academic conference` change (which will also happen, since
`conference` is in the same map) breaks nothing beyond the four sites above.

---

##### B3-05 -- Second chip reads `+ recruiting fair`; plate reads `+ career fair`. `WRONG DATA`. (Event finding 2) **Needs B3-04's map.**

**Cause.** `secondaryEventKind()` (`web/src/app/events/[id]/page.tsx:271-289`):

```ts
const SECONDARY_KIND_TERMS = ["career fair", "job fair", "recruiting fair"];

function secondaryEventKind(activities: string[], primaryKind: string): string | undefined {
  const primary = primaryKind.replace(/-/g, " ").toLowerCase();
  for (const activity of activities) {
    const label = activity.toLowerCase();
    const term = SECONDARY_KIND_TERMS.find((candidate) => label.includes(candidate));
    if (term && term !== primary) return term;
  }
  return undefined;
}
```

It returns whichever raw phrase it matched, verbatim. For the round-3 fixture
(`activities: ["Recruiting fair, day 3"]`, plate's own example), it matches
`"recruiting fair"` and prints exactly that -- the activity's own words, not
a kind label. The plate treats "recruiting fair" as a signal that a
career-fair-shaped thing is happening and prints that kind's canonical label,
`+ career fair` -- the same label B3-04's map gives `career-fair`.

**Fix direction.** Once B3-04's map exists, make `SECONDARY_KIND_TERMS` a
lookup from phrase to the `EventType` it's evidence for, and return the
resolved kind instead of the raw phrase:

```ts
const SECONDARY_KIND_TERMS: Record<string, EventType> = {
  "career fair": "career-fair",
  "job fair": "job-fair",
  "recruiting fair": "career-fair",
};

function secondaryEventKind(activities: string[], primaryKind: EventType): EventType | undefined {
  for (const activity of activities) {
    const label = activity.toLowerCase();
    const match = Object.entries(SECONDARY_KIND_TERMS).find(([term]) => label.includes(term));
    if (match && match[1] !== primaryKind) return match[1] as EventType;
  }
  return undefined;
}
```

`"recruiting fair"` maps to `career-fair`, not a `job-fair`/`career-fair`
distinction of its own -- there is no `EventType` for "recruiting fair," and a
recruiting fair is the same kind of thing as a career fair in every source
this app has. Render at the call site (`:1644`):

```tsx
{secondaryKind && <HeaderChip>+ {lowercaseFirst(eventTypeLabel(secondaryKind))}</HeaderChip>}
```

**`lowercaseFirst` already exists** (`page.tsx:172-174`, built by B2-18 for
the cost-table restatement) -- reuse it rather than writing a second
first-letter-lowercase helper. `eventTypeLabel("career-fair")` = `"Career
fair"` -> `lowercaseFirst(...)` = `"career fair"` -> chip reads `+ career
fair`, matching the plate exactly regardless of which of the three phrases
triggered it.

**The "don't restate the primary kind" guard changes shape, for the
better.** The old guard compared normalised *strings* (`term !== primary`,
both lower-cased/de-hyphenated); the new one compares `EventType` values
directly (`match[1] !== primaryKind`) -- a cleaner equality that doesn't
depend on the two representations staying in sync.

**Risk.**
- `web/src/app/events/[id]/page.test.ts:648`,
  `expect(header).toContain("+ recruiting fair");` -- **this is the bug
  itself, locked in by test.** Rewrite to `expect(header).toContain("+
  career fair")`. This is the same test whose OTHER two assertions (`:653`,
  `:654`) B3-04 already breaks for the primary chip -- all three edits land
  in one test.
- `:668-679`, "does not restate the primary kind as its own secondary chip"
  -- `baseEvent({ type: "career-fair", activities: ["career fair"] })`,
  asserts `header.not.toContain("+ career fair")`. Traced through the new
  logic: `secondaryEventKind` matches `"career fair"` -> resolves to
  `career-fair` -> compares to `primaryKind = "career-fair"` -> equal ->
  suppressed. **Still passes, unchanged**, confirming the guard's intent
  survives the redesign.
- `:657-666`, "omits the secondary kind chip when no activity names a fair"
  -- neither "poster session" nor "keynote" matches any term in
  `SECONDARY_KIND_TERMS`. **Unaffected.**

---

##### B3-06 -- STARTS tile's `flexible` sub-line. `MISSING`. (Ruling 20 -- newly ruled IN, build it.)

**The precedent comparison Sec1h asked me to check first -- and the
finding that changes where this code should live.**

Sec1h frames this as a choice between two shapes: `jobWorkMode()`
(structured-field regex, cheap) or `visa.ts`-style extraction (free-text
regex, heavier). I checked what data each actually operates on and where
each actually runs, and **the honest answer is a third thing: the two
precedents don't just differ in what they read, they run at completely
different pipeline stages, and that difference is what actually matters
here.**

- `jobWorkMode()` (`web/src/lib/jobs/mapper.ts:81-85`) runs **inside
  `scoredJobToJob`** (the mapper itself, `mapper.ts:104-169`, called at
  `:144`), reading `item.location` -- a short string every `ScoredJobItem`
  already carries, no fetch required. It runs unconditionally, for every
  job, at render-mapping time.
- `extractVisaState()` (`web/src/lib/opportunities/visa.ts:183-233`) does
  **not** run in the mapper at all. It runs in
  `enrichJobCandidates()` (`web/src/lib/opportunities/enrich.ts:137-196`,
  call at `:170-172`), a **separate, earlier pipeline stage** that (a) only
  runs on the first `MAX_ENRICHMENT_CANDIDATES` (40) items per search, (b)
  requires a successful fetch of the posting's own page
  (`fetchPagesConcurrently`, `:152-157`; `if (!html) return item;` at
  `:161` silently skips extraction when the fetch fails), and (c) writes its
  result onto the `RawJobItem` (`visa?: Job["visa"]`,
  `web/src/lib/jobs/types.ts:50`) *before* scoring ever happens. By the time
  `scoredJobToJob` runs, `item.visa` is already a finished value --
  `visaForAuthorisedCountries()` (`mapper.ts:87-102`) only *filters* it
  (drops it if the country is one the user is already authorised in), it
  never derives it from scratch. **The mapper never touches `html` or the
  posting's free text at all -- it can't, that text isn't in scope by the
  time the mapper runs.**

Sec1h is right that this is "almost certainly the second shape, not the
first" -- no aggregator field states start-date flexibility, it will be a
sentence in the posting body if it's anywhere. But that means the new
extraction **belongs in `enrichJobCandidates()`/`extractJobDetails()`, not
in `scoredJobToJob`/`mapper.ts` at all.** Trying to derive it inside the
mapper the way `jobWorkMode` does would fail immediately: the mapper simply
does not have the posting's body text in scope. This is the "unexpected
finding" worth flagging plainly -- Sec1h's own two-precedent framing reads as
"pick A or B," but the correct answer is neither call site, it's upstream of
both.

**`extractJobDetails()` (`web/src/lib/opportunities/job-details.ts:253-280`)
is a better-fitting precedent than `visa.ts` itself.** It already runs at
exactly the right pipeline stage, on exactly the right input
(`visibleText = stripHtml(html)`, `:257`), and it already extracts
`startDate` specifically, via the same kind of small labelled-phrase
matching Sec1h asks for (`START_LABEL_PATTERN`, `:46-47`;
`extractLabeledDate`, `:180-197`) -- not `visa.ts`'s heavier country-scoped
sponsor/won't-sponsor state machine, which this doesn't need (there's no
evidence quote to render here, only a boolean; the STARTS tile's detail is a
fixed word, "flexible," not a quoted sentence like the VISA tile's "stated in
the posting").

**Fix direction, in pipeline order:**

1. **`web/src/lib/opportunities/job-details.ts`** -- add `startDateFlexible?:
   true` to `JobPageDetails` (`:4-9`). Add a small phrase-match function
   beside `extractLabeledDate`:
   ```ts
   const START_DATE_FLEXIBLE_RE =
     /\b(?:start\s*date|start)\s+(?:is\s+)?(?:flexible|negotiable)\b|\bflexible\s+start\s*date\b|\bstart\s*date\s+(?:is\s+)?open\s+to\s+discussion\b/i;
   function extractStartDateFlexible(text: string): true | undefined {
     return START_DATE_FLEXIBLE_RE.test(text) ? true : undefined;
   }
   ```
   Test this against real posting phrasing before trusting it -- the same
   caveat the round-3 log already raised about `workMode`'s location regex
   "ever mis-firing" applies equally to a brand-new phrase list. Call it from
   `extractJobDetails` (`:253-280`) on the same `visibleText` already in
   scope, spread conditionally like every other field there:
   `...(startDateFlexible ? { startDateFlexible } : {})`.
2. **`web/src/lib/opportunities/enrich.ts`** -- two changes to
   `enrichJobCandidates`:
   - `hasExtractedJobSignal()` (`:43-58`) -- add
     `details?.startDateFlexible ||` to the boolean OR-chain. **Easy to
     miss:** without this, a posting where flexibility is the *only* new
     signal found causes the function to return `false`, and
     `enrichJobCandidates` discards the whole enrichment
     (`if (!hasExtractedJobSignal(...)) return item;`, `:173`) -- the newly
     extracted flag would be silently thrown away.
   - The returned object (`:174-192`) -- add
     `startDateFlexible: item.startDateFlexible ?? details?.startDateFlexible,`
     alongside the existing `startDate: item.startDate ?? details?.startDate,`
     (`:184`).
3. **`web/src/lib/jobs/types.ts`** -- add `startDateFlexible?: Job["startDateFlexible"];`
   to `RawJobItem` (`:25-53`), next to `startDate?: Job["startDate"];`
   (`:46`), matching that file's own convention of referencing the `Job`
   field's type rather than redeclaring it. `ScoredJobItem`
   (`:131-136`) needs no change -- it `extends RawJobItem` with only
   additive fields, so this flows through automatically.
4. **`web/src/types/index.ts`** -- add to `Job` (beside `startDate` at
   `:222`):
   ```ts
   /**
    * Ruling 20. Plate 02's STARTS tile sub-line ("flexible") -- whether the
    * posting itself says the start date can move. Additive; undefined
    * unless the posting states it explicitly, never inferred from silence,
    * exactly like workMode (B2-06).
    */
   startDateFlexible?: boolean;
   ```
5. **`web/src/lib/jobs/mapper.ts`** -- in `scoredJobToJob` (`:104-169`), a
   plain passthrough, **not a derived field** -- add
   `startDateFlexible: item.startDateFlexible,` alongside the other
   straight passthroughs (e.g. `contractLength: item.contractLength,` at
   `:152`). Do **not** write a `jobStartDateFlexible()`-style mapper-local
   function -- there is nothing left to derive by the time this runs; the
   extraction already happened upstream in step 1.
6. **`web/src/app/jobs/[id]/page.tsx`** -- `buildJobFacts` (`:275-373`),
   change the STARTS tile at `:341` from
   `start ? { key: "start", label: "Starts", value: start } : undefined,`
   to:
   ```ts
   start
     ? {
         key: "start",
         label: "Starts",
         value: start,
         detail: job.startDateFlexible ? "flexible" : undefined,
       }
     : undefined,
   ```
   `JobFact.detail` (`:140`) is already optional and already conditionally
   rendered by the shared `ReportFactTile` component -- no render-layer
   change needed beyond this one line.

**C should split this exactly like B2-06 was split** (per the note in
`§4`'s NOTE line): land the type + mapper passthrough + render first and
commit, then attempt the extraction (steps 1-2) as a second commit. If the
phrase list proves unreliable against real postings, stop after the safe
half and report it -- a `Job` that carries the field with nothing populating
it yet is still a usable checkpoint, same reasoning B2-06 used.

**Risk.** `web/src/app/jobs/[id]/page.test.ts:320-333`, "prints STARTS at
month/year only, with no invented sub-line" (B2-05's own test) --
`baseJob({ startDate: "2026-10-01" })` never sets the new field, so
`job.startDateFlexible` stays falsy and `expect(startTile).not.toContain(
"data-report-fact-detail")` (`:332`) **still passes, unchanged.** But its
own comment (`:321-324`, "Job has no such field, so this is excluded under
the same 'no field exists' category... the tile stays absent for now") is
now **factually wrong** once the field exists and should be rewritten to
say the tile correctly stays quiet because *this fixture's posting doesn't
say* the start date is flexible, not because the field doesn't exist.
Rewrite the comment even though the assertion itself needs no change --
leaving a stale "this can't be built" comment next to code that now builds
it is exactly the kind of drift this loop exists to catch.

Add a new test alongside it: `baseJob({ startDate: "2026-10-01",
startDateFlexible: true })` should render `"flexible"` inside the STARTS
tile. And in `web/src/lib/opportunities/job-details.test.ts` (which asserts
`extractJobDetails`'s return via `toEqual({...})` exact-object matches at
every one of its five cases, `:20`, `:35`, `:49`, `:65`, `:77`) -- none of
the existing fixtures contain flexible-start phrasing, so none of those five
break; add a sixth case exercising the new phrase match, in the same
`toEqual({...})` style.

---

##### B3-07 -- Travel grant is one merged cell; invitation letter beside it is three columns. `WRONG SHAPE`. (Event finding 3)

**Cause.** `supportRows` construction (`web/src/app/events/[id]/page.tsx:1583-1600`):

```ts
const supportRows: CostSupportRow[] = [
  travelGrant
    ? { label: "Travel grant", kind: "span", detail: travelGrant }
    : undefined,
  event.invitationLetter !== undefined
    ? { label: "Visa invitation letter", kind: "columns", standard: ..., student: ..., deadline: "--" }
    : undefined,
].filter(...);
```

`CostSupportRow` (`:129-137`) is a discriminated union built by B2-15
specifically so the two rows *could* take different shapes -- invitation
letter (a boolean) already gets `"columns"`; travel grant (one human-written
string) was deliberately kept `"span"`. B2-15's own comment explains why:
"splitting it on punctuation would be a guess that will mangle a real string
differently shaped than the example." That reasoning was sound at the time;
this item is the manager (via the round-3 finding) deciding the split is
worth doing anyway for the shape the plate actually shows, not overriding
the caution as unfounded.

**Plate wants:** `--` / `30 available` / `Apply with your abstract` --
STANDARD dash (travel grants are student-targeted in every example this app
has; `cheapestWayIn`, `:436-438`, already always describes a grant alongside
a *student* ticket), STUDENT the count clause, DEADLINE the how-to-apply
clause.

**Fix direction -- guarded split, not an unconditional one.** Only convert to
three columns when the string visibly has the plate's own two-clause shape
(a count/availability clause, a comma, an application-method clause);
anything else keeps today's single spanning cell exactly as before. This
preserves B2-15's original caution for any real `travelGrant` text that
isn't shaped like the plate's example, while closing the gap for text that
is:

```ts
function travelGrantColumns(value: string): { student: string; deadline: string } | undefined {
  const parts = value.split(",").map((part) => clean(part)).filter(Boolean) as string[];
  if (parts.length !== 2) return undefined;
  return { student: parts[0], deadline: parts[1] };
}
```

Then at the `supportRows` construction, when `travelGrantColumns(travelGrant)`
returns a value, emit `{ label: "Travel grant", kind: "columns", standard:
"--", student: parts.student, deadline: parts.deadline }`; otherwise keep the
existing `kind: "span"` row unchanged.

**A byte-exact match needs one more small step, and it's worth naming
rather than silently attempting.** The round-3 fixture's own value was `"30
available, apply with your abstract"` (confirmed from the log's exact quoted
render -- **not** "30 grants available"), which splits and capitalises
straight into the plate's cells with nothing else needed beyond
`clean()`ing whitespace and capitalising the deadline clause's first letter
(`"apply..."` -> `"Apply..."`, the same inline idiom
`formatActivityLabel`'s fallback branch already uses,
`text.charAt(0).toUpperCase() + text.slice(1)`). A *differently worded* real
`travelGrant` (e.g. "30 grants available, apply with your abstract") would
split into `"30 grants available"` / `"Apply with your abstract"` --
verbatim, not trimmed to "30 available." **Print the clause verbatim rather
than attempting to strip filler words like "grants"** -- that second trim is
a separate, smaller guess on top of the split itself, and isn't needed to
close this finding honestly.

**Risk.** `web/src/app/events/[id]/page.test.ts:313-350`, "puts the travel
grant and invitation letter in the cost table only" -- its fixture is
`travelGrant: "30 grants available"` (`:320`), **no comma at all.**
`travelGrantColumns` returns `undefined` for it (`parts.length === 1`), so
this row still falls through to the existing `kind: "span"` branch --
`expect(grantRow).toContain('colSpan="3"')` (`:343`) and
`expect(grantRow).toContain("30 grants available")` (`:344`) **both stay
green, unchanged.** Confirmed by re-reading this test's exact fixture value,
not assumed. `:270-311` ("names the travel grant and never signs off with
the higher price") uses a comma-containing `travelGrant` (`:280`, `"30
grants available, apply with your abstract"`) but never asserts anything
about the cost-table support row -- only about `cheapestWayIn`'s own
sentence, a separate code path -- so it is unaffected regardless of which
branch the split takes for it. **Add a new test** with the round-3 shape
(`travelGrant: "30 available, apply with your abstract"`) asserting the
three cells `--` / `30 available` / `Apply with your abstract`.

---

##### B3-08 -- LOCATION tile's sub-line drops the country. `MISSING`. (Job finding 3)

**Cause.** The LOCATION tile's `detail` is `workModeLabel(job)` alone
(`web/src/app/jobs/[id]/page.tsx:326-336`, specifically `:334`), which only
ever returns the mode word (`"Hybrid"`/`"On-site"`/`"Remote"`,
`WORK_MODE_LABELS` at `:247-251`). Plate: `Hybrid . US`. The country half is
simply never read here -- `OpportunityPlace.country`
(`web/src/types/index.ts:102-106`) exists on the type and `job.place` is
already populated when a source provides one (passed straight through in
`scoredJobToJob`, `web/src/lib/jobs/mapper.ts:142`, `place: item.place,`).

**Fix direction.** At the LOCATION tile's construction site only (`:326-336`
in `buildJobFacts`), combine the mode word with the country:

```ts
location
  ? {
      key: "work-mode",
      label: "Location",
      value: location,
      detail: [workModeLabel(job), clean(job.place?.country)]
        .filter(Boolean)
        .join(" . ") || undefined,
    }
  : undefined,
```

**Do not fold this into `workModeLabel()` itself** -- that function has a
*second* caller, the subtitle's third segment (`:666`,
`const workMode = workModeLabel(job);`), and the subtitle's plate example is
`Hybrid (3 days on-site)` -- **no country there.** Appending the country
inside `workModeLabel` would leak it into the subtitle too, which the plate
never shows. Keep the country append local to the facts-row tile.

**A residual worth flagging honestly, not silently working around.**
`job.place.country` is normalised upstream to a full country name
(`sanitizePlace` / `matchCountryToken`,
`web/src/lib/opportunities/structured-extract.ts:1130-1134`: `us: "United
States"`, etc.) -- never the two-letter form the plate literally shows
(`US`). Wiring the field in as designed above will print `"Hybrid . United
States"`, not the plate's `"Hybrid . US"`. Grepped the whole tree for an
existing full-name-to-abbreviation map (the *reverse* direction of
`COUNTRY_ALIASES`) and found none. Closing the gap byte-exactly needs a
small new report-scoped abbreviation table (parallel to `reportShortDate`'s
"the report gets its own vocabulary" precedent, B2-01) -- that's a real,
separate, small addition, not something to build silently as a side effect
of this item. **Recommendation: land the field wiring above first (a real,
visible improvement even printing the full country name), then treat the
US/UK-style abbreviation as its own small follow-up if byte-exact plate
matching is wanted** -- don't block this item on it, and don't invent an
abbreviation scheme without saying so.

**Risk.** Grepped `web/src/app/jobs/[id]/page.test.ts` for the LOCATION
tile's detail text -- no test asserts `workModeLabel`'s output string
directly (only presence of the `data-job-fact="work-mode"` attribute, `:106`,
`:200`), so adding the country when present breaks nothing existing. Add a
new test: a job with `place: { country: "United States" }` and `workMode:
"hybrid"` should show `"Hybrid . United States"` in the LOCATION tile
(or the abbreviated form, if that follow-up lands first) -- and a job with
`place` but no country, or country but no `workMode`, should still show
just the one half it has, never an empty `.` separator.

---

##### B3-09 -- Locked-block item 1 omits a count that's actually live-computable. `MISSING`. (Event finding 5)

**Cause.** `EVENT_TIER_UPGRADE_ITEMS` (`web/src/app/events/[id]/page.tsx:62-86`)
is a **module-level constant array**, built once at load time with no access
to any per-event data:

```ts
const EVENT_TIER_UPGRADE_ITEMS = [
  {
    // B-20. Plate 03's wording. The plate hardcodes a count ("The other 29
    // exhibitors, judged"); this block is static and cannot know it, so the
    // count is left out rather than printed wrong.
    title: "The other exhibitors, judged",
    description: "Reads the full list and tells you which strangers are worth your day.",
  },
  ...
];
```

B-20's own instinct not to print an invented static number was right, but
the round-3 finding is correct that the number isn't actually unknowable
here: it's the untagged organisation tail's own length, and that same number
already prints a few sections above, in `RosterSection`
(`:1197-1444`), as `organisationTail = organisations.filter((row) =>
!concerns(row))` (`:1269`) -- the same array whose length feeds the "Every
other organisation attending . N" heading (B3-07 and earlier items don't
touch this; B-07/B2-07 built that heading in round 1-2). **It is genuinely
live** -- it changes as the reader stars organisations (`concerns = reason ||
starred`), so whatever computes it for the locked block must use the same
live inputs `RosterSection` does: `event.organisations`, `context`
(`EventRosterContext`), the enrichment's `judgedAttendees`, and the current
`starredKeys`.

**The render call site** (`:1900-1903`) passes the static array straight
through: `<TierUpgradeBlock items={EVENT_TIER_UPGRADE_ITEMS}
providerConfigured={...} />`. To make item 1's title dynamic, this needs to
become a value computed inside `EventReport` and passed in place of the
constant.

**Where NOT to get the number from: don't duplicate `RosterSection`'s whole
partitioning pipeline.** That component's tail computation depends on
`organisationReason`, `isCachedRosterFurniture`, and a `takeJudgment`
de-duplication shared across both organisations and people (`:1210-1235`) --
reimplementing all of that a second time, purely to get one number, risks
the two counts drifting apart later if only one copy gets edited. **`EventReport`
(`:1438-1489` for its signature) already has every input `RosterSection`
needs, in scope, before it renders either section** -- `event`, `context`
(built at `:1493-1498`), `displayEnrichment` (`:1608-1615`), and
`starredKeys` (received as a prop, `:1445`, populated by
`useRosterStars()` one level up in `EventDetailPage`, not inside
`RosterSection` itself). The clean fix is to hoist the tail-partitioning
logic itself out of `RosterSection` and up into `EventReport`, so both the
roster heading and the locked-block count read from the same one
computation -- not to write a second, separate count function that has to
be kept in sync with the first by hand.

**Fix direction.**
1. Extract the "is this organisation tagged" predicate `RosterSection`
   already computes inline (tier0 reason present, or a matching judgment, or
   starred) into a small shared function both `RosterSection` and
   `EventReport`'s own locked-block construction can call -- or, more
   simply, lift the whole `organisations`/`organisationTail` partition
   (`:1220-1271`) up into `EventReport` and pass the already-partitioned
   lists down into `RosterSection` as props instead of `event` + `context` +
   `enrichment`. Either way, there should be exactly one place that decides
   "tagged vs. untagged," not two.
2. Turn `EVENT_TIER_UPGRADE_ITEMS` into a function,
   `buildEventTierUpgradeItems(untaggedOrganisationCount: number)`, and
   build item 1's title from it: `count > 0 ? \`The other ${count}
   exhibitors, judged\` : "The other exhibitors, judged"` -- falling back to
   today's generic phrasing (not printing "The other 0 exhibitors") when the
   count is zero or there are no organisations at all, so the sentence never
   reads oddly for a small event where nothing is untagged.
3. Call it at the render site with the value computed in step 1, in place
   of the static import.

**Risk.** Grepped `web/src/app/events/[id]/page.test.ts` for `"exhibitors,
judged"`, `"The other"`, `"EVENT_TIER_UPGRADE"` and `"TierUpgradeBlock"` --
**zero hits.** No existing test asserts this text or count at all; this is a
pure addition. `web/src/components/reports/tier-upgrade-block.test.tsx`
(confirmed by two prior rounds' logs) renders its own fixture items, not the
page's constant, so it needs no change either. Add a new test: an event
with, say, 5 organisations where 2 have a Tier-0 reason should render "The
other 3 exhibitors, judged" in the locked block, and toggling a star on one
of the 3 (via the same `starredKeys` prop `RosterSection` reads) should drop
the count to 2 in both the roster heading and the locked-block title in the
same render -- that agreement is the actual point of hoisting the
computation instead of duplicating it.

---

##### B3-10 -- Subtitle's third segment lacks its day-count parenthetical. `NO FIX AVAILABLE THIS ROUND` -- scoped honestly, per the item's own instruction. (Job finding 5)

**What this is a residual of.** Old exclusion (b) in Sec1e's original
"no field exists" table was `Hybrid (3 days on-site) | job subtitle, 3rd
segment`, and Sec1e's own exception text folded (a) and (b) together as "the
same missing fact" and put both in scope for B2-06 to close. **They weren't
quite the same fact.** B2-06 built `workMode`, which correctly supplies the
mode *word* -- the subtitle at `web/src/app/jobs/[id]/page.tsx:713-722`
now correctly prints `Hybrid` as its third segment (`workMode =
workModeLabel(job)`, `:666`). But the plate's full text there is `Hybrid (3
days on-site)` -- a **day-count**, not a mode word, and `workMode` was never
built to carry one.

**I looked for a newly-possible source and found none.** Grepped the whole
`web/src` tree for any existing signal shaped like "days on-site" / "days a
week" / "days per week" -- the only two hits are the doc comments at
`page.tsx:272` and `:662` that already say, in nearly identical words, that
the parenthetical has no field behind it. No extraction anywhere attempts a
per-week on-site cadence, and nothing added by B3-06 or B3-08 (this round's
other job-side items) creates one as a side effect -- `workMode` is a
three-state enum (`on-site | hybrid | remote`), not a day count, and
`startDateFlexible` (B3-06) and the LOCATION-tile country (B3-08) are both
unrelated facts.

**So: nothing is newly possible this round, and there is no fix for C to
work here.** This is functionally an exclusion, but it is *narrower* than
old exclusion (b) as originally written -- (b)'s mode-word half is closed
(B2-06), only the day-count half remains open. Continuing to cite (b) as a
single, still-fully-open item would misstate what's actually true.

**Recommendation to A/the manager:** retire exclusion (b) as originally
worded and replace it with a narrower one -- something like **(b')
`(3 days on-site)` day-count parenthetical only, job subtitle 3rd segment**
-- so the round's bookkeeping doesn't read as though B2-06 left the whole
gap untouched. This is a paperwork correction, not a ruling request; no
`POLICY` decision is needed since there is no candidate fix to rule on.

---
