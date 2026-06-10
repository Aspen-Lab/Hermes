# TODO — pick up tomorrow

Based on tonight's session. Tasks are ordered: triage first, then code.

---

## 0. Wake-up triage (5 min)

- [ ] Check which branch you're on: `git status`
  - If `fix/missing-search-components` — tonight's new work (digest, project fields, three-tier docs, Gemini setup) is mixed with the original filter-bar bug fix. Decide whether to:
    - **Option A (recommended):** split the new feature work onto a fresh branch before pushing — see step 1.
    - **Option B:** push everything together as one big PR (faster but harder to review).
- [ ] Run `git status` to see what's uncommitted vs. committed since last push.

---

## 1. Repo hygiene (15 min)

- [ ] **Open the PR for the filter-bar bug fix** if you haven't already (your `fix/missing-search-components` branch on GitHub).
- [ ] **If splitting:** create `feat/digest-and-project-context`, cherry-pick or move the new feature commits onto it. Files added/modified tonight that belong on the feature branch:
  - `web/src/types/index.ts` (new `currentProject`, `currentChallenges` fields)
  - `web/src/store/profile.ts` (new updaters)
  - `web/src/store/feed.ts` (passes `seedTexts`)
  - `web/src/app/profile/page.tsx` (new EditRow blocks)
  - `web/src/app/api/profile/route.ts` (new column read/write)
  - `web/src/app/api/feed/route.ts` (already accepts seedTexts, no change needed)
  - `web/supabase/schema.sql` (new columns)
  - `web/src/lib/llm/client.ts` *(new)*
  - `web/src/app/api/digest/route.ts` *(new)*
  - `web/src/components/digest/daily-digest.tsx` *(new)*
  - `web/src/app/page.tsx` (digest mounted, paper anchor IDs)
  - `web/package.json` + `package-lock.json` (Anthropic SDK)
  - Doc files: `VISION.md`, `docs/BLUEPRINT_*.md`, `docs/THREE_TIER_ARCHITECTURE.md`, `docs/SETUP_gemini_vertex.md`, `docs/TODO_tomorrow.md`

---

## 2. Plug in an API key and verify the digest actually works (30 min)

- [ ] Decide first key: **Anthropic** (5-min setup) or **Gemini Vertex** (longer, but uses the .json you already have).
- [ ] **If Anthropic:**
  - Sign up at console.anthropic.com, generate a key
  - Add `ANTHROPIC_API_KEY=sk-ant-...` to `web/.env.local`
  - Restart `npm run dev`
  - Refresh the briefing page → "Today, in one paragraph" should appear above the cards
  - Click a `[1]` citation — should scroll to and briefly highlight the matching card
- [ ] **If Gemini Vertex:** follow [docs/SETUP_gemini_vertex.md](SETUP_gemini_vertex.md) end-to-end. Note: this requires the **provider abstraction work in step 4 below to actually wire Gemini in.** So if you only have Vertex, do step 4 before step 2.
- [ ] If you have a Supabase project: re-run `web/supabase/schema.sql` in the SQL editor so the new `current_project` / `current_challenges` columns exist.

---

## 3. Test the new "Project" + "Challenges" profile fields (15 min)

- [ ] Open the profile page → Edit
- [ ] Fill in "Project" with your real LCO cathode project description
- [ ] Fill in "Challenges" with the open problems you're hunting
- [ ] Save → return to feed → click "Refresh recommendations"
- [ ] Verify papers feel more aligned with your specific work (subjective check — it's a soft TF-IDF boost, not a hard filter)

---

## 4. Start BYOK migration — Steps 1+2 from the blueprint (half day)

Per [docs/BLUEPRINT_byok_and_providers.md §6](BLUEPRINT_byok_and_providers.md), refactor without behavior change, then add Gemini.

- [ ] **Step 1:** Extract Anthropic logic from `web/src/app/api/digest/route.ts` into `web/src/lib/llm/providers/anthropic.ts`
  - Define the `DigestProvider` interface in `web/src/lib/llm/providers/types.ts`
  - Make `/api/digest/route.ts` a thin dispatcher
  - Verify nothing changes for users with `ANTHROPIC_API_KEY` set
- [ ] **Step 2:** Add Gemini Vertex provider
  - `npm install @google-cloud/vertexai`
  - Implement `web/src/lib/llm/providers/gemini.ts`
  - Read env vars: `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`
  - Add `PEER_DIGEST_PROVIDER` env switch (`anthropic` | `gemini`)
  - Smoke test with your .json key

---

## 5. Per-card dashboard redesign — Phase 1 of feature plan (half day)

The digest endpoint already returns `headlineFinding` + `keyNumbers` per paper. Wire these into the card UI.

- [ ] Extend `Paper` type with optional `headlineFinding?: string` and `keyNumbers?: { value, label }[]`
- [ ] Plumb the digest response into `feedStore` so cards can read these fields
- [ ] Update `web/src/components/cards/feed-tile.tsx` (or `paper-card.tsx`) to render the new layout from [feature_decisions discussion](BLUEPRINT_deep_dive_with_plan_edit.md):
  - Headline finding at the top in big type
  - Method chips row
  - "Key Numbers" callout box (2-3 stat tiles)
  - "Why it matters" trimmed to 1 line
  - Drill-down (full abstract, authors) collapsed by default
- [ ] Graceful fallback: when `headlineFinding` is absent (Tier 0), render the existing card layout

---

## 6. Optional / nice-to-have

- [ ] Commit the doc files (`VISION.md`, `docs/*.md`) as their own small PR if not already done — they're useful for your collaborator independent of code.
- [ ] If your collaborator pushed to `main` overnight, rebase your feature branch:
  ```
  git fetch origin
  git rebase origin/main
  ```

---

## Parked / next session

Not for tomorrow, but listed so they don't get forgotten:

- Audio briefing real TTS (replace "Listen — soon" placeholder)
- BYOK migration Steps 3-5 (Settings UI, per-user keys, token budgets)
- Specialized sub-agents per content type (papers / events / jobs / industry)
- Weekly recap (3-paragraph Sunday digest)
- Real source adapters for events + jobs (replace mock data)
- Affiliation field wiring into scoring (currently stored, not used)
- Deep-dive mode + plan-preview/edit (per [BLUEPRINT](BLUEPRINT_deep_dive_with_plan_edit.md))

---

## Context recap from tonight

- Read codebase, learned three-surface app (Python CLI + Next.js web + iOS Swift). Web is the active surface.
- Fixed build error by creating missing `filter-bar.tsx` + `filters.ts`. Committed on `fix/missing-search-components`. Filter-bar later got rewritten by collaborator with richer schema; rewrote `filters.ts` to match.
- Changed daily paper cap from 5 → 10.
- Established [VISION.md](../VISION.md) with the three founding principles.
- Studied [bytedance/deer-flow](https://github.com/bytedance/deer-flow) and decided on: synthesized digest + cards + weekly recap + audio button + sub-agents. Parked deep-dive.
- Built the daily digest scaffolding end-to-end (API + component + page integration + graceful no-LLM fallback).
- Added `currentProject` + `currentChallenges` profile fields, plumbed through scoring as `seedTexts`.
- Captured the three-tier architecture from the admin site as canonical doctrine. Tier 0 must always work.
- Drafted BYOK + Gemini Vertex setup blueprints.

Sleep well. Pick this up cold tomorrow — every step above is self-contained.
