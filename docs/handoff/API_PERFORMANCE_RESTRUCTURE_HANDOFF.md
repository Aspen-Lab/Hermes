# Peer API Performance and Token-Efficiency Restructuring Handoff

Status: review complete; implementation not started  
Review date: 2026-07-23  
Reviewed branch: `fix-setup-page-ui`  
Primary application reviewed: `web/` (Next.js 16)

## Purpose

This document hands the API performance review to another AI or engineering
agent. It explains:

- why Peer currently feels slow on the first daily refresh;
- why individual paper reports can take a long time to appear;
- where API and model calls are amplified;
- how to restructure the system without reducing retrieval or report quality;
- the implementation order, quality gates, and validation criteria.

No application code was changed during the review. This document is the only
new file created from that review.

## Required project constraints

Before implementing anything, read:

- `AGENTS.md`
- `web/AGENTS.md`
- `docs/PRODUCT_DIRECTION.md`
- `docs/THREE_TIER_ARCHITECTURE.md`
- `docs/BLUEPRINT_byok_and_providers.md`
- Live product source of truth: <https://hermes-admin-eta.vercel.app/>

Important project rules:

1. Never create a branch without explicit user approval.
2. State the current branch before starting coding.
3. Peer must remain a calm daily forecast, not a generic agent platform.
4. Tier 0 must remain useful without model keys.
5. Tier 1 and Tier 2 may enhance quality but must degrade gracefully.
6. Prefer precise, portable output and user-declared intent.
7. Source collection, scoring, dedupe, distillation, and output remain the core
   pipeline.
8. Deep-dive mode is a feature, not the product identity.

At the time of this review, the worktree already contained user-owned changes:

```text
 M web/.gitignore
 M web/src/app/layout.tsx
 M web/src/components/first-run.tsx
 M web/src/store/profile.ts
?? running command in terminal
?? web/src/app/api/local-profile/
?? web/src/components/local-profile-sync.tsx
?? web/src/lib/local-profile-restore.ts
```

Preserve these changes and do not overwrite or reformat them unless the user
explicitly puts them in scope.

## Executive conclusion

The dominant problem is not simply that the selected models are slow.

Peer repeatedly recomputes artifacts that should be reused, waits for
independent pipelines as one blocking unit, sends too many candidates to model
calls, and performs report and figure work in long serial chains.

The highest-value improvements are therefore:

1. treat today's briefing as a durable artifact;
2. show cached or deterministic Tier 0 content immediately;
3. separate papers, jobs, events, report text, and figures into progressive
   lanes;
4. deduplicate identical in-flight work;
5. adapt source fan-out to measured coverage instead of always querying every
   source;
6. consolidate model calls around compact, structured inputs;
7. persist reusable paper extraction and canonical analysis;
8. add provider-level token, latency, timeout, and cache accounting.

These changes should improve perceived speed and reduce API/model usage without
lowering retrieval quality. Model changes alone will not solve the structural
latency.

## Current critical paths

### Opening or refreshing the home page

```text
Home mounts with empty Zustand defaults
  |
  +-- local profile and history hydrate
  |
  +-- remote profile/feed synchronization may update state
  |
  +-- page detects a missing/different topic key
       |
       +-- load papers
       |    |
       |    +-- optional advisor seed refresh
       |    +-- POST /api/feed
       |         +-- five academic source adapters
       |         +-- up to roughly 15 origin requests
       |         +-- optional Tavily discovery
       |         +-- dedupe and local ranking
       |         +-- optional Tier 2 model rerank
       |
       +-- load events
       |    +-- optional model query generation
       |    +-- source retrieval and ranking
       |
       +-- load jobs
            +-- optional model query generation
            +-- source retrieval and ranking

Wait for all three lanes
  |
Commit papers, events, and jobs
  |
Mark every returned paper as recently shown
  |
Mount DailyDigest
  |
POST /api/digest for another model call
```

### Opening a paper

```text
Resolve or enrich paper metadata
  |
Start report request before profile state is guaranteed stable
  |
Find full-text sources
  |
Download and parse HTML or PDF
  |
Optional first model pass to compress the paper
  |
Second model pass to synthesize the deep report
  |
Separately rediscover and reprocess figures
  |
Match proposal figure
  |
Match result figures one by one
  |
Return one large JSON response
  |
Client may issue more /api/figure calls for missing bindings
```

The route permits 90 seconds, but the combined component timeout ceilings can
exceed that deadline.

## Detailed findings

### P0: Reloading Peer regenerates rather than reopens today's briefing

Relevant code:

- `web/src/app/page.tsx:112`
- `web/src/store/feed.ts:442-533`
- `web/src/store/feed.ts:934-951`
- `web/src/components/digest/daily-digest.tsx:29-110`

The feed store persists saved/read/recently-shown state but not:

- papers;
- events;
- jobs;
- `lastRefresh`;
- `feedTopicsKey`.

Consequences:

1. A browser reload starts with no daily artifact.
2. Previously shown paper IDs remain persisted.
3. The new request excludes those papers.
4. The returned paper set changes.
5. The digest cache, keyed by exact ordered paper IDs, misses.
6. Peer retrieves and generates another briefing even if today's briefing was
   already built.

The current behavior conflates three distinct actions:

- open today's forecast;
- deliberately regenerate today's forecast;
- load more/advance novelty history.

These must become separate operations.

### P0: Independent home-page lanes block each other

Relevant code:

- `web/src/store/feed.ts:481-487`
- `web/src/app/page.tsx:698-718`
- `web/src/lib/events/pipeline.ts:40-56`
- `web/src/lib/jobs/pipeline.ts:36-58`
- `web/src/lib/opportunities/query-gen.ts:88-135`

Papers, events, and jobs start together but commit through one `Promise.all`.
The digest cannot begin until all three finish, although it only uses papers.

With a custom provider configured, one refresh can perform:

- a paper Tier 2 rerank call;
- a jobs query-generation call;
- an events query-generation call;
- a daily digest call after the other work completes.

The opportunity query calls also happen before opportunity source retrieval,
placing model latency on the critical path.

### P0: Tavily discovery adds latency but currently changes no output

Relevant code:

- `web/src/lib/feed/pipeline.ts:44-55`
- `web/src/lib/feed/pipeline.ts:93-97`
- `web/src/lib/feed/pipeline.ts:184-190`
- `web/src/lib/feed/tavily-discovery.ts:40-74`
- `web/src/lib/sources/web-search.ts:49-55`
- `web/src/lib/sources/web-search.ts:160-163`

When enabled, paper discovery can issue up to four sequential searches. Each
search has a seven-second timeout. The pipeline awaits this work.

The returned `queryBoosts` are not merged into candidates or ranking. They are
only counted in response metadata. As currently wired, the path can spend
requests and latency while providing no feed-quality improvement.

Immediate recommendation:

- remove it from the critical path;
- either merge a single cached discovery wave into actual candidates, or run it
  only as a conditional second wave when the baseline feed lacks coverage.

### P0: Fixed source fan-out is disproportionate to the requested result

Relevant code:

- `web/src/lib/feed/pipeline.ts:13-42`
- `web/src/lib/sources/openalex.ts`
- `web/src/lib/sources/semantic-scholar.ts`
- `web/src/lib/sources/arxiv.ts`
- `web/src/lib/sources/dblp.ts`
- `web/src/lib/sources/pubmed.ts`

The default paper plan always uses:

- OpenAlex;
- Semantic Scholar;
- arXiv;
- DBLP;
- PubMed.

Current query caps permit approximately 15 external requests before Tavily,
advisor expansion, or other enrichment. Each source may request dozens of
candidates even though the UI returns only 5 or 10 papers.

The source-mix setting changes ranking boosts; it does not meaningfully choose
which sources run.

The desired replacement is an adaptive retrieval plan:

1. run a small high-yield first wave selected from declared topics and venues;
2. dedupe and locally rank immediately;
3. measure minimum count, score, topic coverage, venue coverage, and diversity;
4. expand to redundant or domain-specific sources only if those thresholds are
   not met;
5. derive per-source candidate limits from the requested top-N.

### P0: Tier 2 spends tokens on papers that will be discarded

Relevant code:

- `web/src/lib/feed/tier2-rerank.ts:19-58`
- `web/src/lib/feed/pipeline.ts:149-166`

Tier 2 can receive:

- 50 candidates;
- up to 1,200 abstract characters for each candidate;
- up to 2,200 output tokens.

Recently shown and other ineligible candidates are filtered after the model
rerank.

Recommended sequence:

1. canonicalize and dedupe;
2. remove ineligible candidates;
3. score the complete set locally;
4. send only the strongest fresh 15-20 candidates;
5. limit each candidate to compact evidence fields;
6. request only final IDs, short reasons, and reusable brief fields.

Based on the current hard limits, this should reduce reranking input by roughly
70-85%. That estimate is code-derived and must be verified through usage
telemetry.

### P0: Timeouts do not cancel underlying work

Relevant code:

- `web/src/lib/feed/pipeline.ts:197-217`
- `web/src/lib/opportunities/shared.ts:12-29`
- `web/src/store/feed.ts:419`
- `web/src/lib/api.ts:18-34`

Several timeout helpers use `Promise.race` around already-started work. When the
timeout wins, the source request, model call, or parser may continue consuming
origin and serverless resources.

The client also ignores stale results but does not cancel the superseded
request.

Required fix:

- propagate a single `AbortSignal` from browser request through the route,
  pipeline, source adapters, full-text fetches, extractors, and model providers;
- cancel losing hedged requests;
- use one total operation deadline rather than allowing every stage and retry a
  full independent deadline.

### P0: Provider abstraction cannot enforce token budgets

Relevant code:

- `web/src/lib/llm/providers/types.ts:47-72`
- `web/src/lib/llm/providers/anthropic.ts:22-44`
- `web/src/lib/llm/providers/gemini.ts:20-33`
- `web/src/lib/llm/providers/gemini.ts:81-127`
- `web/src/lib/llm/providers/gemini.ts:153-169`
- `web/src/lib/llm/providers/gemini.ts:223-260`
- `web/src/lib/llm/providers/registry.ts:12-63`

Provider calls generally return only text. The application discards:

- input tokens;
- output tokens;
- cached input tokens;
- latency;
- actual model;
- request ID;
- finish reason;
- retry/fallback reason.

Consequences:

- daily token budgets cannot be enforced or audited;
- savings cannot be measured;
- provider fallback can silently escalate cost and latency;
- timeout and cancellation behavior is inconsistent;
- Gemini currently ignores caller-supplied output-token limits;
- the `ollama` registry entry maps to a Gemini placeholder.

Create one model gateway with a result contract similar to:

```ts
type GenerationResult = {
  text: string;
  model: string;
  provider: string;
  latencyMs: number;
  requestId?: string;
  finishReason?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
};
```

The gateway must also accept:

- `AbortSignal`;
- an explicit model tier;
- input and output limits;
- a strict response schema;
- retry classification;
- a user/daily token budget;
- a prompt version;
- an operation trace ID.

Provider-native prompt/context caching may supplement Peer's artifact cache for
large repeated stable prefixes:

- Anthropic: <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>
- Gemini: <https://ai.google.dev/gemini-api/docs/caching>

Provider caching must not replace Peer's own durable daily and paper artifacts.

### P0: Paper report requests can duplicate during hydration

Relevant code:

- `web/src/components/store-hydrator.tsx:8-19`
- `web/src/store/profile.ts:421-433`
- `web/src/components/profile-sync.tsx:122-140`
- `web/src/app/papers/[id]/page.tsx:533-577`
- `web/src/app/papers/[id]/page.tsx:618-695`
- `web/src/lib/api.ts:18-34`

The report effect can run before local and remote profile state settles. It does
not mark a cache key as in-flight before making the request. A rerender caused
by profile reconciliation, metadata enrichment, Strict Mode, or user feedback
can start an identical or superseding request.

Cleanup only prevents the stale response from being committed; it does not
abort server work.

The current cache key includes paper ID, context, depth, and provider, but omits:

- paper content hash;
- prompt/schema version;
- extractor version;
- selected model;
- canonical paper cluster ID.

A report generated from incomplete metadata can therefore occupy the same
seven-day cache key as the later enriched paper.

### P0: The UI hides an already-available Tier 0 report

Relevant code:

- `web/src/app/papers/[id]/page.tsx:625-641`
- `web/src/app/papers/[id]/page.tsx:936-954`
- `web/src/app/papers/[id]/page.tsx:1073-1122`
- `web/src/lib/papers/surface-model.ts:330-498`

Peer already constructs a deterministic fallback report immediately, but the
page displays skeletons until the network report finishes.

The Tier 0 report should be the first render. Cached or newly generated Tier
1/2 content should progressively replace or enrich it.

This improves perceived performance without reducing analytical quality.

### P0: Deep report generation is an overly serial all-or-nothing route

Relevant code:

- `web/src/app/api/papers/report/route.ts:184-269`
- `web/src/lib/papers/source-links.ts:286-290`
- `web/src/lib/papers/full-text.ts:174-203`
- `web/src/lib/papers/pdf-text.ts:61-116`
- `web/src/lib/papers/deep-report.ts:318-339`
- `web/src/lib/papers/figure-binding.ts:315-332`
- `web/src/lib/figures/pdf-extract.ts:132-200`

The deep path performs these stages serially:

1. source discovery;
2. full-text download/extraction;
3. optional model compression;
4. model synthesis;
5. separate figure discovery/extraction;
6. proposal figure binding;
7. each result figure binding.

Cold PDF paths may add separate Python extraction processes for text and
figures. Not every maximum timeout will stack, but the possible ceilings can
exceed the route's 90-second limit.

Text and figures should be separate completion lanes. Report text should never
wait for high-resolution figure selection.

### P0: Figure resolution permits model-call explosion

Relevant code:

- `web/src/lib/papers/figure-binding.ts:118-149`
- `web/src/lib/papers/figure-binding.ts:315-332`
- `web/src/app/papers/[id]/page.tsx:981-1024`
- `web/src/app/papers/[id]/page.tsx:1123-1182`
- `web/src/lib/figures/extract.ts:620-690`
- `web/src/lib/figures/vision-match.ts:129-201`

Deep binding may issue separate small-model calls for the proposal and up to
four result sections. If binding misses, the client creates individual
`/api/figure` requests. Each request can perform:

1. one semantic model call;
2. up to three sequential vision calls;
3. a fallback selection anyway.

Architectural worst case:

- shallow report: one report call plus up to 20 figure-related model calls;
- deep report: up to two report-generation calls, five binding calls, and
  further client-side figure calls.

Keyword matches often short-circuit this, so this is not a claim about average
production usage. It is nevertheless an unacceptable possible execution path.

Replacement:

- make the report synthesis return desired figure labels;
- validate labels deterministically against extracted captions;
- batch all unresolved captions into one structured small-model call;
- if vision is still required, use one multi-image shortlist call;
- omit a figure when confidence is low rather than displaying a misleading
  fallback.

### P0: Full text and figures duplicate download and parsing

Relevant code:

- `web/src/lib/papers/source-links.ts`
- `web/src/lib/papers/full-text.ts`
- `web/src/lib/papers/pdf-text.ts`
- `web/src/lib/figures/extract.ts:726-1055`
- `web/src/lib/figures/extract.ts:1120-1226`
- `web/src/lib/figures/pdf-extract.ts`

The text and figure subsystems separately implement source discovery, paywall
handling, HTML parsing, PDF downloads, and Python extraction.

Create one document-ingestion artifact containing:

- canonical metadata and identifiers;
- trusted source URLs;
- ordered section headings and text;
- evidence spans;
- captions;
- stable references to extracted image assets;
- source/content hash;
- extractor version.

One PDF download and one bounded extraction job should produce both text and
figure metadata.

### P1: Report and extraction caches are not durable

Relevant code:

- `web/src/app/papers/[id]/page.tsx:434-491`
- `web/src/lib/papers/full-text.ts:49-54`
- `web/src/lib/papers/full-text.ts:219-237`
- `web/src/lib/figures/extract.ts:1115-1125`
- `web/src/lib/figures/pdf-extract.ts:274-283`

Current caching consists of:

- reports in browser `localStorage`;
- full text in a process-local Map;
- figure candidates in a process-local Map.

Serverless cold starts lose process caches. Report cache entries can contain
base64 PDF images, making responses and browser storage extremely large. One
rich report can exceed browser storage limits, after which writes fail and the
report regenerates.

Use:

- durable server-side metadata/artifact storage;
- object storage/CDN for image assets;
- stable figure IDs/URLs in report JSON;
- bounded positive and negative cache TTLs;
- distributed single-flight locks for cold misses.

### P1: Deep prompts currently lose source structure and evidence

Relevant code:

- `web/src/lib/papers/html-text.ts:74-89`
- `web/src/lib/papers/deep-report.ts:85-125`
- `web/src/lib/papers/deep-report.ts:180-233`
- `web/src/lib/papers/report.ts:310-326`
- `web/src/app/api/papers/report/route.ts:48-78`

Performance work must not preserve these quality defects:

- nonstandard headings collapse into `body`;
- `body`, related work, conclusion, and original headings are omitted from the
  deep prompt;
- review reports request actual section names even though headings were
  discarded;
- an empty/malformed compression result may pass empty evidence to synthesis;
- quotations and numerical claims are not checked against extracted text;
- shallow review prompting permits inferred plausible headings, conflicting
  with non-fabrication requirements.

The optimized path must preserve ordered headings and evidence references and
validate output against them.

### P1: Scheduled briefings and home regenerate the same conceptual artifact

Relevant code:

- `web/src/app/api/jobs/dispatch-digests/route.ts:158-268`
- `web/src/app/api/briefings/route.ts:25`
- `web/src/app/profile/page.tsx:1404`

The scheduler stores briefing payloads, but home does not load them. Cron can
pay for retrieval, after which opening home pays for another feed and digest.

The scheduler also processes users sequentially, rerunning similar source
queries for each user.

Home, cron, email, history, Markdown, feed output, and JSON should consume one
canonical daily artifact.

The scheduler should:

- collect public source snapshots once per normalized topic/venue/time bucket;
- use bounded per-user ranking/delivery concurrency;
- have a unique user/local-date/profile-version idempotency key;
- return lightweight history projections separately from artifact detail.

### P1: Authentication and synchronization amplify API traffic

Relevant code:

- `web/src/components/user-menu.tsx:15`
- `web/src/components/profile-sync.tsx:147`
- `web/src/components/feed-sync.tsx:85-128`
- `web/src/app/api/read/route.ts:74`

Multiple components independently fetch the authenticated user and subscribe to
auth changes.

On cold signed-in mount, feed synchronization replays locally saved items and
read IDs, then fetches remote state. It does not send versioned deltas. Replaying
read IDs also resets `read_at` timestamps.

Replacement:

- one session provider;
- one authenticated bootstrap response containing the remote profile decision,
  saved/read versions or deltas, and today's briefing artifact;
- a versioned local outbox and bulk-delta endpoint;
- no replay-all synchronization.

### P0 safety: expensive public routes need hardened boundaries

Relevant code:

- `web/src/app/api/digest/route.ts:23-55`
- `web/src/app/api/papers/report/route.ts:161-199`
- `web/src/app/api/figure/route.ts:14-40`
- `web/src/lib/supabase/middleware.ts:8-37`

The digest and report paths lack sufficient authentication, request-size
limits, quotas, and idempotency protection while they can consume configured
server model credentials.

The report and figure routes also accept client-controlled URLs that can become
server-side fetch targets. Redirect destinations and private network targets
must be validated.

Before scaling background generation:

- require authenticated or explicitly anonymous-budgeted sessions;
- add per-user/IP concurrency and daily spend limits;
- accept canonical paper IDs rather than arbitrary paper objects/URLs;
- allowlist legal HTTPS sources;
- reject private, loopback, link-local, and metadata-service addresses;
- validate each redirect;
- bound context, arrays, captions, source bytes, and response size.

Personalized POST routes also advertise public cache headers in places. Replace
that with explicit application artifact caching whose keys exclude API secrets
and include the correct private profile fingerprint.

## Target architecture

### Daily briefing artifact

Suggested conceptual type:

```ts
type DailyBriefingArtifact = {
  id: string;
  localDate: string;
  profileFingerprint: string;
  pipelineVersion: string;
  aiMode: "tier0" | "tier1" | "tier2";
  status: "partial" | "complete" | "stale";
  generatedAt: string;
  expiresAt: string;
  papers: CanonicalPaperBrief[];
  events: EventBrief[];
  jobs: JobBrief[];
  digest?: DailyDigest;
  diagnostics: {
    cacheStatus: string;
    sourceSnapshotIds: string[];
    traceId: string;
  };
};
```

The exact storage schema is an implementation decision. Required semantics:

- stable for the local day;
- keyed by the complete retrieval/profile fingerprint, not only topics;
- prompt and pipeline versioned;
- supports partial lane completion;
- can serve the last known good result;
- shared across home, cron, email, Markdown, feed, and JSON output;
- no raw API keys or sensitive profile text in cache keys.

Replace the overloaded `loadFeed()` behavior with:

```ts
loadToday()
regenerateToday({ force: true })
loadMore(cursor)
invalidateForProfileChange()
```

Opening the page must not advance recently-shown state.

### Paper artifact

Suggested conceptual layers:

```text
PaperIdentity
  |
DocumentArtifact
  |-- trusted source links
  |-- ordered headings and text
  |-- evidence spans
  |-- captions and figure asset IDs
  |
CanonicalPaperAnalysis
  |-- user-neutral report
  |-- claims linked to evidence
  |-- requested figure labels
  |
PersonalizedPaperOverlay
  |-- relevance to declared intent
  |-- project/method fit
  |-- recommended next action
```

Cache keys should include:

- canonical paper/content hash;
- extractor version;
- report schema and prompt version;
- provider/model where output depends on them;
- depth;
- compact private user-intent hash for the personalized overlay.

The large canonical analysis should be reusable. The personalized overlay
should remain small and private.

### Progressive user experience

```text
Open Peer
  |
Load today's local/server artifact
  |
Render Tier 0 immediately
  |
Background freshness check
  |
Adaptive source retrieval
  |
Local dedupe/ranking
  |
One compact structured enhancement
  |
Update artifact

Open paper
  |
Render deterministic/cached report
  |
Load or generate canonical text analysis
  |
Render text
  |
Resolve and render figures independently
```

## Implementation order

### Phase 1: Observability and regression harness

Implement before changing model behavior.

Add:

- operation and trace IDs;
- source-level timing, outcome, candidate count, and cache status;
- model provider, actual model, input/output/cached tokens, latency, and reason;
- time to first paper cards;
- time to complete each home lane;
- time to Tier 0 report;
- time to canonical report text;
- time to figures;
- response bytes and figure bytes;
- cancellation, retry, fallback, and quota outcomes.

Never log:

- raw API keys;
- full private profile context;
- full extracted paper text;
- base64 images.

Add a golden evaluation set before changing prompts:

- fixed user profiles and declared intentions;
- experimental papers;
- theoretical papers;
- reviews;
- arXiv papers;
- PMC papers;
- paywalled papers;
- generic publisher HTML/PDF papers.

### Phase 2: Stable today artifact and progressive home lanes

1. Add daily artifact read/write and stable keying.
2. Load it before initiating fresh generation.
3. Render stale/last-good Tier 0 immediately.
4. Gate initial generation on local hydration and the first remote-profile
   decision.
5. Commit papers, jobs, and events independently.
6. Start the digest when papers are ready.
7. Add in-flight single-flight and stale-response protection.
8. Ensure page view does not update recently-shown history.
9. Reuse scheduled briefing artifacts on home.

This phase addresses the user's most visible first-refresh problem.

### Phase 3: Retrieval efficiency

1. Remove no-op Tavily work from the critical path.
2. Add `AbortSignal` to source adapter interfaces and shared fetch helpers.
3. Add bounded concurrency and source-specific rate-limit/retry policy.
4. Build canonical paper identity and cross-source clustering.
5. Introduce adaptive first- and second-wave retrieval.
6. Base candidate budgets on requested top-N.
7. Cache public source snapshots by normalized query/source/time bucket.
8. Keep personalization out of public snapshot cache keys.

Do not reduce source coverage blindly. The second wave must run whenever the
first wave fails quality thresholds.

### Phase 4: Compact structured model enhancement

1. Introduce the common model gateway and usage contract.
2. Enforce consistent output limits, timeout, cancellation, retry
   classification, and daily budgets.
3. Filter and locally rank before calling a model.
4. Send only a compact 15-20 paper shortlist.
5. Use provider-native strict JSON schema where supported.
6. Evaluate whether reranking, digest bullets, and reusable per-paper
   distillation can be returned by one call.
7. Cache per-paper canonical distillation by content/prompt/model version.
8. Keep automatic strong-model escalation out of daily mode; reserve stronger
   models for explicit deep dives unless evaluation proves otherwise.

### Phase 5: Paper report artifact and immediate Tier 0

1. Gate personalized requests on profile readiness.
2. Register the in-flight key before the request starts.
3. Abort superseded work.
4. Show the existing deterministic report immediately.
5. Add durable document and canonical-analysis artifacts.
6. Separate canonical analysis from personalized overlay.
7. Prewarm only the top few daily papers under strict concurrency and token
   budgets.

### Phase 6: Unified extraction and batched figures

1. Share source discovery and download between text and figures.
2. Start high-probability sources while slower discovery runs concurrently.
3. Use staggered bounded races and cancel losers.
4. Download a PDF once.
5. Emit ordered text, headings, captions, and selected figure assets from one
   extraction job.
6. Store images in object storage/CDN.
7. Return stable figure IDs/URLs instead of base64.
8. Produce desired figure labels during report synthesis.
9. Batch unresolved caption matching.
10. Complete figures independently from report text.

### Phase 7: Bootstrap, sync, cron, and API hardening

1. Consolidate auth/session state.
2. Add one authenticated bootstrap response.
3. Replace replay-all sync with a versioned outbox/bulk delta.
4. Make home, cron, email, and history consume one briefing artifact.
5. Add scheduler idempotency and bounded concurrency.
6. Add auth/anonymous budgets, validation, quotas, and SSRF protections.
7. Replace incorrect public personalized caching with explicit private artifact
   caching.

## Quality safeguards

Performance work is acceptable only if these gates remain satisfied.

### Retrieval quality

Measure old and new pipelines on fixed profiles:

- precision@10;
- nDCG@10;
- declared-topic coverage;
- required-venue coverage;
- source diversity;
- freshness;
- novelty;
- duplicate rate;
- top-10 overlap with the current pipeline.

The adaptive source second wave must run when any required count, relevance,
coverage, or diversity threshold is missed.

### Report quality

Require:

- preserved ordered headings;
- evidence-span references for substantive claims;
- quotation validation;
- unsupported-number rejection;
- meaningful fallback when full text is unavailable;
- correct handling of malformed or empty model JSON;
- report-type coverage for empirical, theoretical, and review papers.

### Figure quality

Measure:

- correct figure precision;
- useful figure recall;
- caption-to-section grounding;
- rate of correctly returning no figure.

Never prefer a wrong figure over an empty figure slot.

### Resilience

- Tier 0 is always available without model keys.
- Last-good daily artifacts remain available when providers fail.
- Cache keys include all output-affecting versions.
- Auth/quota/invalid-input failures are not retried.
- Only retry retryable 429/5xx failures, with bounded jitter.
- One user signal does not cause an abrupt ranking overreaction.
- Roll out behind flags and shadow comparison.

## Initial performance and usage targets

These are proposed budgets, not measured production results. Current telemetry
is insufficient to claim actual p50/p95 values.

| Experience | Initial target |
| --- | --- |
| Returning user's useful daily briefing | under 500 ms |
| Fresh paper lane | approximately 2-4 seconds |
| Complete opportunity lanes | approximately 5-8 seconds |
| Warm/cached paper report | under 500 ms |
| New shallow enhancement | approximately 2-4 seconds |
| Deep report text | approximately 8-15 seconds |
| Figures | independent, progressive completion |
| Tier 2 reranking input reduction | approximately 70-85% |
| Repeat report token savings | potentially 60-95% |
| New shallow report calls | 0 cached/immediate; at most 1 enhancement |
| New deep report calls | 1 synthesis plus optional 1 batched figure match |

All targets must be validated against real traces and the golden quality set.

## Baseline validation

From `web/` at review time:

```text
npm test
  5 test files passed
  61 tests passed

npx tsc --noEmit
  passed

npm run lint
  failed on one pre-existing error:
  web/src/components/persona/quiz.tsx:46
  synchronous setState in an effect
```

Existing tests cover formatting, preferences, opportunity helpers, and
job/event scoring. There were no tests found for:

- feed/source orchestration;
- daily artifact reuse;
- route validation, quotas, and cache behavior;
- hydration-triggered duplicate requests;
- in-flight feed/digest/report single-flight;
- cancellation of timed-out work;
- provider token caps and usage accounting;
- canonical cross-source dedupe;
- report generation;
- deep-report evidence handling;
- full-text extraction;
- figure extraction and binding;
- cron/home artifact parity;
- latency, token, call-count, or response-size budgets.

These gaps should be addressed during Phase 1.

## Recommended first implementation slice

After user approval, the first change set should remain deliberately focused:

1. add trace/usage result types and test scaffolding;
2. add stable daily artifact keying and local/server read-through behavior;
3. show the last-good/Tier 0 briefing immediately;
4. separate paper, event, and job state commits;
5. remove the no-op Tavily dependency from the critical path;
6. add request single-flight and cancellation at the feed boundary;
7. add regression tests for same-day reload reuse and one-request behavior.

Do not combine the first slice with the full document/figure rewrite. Establish
measurable improvements and quality baselines first.

## Definition of done

This restructuring is complete when:

- opening Peer does not regenerate a same-day briefing without invalidation or
  explicit refresh;
- cached Tier 0 content is visible immediately;
- papers are not blocked by jobs or events;
- one logical refresh produces one in-flight briefing job;
- timeouts cancel origin/model/extractor work;
- daily token budgets are measured and enforced;
- adaptive retrieval meets or exceeds the current quality baseline;
- report text no longer waits for figures;
- one paper is downloaded and parsed once per artifact version;
- repeat paper opens reuse canonical analysis;
- report JSON does not contain base64 figure payloads;
- model-call and token counts are covered by tests and telemetry;
- evidence and figure quality gates pass;
- home, scheduled delivery, and portable outputs share the same daily artifact;
- Tier 0 remains fully useful without model keys.

