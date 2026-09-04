# SPEC — Freemium on a system key

**Status:** BINDING contract for the `ABC-freemium` loop. Written 2026-09-04 by the manager from the
owner's decisions. Agents measure against this file. Nothing outside it is in scope.

**Audience:** agents. Precise and technical on purpose.

---

## 0. Scope in one paragraph

Peer moves from BYOK-only to: an operator-funded Gemini key as the default LLM for every signed-in
user (a user's own LLM key still overrides it); an operator-funded Tavily key spent **only** for
trial/paid users; a server-authoritative entitlement (`free` / `trial` / `paid`) that gates AI
features and quotas; weekly rebuilds of the jobs/events pools; a monthly deep-report quota for free
users; a 14-day reverse trial; and removal of "Tier 0/1/2" as user-facing vocabulary. Papers stay
on the free academic sources with zero paid search. Payment integration is **out of scope** — a
hand-settable `plan` column stands in for it.

---

## 1. Product decisions — BINDING (from the owner, 2026-09-04)

- **D1 — LLM.** A system Gemini key (`GOOGLE_API_KEY`, an AI Studio key, consumed through the
  existing `createGeminiApiProvider` path) is the default LLM for every signed-in user in every
  environment. A user-supplied LLM key (the existing BYOK override) takes precedence. No LLM at all
  only when neither exists — that is the existing tier-0 code path, which stays.
- **D2 — Search.** Tavily. Free users: their own Tavily key (existing BYOK) or none → structured
  sources only. Trial + paid users: the system `TAVILY_API_KEY`, spent only on their behalf. Brave
  stays env-only and is **banned** on Vercel. Vertex AI Search and Gemini grounding: code stays,
  never enabled in a deployment (the guard bans their env names).
- **D3 — Pool cadence.** Jobs/events pools rebuild **weekly** (ISO week in the cache key) for
  everyone; papers stay daily (free sources, no paid search). Trial/paid users get a "refresh now"
  action that forces a rebuild. A free user without a Tavily key never triggers a paid search; a
  free user with their own key builds on their own key at the weekly cadence (a mid-week topic
  change is a cache miss on their own key — that is their quota to spend).
- **D4 — Quotas.** Free: **5 deep reports per calendar month**, one counter across papers + jobs +
  events. Trial: **20 deep reports** over the 14 days. Paid: unlimited to the user, behind a hard
  circuit breaker — **200 deep reports/day and 500 system-Tavily searches/day** — that logs at
  error level, records a `breaker` usage event, and degrades to the existing no-LLM path for the
  rest of the UTC day. AI ranking, digest, and query generation are **unlimited for everyone**
  (metered, never capped).
- **D5 — Trial.** 14 days from the first sign-in, full paid behaviour (D2 paid search + D4 trial
  quota), no card. Auto-downgrade to `free` at expiry, computed at read time. The server is the
  authority; the client only displays.
- **D6 — Vocabulary.** No user-facing string may contain "Tier 0", "Tier 1", "Tier 2" or "BYOK".
  The internal `aiTier` number and the tier-0 code paths remain — they are the degrade path.
  Provenance badges that mean "computed without a model" get a plain-language label.
- **D7 — Pricing.** Display only: $12/month, student $6. No payment code. `plan` is a column an
  admin sets by hand (service role). Leave one documented hook where a future Stripe webhook would
  write `plan`.
- **D8 — Never spend an operator key on an unauthenticated request.** Every route that can reach
  `resolveProvider()` or the system Tavily key requires a signed-in Supabase user in deployed
  runtimes.
- **D9 — The nightly digest cron stays no-LLM** (hard-coded `aiTier: 0`) in this loop, so that
  users who never open the app cost nothing. Revisit after launch.

---

## 2. Requirements — A measures each one

Each requirement is scored `MET` / `PARTIAL` / `NOT MET` / `BLOCKED` with evidence (test name,
route behaviour, or grep result). Requirements are grouped; numbering is stable — never renumber.

### R-SEC — no unauthenticated or unentitled spend

- **R-SEC-1.** `GET /api/figure` requires a signed-in user and `protectAiRequest` in deployed
  runtimes. The semantic and vision figure matchers never resolve a server provider without an
  authenticated request context passed in explicitly.
- **R-SEC-2.** Every AI-spending route — the three feeds, digest, the three reports, figure,
  test-digest — calls one shared entitlement check **before** `resolveProvider`.
- **R-SEC-3.** A request body cannot elevate access. `aiTier: 2` (or `deepReport: true`) from a
  non-entitled client is downgraded server-side. The current "downgrade because no provider
  resolved" line in each feed route is replaced by "downgrade because not entitled".
- **R-SEC-4.** `dispatch-digests` remains `aiTier: 0` and never touches a system key (D9), with a
  comment naming D9.

### R-METER — every operator-funded call is recorded

- **R-METER-1.** Every LLM call on a system key writes one `usage_events` row: `user_id`, `kind`
  (`llm`), `path`, `provider`, `model`, `input_tokens`, `output_tokens`, `thinking_tokens`,
  `latency_ms`, `ok`. Implemented as a wrapper around the `DigestProvider` returned by
  `resolveProvider`, so every caller is counted without threading a user id through call sites.
  BYOK calls write the same row with `byok = true` and no cost attribution. **Never the key.**
- **R-METER-2.** Every system-Tavily search writes a `usage_events` row (`kind = search`,
  `surface`, `query_count`), attributed to the user whose request triggered the pool build.
- **R-METER-3.** Per-user counters — `deep_reports_month`, `deep_reports_today`,
  `searches_today` — live in Supabase behind an atomic increment (RPC or single-row upsert). The
  module-scope `Map` in `web/src/lib/security/ai-request.ts` is replaced by this store; the
  existing 60/h feed and 20/h report limits survive cold starts and multiple instances.
- **R-METER-4.** Local dev and tests without Supabase use an in-memory fallback that is clearly
  labelled and **never** selected when the Supabase env is present.

### R-ENT — entitlement is a server concept

- **R-ENT-1.** `profiles` gains `plan` (`free` | `trial` | `paid`), `trial_started_at`,
  `trial_ends_at`, `plan_updated_at`. `handle_new_user` sets `plan = 'trial'`,
  `trial_started_at = now()`, `trial_ends_at = now() + 14 days`. RLS: a user reads their own row;
  only the service role writes `plan*`. Migration file under `web/supabase/migrations/`.
- **R-ENT-2.** A server helper `resolveEntitlement(userId)` returns at least: `plan`,
  `effectivePlan` (trial past `trial_ends_at` → `free`), `deepReportsRemaining`,
  `systemSearchAllowed`, `poolRefreshAllowed`, `trialEndsAt`. Expiry is computed at read time.
- **R-ENT-3.** The entitlement summary is delivered to the client (extend `GET /api/profile` or
  equivalent) and held in the store. `feedsUseAi`, `reportProviderConfigured` and
  `canAttemptOpportunityEnrichment` collapse into **one** predicate reading
  `(entitlement allows AI) || (BYOK override present)`. The two client-side
  `process.env.NODE_ENV === "development"` tests (`ai-tier.ts`, `enrichment.ts`) are deleted.
  **Amendment 2026-09-04 (Ruling 2, binding):** the intent is that **no code shipped to the
  browser decides whether AI is available by testing `NODE_ENV`**. Round-1 A found six such
  tests, not two (`app/page.tsx:961`, `app/page.tsx:988`, `app/papers/[id]/page.tsx:685`,
  `store/feed.ts:266`, plus the two named). All six are in scope: B classifies each by what it
  gates; every one that gates AI availability, entitlement, or an AI-dependent UI state is replaced
  by the single predicate; any that turns out to be an unrelated dev convenience is recorded by
  name and left, and A's scan 2 reports it as an accepted item thereafter.
- **R-ENT-4.** Signed-out users get tier-0 behaviour everywhere, no system spend — unchanged.
- **R-ENT-5.** A dev-only override `PEER_DEV_ENTITLEMENT=free|trial|paid` is honoured only when
  `NODE_ENV === "development"` and not on Vercel, so local runs and tests can exercise every
  persona without Supabase. The guard bans it on Vercel.

### R-POOL — weekly cadence

- **R-POOL-1.** The jobs and events pool cache keys use the local **ISO week** instead of the local
  date; papers keep the local date. `CACHE_KEY_VERSION` is bumped.
- **R-POOL-2.** Entitled users have a "refresh now" action that forces a rebuild (key nonce or
  bypass); each forced rebuild counts against the daily search breaker.
- **R-POOL-3.** A free user with no Tavily key never triggers a Tavily search on any key; jobs and
  events still respond from the free structured sources immediately.

### R-KEY — the system keys

- **R-KEY-1.** `resolveProvider(override)` order: valid BYOK override → system provider
  (`GOOGLE_API_KEY` via `createGeminiApiProvider`) → `null`. This holds in every environment; the
  `NODE_ENV`/`VERCEL` gate in `canUseLocalServerProvider` no longer decides whether a system
  provider exists. `GOOGLE_VERTEX_PROJECT` never takes precedence over `GOOGLE_API_KEY`; Vertex is
  reachable only by an explicit local opt-in that the guard bans on Vercel.
- **R-KEY-2.** The system provider is handed only to authenticated **and** entitled requests
  (R-SEC-2). A BYOK override is honoured for any signed-in user.
- **R-KEY-3.** `resolveKeys` in `jobweb.ts` / `eventweb.ts`: request BYOK Tavily →
  (`entitlement.systemSearchAllowed` ? `process.env.TAVILY_API_KEY` : none) → Brave env (banned on
  Vercel) → none. The system Tavily key is never used for a free user.
- **R-KEY-4.** `UserAiProvider` value `"default"` now means "Peer's AI (included)". Profile copy
  reflects it; `welcome/completeness.ts` no longer treats `"default"` as incomplete.

### R-QUOTA — counting deep reports

- **R-QUOTA-1.** Each deep-report route checks and increments the monthly counter atomically. On
  exhaustion it returns the existing degraded (no-LLM) payload plus a machine-readable
  `quota: { kind: "deep_report", remaining: 0, resetsAt }`; the UI shows an English message —
  "You've used this month's deep reports. Resets in N days." — and an upgrade prompt.
  **Amendment 2026-09-04 (Ruling 3, binding):** the original text here gave the message in
  Chinese; that was the manager's shorthand, not a product decision. The product is English-only
  (B measured zero CJK characters under `web/src`), so the string ships in English as above.
- **R-QUOTA-2.** Trial cap 20 total; paid breaker 200/day; system-search breaker 500/day. A trip
  writes an error-level log line and a `usage_events` row (`kind = breaker`).
- **R-QUOTA-3.** Shallow (abstract-only) paper reports, ranking, digest and query generation are
  **not** counted against the deep-report quota.

### R-UI — what the user sees

- **R-UI-1.** No rendered string contains "Tier 0", "Tier 1", "Tier 2" or "BYOK". The dashboard
  chip shows the plan ("Free" / "Trial · N days left" / "Pro") and whether AI is on.
- **R-UI-2.** Profile AI setup: the "Tier 0 — no AI API" option is gone; the default option reads
  "Peer's AI (included)"; "Use my own key" remains.
- **R-UI-3.** `TierUpgradeBlock` becomes a plan-aware upsell and never renders for paid users.
- **R-UI-4.** Report and digest cache keys discriminate system-AI output from no-AI output
  (`papers/[id]/page.tsx` key, `daily-digest.tsx` key). Ships in the **same commit** as R-KEY-1.

### R-GUARD — the build refuses to ship the wrong shape

- **R-GUARD-1.** `web/scripts/assert-byok-production-env.mjs` is rewritten. On a Vercel build it
  **requires** `GOOGLE_API_KEY`, `TAVILY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`; it **bans** `GOOGLE_VERTEX_*`, `GOOGLE_APPLICATION_CREDENTIALS`,
  `PEER_DIGEST_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `QWEN_API_KEY`, `DASHSCOPE_API_KEY`,
  `DEEPSEEK_API_KEY`, `BRAVE_SEARCH_API_KEY`, `PEER_DEV_ENTITLEMENT`, and `PEER_FEED_AI_TIER > 0`.
  It exits 1 with a message that names every missing and every forbidden variable.
- **R-GUARD-2.** The message never prints a value.

### R-TEST — the gate

- **R-TEST-1.** `registry.test.ts`, `ai-tier.test.ts` and the route tests are rewritten to the
  new contract (assertions rewritten, never deleted). New tests exist for: entitlement resolution
  (trial active / expired / paid), quota increment and exhaustion, breaker trip, figure-route
  auth, the guard script's require/ban lists, and the weekly pool key.
- **R-TEST-2.** The gate (§3 of the state file) stays green at or above baseline.

---

## 3. Out of scope

Stripe or any payment provider; email/SMS alerting (an error-level log line suffices); enabling
Vertex; Gemini grounding; giving the digest cron an LLM; topic vocabulary / pool sharing across
users; the native app under `Peer/` and `Peer.xcodeproj`. Web only.

---

## 4. The manager's reading — UNVERIFIED, check by execution

A prior read of the code produced the list below. It is a **lead list, not a finding list**: B
must confirm each by grep and execution before writing a fix entry, and A must not inherit it as
evidence. Citations may be stale.

- Three independent locks currently stop a system key from doing anything: the prebuild guard
  (`web/scripts/assert-byok-production-env.mjs`, wired as `prebuild`), `canUseLocalServerProvider`
  (`web/src/lib/llm/providers/registry.ts`), and two **client-side** `NODE_ENV === "development"`
  tests (`web/src/lib/feed/ai-tier.ts`, `web/src/lib/opportunities/enrichment.ts`) that Next
  inlines at build time so the browser never even asks. Server-side changes alone do nothing.
- `resolveLocalServerProvider` checks `PEER_DIGEST_PROVIDER`, then `GOOGLE_VERTEX_PROJECT`, then
  `GOOGLE_API_KEY` — the Vertex path uses ADC via a **file path** and does not run on Vercel.
- The feed routes' downgrade line `aiTier = requested >= 2 && !aiProvider ? 0 : requested` is
  today's only defence against a lying client and stops being one once a provider always resolves.
- `GET /api/figure` has no auth and no rate bucket; `semantic-match.ts` and `vision-match.ts` call
  `resolveProvider()` with no override.
- Rate limiting is a module-scope `Map` keyed `${scope}:${user.id}` in
  `web/src/lib/security/ai-request.ts` — per instance, lost on cold start.
- `web/src/lib/llm/usage-log.ts` only `console.log`s; nothing is persisted.
- No `plan`/entitlement column exists on `profiles` (`web/supabase/schema.sql`).
- Report cache keys (`papers/[id]/page.tsx` ~line 695, `daily-digest.tsx` ~line 108) would serve
  cached tier-0 output as AI output once every non-BYOK user looks identical to a tier-0 user.
- `feedAiProvider` / `feedAiApiKey` are stripped from the Supabase sync payload and live only in
  localStorage — the server cannot see them, which is fine (BYOK stays client-supplied per
  request) but means entitlement cannot piggy-back on them.
- The pool cache key (`web/src/lib/opportunities/pool-cache.ts`, `derivePoolCacheKey`) has no user
  id and uses the local calendar date; `dispatch-digests` calls `runFeedPipeline` per enrolled
  user at `aiTier: 0` (papers only, free sources).
- Tavily is called with `search_depth: "basic"` (1 credit) in `jobweb.ts`, `eventweb.ts`,
  `web-search.ts`; jobs budget 12, events 16, papers 0 (`web/src/lib/opportunities/query-budget.ts`).
- The guard's ban list does **not** currently include `TAVILY_API_KEY`; with D2 that key becomes
  *required*, not banned, and its use must be gated by entitlement instead.

---

## 5. How A measures

**Fixture — the requirement checklist.** Score every R-* item. Percentage = (NOT MET + PARTIAL) ÷
(total − manager exclusions). Same denominator every round unless the manager excludes an item by
name.

**Real inputs — five personas through the real routes**, reported per persona, never averaged:
`anonymous`, `free-no-key`, `free-byok-tavily`, `trial`, `paid`. Drive them with `PEER_DEV_ENTITLEMENT`
(R-ENT-5) plus the existing BYOK request shape, against `next dev` or the vitest route harness —
whichever exercises the **actual route handler**. A value obtained by calling a helper directly is
evidence about the helper, never about the route.

**Static scans, every round, each reported even when zero:**
1. Rendered strings matching `Tier 0|Tier 1|Tier 2|BYOK` under `web/src` (components, pages, copy).
2. `NODE_ENV === "development"` in code that ships to the browser.
3. `process.env.TAVILY_API_KEY` reads outside the single gated resolver.
4. `resolveProvider()` calls with no override argument outside the one entitlement-checked path.
5. Routes reachable without `protectAiRequest` that can spend an operator key.

**Gate:** the command and baseline in the state file §3. Report the figures; do not round.
