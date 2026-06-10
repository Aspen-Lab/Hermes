# Blueprint — BYOK (Bring Your Own Key) + Provider Abstraction

**Status:** Planned. Refer to [THREE_TIER_ARCHITECTURE.md](THREE_TIER_ARCHITECTURE.md) for the doctrine this implements.

**Goal:** Let users plug in their own API keys (Anthropic, Google Gemini Vertex, OpenAI, local Ollama) without breaking Tier 0. Preserve every current feature for users who provide no key.

---

## 1. The user-facing model

A new **Settings → AI Provider** surface in the web app, with three states the user can occupy:

```
┌─────────────────────────────────────────────────────────┐
│  AI features                              [● Tier 0]    │
│  ─────────────────────────────────────────────────────  │
│  ○ Off — rules only (no LLM)                            │
│      Peer works fully. Digest paragraph and headline  │
│      extraction are hidden. No data leaves Peer.      │
│                                                         │
│  ○ Use my own key (BYOK)                                │
│      • Provider:  [ Anthropic │ Gemini │ OpenAI │ ... ] │
│      • Key:        [ paste here ]                       │
│      • Daily budget: [ $1 / 100k tokens ]               │
│      • [Test connection]   [Save]                       │
│                                                         │
│  ○ Use Peer-hosted (when available)                   │
│      Operator-funded, may have queue / rate limits.     │
│      [Status: configured | unconfigured]                │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  Current effective tier: 0 / 1 / 2                      │
│  Last successful call:    2 minutes ago                 │
│  Today's usage:           1,243 tokens / $0.003         │
└─────────────────────────────────────────────────────────┘
```

Critical UX rules:
- The default state is **Off** — fresh users land in Tier 0, no friction.
- Switching to Off must instantly hide the digest and not break the feed.
- "Test connection" runs a tiny prompt against the chosen provider before saving, surfacing errors clearly.
- Budget exhaustion **degrades silently to Tier 0** with a small banner ("AI features paused — budget reached") rather than failing.

---

## 2. Provider abstraction

A thin interface so adding a provider = one new file.

```ts
// web/src/lib/llm/providers/types.ts
export interface DigestProvider {
  id: ProviderId;             // "anthropic" | "gemini" | "openai" | "ollama"
  name: string;
  generateDigest(args: {
    papers: PaperLite[];
    contextHint?: string;
    abortSignal?: AbortSignal;
  }): Promise<DigestResponse>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}
```

Each provider lives in its own file:
```
web/src/lib/llm/providers/
  anthropic.ts   // existing logic, refactored out of /api/digest/route.ts
  gemini.ts      // new — Google Vertex, see install walkthrough
  openai.ts      // new — generic OpenAI Chat Completions
  ollama.ts      // new — local /api/chat HTTP
  types.ts       // the interface
  registry.ts    // ProviderId → constructor map
```

The `/api/digest` route becomes a thin dispatcher:
1. Resolve the user's effective provider (BYOK > server > none)
2. Look up provider in the registry
3. Call `generateDigest(...)`, with a try/catch that falls back to `noLlm: true`

---

## 3. Storage of user keys

**Never localStorage.** API keys are credentials.

New Supabase table:
```sql
create table public.user_ai_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  provider       text check (provider in ('off','anthropic','gemini','openai','ollama','hosted')),
  -- Encrypted key blobs. Use pgsodium / vault, NOT plain text.
  api_key_enc    bytea,
  -- Gemini Vertex needs project_id + service-account email + private key.
  -- Store extracted fields, not the raw .json blob (smaller, easier to validate).
  vertex_project text,
  vertex_email   text,
  vertex_key_enc bytea,
  -- Ollama for Tier 1 — just a URL, no secret.
  ollama_url     text,
  -- Per-user budget tracking
  daily_token_limit integer default 100000,
  daily_tokens_used integer default 0,
  last_reset_at  timestamptz default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.user_ai_settings enable row level security;
-- Standard RLS: users read/write only their own row.
```

Encryption: use Supabase's pgsodium or vault for `api_key_enc`. The server decrypts only at request time, never returns plaintext keys to the client (the settings UI shows `••••••••` after save).

---

## 4. Resolution order — which provider runs?

```
1. User signed in?
   ├── yes → read user_ai_settings.provider
   │         ├── 'off'           → Tier 0, hide digest
   │         ├── 'anthropic'/'gemini'/'openai' → BYOK, decrypt their key
   │         ├── 'ollama'        → Tier 1, hit their local URL
   │         └── 'hosted'        → fall through to operator key
   └── no  → fall through to operator key
2. Operator key? (server env var ANTHROPIC_API_KEY etc.)
   ├── yes → use it
   └── no  → Tier 0, hide digest
```

Important: BYOK keys are decrypted **only on the server side** in the `/api/digest` route handler. Client-side code never sees the key.

---

## 5. Token budgets

Each call passes through a budget gate:
1. Read `daily_tokens_used` + `daily_token_limit`
2. Estimate request cost (input tokens × provider price + max output tokens)
3. If would-exceed → return `noLlm: true` with reason `"budget_exhausted"`
4. Else → run, then increment `daily_tokens_used` by actual usage

Cron job (or on-read check) resets `daily_tokens_used` to 0 when `last_reset_at` is in a previous day.

---

## 6. Migration plan — preserving every current feature

### Step 1 — Refactor without behavior change *(safe, mergeable on its own)*
- Extract the Anthropic logic from `web/src/app/api/digest/route.ts` into `web/src/lib/llm/providers/anthropic.ts`
- Add `DigestProvider` interface
- `/api/digest` calls `anthropic.generateDigest(...)` instead of inline SDK calls
- **No user-facing change.** Same behavior with `ANTHROPIC_API_KEY` env var.

### Step 2 — Add Gemini Vertex provider *(new capability, behind env var)*
- Implement `gemini.ts` against `@google-cloud/vertexai`
- Read credentials from `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS` (env points to .json path)
- If both Anthropic and Vertex env keys are set, server has a default-provider env var to pick between them.
- **No user-facing change yet.** Only surfaced via env vars.

### Step 3 — BYOK Supabase schema + Settings UI *(visible feature)*
- New migration in `web/supabase/schema.sql` for `user_ai_settings`
- New page `web/src/app/settings/ai/page.tsx` with the radio-group UI above
- New API: `GET/PUT /api/settings/ai` (RLS-scoped)
- New API: `POST /api/settings/ai/test` (validates a key without saving)
- `/api/digest` consults user_ai_settings before falling back to env var

### Step 4 — Token budgets and degradation banners *(polish)*
- Budget enforcement in `/api/digest`
- Small banner component in the digest area showing "AI paused — daily budget reached" with link to settings

### Step 5 — Tier 1 Ollama provider *(future)*
- `ollama.ts` provider hitting `http://localhost:11434/api/chat`
- Defer until users ask; Tier 0 + Tier 2 cover most needs.

---

## 7. What survives the migration unchanged

- **Card grid.** Always rendered, all sources, full scoring. No LLM dependency.
- **Search.** Already non-LLM, untouched.
- **Profile fields.** Topics, methods, venues, project, challenges — all still feed scoring.
- **Daily feed pipeline.** No change to fetch / dedup / score / filter.
- **Saved items, read tracking, feedback events.** Untouched.
- **Email cron.** Stays on Anthropic-or-nothing for now; can be retrofitted to use the same provider abstraction in a later pass.

The only thing that changes per-user is whether the **digest paragraph** and **per-paper headline/numbers** appear. Everything else is identical.

---

## 8. Open questions to resolve at design time

- **Is "hosted" tier offered at all?** If yes, who pays for it (admin / Stripe-backed)? If no, the radio group has only Off / BYOK / Ollama.
- **Should the digest auto-disable on first 401 from a BYOK provider, or retry once?** Probably: one retry, then disable + banner.
- **How do we handle keys for the daily email cron?** Only operator keys, or BYOK on a per-user basis? (Per-user is the "right" answer but adds complexity.)
- **Audio briefing TTS** — same BYOK model? OpenAI TTS, ElevenLabs, Google? Defer until Phase 2.
