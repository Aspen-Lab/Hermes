# HANDOFF COMPLETE
**Branch:** feature/summary-report-revamp  **Finished:** 2026-08-02  **Status:** COMPLETE

## Ledger summary

10 DONE, 0 outstanding. P10.1 was completed by the previous implementer; P10.2
was correctly left `BLOCKED` by that implementer because the written task
contradicted plate 02, and was unblocked by a reviewer decision (follow the
plate) before the remaining nine were finished.

## Evidence

### Gates

```
cd web
npx vitest run                                    →  81 files, 795 tests, all passing
npx vitest run src/lib/events/benchmark.test.ts   →  1 passed, NOT skipped, override unset
npx tsc --noEmit                                  →  clean, exit 0
npx eslint                                        →  exactly 1 error, the pre-existing
                                                     persona/quiz.tsx:46
```

Baseline entering the phase was 80 files / 778 tests. The suite grew by 17 tests
and no test was deleted to make a change pass — every stale assertion was
rewritten to state the new contract, with a comment saying which task changed it
and why.

### Live job report, read on the running server

`/jobs/jobweb:probe10`, provider configured, rendered order:

```
chips → title → subtitle → action row → facts → TIMELINE → SKILLS AND PROFILE GAPS
   → WHAT THE ROLE IS  ‖  TO APPLY, HAVE READY      (two columns, plate 02's layout)
   → explanation line → SPONSORSHIP READ → WHAT TO EMPHASISE
```

"What the role is" renders as three bullets. Absent, as intended: `How
competitive this actually is`, `The role in three clean sentences`, `Why Peer
sent it`, and the locked upgrade block.

### Live event report, read on the running server

`/events/eventweb:probe10`, provider configured, page fetch failed:

```
chips → title → when/where → action row → milestones
   → WHAT ACTUALLY HAPPENS THERE (whole sentences, no mid-word cut)
   → session-type chips (Tier 0 checklist, unchanged)
   → ORGANISATIONS AT THE EVENT
   → "Peer could not finish reading the programme page this time."
```

Absent, as intended: `A day-by-day plan`, `Why Peer sent it`, and the locked
block — the reader has a key, so they get the explanation rather than an upgrade
pitch. The explanation renders exactly once.

### Defects found and fixed during this phase, beyond the listed tasks

1. **A free report stopped being free.** P10.1 had added `clean(event.shortDescription)`
   to `hasEventEnrichmentCandidates`. Almost every event has a description, so the
   gate that keeps an event report free when there is nothing worth asking about
   started passing everything — roughly a sixfold increase in paid event calls
   across the local pool of 81 events, of which only 13 carry a roster or a real
   talk title. It also broke the Phase 9 route test written to hold exactly that
   line. The condensed description is still produced whenever a call happens for
   a real reason.

2. **Sentence trimming cut inside initials.** "Organised by Y. Nakamura and L.
   Ferreira of the battery group." was trimmed to "Organised by Y. Nakamura and
   L." — a dangling initial, which is the mid-sentence cut the trimming exists to
   prevent. Initials and common abbreviations are now skipped, kept as a test.

3. **Both locked blocks advertised deleted features.** The job block still
   promised the competitiveness verdict and the three-sentence rewrite; the event
   block still promised the day-by-day plan. All three were removed from the
   promise lists in the same commits that deleted the features.

## What I could not do / am unsure about

- The live reports above were rendered against seeded fixtures whose URLs are not
  real, so the page fetch fails and the Tier 1/2 talk and poster sections could
  not be seen end to end on screen. Their behaviour is covered by tests, and the
  "read failed" path is exactly what rendered — but a real conference URL with a
  reachable programme page has not been walked through by hand since P10.8
  widened where titles may be found.
- P10.8 accepts `<li>` and `<td>` candidates. On a page that lists navigation as
  a table this could admit a non-title, and the guard against that is the
  unchanged verbatim check plus a bare-word rejection. Worth watching on a real
  page with an unusual layout.
- The P10.10 export/import exists in the store with tests, but no button is wired
  into Profile settings yet — a local tester can call it, a user cannot click it.
  That UI is a small follow-up and was not in the task's acceptance command.

## Anything I changed that was NOT in the plan

- Removed `matchReason`, `facetReason` and `relevanceReason` from both report
  pages: deleting "Why Peer sent it" left them unused and lint flagged them.
- Replaced the job locked block's "The role in three clean sentences" row with
  "What this employer actually asks for", which is a feature that does still
  exist, rather than leaving the list one item shorter.
- Restored a render-side cap on poster-fit points. Switching to bullets dropped
  it, leaving only the parser's cap; a component rendered directly in a test
  printed all 180 words.
