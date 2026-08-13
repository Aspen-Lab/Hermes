# docs/handoff — all agent handoff documents live here

Every handoff document in this repo belongs in this folder. A handoff is a
self-contained brief written for a future agent (any vendor) to pick up a piece
of work without this conversation's context.

## Active

| File | Work | Status |
| --- | --- | --- |
| [HANDOFF-chatgpt-mcp-app.md](HANDOFF-chatgpt-mcp-app.md) | Peer as an MCP app inside ChatGPT/Claude, full product parity | **ACTIVE — read this to build** |
| [MEMBERSHIP_OAUTH_AND_MCP_HANDOFF.md](MEMBERSHIP_OAUTH_AND_MCP_HANDOFF.md) | Membership OAuth / MCP policy + product-boundary record | Reference (binding guardrails) |

## Historical (completed or superseded)

API_PERFORMANCE_RESTRUCTURE_HANDOFF.md, HANDOFF-FACETS-COMPLETE.md,
HANDOFF-detailed-cards(-COMPLETE).md, HANDOFF-facets-and-daily-pool.md,
HANDOFF-per-surface-topics(-COMPLETE).md, HANDOFF-phase7-tier12-enrichment(-COMPLETE).md,
HANDOFF-report-overhaul(-COMPLETE).md

## Files that are NOT here yet — do not go looking for them on this branch

`HANDOFF-ABC.md`, `MULTIAGENT-report-parity.md`, and the phase8/9/10 handoffs
exist only on `feature/summary-report-revamp` (an independent, actively running
loop). They stay at that branch's repo root because its agents have those paths
memorised. When that branch merges to `main`, move its completed handoffs here
as a follow-up — never before.

## Rules

1. New handoffs are created in this folder, named `HANDOFF-<topic>.md`.
2. A handoff that another branch's live automation reads must never be moved
   or renamed from this branch.
3. Keep one source of truth: a handoff points at the state file / rulebook it
   belongs to instead of restating its rules.
