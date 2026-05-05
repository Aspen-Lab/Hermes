# Changelog

All notable user-facing or infrastructure changes to Hermes. Newest at the top.
Versioning is `0.x.y` until v1; `y` for fixes/chore, `x` for features.

---

## v0.7.9 — 2026-05-04
**Persona: actually persist the quiz result**

`/persona` already advertised "Saved locally only — not uploaded" in the result footer, but the quiz result lived in component `useState` only — close the tab or refresh and it was gone, so the footer's promise was a lie. Persist now: on completion the scores are written to `localStorage` under `hermes:persona:v1`, on next mount the page hydrates from there and re-derives the persona via `pickPersona` (rather than caching the persona blob, so future tweaks to persona names / blurbs / portraits surface automatically). Retake clears the storage. SSR-safe (`typeof window` guards), tolerant of quota/private-mode failures (silent fall-through to a fresh quiz). Sync to the server profile is a separate follow-up tied to the auth track.

## v0.7.8 — 2026-05-04
**Profile reading calendar: align client bucketing to server's UTC days**

The contribution-style calendar on `/profile` was always rendering blank cells even when `read_items` had data. `/api/read?aggregate=daily` groups reads by `toISOString().slice(0,10)` (UTC YYYY-MM-DD), but `useDailyActivityCells` was building its lookup keys from a `Date` set to *local* midnight then formatted via `toISOString()` — which yields the UTC string of local-midnight, off by a day for any non-UTC user. Reads timestamped late local-evening (= early next-UTC-day) bucketed under tomorrow's key on the server but were looked up under today's key on the client — every cell missed, calendar stayed empty. Switched the client to `setUTCHours(0,0,0,0)` and millisecond-arithmetic day stepping so both sides agree on day boundaries.

## v0.7.7 — 2026-05-04
**Hotfix: prod page-load crash + read-tracking 500s**

Two unrelated bugs were taking the production deploy down. (1) `applyColorTheme` was calling `Object.entries(themeVars[theme])` without guarding for the case where `theme` is `undefined` — which it was for every existing user, because the `profiles.color_theme` column declared in `schema.sql` had never actually been applied to the live DB. The throw bubbled up through React render and Chrome surfaced "This page couldn't load". Added a defensive `if (!vars) return` so unknown / missing themes silently fall back to the CSS defaults instead of crashing the tree. (2) `/api/read` was upserting into `read_items` to refresh `read_at` on repeat reads, but the table had no `UPDATE` RLS policy — so the conflict-resolution path always failed with "new row violates row-level security policy". Added the missing `users update own reads` policy (USING + WITH CHECK on `auth.uid() = user_id`), matching the pattern already used by `saved_items`. Schema source-of-truth in `web/supabase/schema.sql` updated to keep parity. The `profiles.color_theme` schema drift remains — that's a separate auth/Supabase-track follow-up; the defensive code makes it non-blocking.

## v0.7.6 — 2026-04-29
**Persona result: editorial side-by-side layout + 2 more portraits**

Result page goes from a stacked column to a two-column editorial layout — portrait (with cream gradient frame, soft shadow, italic "Profile sketch" caption) sticks to the left on desktop, the title / tagline / blurb / look / axes flow on the right at a comfortable reading width. Title bumps to 52px Instrument Serif, tagline gets italic Source Serif, "Spotted at the conference like" header now sits between hairline rules — a touch more magazine, less form-result. Mobile collapses cleanly to a single column. Two additional portraits seeded: `lab-lead.png` and `synthesist.png`. Five remaining slots open.

## v0.7.5 — 2026-04-29
**Persona: collapse to the canonical 10 + best-fit assignment**

Quiz results now always land on one of the 10 curated PAIR personas (or the flat-profile Polymath fallback). The 10 SOLO names — "The Bench Operator", "The Theorist", "The Polymath" (specialist-pole), "The Builder", "The Provocateur", etc. — were a mid-state fallback for users whose top-two combo wasn't in the curated set, but they had no portraits and felt like a "you're not really any of these" cul-de-sac. Removed. New pickPersona scores all 10 PAIRs by alignment with the user's axis values (sign-aware sum of the two pole projections) and picks the highest-fit one — so a Generalist+Solo profile, which previously fell to "The Polymath" SOLO, now lands on whichever curated PAIR best matches that direction (typically Synthesist or Field Crosser). 11 possible outcomes total (10 PAIRs + flat Polymath), every named result has a slot for a portrait. Renamed the misseeded `bench-operator.png` → `bench-builder.png` since the visual fits Bench Builder perfectly and Bench Operator no longer exists as a result.

## v0.7.4 — 2026-04-28
**Persona art: portrait above each result**

The `/persona` result now renders a portrait above the persona title. Convention is purely file-system based — drop a PNG at `web/public/persona/<slug>.png` (slug = persona name, lowercased, leading "The" stripped, non-alphanumerics → dashes — so `bench-operator.png`, `theoretical-provocateur.png`, `group-builder.png`, etc.) and it appears next deploy. No code change needed per persona; missing images render nothing (the `<img>` errors silently). Seeded the first two from existing references — Bench Operator and Group Builder.

## v0.7.3 — 2026-04-28
**Persona: ship the whole feature + add MBTI-style "look" to result page**

Two things in one. (1) The `/persona` quiz that v0.7.0 announced was never actually committed — `web/src/app/persona/`, `web/src/components/persona/`, and `web/src/lib/persona/` only existed locally and Vercel had no idea about them. Tracked all of them now (same fix shape as v0.7.1 — other agent's WIP wasn't `git add`ed). (2) Added a `look` field to every Persona — concrete MBTI-style appearance for all 10 curated PAIR_NAMES, all 10 SOLO_NAMES (with poles having distinct visuals: e.g. The Bench Operator gets "olive flannel, top-knot, dead-project sticker laptop, coffee, anti-glamour"), and the Polymath flat fallback. New "Spotted at the conference like" section on the result page renders the look as an italicized accent-bordered pull-quote between the blurb and the axes bars. Same data, more recognizable.

## v0.7.2 — 2026-04-28
**Affiliation: school autocomplete + lab field**

The Affiliation row in the profile editor splits into two fields. **School / org** is now an autocomplete-backed input — type to filter ~150 curated entries (top global research universities, CMU/MIT/Oxford/Tsinghua/etc. + industry research labs like Anthropic, DeepMind, FAIR), with substring highlighting on the matched portion, ↑/↓/Enter/Tab keyboard nav, and free-text fallback for anything not in the list. **Lab / group** is a separate plain-text field below for the unit within the org (CSAIL, HCI Group, Vision Lab, your advisor's group). Both are persisted on the profiles row and surface in the read view as `MIT / CSAIL`. New `lab` column on profiles table; schema.sql + the /api/profile mapping updated to round-trip.

## v0.7.1 — 2026-04-28
**Fix: ship the missing search filter modules**

Production deploys had been failing since v0.6.8 — the search filter feature committed `page.tsx` imports for `@/components/search/filter-bar`, `@/components/search/filter-chip`, `@/components/search/more-filters-panel`, and `@/lib/search/filters`, but the directories themselves were never `git add`ed. They existed locally and worked in dev but Vercel's clean checkout couldn't resolve the imports → every commit since v0.6.8 returned the old deploy. Added the four missing files (752 lines) so the production build succeeds and v0.6.9–v0.6.14 actually reach users.

## v0.7.0 — 2026-04-28
**Academic persona quiz at /persona**

A short forced-choice quiz that maps a researcher across five continuous axes — Empirical ↔ Theoretical, Specialist ↔ Generalist, Solo ↔ Collaborative, Builder ↔ Critic, Formal ↔ Narrative — and names a persona from the two strongest signals (e.g. "The Theoretical Provocateur", "The Bench Specialist", "The Synthesist"). Jung-style multi-dimensional rather than MBTI's 16 boxes: every axis is a value in [-1, +1], not a category, and the persona name reflects a combination, not a verdict. 15 questions, 3 per axis, no Likert middle ground. Result card shows axis bars with score markers, a tagline, and a prose blurb in the editorial serif. Saved locally only — no upload. Accessible from the sidebar (or `g x`). First step toward the broader "input your paper, get an academic style profile" feature; URL/PDF analysis comes next, this seeds the framework.

## v0.6.15 — 2026-04-28
**Paper figure adopts the image's natural aspect ratio (no more cropping)**

`PaperFigure` was forcing every figure into a fixed 16:8 (hero) or 16:9 (compact) frame with `object-cover`, which silently cropped portrait charts, square diagrams, and any landscape figure with a different ratio. The container now starts at the variant's default aspect (skeleton state only), then on `onLoad` reads `naturalWidth / naturalHeight` from the image and sets the container's `aspect-ratio` to match. Image switches to `object-contain` so it always fits, and a `transition: aspect-ratio 300ms` smooths the resize when the natural aspect arrives. A `max-h-[80vh]` cap prevents extreme portrait images from dominating the viewport. Net effect: every figure renders at its true proportions, nothing gets cropped.

## v0.6.14 — 2026-04-28
**Profile editor: affiliation field + suggestion chips + cleaner first-run defaults**

Adds an Affiliation field (school / lab / company) to the profile editor, persisted as a new `school` column on `profiles`. Improves first-run by stopping the editor from pre-seeding battery-research demo topics — `defaultProfile.researchTopics` and `preferredVenues` are now empty arrays so the profile-setup nudge in the header surfaces immediately. The Topics, Methods, and Venues ChipInputs gained quick-add suggestion rows ("Try: + transformers + RAG + diffusion models …") shown only when the field is empty, and Topics carries an inline hint reminding people specificity matters (a single word like "whatever" matches nothing useful — we just shipped a fix for that exact case in v0.6.12). Schema.sql + the /api/profile mapping updated together so the new column round-trips cleanly.

## v0.6.13 — 2026-04-28
**Paper detail: rework "At a glance" + "Explore further" + train-feed action**

Three weak spots on the paper detail page got a pass. (1) "At a glance" Signal chips used a binary ✓/× toggle that read awkwardly — `Older paper ×` was double-negation, and `On arXiv ×` for a non-arXiv paper just wasted a slot. Replaced with a new `FactChip` that only surfaces facts when they're present: `Preprint on arXiv` (accent), `Code available` (tag), a relative-time chip (`23 days ago` / `2 years ago`), and a smarter team-size label (`Solo author` / `3 authors · small team` / `12 authors · large team`). (2) "Explore further" link chips now carry a leading icon per destination (document for publisher, mortarboard for Google Scholar, code-brackets for source/search code) so the row is scannable at a glance instead of three near-identical pills. (3) The lonely "Train my feed on this" button at the bottom got a clearer label (`More like this`) and a co-located one-line explainer so it reads as an action, not a stranded chip.

## v0.6.12 — 2026-04-28
**Stop showing mock data as the user's feed**

The feed store had a `realPapers.length > 0 ? realPapers : mockPapers` fallback that silently surfaced battery-research demo fixtures (with hardcoded "your PhD"-style relevance reasons) whenever the real API returned 0 results — for example when the user typed a topic with a typo like `transfomer`. Events and Jobs were even worse: always wired to `mockEvents` / `mockJobs` because no real adapters exist yet. Removed both fallbacks. Empty source = empty feed; the FeedMoreTile already shows a context-aware "Tune your signals" prompt when topics under-deliver, so a real empty state is more honest and more actionable than fake content.

## v0.6.11 — 2026-04-28
**Per-category icons + richer metadata on feed tiles**

Feed grid cards now carry a category-specific line icon next to the kind label (Paper / Discussion / Event / Job) and a thin colored stripe on the left edge for at-a-glance scanning. Inline mini-icons attach to metadata: author for papers, calendar + pin/globe for events, building + pin/globe for jobs. The redesign keeps the same density and serif/sans typography rhythm — purely a scannability pass, no content moved.

## v0.6.10 — 2026-04-28
**Search result card redesign + cleaner result count**

Search cards now read more like Airbnb listings than a database dump. Each card gets a colored type badge (arXiv, Journal, Conference) and an Open Access badge with icons; venue and date sit on a single meta row with calendar/book glyphs; the citation count moves to a quiet footer separator with its own icon and is humanized (`12.4k cited` instead of `12,432 cited`). Title shifted to `line-clamp-3` so longer paper titles breathe; abstract switches to the editorial serif at 13.5px for scannable reading. Result counter at the top no longer surfaces the raw OpenAlex universe size — it just shows how many results are visible (e.g. `12 results for "transformer"`), which fits the triage use case far better than `12 of 4,567,890`. Search API now returns `sourceType` and `isOpenAccess` to drive the badges.

## v0.6.9 — 2026-04-28
**Better paper links: prefer open-access PDFs + clean arXiv URLs**

Two fixes for the "many paper links are wrong" complaint. (1) The OpenAlex adapter now requests `best_oa_location` and `open_access` and prefers, in order: an OA PDF → an OA landing page → the DOI URL → the OpenAlex page itself. Result: papers with a free PDF on arXiv / institutional repository / publisher OA channel surface that link instead of a paywalled DOI redirect. (2) When OpenAlex returns an arXiv preprint via the `10.48550/arxiv.*` DOI prefix, the mapper detects it, swaps the URL to a clean `https://arxiv.org/abs/<id>`, populates `linkArxiv`, and renames the venue from "arXiv (Cornell University)" to plain "arXiv". The detail page CTA correctly says "Read on arXiv" again for these.

## v0.6.8 — 2026-04-27
**Search filters: year, sort, open access, citations, source, venue**

OpenAlex search now exposes the dimensions that actually matter for relevance triage. A chip row appears under the search bar in search mode (year preset or custom range, sort by relevance/citations/date, open-access toggle, min-citations threshold), with source-type and venue search behind a "More filters" inline drawer. State syncs to the URL so a filtered search is shareable and back-button safe; opening a shared link rehydrates every filter. Reset link clears all non-default filters in one click. Daily feed unchanged — filters only render in search mode.

## v0.6.7 — 2026-04-28
**"See more" tile at end of feed grid**

Added a context-aware action tile to the last cell of the homepage grid. Detects three states and adapts copy:

- **Profile under-tuned** (placeholder topics like `Whatever`, `idk`, or single short word) → "Tune your signals" + link to `/profile`. Short-circuits the most common reason for a sparse feed.
- **Sparse but tuned** (< 4 items) → "Light today" + Refresh button.
- **Plenty** → "More?" + Refresh button.

Replaces the loose "Refresh recommendations" link below the grid; collapses two affordances into one tile that lives where the eye lands. Visual differentiation: dashed border, no shadow — reads as an action, not content.

## v0.6.6 — 2026-04-28
**Distinguish HN discussions from academic papers in the feed**

HN posts share the `Paper` data model (and "Papers" tab) with arXiv/OpenAlex items, which made a Show HN thread visually identical to a real publication. The FeedTile now uses an **allowlist** of academic id prefixes (`arxiv:*`, `openalex:*`) to decide which items get the orange "Paper" badge — anything else renders as a muted "Discussion" badge. Allowlist over blocklist on purpose: future non-academic adapters (Twitter, Substack, etc.) default to "Discussion" until explicitly opted in. (A separate Discussions tab is the obvious next step if this surface keeps growing.)

## v0.6.5 — 2026-04-28
**Skip figure extraction for HN items**

HN posts link to arbitrary external URLs (GitHub repos, personal blogs, corporate sites). The `og:image` on those is rarely a meaningful representation of the discussion — usually a generic social preview, repo card, or logo banner. The detail page was loading these as the hero figure, which felt wrong. Now `extractFigure` returns null for any `hn:*` item id; the figure component's `hideOnMiss` collapses gracefully. Cache-bust param bumped `v=2 → v=3` so existing CDN entries refresh.

## v0.6.4 — 2026-04-28
**Fix HN content rendering on detail page**

Three bugs surfaced from a Show HN paper detail view: (1) abstracts arrived with HTML entities (`&#x2F;` `&#x27;`) and `<p>` tags un-decoded — added `decodeHtmlEntities` + `stripHtml` in the mapper before splitting; (2) HN system tags (`story`, `front_page`, `show_hn`, `author_*`, `story_*`) were polluting "Methods & techniques" — now filtered out via `isUsefulKeyword`; (3) primary CTA was hardcoded "Read on arXiv" — now source-aware (`Read on Hacker News` / `Read on arXiv` / fallback `Search arXiv`).

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
