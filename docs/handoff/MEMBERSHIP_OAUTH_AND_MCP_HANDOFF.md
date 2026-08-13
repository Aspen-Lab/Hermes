# Peer: Membership OAuth, MCP, and Product-Surface Handoff

**Status:** Design/research record only. No product code has been changed for this work.

**Branch:** `membership-api-connection`

**Purpose:** This is a self-contained record of the discussion about letting users connect a ChatGPT or Claude membership to Peer while retaining the existing API-key (BYOK) system. Read this before changing providers, MCP, Persona, reports, or AI settings.

---

## 1. The product decision in one paragraph

Peer must remain a real, branded product with its own daily forecast, feed, Persona, report reader, history, and notifications. It must **not** be reduced to an invisible MCP data source that only produces sentences inside ChatGPT or Claude.

The preferred direction is therefore a **dual-surface product**:

1. **Peer web/PWA remains the primary home.** It owns the daily forecast, source pipeline, ranking, Persona, report reading, feedback, history, exports, and proactive notifications.
2. **ChatGPT/Claude integrations become a second entrance.** They can show Peer-branded interactive cards or full-screen views and call Peer tools, but do not replace Peer’s own home.
3. **The old user API-key system stays.** It remains the most clearly supported public hosted route for cloud inference, alongside Tier 0.
4. **Membership connections are an explicit beta/partner-gated route.** They are technically possible in some official runtimes, but must not be treated as a generic, public, server-side OAuth feature until provider authorization and runtime rules are clear.

This follows Peer’s product direction: daily information should be calm and useful, user intent should be explicit, Tier 0 must work without model keys, and cloud LLM use is optional progressive enhancement.

---

## 2. Important correction to the initial assumption

An earlier conclusion—“ChatGPT or Claude membership cannot be used through OAuth”—was too broad.

The accurate statement is:

- **OpenAI Codex supports signing in with ChatGPT for subscription access in supported Codex clients and local workflows.**
- **OpenClaw documents that it uses ChatGPT/Codex subscription authentication through the native Codex app-server runtime.** Its direct API calls remain a separate, API-key-billed route.
- This does **not** prove that a normal hosted web application can freely turn any ChatGPT membership into a generic OpenAI API credential.
- Claude has similar subscription/Agent SDK paths, but Anthropic explicitly says product builders for other users should use API-key authentication unless the relevant third-party path is approved.

In plain language: OpenClaw is not evidence that Peer may safely copy a browser login or put a user’s membership token on Peer’s Vercel server. It is evidence that a provider-approved/native runtime can sometimes use a subscription.

Never copy another product’s OAuth client ID, mimic its identity, collect browser cookies, or store an unmanaged membership credential on the Peer server.

---

## 3. Three different things that are easily confused

| Connection | What it does | Does it automatically give Peer model quota? |
| --- | --- | --- |
| **Sign in with ChatGPT** | Lets a supported partner site/app identify the user as a ChatGPT user. | **No.** It is identity login, not generic model access. |
| **Codex subscription authentication** | Lets supported Codex clients/runtimes use the user’s ChatGPT subscription according to that product’s limits. | **Yes, in the supported Codex runtime.** |
| **Peer MCP OAuth** | Lets ChatGPT/Claude obtain permission to call Peer and access the particular Peer account. | **No by itself.** The host decides what model runs; Peer OAuth authorizes Peer data/actions. |
| **Peer BYOK API key** | Lets Peer call the user’s chosen provider API directly. | **Yes, but usage is charged under the user’s API account, not their chat membership.** |

OpenAI’s general API billing is still separate from a ChatGPT subscription. The special case under discussion is a Codex/subscription runtime, not a replacement for the normal OpenAI API.

---

## 4. What MCP is—and what it is not

### Correct part of the concern

If Peer exposes only text-returning MCP tools such as `search_jobs` or `summarize_report`, ChatGPT/Claude will own almost all of the visible experience. Peer will look like a background database. That is not the desired product direction.

### Necessary correction

MCP is a connection protocol, not a rule that removes UI. Modern hosts can render an app-provided interactive interface:

- Claude supports interactive connectors with compact cards and a full-screen view, including filters, settings, drill-downs, and actions.
- ChatGPT supports Apps/Plugins and interactive app experiences; its workspace-agent product also has a distinct left-sidebar entry point in eligible workspaces.

An MCP-powered Peer surface can therefore still show a recognizable Peer interface: the daily forecast, source cards, evidence panels, report reading, Persona controls, saved items, and feedback. The important implementation choice is to ship a **Peer interactive app/UI**, not just a tool list.

### Current host limitation

The exact desired experience—“Peer is a permanent independent top-level application in every ChatGPT/Claude left sidebar, and clicking it always opens Peer’s own full homepage”—is **not a universal consumer-platform capability today**.

- A ChatGPT Plugin/App may be discoverable through the sidebar’s Plugin directory, but normally gets invoked in a conversation.
- ChatGPT Workspace Agents offer the closest match: each agent has its own left-sidebar entry and agent page, but this is an eligible managed-workspace feature rather than a universal consumer app shell.
- Claude interactive connectors can show excellent full-screen Peer UI, but are entered through a connector-enabled conversation rather than a persistent Peer home in the left nav.

Therefore, do not promise the exact left-nav behavior for all ChatGPT/Claude customers before validating the target plan, region, and host surface.

---

## 5. Keeping Peer visibly Peer

The following product boundary was agreed:

```text
Peer owns:                       Host (ChatGPT / Claude) contributes:
daily forecast and feed           natural-language conversation
source collection and evidence    optional reasoning/runtime
deterministic ranking             invocation of approved Peer tools
Persona source of truth           discovery/distribution surface
report reader and saved state     its own chat shell and notifications
email / web / PWA notifications
portable Markdown / JSON output
```

This means ChatGPT or Claude may say, “Open today’s Peer forecast,” but the content, cards, evidence, progress state, and preference changes remain Peer-owned. Host memory must never become the sole storage for a user’s Persona.

### Suitable interactive Peer views

- **Daily Forecast:** concise list of today’s high-signal opportunities with why-it-matters explanations.
- **Report Reader:** source citations, original excerpts, report outline, evidence/uncertainty, and an “open in Peer” deep link.
- **Persona:** declarative goals, location, work authorization, topics, projects, and controls; not a hidden chat prompt.
- **Feedback:** save, dismiss, more/less like this, export.

The UI should reuse Peer’s calm visual identity but adapt to the host’s container. The embedded/full-screen version is a companion surface, not a second unrelated product.

---

## 6. Can the existing Peer features survive an MCP integration?

| Feature | Can it work through MCP? | Design rule |
| --- | --- | --- |
| Daily feed and opportunity cards | Yes | Return structured cards plus an interactive Peer UI, not prose alone. |
| Detailed reports | Yes | Peer fetches/validates sources and owns the evidence. The host can read or open the report. |
| Persona | Yes | Store it in Peer; authenticate each MCP call to the corresponding Peer user. |
| Ranking and relevance | Yes | Keep ranking in Peer’s existing pipeline; do not delegate its source-of-truth logic to host memory. |
| Feedback/save/read state | Yes | MCP actions write into Peer under narrow OAuth scopes and confirmation rules. |
| Push notifications | Partly | MCP alone is not a dependable user-notification product. Retain Peer email/web/PWA push; host schedules are optional extra channels. |
| Tier 0 | Yes | MCP must work without a paid model call whenever Peer can supply a Tier-0 result. |

For proactive daily use, Peer’s own notification channels are indispensable. ChatGPT has scheduled tasks and workspace agents can schedule runs, but these are host features with plan and availability constraints—not a replacement for Peer-owned delivery.

---

## 7. Recommended architecture

```text
                         ┌─────────────────────────────────┐
                         │             Peer                │
                         │  sources → score → dedupe → UI   │
                         │  Persona, reports, feedback, push│
                         └───────────────┬─────────────────┘
                                         │
                  ┌──────────────────────┼───────────────────────┐
                  │                      │                       │
          ┌───────▼────────┐    ┌────────▼─────────┐   ┌────────▼─────────┐
          │ Tier 0         │    │ Existing BYOK    │   │ Membership beta  │
          │ no LLM / rules │    │ OpenAI/Claude/...│   │ approved runtime │
          └────────────────┘    └──────────────────┘   └──────────────────┘
                                                                 │
                                             ┌───────────────────┴───────────────────┐
                                             │                                       │
                                   ┌─────────▼─────────┐                   ┌─────────▼─────────┐
                                   │ Peer web/PWA      │                   │ MCP companion UI  │
                                   │ primary product   │                   │ ChatGPT / Claude  │
                                   └───────────────────┘                   └───────────────────┘
```

### Provider modes proposed for the Settings UI

1. **Tier 0 / no AI:** default; no paid model request.
2. **Use my API key:** preserve existing OpenAI, Anthropic, Gemini, Qwen, and DeepSeek support.
3. **ChatGPT Membership — Beta:** only appear when the approved Codex runtime and deployment model are available.
4. **Claude Membership — Beta:** only appear after Anthropic’s permitted runtime/policy conditions are confirmed.

Do not silently switch a user from membership quota to a paid API key. The effective runtime, quota/billing origin, limits, and fallback must be visible in settings and request logs.

### Suggested code-level shape (design only)

Keep the existing provider abstraction and add an explicit connection layer rather than pretending every connection is an API key:

```ts
type AiConnectionMode =
  | "tier0"
  | "api_key"
  | "chatgpt_codex_subscription"
  | "claude_agent_subscription";

type AiRuntime =
  | "peer_server_provider"
  | "codex_app_server"
  | "claude_agent_sdk";
```

The existing `resolveProvider` path should remain valid for `api_key` and Tier 0. Membership modes should use a dedicated runtime adapter and must fail closed to Tier 0 if unavailable. Do not place subscription credentials in the same fields as `feedAiApiKey`.

For any MCP server, give each tool narrow contracts, for example:

- `get_daily_forecast`
- `open_opportunity`
- `get_report`
- `get_persona_summary`
- `update_persona` (explicit user confirmation)
- `save_item` / `dismiss_item`

Peer still enforces authorization, source access, rate limits, and write confirmation on its server. Never trust the host model to make those boundaries safe by prompt alone.

---

## 8. Provider-specific feasibility

### ChatGPT / OpenAI

**What is confirmed:** OpenAI documents two Codex sign-in methods: ChatGPT subscription access and API-key usage. The browser sign-in returns credentials to the supported Codex client. This is documented for local work in the ChatGPT desktop app, Codex CLI, and IDE extension.

**What OpenClaw demonstrates:** It routes membership-backed turns through a native Codex app-server runtime and keeps normal non-agent OpenAI API use API-key billed.

**Safe initial hypothesis for Peer:** a local/self-hosted Peer companion that asks the user to run the official Codex sign-in flow, then invokes an official local Codex runtime, is the closest comparable experiment. Peer web remains the UI; the local companion is the runtime bridge.

**Not yet approved to assume:** that a hosted Peer SaaS can collect/store user ChatGPT membership credentials and run subscription traffic on its servers. Obtain clear OpenAI partner/product approval and the intended client-registration flow before building this as a public cloud feature.

### Claude / Anthropic

**What is confirmed:** Anthropic currently says Agent SDK, `claude -p`, and some third-party app usage may draw from subscription usage limits, but the policy is in flux. It also states that builders making a product/tool for other people should use API keys or a supported cloud provider; misrepresenting third-party traffic to use subscription limits is prohibited.

**Safe initial hypothesis:** local beta only, via an officially supported Agent SDK/Claude runtime with user-controlled sign-in. Treat it as policy-sensitive and do not market it as permanent hosted SaaS behavior.

**Public hosted default:** retain Claude BYOK API-key flow.

---

## 9. Rollout plan

### Phase 0 — Preserve the current contract

- Keep the existing BYOK settings and provider resolution working exactly as today.
- Keep Tier 0 useful and default when no permitted connection is available.
- Document billing/fallback behavior before adding UI choices.

### Phase 1 — Peer-owned MCP, no membership dependency

- Build a remote MCP server authenticated to the Peer account with least-privilege OAuth scopes.
- Expose read-only forecast, report, and Persona-summary tools first.
- Build a small interactive companion UI: forecast card → report reader → “open in Peer.”
- Add write actions later with confirmation and audit logging.

This phase gives Peer a ChatGPT/Claude companion presence even if membership inference is unavailable.

### Phase 2 — ChatGPT workspace-agent pilot

- Target an eligible Business/Enterprise workspace.
- Publish a branded Peer workspace agent with the Peer MCP/app attached.
- Verify the left-sidebar entry, starter prompts, schedule behavior, account mapping, interactive report view, and revocation.
- Do not extrapolate this result to consumer ChatGPT plans.

### Phase 3 — Local membership-runtime prototype

- Create a local Peer companion/bridge for a single consenting user.
- Use the official Codex sign-in/runtime path rather than copied tokens.
- Confirm exactly what task types, limits, routing, data handling, and subscription behavior are permitted.
- Test failure: signed out, quota exhausted, network unavailable, unsupported feature.

### Phase 4 — Public membership decision

Do this only after written provider guidance/approval establishes:

- public third-party client registration/support;
- the supported OAuth/device flow;
- whether hosted execution is permitted;
- quota/rate-limit semantics;
- what data reaches the provider;
- support, revocation, and incident responsibilities.

If any of these are missing, keep membership connection as a local beta and continue to offer BYOK.

---

## 10. Non-negotiable safety and product guardrails

- Preserve Tier 0: no key/no membership must mean no paid AI call, not an operator-funded hidden fallback.
- Preserve the existing API-key system; do not force users into membership sign-in.
- Never route a ChatGPT/Claude membership request through a generic public API endpoint without documented provider support.
- Never scrape, proxy, replay, or store browser session cookies.
- Keep provider, runtime, billing method, and host surface as separate concepts in code and UI.
- Keep Persona and ranking in Peer, based on user-declared intent; host chat memory is supplementary at most.
- Validate every source and retain evidence in Peer before displaying a report; an LLM-generated generic title/summary is not a source-backed fact.
- Use scoped OAuth, server-side authorization, auth/rate limits, action confirmation, and audit logs for MCP writes.
- Make fallback obvious: `membership unavailable → Tier 0`; do not silently begin API billing.
- Keep daily Peer concise; do not turn this integration into a generic agent platform.

---

## 11. Open questions for the next agent

1. What specific user segment comes first: individual Peer users, a single managed ChatGPT workspace, or a local/self-hosted pilot?
2. Is the desired “left sidebar Peer” requirement limited to Business/Enterprise Workspace Agents, or is a prominent Plugin/App entry acceptable for consumer ChatGPT?
3. Can the team obtain direct written OpenAI guidance for a public hosted membership-runtime use case? Without it, membership remains local beta only.
4. Does Claude offer a stable, explicitly permitted third-party membership SDK route at launch time? Recheck policy immediately before implementation.
5. Which three interactive screens are needed for the first companion release? Recommended: daily forecast, report reader, Persona summary/edit link.
6. Which Peer notification channels should be launched first? Recommended: Peer email/web/PWA; host schedules are optional extras.
7. Is an account link via “Sign in with ChatGPT” useful separately from model membership? It can simplify Peer account creation, but it must be labelled as identity login, not model entitlement.

---

## 12. Key external references checked during the discussion

- [OpenAI: Codex authentication](https://learn.chatgpt.com/docs/auth) — ChatGPT subscription sign-in vs API-key billing, and local supported Codex clients.
- [OpenAI: ChatGPT subscription and API billing](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api) — the ordinary API is billed separately.
- [OpenAI: Sign in with ChatGPT](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt) — identity login is separate from chats, tokens, billing, and extra permissions.
- [OpenClaw: OpenAI provider](https://docs.openclaw.ai/providers/openai) — its documented distinction between Codex subscription runtime and direct API-key route. This is third-party documentation, not a substitute for OpenAI approval for Peer.
- [OpenAI: Plugins in ChatGPT and Codex](https://help.openai.com/en/articles/20001256) — plugin discovery, OAuth connection, and conversation invocation.
- [OpenAI: Workspace Agents](https://help.openai.com/en/articles/20001143-chatgpt-workspace-agents-for-enterprise-and-business) — sidebar agent entries, custom MCP, schedules, and managed-workspace conditions.
- [Anthropic: Remote MCP connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) — OAuth custom connectors and interactive inline/full-screen interfaces.
- [Anthropic: Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) — full-screen embedded app possibilities.
- [Anthropic: Claude subscription login and third-party tools](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account) — product builders should use API keys unless a permitted third-party route applies.
- [Anthropic: Agent SDK with a Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) — current policy/usage status, noted as subject to change.

---

## 13. Current implementation snapshot

- Existing Peer profile types include `UserAiProvider = "default" | "openai" | "gemini" | "anthropic" | "qwen" | "deepseek"`.
- Existing profile UI is under `web/src/components/profile/ai-setup.tsx`.
- Existing provider resolution is under `web/src/lib/llm/providers/registry.ts`.
- No membership runtime, Peer MCP server, OAuth storage, interactive host UI, or Settings UI change has been implemented in this branch yet.
- No files beyond this handoff record were changed for this design task.
