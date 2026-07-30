# Tier 3 — Streaming "build-up" reports & feed (AI-agent implementation guide)

Audience: an AI coding agent implementing this feature. Full technical detail intended.
Reviewer: the primary Claude agent will review your PR against the Acceptance Checklist at the end.

## Mission

Replace the "blank loading screen → dump everything at once" experience with a **live build-up**:
a real progress stream + a floating progress bar (site-styled) + a decode/scramble text reveal.

Behavioral rule (must hold exactly):
- **AI on (Tier 1/2 — an LLM provider will produce the report):** never show the deterministic basic
  report during load. Show the build-up (progress bar + scramble reveal) until the real report locks in.
- **AI off (Tier 0 — no provider anywhere):** render the deterministic basic report **instantly**,
  no build-up, no spinner.
- **Cached report exists:** render it instantly (no fetch, no build-up). This already happens; keep it.

## Hard constraints (do NOT violate)

1. **Cost-neutral.** Do not add, duplicate, or enlarge any LLM call, and do not change any prompt.
   Progress "stages" are server-emitted status strings, not model calls. The scramble effect is
   client-only. Token usage must be identical to today.
2. **Do NOT modify** `web/src/lib/llm/providers/**` (Tier 0–2 provider work — separate PR #11) or any
   prompt text.
3. **Do NOT touch** the local-saver files (leave them unstaged; they belong to another change):
   `web/src/components/local-profile-sync.tsx`, `web/src/lib/local-profile-restore.ts`,
   `web/src/app/api/local-profile/**`, and the local-saver edits in `web/src/app/layout.tsx`,
   `web/src/components/first-run.tsx`, `web/src/store/profile.ts`, `web/.gitignore`.
4. **Backward compatible.** Keep the existing non-streaming JSON path working as a fallback. If the
   stream errors or is unsupported, the client must fall back to the current one-shot JSON request and
   still render a correct report.
5. **Accessibility.** Honor `prefers-reduced-motion: reduce` — no scramble, no bar animation; text
   appears directly. globals.css already has a reduced-motion block (see it near `.animate-fade-in-up`).
6. **Verify in the browser** (preview tools) and attach screenshots. Run `tsc`, tests, and lint.

## Branch / PR

- Branch off `perf-api-tier0-3` (it contains the Tier 0–2 report-route changes you build on):
  `git checkout perf-api-tier0-3 && git checkout -b tier3-streaming-report`.
- Commit ONLY the files you create/modify for this feature (see file list). Do not stage local-saver files.
- Open the PR against `main`. End the PR body with the standard Claude Code footer.

---

## Architecture

### Streaming protocol (NDJSON over a ReadableStream)

The report route streams newline-delimited JSON. One JSON object per line:

```ts
type ReportStreamEvent =
  | { type: "mode"; aiMode: "tier0" | "tier1" | "tier2" }      // ALWAYS first
  | { type: "stage"; stage: StageId; label: string; pct: number } // 0..100, monotonic
  | { type: "report"; report: PaperReport }                     // final, complete report
  | { type: "error"; message: string };

type StageId = "source" | "reading" | "writing" | "figures" | "done";
```

- `mode` is emitted first. If `tier0`, the client immediately renders its local deterministic
  `buildFallbackPaperReport(...)` and stops (no build-up). For `tier1|tier2`, the client shows the
  build-up and waits for `report`.
- `stage` events drive the progress bar. Suggested pct weights: source 10 → reading 35 → writing 75 →
  figures 92 → done 100. `label` is user-facing ("Finding the paper", "Reading it", "Writing the
  report", "Adding figures").
- `report` carries the final `PaperReport`. On receipt the client writes it to the existing cache and
  runs the scramble reveal.
- `error` → client falls back to the one-shot JSON request (see Client fallback).

### Opt-in (keeps the old JSON path intact)

The route streams **only** when the request opts in via header `Accept: application/x-ndjson` (or body
`{ stream: true }`). Otherwise it behaves exactly as today (returns `NextResponse.json(...)`). This
preserves every existing caller and gives the client a clean fallback.

---

## Files

Create:
- `web/src/components/ui/progress-bar.tsx` — floating, site-styled determinate progress bar.
- `web/src/components/scramble-text.tsx` — decode/scramble text reveal (per-line, once, reduced-motion aware).
- `web/src/lib/papers/report-stream.ts` — client helper: POST + read NDJSON → async iterator of events.

Modify:
- `web/src/app/api/papers/report/route.ts` — add the streaming branch (mode → stages → report).
- `web/src/app/papers/[id]/page.tsx` — consume the stream; drive progress + scramble; enforce the
  AI-on/off rule; keep cache + JSON fallback.

Phase 2/3 (after Phase 1 is reviewed): `web/src/components/digest/daily-digest.tsx`,
`web/src/app/page.tsx`, `web/src/store/feed.ts`.

---

## Phase 1 — Paper report page (do this first, get it reviewed)

### 1a. Route: `web/src/app/api/papers/report/route.ts`

Current deep flow (keep it as the non-streaming path): parse body → `resolveProvider` → `getFullText` →
paywalled/failed ⇒ shallow → else `Promise.all([generateDeepReport, getFigurePool])` →
`bindFiguresToReport` → `NextResponse.json(bound)`. `maxDuration = 180`.

Add a streaming branch at the top of `POST`:

```ts
const wantsStream =
  req.headers.get("accept")?.includes("application/x-ndjson") === true;
if (wantsStream) return streamReport(body);   // body already parsed
// ...existing JSON behavior unchanged below...
```

`streamReport(body)` returns `new Response(readable, { headers })` where `readable` is a
`ReadableStream`. Inside `start(controller)`:

```ts
const enc = new TextEncoder();
const send = (e: ReportStreamEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
```

Sequence (reuse the EXISTING functions/awaits — do not add model calls):
1. Resolve provider. Determine `aiMode`: no provider ⇒ `tier0`; deep requested + provider ⇒ `tier2`;
   provider but shallow ⇒ `tier1`. `send({type:"mode", aiMode})`.
2. If `tier0`: `send({type:"stage", stage:"done", pct:100})`; close. (Client renders local fallback.)
   Optionally also send a `report` built from `buildFallbackPaperReport` — but the client already has
   it, so closing is enough.
3. Else: `send({stage:"source", pct:10})` → `await getFullText(...)`. On paywalled/failed, generate the
   shallow report and `send({type:"report", report})`; close.
4. `send({stage:"reading", pct:35})`. Kick off `getFigurePool(...).catch(()=>null)` concurrently.
5. `send({stage:"writing", pct:75})` → `await generateDeepReport(...)`. If null ⇒ shallow fallback ⇒
   `report` ⇒ close.
6. `send({stage:"figures", pct:92})` → `await` the figure pool promise → `await bindFiguresToReport(...)`.
7. `send({type:"report", report: bound})` → `send({stage:"done", pct:100})` → `controller.close()`.
8. Wrap in try/catch → `send({type:"error", message})` then close. Never throw out of `start`.

Headers: `{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-store, no-transform"}`.
Keep `export const maxDuration = 180` and `export const dynamic = "force-dynamic"`.

Note: `generateDeepReport` internally does pass 1 + pass 2 in one await. Coarse stages around the
existing awaits are sufficient — do NOT refactor deep-report.ts to emit sub-stages in this phase (a
later stretch goal may thread a progress callback; out of scope now).

### 1b. Client stream reader: `web/src/lib/papers/report-stream.ts`

```ts
export async function* streamPaperReport(
  requestBody: unknown,
  signal: AbortSignal,
): AsyncGenerator<ReportStreamEvent> {
  const res = await fetch("/api/papers/report", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(requestBody),
    cache: "no-store",
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`report stream HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as ReportStreamEvent;
    }
  }
  const tail = buf.trim();
  if (tail) yield JSON.parse(tail) as ReportStreamEvent;
}
```

Export the `ReportStreamEvent`/`StageId` types from here (or a shared types module) and import them in
the route so both sides share one definition.

### 1c. Report page: `web/src/app/papers/[id]/page.tsx`

Relevant existing symbols (do not rename gratuitously): `reportResult`/`setReportResult`,
`cachedReport`, `fallbackReport` (= `buildFallbackPaperReport(paper, contextHint)`), `hasFetchedReport`,
`reportDone`, `report`, `reportLoading`, `reportKey`, `deepReportRequested`,
`readCachedPaperReport`/`writeCachedPaperReport`, and the `useEffect` (~line 637) that POSTs to
`/api/papers/report`.

Replace the fetch effect with a streaming version:
- Guard unchanged: `if (!paper || cachedReport || reportResult.key === reportKey) return;`
- Create `AbortController`; on cleanup `abort()`.
- Add state: `const [buildup, setBuildup] = useState<{stage: StageId; label: string; pct: number} | null>(null)`
  and `const [aiMode, setAiMode] = useState<"tier0"|"tier1"|"tier2"|null>(null)`.
- Iterate `streamPaperReport(requestBody, controller.signal)`:
  - `mode`: setAiMode. If `tier0` → `setReportResult({key, report: null, done:true})` (so the existing
    logic renders the local `fallbackReport` instantly) and return.
  - `stage`: `setBuildup({stage, label, pct})`.
  - `report`: `writeCachedPaperReport(reportKey, ev.report)`;
    `setReportResult({key: reportKey, report: ev.report, done:true})`; trigger scramble reveal.
  - `error`: fall back — `await` a plain JSON POST (existing shape, no `Accept` header) and set the
    result from it. If that also fails, `setReportResult({key, report:null, done:true})` (renders fallback).
- Keep `writeCachedPaperReport` + `setReportResult` semantics so `report`/`reportLoading`/cache all keep working.

Gate the UI (the rule):
- Compute `const showBuildup = aiMode !== "tier0" && reportLoading && buildup !== null;`
- When `showBuildup`, render the progress bar + the report sections wrapped so their text runs through
  `<ScrambleText>` as it arrives. While `reportLoading` and NOT tier0, do **not** render the old
  skeletons that imply "basic report" — render the build-up instead. (Skeletons may remain only as the
  pre-first-event placeholder, i.e. `reportLoading && buildup === null`.)
- When `aiMode === "tier0"`, `report` resolves to `fallbackReport` immediately (existing code path) —
  render it directly, no scramble, no bar.

### 1d. Progress bar: `web/src/components/ui/progress-bar.tsx`

- Fixed/floating, e.g. `className="fixed top-0 left-0 right-0 z-[60]"` (or a centered pill near the top
  of the content column — match the app's feel). Track = `bg-bg-secondary`; fill = `bg-accent`;
  `rounded-full`; width via inline `style={{ width: \`${pct}%\` }}` with
  `transition-[width] duration-300 ease-snap`. Optional label uses `text-text-muted text-meta`.
- ARIA: `role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}`.
- Design tokens live in `globals.css` `@theme` (`--color-accent`, etc.) and the `ease-snap` utility
  (line ~217). Confirm exact class names there; do not hard-code hex colors.
- Under `prefers-reduced-motion`, keep the bar but drop the width transition (jump instantly).

### 1e. Scramble reveal: `web/src/components/scramble-text.tsx`

- Props: `{ text: string; className?: string }`. Renders a `<span>`; on mount (and when `text` changes
  to a new final value) animates each character cycling through a random glyph set
  (`ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|=+*·`) then locking to the target char, left-to-right,
  finishing within ~400–700ms per line regardless of length (scale step rate to length).
- **Each target reveals once.** Do not loop. Once settled, it's static text.
- Use `requestAnimationFrame`; clean up on unmount.
- **Reduced motion:** if `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, render `text`
  directly with no animation.
- Keep it cheap: only animate visible report section text as it arrives (headline/summary/section
  bodies), not every tiny label. Do not continuously scramble already-settled text.

Apply `<ScrambleText>` to the report's section summaries/bodies in the page when `showBuildup` (or when a
section's text first arrives). Static chrome (titles, icons) does not scramble.

### Phase 1 verification

- `cd web && npm run dev`; open a paper detail page for a paper with the site provider on (Vertex) so a
  real report generates. Watch: bar fills through source→reading→writing→figures; sections decode in;
  final text locks; no basic-report flash.
- Toggle an OS "reduce motion" setting (or force the media query) → verify instant text, no scramble.
- Simulate a stream error (temporarily throw in the route) → verify the client falls back to JSON and
  still shows a correct report.
- Confirm server logs show the SAME number of model calls as before (cost-neutral) — check `[llm]` lines.
- Screenshots: mid-build (bar + partially-decoded) and final.

---

## Phase 2 — Home feed (after Phase 1 review)

- `daily-digest.tsx`: the digest already fetches once and caches. Add the same progress bar while the
  digest is generating and run the bullets through `<ScrambleText>` as they render. Do NOT change the
  digest request/caching (Tier 0–2 already optimized it) — this is presentation only.
- Papers grid: when the feed is loading, show the site-styled bar; decode paper card titles/summaries in
  as they arrive. Cost-neutral, presentation only.

## Phase 3 — Lane separation (after Phase 2)

- In `store/feed.ts` / `page.tsx`: commit papers, events, and jobs independently instead of one
  `Promise.all` barrier, so papers render as soon as they're ready and the digest can start on papers
  without waiting for jobs/events. This is a logic change to the feed loader — small but core; add/keep
  tests for "papers render before jobs/events resolve". Do not advance recently-shown history on a plain
  open (this ties into Tier 2 caching correctness).

---

## Commands

```bash
cd "C:\I\Personal\Github - start up project\Peer\web"
```
```bash
npm run dev
```
```bash
node_modules/.bin/tsc --noEmit -p tsconfig.json
```
```bash
npm test
```
```bash
npm run lint
```

(Lint currently has ONE pre-existing unrelated error in `persona/quiz.tsx`; do not "fix" it as part of
this work — leave it. Any NEW lint error you introduce must be resolved.)

---

## Acceptance checklist (the reviewer will check each)

- [ ] AI on: no basic-report flash; build-up (bar + scramble) shows until the real report locks in.
- [ ] AI off (tier0): deterministic basic report appears instantly; no bar, no scramble.
- [ ] Cached report: instant, no fetch, no build-up (unchanged).
- [ ] Progress bar is determinate, monotonic, site-styled (uses `--color-accent`/`ease-snap`, no hard-coded hex), ARIA-correct.
- [ ] Scramble reveals each line once, finishes quickly, never loops, never re-scrambles settled text.
- [ ] `prefers-reduced-motion`: no scramble, no bar animation; text direct.
- [ ] Stream error → clean fallback to the one-shot JSON path → correct report still renders.
- [ ] Cost-neutral: `[llm]` logs show identical model-call count/prompts vs. before; no provider files changed.
- [ ] Old JSON endpoint behavior unchanged for non-streaming callers.
- [ ] `tsc --noEmit` clean; `npm test` green; no NEW lint errors; local-saver files untouched/unstaged.
- [ ] Screenshots attached (mid-build + final) and a reduced-motion check noted.
