# HANDOFF — Peer as an MCP app inside ChatGPT (and Claude)

**Status: ACTIVE.** This is the build spec for the `membership-api-connection`
branch. Any agent (Claude, ChatGPT/Codex, Cursor, cloud run) picking up this
work starts here.

**Branch:** `membership-api-connection`
**Worktree (local Claude sessions):**
`C:/I/Personal/Github - start up project/Peer/.claude/worktrees/membership-api-connection-b9792f`
**Loop state file:** `docs/handoff/MULTIAGENT-mcp-app.md` — whose turn it is,
round log, rulings. **The state file outranks this spec on "what is happening
right now"; this spec outranks everything on "what we are building."**

---

## 1. Mission

Build **"Peer for ChatGPT"**: Peer exposed over MCP so that a user who has
connected their Peer account can use Peer from inside ChatGPT — with Peer's own
interactive UI, not prose. Claude (interactive connectors) is a second host for
the same server; ChatGPT is the primary target.

**Parity goal (user requirement, 2026-08-12):** _whatever Peer web can do, the
Peer MCP app can do._ The web/PWA stays the primary home and the notification
owner; the MCP app is a full-featured second entrance, not a demo.

Product frame (binding, from the membership handoff §1/§5): Peer owns data,
ranking, Persona, reports, saved state, and visual identity. The host
contributes conversation, the user's own model quota, and distribution. No
membership credential ever touches Peer's servers.

## 2. Binding references

1. **Mockups (visual + interaction contract):**
   `docs/design/peer-in-chatgpt-mcp-mockups.html` — 5 annotated screens.
   Published copy: https://claude.ai/code/artifact/ae153b7d-d3c4-4328-b558-d83d35773165
   The screens are the acceptance reference: build what they show unless a
   host limitation forces a documented deviation.
2. **Policy / product boundaries:**
   `docs/handoff/MEMBERSHIP_OAUTH_AND_MCP_HANDOFF.md` — §5 (Peer stays visibly
   Peer), §7 (architecture), §10 (guardrails). Its guardrails are
   non-negotiable for this build.

## 3. User requirements (recorded 2026-08-12/13)

- **R1 — Build order is by mockup screen: 2 → 3 → 1 → 4 → 5.**
  (Working software before polished onboarding: card first, fullscreen home
  second, production OAuth third, reports fourth, writes/settings fifth.)
- **R2 — Sidebar entry lands on the home view.** When the user clicks "Peer"
  in ChatGPT's left sidebar / app launcher, the intended landing experience is
  the fullscreen Daily Forecast home (mockup screen 3), not a bare empty chat.
  Host reality: consumer ChatGPT controls its own surfaces; we cannot force a
  left-nav behavior on every plan (membership handoff §4). So: implement an
  `open_home`-style tool + app default view + starter prompts such that the
  first click/first message opens the fullscreen home in one step, then
  **measure and record in the state file what each plan/surface actually
  does** at test time. Do not silently promise more.
- **R3 — Settings are editable from inside ChatGPT.** Persona and user
  settings can be read and changed in the MCP app, with Peer-enforced
  confirmation before every write (mockup screen 5 pattern).
  **Secrets exception:** provider API keys are never typed into the ChatGPT
  surface — key entry deep-links to Peer web (`Profile` → AI setup). This is a
  security boundary, not a parity gap.
- **R4 — Full parity** per the matrix in §6. Anything not yet built stays
  listed there as OPEN; the loop is done when the matrix is closed or every
  remaining row has an explicit user-approved waiver.

## 4. Milestones (= build order)

Each milestone maps to one mockup screen and ends with: tests green, verified
in a real ChatGPT client (see §8), evidence recorded in the state file.

### M1 — screen 2: in-chat invocation + inline Daily Forecast card
- MCP server endpoint inside the existing Next.js app (`web/`), Streamable
  HTTP transport, tools discoverable by ChatGPT developer mode and Claude
  custom connectors.
- Read-only tools: `get_daily_forecast` (structured items: id, title, org,
  location, posted/deadline, relevance, why-it-matters, tags, deep link),
  `get_opportunity` (one item's detail).
- Inline interactive card (Apps-SDK component) rendering the forecast rows
  with relevance, "why", tags — visually Peer (ivory/sand/espresso/orange
  per `web/src/app/globals.css` tokens). Graceful text-only fallback for
  hosts without component rendering.
- Dev auth (M1 only): unguessable URL slug (`/api/mcp/<slug>`) mapped to a
  designated test user server-side; read-only tools only; slug rotates on
  demand and is never committed. Real OAuth arrives in M3 and replaces it.
- Tier 0 rule holds: these tools serve Peer data; they must not require any
  LLM key to answer.

### M2 — screen 3: fullscreen Daily Forecast home + entry behavior
- Fullscreen view: date header, counts, filter chips (All/Jobs/Papers/
  Grants/Events per Peer's real facets), full card list, per-card actions
  (Save/Dismiss may remain visually present but disabled until M5 if writes
  are not ready), "Open in Peer" deep links throughout.
- `open_home` tool + app metadata/starter prompts so "open Peer" lands here
  in one step (R2). Record actual sidebar/launcher behavior per plan in the
  state file.

### M3 — screen 1: production OAuth connect flow
- OAuth 2.1 authorization-code + PKCE + dynamic client registration on the
  Peer side, bridged to Supabase-authenticated Peer accounts
  (`web/src/lib/supabase/`). Authorize page on Peer web listing scopes
  exactly like mockup screen 1: `forecast:read`, `reports:read`,
  `persona:read` granted; `items:write`, `persona:write`, `settings:write`
  listed as per-action-confirm.
- Token issuance/refresh/revocation; revoke UI in Peer web `Profile`.
- Dev slug from M1 is deleted the same day OAuth lands.

### M4 — screen 4: Report Reader
- `get_report` tool: report body, fit analysis, sources with captured-at
  timestamps and excerpts, uncertainty flags — all from Peer's existing
  report pipeline; the host model never invents source facts.
- Fullscreen Report Reader per mockup: outline rail, sources, evidence/
  uncertainty box, actions (Save→M5, Export Markdown, Open in Peer).

### M5 — screen 5 + parity closure: writes, Persona, settings
- Write tools with Peer-enforced confirmation cards: `save_item`,
  `dismiss_item`, `update_persona`, `update_settings` (and `get_persona_summary`,
  `get_settings` reads). Confirmation is server-enforced: a write executes
  only with an explicit confirm round-trip, never on the model's say-so.
- Audit log + rate limits on all writes (membership handoff §10).
- Parity audit against §6; close or waiver every OPEN row.

## 5. Architecture and code anchors

- App: Next.js under `web/` (**read `web/AGENTS.md` first** — this Next.js
  version differs from training data; check `node_modules/next/dist/docs/`).
- Auth today: Supabase SSR (`web/src/lib/supabase/middleware.ts`).
- Existing REST routes to reuse for data (do not duplicate business logic —
  the MCP tools call the same lib code these routes use):
  `web/src/app/api/{feed,jobs,papers,events,saved,profile,topics,briefings,digest,feedback,read}`.
- LLM provider registry (context only; MCP tools must not need it):
  `web/src/lib/llm/providers/registry.ts`.
- Design tokens for the widgets: `web/src/app/globals.css` (ivory `#fdf6ee`,
  sand `#f1e9da`, espresso `#2b180a`, accent `#ff520d`, serif display).
- New code shape (C decides exact files with B's guide, keep it in one area):
  `web/src/app/api/mcp/…` for transport + auth, `web/src/lib/mcp/…` for tool
  registry/contracts, widget templates co-located under `web/src/lib/mcp/ui/`.
- MCP implementation: official TypeScript SDK (`@modelcontextprotocol/sdk`)
  with Streamable HTTP; stateless per-request handling suits Vercel. ChatGPT
  Apps-SDK component metadata on tools; hosts without components get
  structured text.

## 6. Parity matrix (R4)

| Peer web capability | MCP app | Milestone | Status |
| --- | --- | --- | --- |
| Daily forecast feed (ranked, why-lines) | inline card + fullscreen home | M1/M2 | OPEN |
| Facet filters (jobs/papers/grants/events) | fullscreen filter chips | M2 | OPEN |
| Opportunity detail | `get_opportunity` + card expand | M1 | OPEN |
| Full report with sources/evidence | Report Reader fullscreen | M4 | OPEN |
| Save / dismiss / feedback | write tools + confirm | M5 | OPEN |
| Saved list | `get_saved` + fullscreen list view | M5 | OPEN |
| Persona view | `get_persona_summary` | M5 | OPEN |
| Persona edit | `update_persona` + confirm card | M5 | OPEN |
| Settings view/edit (non-secret) | `get_settings`/`update_settings` | M5 | OPEN |
| Provider API key entry | **deep link to Peer web only** (R3) | — | BY DESIGN |
| Notifications (email/web/PWA push) | **stays Peer-owned**; host schedules optional later | — | BY DESIGN |
| Markdown/JSON export | Export action deep link | M4 | OPEN |

## 7. Non-negotiable guardrails (inherited)

1. No ChatGPT/Claude membership credential, cookie, or token on Peer servers.
   This build is the **A path** (Peer inside the host); the B path (membership
   quota inside Peer) stays a separate local-beta track — out of scope here.
2. BYOK and Tier 0 behavior unchanged. MCP tools work without model keys.
3. Writes: scoped OAuth + server-side authorization + per-action confirmation
   + audit log + rate limits. Never trust host-side prompt text as authority.
4. Peer visual identity in every rendered surface; "Open in Peer" everywhere.
5. Persona/ranking source of truth stays in Peer's pipeline, never host memory.

## 8. How the user tests with their own ChatGPT account

Written for the user; agents keep it current as hosts change.

**Prereq:** a reachable HTTPS MCP URL. Two options:
- **Deployed (preferred from M2 on):** the Vercel deployment of this branch,
  URL `https://<vercel-preview-domain>/api/mcp/<slug>` (M1–M2) then
  `https://<domain>/api/mcp` with OAuth (M3+).
- **Local (fastest in M1):** run `npm run dev` in `web/`, then tunnel:
  `npx cloudflared tunnel --url http://localhost:3000` and use the printed
  `https://…trycloudflare.com/api/mcp/<slug>` URL.

**Connect (ChatGPT web or desktop, personal account):**
1. Settings → **Apps & Connectors** → **Advanced settings** → enable
   **Developer mode** (available on Plus/Pro accounts).
2. Back in **Apps & Connectors** → **Create** (custom connector): name
   `Peer (dev)`, paste the MCP URL. Auth: **No authentication** during M1–M2
   (the secret slug is the gate); **OAuth** from M3 (ChatGPT will open Peer's
   authorize page — the mockup screen-1 flow).
3. In a new chat: open the **+ / Apps** menu, enable `Peer (dev)`, then ask:
   _"Peer, what's in my forecast today?"_
4. Expected per milestone — M1: tool call chip + inline Peer card. M2: card's
   Expand (or "open my Peer home") shows the fullscreen forecast; check
   whether your plan shows Peer in the sidebar/launcher and note it. M3:
   connecting walks through Peer's OAuth consent. M4: "open the report for
   <item>" renders the Report Reader. M5: "save the first one" / "change my
   location to Boston" produce Peer confirmation cards that actually write.
5. Claude cross-check (optional, from M2): Claude → Settings → Connectors →
   Add custom connector with the same URL.

**Safety while testing:** dev slug URLs point at a test account by default;
switching the slug to the user's real Peer account is a manager decision
recorded in the state file.

## 9. How this loop runs (ABC)

- Roles per `docs/handoff/MULTIAGENT-mcp-app.md`: A reviews against this spec
  + mockups, B investigates and writes fix guides, C implements. Manager is
  the user's interactive Claude session (Fable). **A/B/C subagents run on
  Sonnet** (`model: sonnet`) — standing user rule.
- One commit per item; **push `membership-api-connection` after every
  commit** (the hourly cloud clock works from origin, not your disk).
- Credit-limit continuity ("the clock"): an hourly scheduled cloud run reads
  the state file and continues pending work when local sessions are out of
  budget, claiming the same turn lock. Local sessions always take priority;
  the cloud run stands down when the lock is fresh. Details + identifiers in
  the state file §0.
- This spec changes only by manager/user decision, recorded as a ruling in
  the state file.

## 10. Out of scope (do not drift)

- Membership-runtime inference (B path), workspace-agent pilot (Phase 2 of
  the membership handoff), host-side scheduled notifications, publishing to
  the ChatGPT app directory (that is a launch decision, after M5).
