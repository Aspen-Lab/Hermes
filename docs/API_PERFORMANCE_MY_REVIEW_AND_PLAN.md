# Peer API Efficiency — Independent Review, Cross-Check, and Final Plan

Author: second review pass (Claude)
Method: 8 parallel code auditors over every API surface → adversarial verification of
each finding (specifically stress-testing whether a proposed speed-up would hurt
output quality) → synthesis. 58 findings raised, **32 survived verification**.
Cross-checked against `docs/API_PERFORMANCE_RESTRUCTURE_HANDOFF.md` (the other agent's review).

No application code was changed producing this document.

---

## 1. Headline conclusion

The two reviews are **complementary, not contradictory**:

- **The handoff doc is stronger on architecture** — the durable daily-briefing artifact,
  progressive Tier-0-first rendering, lane separation, one canonical paper analysis,
  observability harness, and security/SSRF hardening. This is the right *long-term shape*.
- **My audit is stronger on the LLM call mechanics** — the exact, model-aware fixes for the
  Gemini provider (which silently drops every caller's token cap and runs uncapped "thinking"),
  plus a concrete ~50% digest-output cut the handoff missed, plus precise "safe number"
  guardrails so the speed-ups don't quietly degrade results.

Net: adopt the handoff's *structure and sequencing discipline*, but implement the model-layer
changes using my *model/tier-aware* recipes, and take my *zero-risk quick wins first*.

The single most important cross-cutting fact: **the Gemini provider ignores `maxTokens` on every
path and sets no `thinkingConfig` anywhere**, so every LLM call (digest, rerank, report, figures,
query-gen) runs with unbounded output and default "dynamic thinking." Fixing that one provider
layer — correctly — is the highest-leverage change in either review.

---

## 2. Where the two reviews AGREE (high confidence — do these)

| Theme | Handoff | My audit |
| --- | --- | --- |
| Provider can't enforce token budgets; Gemini ignores output limits | P0 "provider abstraction" | Findings 16, 20, 28, 31 (with the exact fix) |
| Reloading regenerates today's briefing needlessly | P0 "reload regenerates" | Finding 5 (cache-key half) |
| Report has no durable server-side cache | P1 "caches not durable" | Finding 11 |
| Serial waterfalls in report + figures | P0 "serial report", "figure explosion" | Findings 12, 13, 21, 22 |
| Show Tier 0 / cached content immediately | P0 "UI hides Tier 0 report" | Findings 4, 10 (streaming) |
| Figure binding can fan into many LLM calls | P0 "figure explosion" | Findings 13, 21, 22 |
| Timeouts don't cancel underlying work | P0 "timeouts" | Findings 6, 7, 24 |
| Report route deadline too tight | "90s vs component ceilings" | Finding 10 (maxDuration=90 < observed 102s) |

---

## 3. What my audit ADDS that the handoff lacks (precision that prevents regressions)

1. **Dead LLM output in the digest (Finding 2 — confirmed, zero risk).** The digest prompt asks
   for per-paper `keyNumbers` (2–3 each) that are **rendered nowhere**, and a `headlineFinding`
   that **duplicates the bullet** already generated for that paper. Removing them cuts digest
   output tokens **~45–55%** with literally zero quality impact. The handoff missed this entirely.
   This is the best single token-saver and it is trivial.

2. **The Gemini fix must be model- and tier-aware — the naive version breaks things.** The handoff
   says "add output limits" abstractly. Doing that in the shared `callModel`/`callApiModel` helpers
   would:
   - **Break deep-report Pass 2** (`tier:"large"` → `gemini-2.5-pro`), whose multi-step reasoning
     is intentional.
   - **Error out**: `gemini-2.5-pro` cannot disable thinking (`thinkingBudget` min 128; 0 is
     rejected and the `catch` would silently skip the model).
   - **Truncate mid-thinking**: on Gemini 2.5/3, `maxOutputTokens` counts thinking tokens, so
     setting it to the raw caller value (e.g. 200) yields empty/garbage output.
   - **Miss Gemini 3** preview models, which use `thinkingLevel`, not `thinkingBudget`.
   The correct fix computes `thinkingConfig` **per model inside the chain loop** and sets
   `maxOutputTokens = output_need + thinking_headroom`.

3. **Concrete "safe number" guardrails** (each verified against the code):
   - Tier-2 rerank: trim the **reasons** count (all 50 → top ~15–20), do **not** cut the 50
     candidate **input** and do **not** cap output at 1200 (that truncates legitimate ranking).
   - PDF extraction: do **not** drop `MAX_PDF_PAGES` to 15 — biomed Results/Discussion start late;
     use a terminal-heading early-exit instead.
   - Figure downscale: target **~1568px lossless**, not 1024px/JPEG (provider-blind + artifacts on
     axis labels/line art).
   - Digest: keep **one batched JSON call**; do **not** split per-paper or switch to NDJSON
     (multiplies the ~450-token system prompt, drops JSON-mode reasoning-leak protection).

---

## 4. Where I DISAGREE or counsel caution (what NOT to rush)

1. **Adaptive source fan-out (handoff P0) — I am skeptical of the payoff.** My Finding 19
   concludes the current 5-source fan-out is **already efficient**: `generatedQueries` is trimmed
   locally at fetch time, sources run under one 8s `Promise.allSettled` wall, and trimming would
   **reduce recall**. External-source latency is not the dominant cost — LLM calls are. The handoff
   itself says "do not reduce source coverage blindly," so we agree on the guardrail; I simply
   would **not prioritize** this, and would gate any change on precision@10 / coverage telemetry
   proving a real win first.

2. **The full "canonical analysis vs personalized overlay" split (handoff) is not a quick win.**
   It's the right long-term shape, but Pass 2 currently **entangles `userContext` into the single
   expensive LLM call**, so the reusable-across-users benefit requires a real prompt/architecture
   change. The safe interim is an **exact-output report cache keyed on `hash(contextHint)`** — do
   the split later only if telemetry shows enough cross-user paper overlap to justify it.

3. **Reject the aggressive figure rewrites.** The batched multi-image vision call and the
   single-call batched figure binding both risk **attribution/precedence** errors (images carry no
   inline ordinal; batching discards the deterministic explicit/keyword matching that runs first).
   Parallelize + early-exit instead — same output, less wall-clock.

4. **Do not attempt the handoff's 7-phase rewrite as one sweep.** Sequence it; prove each tier
   with measurements before the next.

---

## 5. What the handoff UNIQUELY nails (adopt these)

1. **Observability first.** Instrument before changing model behavior. This is methodologically
   correct and it directly protects the "no quality loss" constraint — many of my own impact
   estimates are explicitly *unmeasured* and need telemetry to confirm.
2. **A golden eval set** (fixed profiles + a spread of paper types) before any prompt change.
3. **Security/SSRF hardening** of the `report`/`figure` routes (they accept client-controlled URLs
   that become server-side fetch targets) and auth/quotas on the expensive public routes. My audit
   did not cover this; it matters before anything scales beyond your laptop.
4. **One canonical daily artifact** shared by home / cron / email / export.

---

## 6. Final plan (tiered, sequenced, quality-gated)

Everything below is **shareable app code** — it goes in its own PR series, **separate from the
local-saver** (which stays uncommitted per your earlier instruction).

### Tier 0 — Instrument (do before touching model behavior)
- Add lightweight per-LLM-call logging in the provider layer: model, input/output tokens
  (Gemini returns `usageMetadata`), latency, finish reason. Never log keys, private profile text,
  full paper text, or base64 images.
- Stand up a tiny golden set (a handful of fixed `{profile, papers}` fixtures) to eyeball
  digest/report/figure quality before-and-after.
- *Purpose: make every later change measurable and prove "no quality loss."*

### Tier 1 — Safe, high-leverage token + latency wins (small, low risk)
1. **Remove dead digest output** — drop `keyNumbers`; reuse `bullet.text` for the detail-page
   PullQuote instead of a separate `headlineFinding`. (~45–55% digest output-token cut, zero risk.)
2. **Fix the Gemini generation-config layer (the core refactor):** thread `maxTokens` →
   `config.maxOutputTokens` on all four `generate*` methods; add a per-model `thinkingConfig`
   policy computed inside the chain loop (2.5-flash → `thinkingBudget: 0` or small; 2.5-pro → keep,
   generous budget; gemini-3 → skip); set `maxOutputTokens = need + thinking headroom`. Applies to
   **every** LLM path at once.
3. **Tier-2 rerank:** pass `tier:"small"` (flash-only, no pro escalation) and request reasons for
   only the top ~15–20 (not all 50). Keep the 50-candidate input.
4. **Parallelize confirmed serial waterfalls** (quality-neutral `Promise.all`): figure caption
   binding, deep-report figure bindings, web-search per-query fetches; vision matcher gets
   early-exit on first high-confidence + parallel image fetch.
5. **Deep report:** fetch the figure pool concurrently with report generation (not after).
6. **Cache opportunity query-gen** output (keyed on the profile fields it reads + kind + year).
7. **Small guards:** figure downscale to ~1568px lossless before vision upload; client
   `AbortController` on figure fetch; `tier:"small"` on interactive figure calls; truncate
   query-gen project text to ~500 chars; slim the advisor-seed OpenAlex select (keep abstract +
   topics).

### Tier 2 — Caching & durability (medium)
8. **Stop regenerating today's briefing on reload:** persist papers + digest for the local day
   (or reuse the scheduled artifact); separate "open today" / "regenerate" / "load more"; do not
   advance recently-shown on a plain open. Make the digest cache key order-insensitive and include
   `contextHint`.
9. **Server-side report cache:** `paper_reports` table keyed on `(paperId, provider, deep,
   sha256(contextHint))`, 7-day TTL; check before running the pipeline.
10. **Raise the report route `maxDuration`** above observed p95 (~120–180s) so slow reports aren't
    silently killed down to abstract-only.

### Tier 3 — Streaming / progressive UX (medium)
11. **Render the deterministic Tier 0 report immediately**, then progressively replace with Tier
    1/2 (the component already builds a Tier 0 fallback; today it hides it behind skeletons).
12. **Stream the digest** (one batched JSON call + tolerant streaming parse) so cards fill in.
13. **Stream the deep report** within one request: flush Pass-2 text first, then figures as a patch.
14. **Separate client lanes:** commit papers/events/jobs independently; start the digest as soon as
    papers land (don't wait on jobs/events); move opportunity query-gen off the critical path.

### Tier 4 — Larger structural / production-grade (later, behind gates + telemetry)
15. `AbortSignal` propagation end-to-end; cancel superseded/losing work.
16. Unified document ingestion (one PDF download/extraction feeding both text and figures).
17. Canonical-analysis vs personalized-overlay split (only if telemetry shows cross-user overlap).
18. Adaptive retrieval (only behind precision@10/coverage gates — see §4.1).
19. Security: auth/quotas on digest+report, SSRF allowlist on client-URL fetches, move base64 out
    of report JSON to object storage + stable IDs, cron/home artifact parity.

---

## 7. What NOT to do (explicit)

- Don't blanket-set `thinkingBudget: 0` or a tight `maxOutputTokens` in the shared call helpers —
  breaks deep-report Pass 2 and errors on `gemini-2.5-pro`. Must be model/tier-aware.
- Don't cut Tier-2 rerank **input** (50 candidates) or cap its output at ~1200 — truncates
  legitimate ranking. Only trim the **reasons** count.
- Don't split the digest per-paper or switch to NDJSON — multiplies the system prompt, weakens
  reasoning-leak protection.
- Don't lower `MAX_PDF_PAGES` to 15 — loses Results/Discussion for biomed PDFs; use terminal-heading
  early-exit.
- Don't downscale figures to 1024px/JPEG — provider-blind + artifacts; use ~1568px lossless.
- Don't do the batched multi-image vision call or batched single-call figure binding — parallelize
  instead.
- Don't rush adaptive source-fan-out reduction or the canonical/overlay split — prove the win with
  telemetry first.
- Don't attempt the whole thing in one PR.

---

## 8b. Provider coverage — does this help non-Gemini users?

Peer supports five providers (Anthropic, OpenAI, Gemini, DeepSeek, Qwen) via env config or
BYOK. Vertex/Gemini is only *this* deployment's default; other users run other providers. So it
matters which changes are universal vs Gemini-specific. Verified against every provider file:

**Current per-provider state (the reason the "token cap" fix is Gemini-only):**

| Provider | Honors `maxTokens`? | Reasoning/thinking overhead? | Per-call timeout? |
| --- | --- | --- | --- |
| Anthropic (Haiku/Sonnet) | ✅ yes | ❌ none (extended thinking not enabled) | ❌ none |
| OpenAI (gpt-5.4-mini / gpt-5.4) | ✅ yes (`max_completion_tokens`) | ⚠️ GPT-5 reasoning at default effort (bounded by cap) | ✅ 15s |
| DeepSeek (deepseek-chat V3) | ✅ yes | ❌ none (deliberately avoids `deepseek-reasoner`) | ✅ 20s |
| Qwen (turbo/plus/max) | ✅ yes | ❌ none | ✅ 20s |
| **Gemini (2.5-flash/pro)** | ❌ **dropped** | ❌ **uncapped thinking, no `thinkingConfig`** | ❌ none |

Gemini is the outlier on both output caps and thinking — the other four already do it correctly.

**Universality of each change:**

| Change | Scope | Who benefits |
| --- | --- | --- |
| Remove dead digest `keyNumbers`/`headlineFinding` | **Shared prompt (`types.ts`)** | **ALL providers** |
| Tier-2 rerank: trim reasons, pass `tier:"small"` | Above provider layer | **ALL providers** |
| Parallelize waterfalls (figures / web-search / report) | Above provider layer | **ALL** |
| Concurrent figure-pool fetch; cache query-gen | Above provider layer | **ALL** |
| Figure downscale before vision upload | Above provider layer | **ALL vision providers** (esp. Anthropic/OpenAI size limits) |
| Client AbortController, tier tags, text truncation, slim OpenAlex select | Above provider layer | **ALL** |
| Caching / streaming / lane separation / durable artifacts (Tiers 2–4) | Above provider layer | **ALL** |
| **Gemini `maxTokens` + `thinkingConfig` fix** | **Gemini provider only** | Gemini/Vertex + Gemini-BYOK users (brings Gemini to parity with the others) |
| Add per-call timeout | Anthropic + Gemini (others have it) | Anthropic + Gemini users |
| *(Optional)* `reasoning_effort:"low"` on OpenAI small-tier tasks | OpenAI provider only | OpenAI users (minor) |

**Conclusion:** ~90% of the plan lives **above** the provider abstraction and benefits every user
regardless of provider. The one Gemini-specific item is a genuine **bug fix** that brings Gemini
up to the parity the other four already have — not a Gemini-only optimization. To keep it clean, the
token/reasoning discipline should be implemented as a **uniform cross-provider policy** (every
provider honors caps and has a timeout), and the biggest single token win — deleting the dead
digest output — is fully universal.

## 8. Quality gates (every change must pass)

- Prompt/model changes measured on the golden set: same-or-better precision@10, topic/venue
  coverage, freshness; digest bullets still lead with the result and never fabricate numbers.
- Reports: preserved ordered headings, evidence/quote validation, unsupported-number rejection,
  meaningful Tier-0 fallback.
- Figures: never prefer a wrong figure over an empty slot.
- Ranking-affecting changes ship behind a flag with shadow comparison.
- Only retryable 429/5xx are retried; auth/quota/invalid-input are not.
