# Tier 4 Build Guide — Peer API Efficiency (the "big renovation" tier)

**This guide has two voices in every section:**
- **In plain words** — for a human reader; no jargon.
- **For the implementer** — for an AI agent or engineer; real file paths, approach, gotchas, and the quality bar.

Tier 4 is the deep, structural part of the API-efficiency work. It is **not** quick wins — it's
architecture and safety. Do it **after** Tiers 0–3 are merged and the Tier-0 measurement logging
(`web/src/lib/llm/usage-log.ts`) is live, so every change here can be proven with numbers.

> Golden rule for the whole tier: **never trade output quality for speed.** Every change ships
> behind a flag, is compared against a fixed "golden set" of papers/profiles, and is reverted if
> retrieval or report quality drops. Speed that makes the briefing worse is a bug, not a win.

---

## 0. Before you start (prerequisites)

**In plain words:** Tier 4 needs three things that aren't set up on a laptop-only dev machine: a
real database to store finished work, a place to store images, and the measuring tools from Tier 0.
Get those ready first, or several items here can't be tested.

**For the implementer:**
- **Supabase (Postgres) configured** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`. Without it, `web/src/lib/supabase/*` returns null and every durable-cache
  item degrades to a no-op. `POST /api/read` currently 500s for exactly this reason — fixing it is part of §5.
- **Object storage / CDN** — Supabase Storage bucket (or S3/R2) for figure images. Needed for §4/§5 so
  report JSON stops carrying base64.
- **Tier-0 usage logging merged** (`usage-log.ts`) — extend it into the full gateway in §7.
- **A feature-flag mechanism** — even a simple env-var or profile-field gate — so each item ships dark.
- **A golden set** — a small fixtures folder of `{profile, paper}` pairs spanning empirical / theoretical /
  review / arXiv / PMC / paywalled, plus expected top-10 feed for a couple of profiles. This is the
  regression harness for the quality gates below.

---

## 1. One canonical daily briefing artifact

**In plain words:** Today, the website, the scheduled emails, and the history page each build "today's
briefing" from scratch — same work, three times. Instead, build it **once**, save it as one object for
the day, and have everything read that same copy. Opening the app should *open* today's briefing, not
*rebuild* it.

**Why it matters:** This is the biggest cause of "why does it feel slow / why did it regenerate."

**For the implementer:**
- **Model:** a `DailyBriefingArtifact` keyed on `(localDate, profileFingerprint, pipelineVersion)` — not
  just topics. Fields: `papers`, `events`, `jobs`, `digest`, `aiMode`, `status: partial|complete|stale`,
  `generatedAt`, `expiresAt`, `diagnostics{traceId}`. Store in Supabase; mirror a lightweight copy in the
  client feed store (`web/src/store/feed.ts`) for instant open.
- **Split the overloaded `loadFeed()`** into explicit operations: `loadToday()` (read-through, no
  regeneration), `regenerateToday({force})`, `loadMore(cursor)`, `invalidateForProfileChange()`.
- **Opening the page must NOT advance `recently-shown` history** — that mutation is what changes the paper
  set on reload and busts the digest cache. Only `regenerateToday`/`loadMore` advance novelty.
- **Reuse the scheduler's output:** `web/src/app/api/jobs/dispatch-digests/route.ts` already stores briefing
  payloads and `web/src/app/api/briefings/route.ts` serves them — but home never reads them. Wire home to
  consume the same artifact.
- **Gotchas:** the fingerprint must include every output-affecting profile field (topics, methods, venues,
  sourceMix, freshness, count, advisor seeds) but **no secrets** (no API keys). Cache keys are public.
- **Quality gate:** same-day reload returns the identical artifact with zero new source/model calls; a
  profile edit invalidates it exactly once.

---

## 2. Canonical paper analysis vs personalized overlay

**In plain words:** A paper's deep report has two kinds of content: a "general" part that's the same for
everyone (what the paper found), and a small "just-for-you" part (why it fits *your* project). Right now
both are made in one expensive AI call, so every person regenerates the whole thing. Split them: compute
the general part once, reuse it for everyone, and only redo the tiny personal part.

**Why it matters:** Turns most repeat report opens (across users and sessions) from a ~60–90s AI job into
an instant lookup plus one cheap personalization step.

**For the implementer:**
- **Current blocker (verified):** `buildPass2Prompt` in `web/src/lib/papers/deep-report.ts` injects
  `userContext: contextHint` into the *single* Pass-2 call that also emits the reusable body. So the
  expensive part is entangled with personalization today. This is a real prompt/architecture change, not a
  cache tweak.
- **Target layers:** `PaperIdentity → DocumentArtifact → CanonicalPaperAnalysis → PersonalizedPaperOverlay`.
  - `CanonicalPaperAnalysis`: user-neutral report + claims linked to evidence + requested figure labels.
    Cache key: `(contentHash, extractorVersion, reportSchemaVersion, model, depth)` — **no user fields**.
  - `PersonalizedPaperOverlay`: relevance-to-you, project/method fit, next action. Small, private, cache key
    adds a compact `hash(userIntent)`.
- **Interim safe step (do this first):** an exact-output report cache (see §5) keyed on
  `(paperId, provider, deep, sha256(contextHint))`. Captures the cross-session win without the split; do the
  full split later only if telemetry shows enough cross-user overlap to justify it.
- **Quality gate:** blind-compare split reports vs current single-call reports on the golden set — evidence
  grounding, quote validation, and unsupported-number rejection must not regress.

---

## 3. Real cancellation (AbortSignal end-to-end)

**In plain words:** When you navigate away or a request is replaced, the background work should actually
**stop**. Today several "timeouts" just ignore the result but let the work keep running (and keep costing
money). Wire a single "cancel" that travels all the way down.

**For the implementer:**
- Thread one `AbortSignal` from the browser request → route handler → source adapters (`web/src/lib/sources/*`,
  `_fetch.ts`) → full-text/figure fetchers (`web/src/lib/papers/*`, `web/src/lib/figures/*`) → the provider
  gateway (§7). Cancel losing hedged requests; use one total operation deadline instead of every stage/retry
  getting its own fresh deadline.
- Replace `Promise.race`-around-started-work patterns (`web/src/lib/feed/pipeline.ts`,
  `web/src/lib/opportunities/shared.ts`) with real cancellation.
- Client: give superseded `fetch`es an `AbortController` (the figure component already got one in Tier 1;
  extend the pattern to feed/report/digest fetches in `web/src/store/feed.ts` and `apiFetch` call sites).
- **Gotcha:** shared, in-flight-deduplicated promises (e.g. figure `buildCandidatePool`) must **not** be
  aborted by one caller if another still needs them — abort at the right layer, or ref-count.
- **Quality gate:** an abandoned report/figure request shows zero continued model/source calls in the Tier-0
  logs after disconnect.

---

## 4. Unified document ingestion (download the PDF once)

**In plain words:** Right now the text part and the figures part of a paper each find, download, and parse
the PDF **separately** — same file, twice. Do it once and hand both jobs the result.

**For the implementer:**
- Two subsystems duplicate discovery/paywall/HTML/PDF work today: `web/src/lib/papers/{source-links,
  full-text,pdf-text}.ts` and `web/src/lib/figures/{extract,pdf-extract}.ts`.
- Create one `DocumentArtifact` per paper+version: canonical ids, trusted source URLs, ordered
  headings+text, evidence spans, captions, references to extracted image assets, `sourceHash`,
  `extractorVersion`. One PDF download + one bounded extraction job emits **both** text and figure metadata.
- **Gotcha (verified):** `pdf-extract.ts` deliberately sends a browser User-Agent because some publisher/
  EuropePMC/JSTOR CDNs 403 a "Bot" UA. Preserve that when unifying, or figure fetches will start failing.
- Start high-probability sources immediately while slower discovery runs concurrently; staggered bounded
  races; cancel losers (ties into §3).
- **Quality gate:** one download+parse per artifact version; figure availability and caption grounding do
  not drop vs today.

---

## 5. Durable caching + images out of JSON

**In plain words:** Save finished reports and extracted pages in the database (not just the browser), and
put figure images in proper image storage — not stuffed into the report as giant text blobs. Today a rich
report can be so big it overflows browser storage, fails to save, and gets regenerated.

**For the implementer:**
- Replace process-local `Map` caches (`full-text.ts`, `figures/extract.ts`, `figures/pdf-extract.ts` — all
  lost on serverless cold start) and browser-`localStorage` report cache with:
  - a Supabase table for report/extraction metadata (`paper_reports`, `document_artifacts`), bounded
    positive **and** negative TTLs, and a single-flight lock for cold misses;
  - object storage/CDN for image assets; report JSON carries **stable figure IDs/URLs**, never base64.
- Cache keys must include content hash + extractor version + prompt/schema version + model + depth
  (a report built from incomplete metadata must not share a key with the later enriched one).
- Fix `POST /api/read` (currently 500 when Supabase is absent) as part of turning Supabase on.
- **Quality gate:** warm/cached report open < ~500ms; report JSON contains no base64; a cache entry never
  serves output from a different schema/model version.

---

## 6. Adaptive retrieval (only behind quality gates)

**In plain words:** Instead of always querying every paper source for every search, run a small fast first
wave, check if it's good enough, and only reach for more sources if it's missing something. **Caution:** the
current fan-out is already efficient, so this is easy to get wrong and *lose* good results. Only do it if the
numbers prove it helps.

**For the implementer:**
- This is where my audit and the handoff **disagree**. Verified Finding 19 says the current fan-out
  (`web/src/lib/feed/pipeline.ts`, all sources under one `Promise.allSettled` wall) is already efficient and
  trimming risks recall. So treat this as **low priority / prove-first**.
- If pursued: first wave from declared topics/venues → dedupe + local rank → measure count, score, topic/venue
  coverage, diversity → expand to redundant/domain-specific sources **only** if thresholds are missed. Derive
  per-source candidate limits from requested top-N.
- **Hard rule:** the second wave MUST run whenever any count/relevance/coverage/diversity threshold is missed.
  Never reduce coverage blindly.
- **Quality gate:** precision@10, nDCG@10, topic/venue coverage, freshness, novelty, dup-rate, and top-10
  overlap must all meet-or-beat the current pipeline on the golden set. If any regress, revert.

---

## 7. Provider model-gateway + budgets (grow the Tier-0 logger)

**In plain words:** Turn the little "receipt printer" from Tier 0 into a proper front desk that every AI call
goes through — one place that enforces size limits, timeouts, cancellation, retries, and a daily spending cap,
and records what everything cost.

**For the implementer:**
- Evolve `web/src/lib/llm/usage-log.ts` + `providers/registry.ts` into a gateway returning a
  `GenerationResult { text, model, provider, latencyMs, usage{input,output,cachedInput}, finishReason,
  requestId }`, and accepting `{ AbortSignal, tier, maxOutput, schema, retryClass, dailyBudget, promptVersion,
  traceId }`.
- Enforce: consistent output caps (Tier 1 already fixed Gemini; make it uniform), one timeout policy, retry
  only retryable 429/5xx with jitter (never auth/quota/invalid-input), and a per-user/day token budget.
- Consider provider-native prompt/context caching (Anthropic, Gemini) for large stable prefixes — a supplement
  to Peer's own artifact cache, not a replacement.
- Fix the `ollama` registry entry (currently a Gemini placeholder).
- **Quality gate:** token/latency/model/finish-reason visible per call; daily budget actually stops overspend;
  fallback escalation is logged, not silent.

---

## 8. Security & hardening (before any public scale)

**In plain words:** The AI endpoints are powerful and currently pretty open. Before letting more people use
them, add locks: require a signed-in (or budgeted-anonymous) user, cap how much each person can spend, and make
sure the "go fetch this paper URL" feature can't be tricked into grabbing private/internal web addresses.

**For the implementer:**
- `digest`/`report`/`figure` routes: require authenticated or explicitly anonymous-budgeted sessions;
  per-user/IP concurrency + daily spend limits; accept **canonical paper IDs**, not arbitrary paper objects/URLs.
- **SSRF:** `report`/`figure` accept client-controlled URLs that become server-side fetches. Allowlist legal
  HTTPS sources; reject private/loopback/link-local/metadata (169.254.169.254) targets; validate every redirect;
  bound context/array/caption/source-byte/response sizes.
- Replace any `public` cache headers on personalized POST routes with explicit private artifact caching whose
  keys exclude secrets and include the correct private profile fingerprint.
- **Quality gate:** a crafted request to an internal address is refused; an anonymous flood is rate-limited;
  no secret ever appears in a cache key or log.

---

## Recommended order

1. **§0 prerequisites** (Supabase, object storage, flags, golden set) — nothing else works without these.
2. **§7 gateway** — everything below reports through it.
3. **§5 durable caching** + **§1 daily artifact** — the biggest felt-speed wins.
4. **§3 cancellation** + **§4 unified ingestion** — stop waste, download once.
5. **§2 canonical/personal split** — after §5's interim cache proves the demand.
6. **§8 security** — before any real traffic.
7. **§6 adaptive retrieval** — last, and only if telemetry proves a win.

## Definition of done (the whole tier)

- Opening Peer never regenerates a same-day briefing without an explicit refresh.
- Home, scheduled email, history, and exports all read **one** daily artifact.
- Repeat paper opens reuse a stored canonical analysis; report JSON has no base64.
- Timeouts actually cancel origin/model/extractor work.
- One PDF download+parse per artifact version.
- Daily token budgets are measured and enforced; every call's cost is visible.
- Public expensive routes require auth/budget and are SSRF-safe.
- Every quality gate above passes on the golden set; Tier 0 remains fully useful with no model keys.
