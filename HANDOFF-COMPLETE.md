# HANDOFF COMPLETE

**Branch:** event-job-relevance-refactor
**Finished:** 2026-07-26T04:14:31.4522053-05:00
**Status:** COMPLETE

## Phases attempted
- [x] Phase 0 — bleeding stop
- [x] Phase 1 — term normalization
- [x] Phase 2 — active-search architecture
- [x] Phase 3 — SKIPPED BY INSTRUCTION
- [x] Phase 4 — benchmark test

## Files changed
HANDOFF-COMPLETE.md — records the required completion signal, evidence, validation, and known limitations.
web/src/lib/opportunities/query-gen.ts — expands the query budget, uses every required topic plus explore-topic pairs, prioritizes specific terms, adds industry-event vocabulary, and includes explore topics in LLM cache/prompt inputs.
web/src/lib/opportunities/query-gen.test.ts — locks the real-profile first-eight query order, vocabulary coverage, all-topic coverage, and hard query cap.
web/src/lib/events/sources/eventweb.ts — searches eight queries concurrently, rejects denied hosts/paths, and requires positive event shape for every web result.
web/src/lib/jobs/sources/jobweb.ts — searches eight queries concurrently across industry and academic sources, rejects article-shaped results, and requires a job URL or explicit hiring language.
web/src/lib/events/pipeline.ts — passes explore topics into query generation and reports pre/post score-floor counts.
web/src/lib/jobs/pipeline.ts — passes explore topics into query generation and reports pre/post score-floor counts.
web/src/lib/events/types.ts — adds the Phase-2 score-floor counts to event pipeline metadata.
web/src/lib/jobs/types.ts — adds the Phase-2 score-floor counts to job pipeline metadata.
web/src/lib/scoring/term-expand.ts — adds canonicalization, morphology, bidirectional materials abbreviations, Unicode whole-word matching, specificity weights, and verified generic-context guards.
web/src/lib/scoring/keyword.ts — adds title/summary scope and replaces topic-count dilution with saturating specificity-weighted scoring while preserving the default paper scope.
web/src/lib/opportunities/shared.ts — carries a short gate summary separately from the full TF-IDF/preference text.
web/src/lib/events/scoring.ts — makes relevance dominant, applies required-topic gates to every source, adds an honest reason fallback, and exports/applies the score floor.
web/src/lib/jobs/scoring.ts — makes relevance dominant, applies required-topic gates to every source, fixes web-job industry classification, adds an honest reason fallback, and exports/applies the score floor.
web/src/lib/events/scoring.test.ts — covers deny signals, event shape, required-topic gates, date exemption, soft/method isolation, broad-two matching, and floor behavior.
web/src/lib/jobs/scoring.test.ts — covers job shape, industry classification, required-topic gates, soft/method isolation, generic-material false positives, and honest reasons.
web/src/lib/events/benchmark.test.ts — adds the key-gated real-profile Cambridge EnerTech benchmark and denied-host assertions.
web/src/lib/scoring/term-expand.test.ts — covers every §3.6 regression plus morphology, abbreviations, Unicode boundaries, score saturation, and paper-scope compatibility.

## Benchmark result
Did the Solid-State Battery Summit appear in the Events top 5?  YES

Actual Events top 5:
1. Meeting Summary-2026 International Round Table on Titanium Production in Molten Salts — tirt7.com
2. Solid-State Battery Summit — cambridgeenertech.com
3. Solid-State Battery Summit 2026 - Battery-Tech Network — battery-tech.net
4. Solid State Battery Summit 2026 - Blue Current — bluecurrent.com
5. The First European Conference on Molten Salt Reactor ... — euagenda.eu

The top 5 contained no denied social, journal/article, or conference-mill hosts and no AI/CS conferences.

Secondary live Jobs top 5:
1. Molten Salt Electrochemistry Summer Internship — INL Careers
2. Molten Salt Chemistry Summer 2025 Internship — INL Careers
3. 2026 Biologics Analytical R&D Intern (PhD) job in North Chicago, IL — careers.abbvie.com
4. PhD Student Internship Opportunities at Thermo Fisher Scientific — grad.wisc.edu
5. ION Exchange Membrane Expert in Amsterdam at AquaBattery — magnet.me

## Test results
Output of `npx vitest run`: 8 test files passed, 1 key-gated benchmark file skipped; 127 tests passed, 1 skipped. The same benchmark passed 1/1 when run with the real snapshot path.
Output of `npx tsc --noEmit`: PASS (no output).
Changed-file ESLint: PASS.
Repository-wide `npx eslint`: the only failure is the pre-existing `web/src/components/persona/quiz.tsx:46` `react-hooks/set-state-in-effect` baseline error.
Output of `npm run build`: PASS. The build retained the pre-existing Turbopack NFT trace warning through the paper report route.
`git diff --check`: PASS.

## What I could not do / what I am unsure about
Phase 3 UI code was intentionally not implemented. Its preserved design is: a centered two-thirds-width search box below surface tabs and hidden on `all`; a default-collapsed Required/Explore panel per papers/events/jobs surface; six independent required/explore topic arrays; a mandatory Zustand persist migration from the old two arrays; and onboarding seeding all three surfaces.
The Tier-3 progressive feed implementation exists on `perf-api-tier0-3`, not on the requested `main` baseline. I did not cherry-pick that unrelated 18-file feature; all event/job relevance scope files were verified identical between the two baselines, and this change does not touch feed/digest/tile code.
The clean `main` baseline does not actually ignore `.local-data/profile.json`, contrary to §2. I never copied the snapshot or key into this worktree; live tests read the original snapshot through an explicit path and never logged secrets.
The final Jobs feed is materially improved and contains real molten-salt/electrochemistry roles, but broad terms such as `ion exchange` can still admit adjacent biomedical or water-technology roles. Per-surface keywords from the deferred Phase 3 design should improve that further.

## Anything I changed that was NOT in the plan
The eight event/job searches now run concurrently inside each adapter. The first Phase-0 live run proved that sequential execution hit the existing eight-second source wall and discarded every web result.
Job web discovery was broadened beyond the old academic-domain whitelist and given job-shape/article-path filtering. A live run proved the old whitelist returned Nature/Science article pages as the entire Jobs top 5; the corrected run returned actual R&D/internship postings.
`events/types.ts` and `jobs/types.ts` were updated because §6.3 requires new pipeline meta fields even though those type files were omitted from the §11 quick-reference table.
`query-gen.test.ts` and the existing event/job scoring tests were expanded beyond the §11 test-file list to lock the specified ordering, quality gates, floor, and honest-reason behavior.
The permanent benchmark accepts an optional `PEER_PROFILE_SNAPSHOT_PATH` override so an isolated worktree can test the real local snapshot without copying an unignored secret; its default remains `web/.local-data/profile.json` as specified.
