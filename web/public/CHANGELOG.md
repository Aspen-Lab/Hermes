# Changelog

All notable user-facing or infrastructure changes to Hermes. Newest at the top.
Versioning is `0.x.y` until v1; `y` for fixes/chore, `x` for features.

---

## v0.6.3 — 2026-04-27
**Dense feed grid (Xiaohongshu-PC density)**

Replaced the 3-tier briefing layout (hero + "Worth your time" + "Quick hits") with a single dense card grid that scales 1 → 2 → 3 → 4 columns from mobile through `xl`. New `<FeedTile />` compact card — tighter padding, two-line title, kind badge + relevance %, single-tap save action. Container widens from 820px to 1280px so wide screens actually use the space; header (greeting, search, type tabs) stays narrow-centered for reading rhythm. Search results adopt the same grid.

## v0.6.2 — 2026-04-27
**Public changelog page at `/changelog`**

Added a server-rendered page that reads `public/CHANGELOG.md`, parses the version/date/title/body structure, and renders entries in the editorial brand style (Instrument Serif headlines, Source Serif body, accent-orange version tags). 1-min revalidate so a markdown push lands on the live site without a redeploy. Raw markdown still served verbatim at `/CHANGELOG.md` for the curious.

## v0.6.1 — 2026-04-27
**Start CHANGELOG**

Backfilled past releases from `git log` and seeded an ongoing release log. From here on, every user-facing/infra commit adds an entry.

## v0.6.0 — 2026-04-26
**Hourly digest cron via GitHub Actions**

Replaced the removed Vercel cron with `.github/workflows/digest-cron.yml`. Triggers `/api/jobs/dispatch-digests` every hour at :05 with bearer auth via the `CRON_SECRET` repo secret. Free, preserves per-user timezone hour preference (Vercel Hobby plan rejected hourly cron).

## v0.5.2 — 2026-04-24
**Unblock production deploy**

Removed `web/vercel.json`. Hobby plan rejected the `0 * * * *` schedule, blocking every deploy after v0.5.0. Cron re-added externally in v0.6.0.

## v0.5.1 — 2026-04-24
**Ignore local MCP config**

`.mcp.json` excluded from repo. Local-only tooling config, never product code.

## v0.5.0 — 2026-04-24
**Email digest delivery (Resend)**

Resend wrapper with lazy init + branded HTML/plaintext/subject templates (Gmail-friendly table layout, escapes user-derived fields) + `/api/test-digest` self-send endpoint. Gracefully degrades when `RESEND_API_KEY` is missing — in-app inbox keeps working.

## v0.4.0 — 2026-04-24
**Supabase persistence layer**

Server-side persistence for saved items, read items, feedback signals, and digest deliveries. New RLS-scoped tables: `saved_items`, `read_items`, `feedback_events`, `briefing_deliveries`. Profile gets 5 digest preference columns (timezone, hour, channel, frequency, enabled). API routes: `/api/{saved,read,feedback,briefings}` + cron `/api/jobs/dispatch-digests`. `<FeedSync />` bridges local Zustand ↔ cloud on auth state change. Profile page adds digest preferences UI, Past Briefings inbox, and a reading calendar driven by real per-day read counts.

## v0.3.1 — 2026-04-24
**Profile sync to Supabase + UX polish**

Profile data persists via Supabase `profiles` table (was localStorage-only). User menu floats top-right.

## v0.3.0 — 2026-04-22
**Supabase GitHub auth + stars badge**

Sign-in with GitHub via Supabase Auth. Top-right pill shows the project's live GitHub star count.

## v0.2.3 — 2026-04-21
**Search briefing fixes + UX polish**

Search results route to internal briefing detail page; encoded-colon route param decoded correctly; "Loading briefing…" replaced with a shimmer skeleton.

## v0.2.2 — 2026-04-21
**Feed wired to real recommendations**

`/api/feed` returns scored items from the Tier 0 pipeline; replaces sample data fixture.

## v0.2.1 — 2026-04-20
**Briefing → memory-ful reading inbox**

Briefing surface treats items as a persistent reading list rather than an ephemeral feed.

## v0.2.0 — 2026-04-20
**Tier 0 scoring + multi-source feed pipeline**

Combined keyword / TF-IDF / recency / source-weight scoring. Source adapters for OpenAlex, arXiv, Hacker News. Wired into `/api/feed`. Profile redesigned as editorial dashboard with reading stats. Briefing feed redesigned with hero + quick-hit layout. Switched to HTTPS for arXiv to avoid Vercel-side 301 timeout.

## v0.1.0 — pre-versioning
Earlier work (project scaffolding, initial UI, prototype data layer). See `git log` for full history.
