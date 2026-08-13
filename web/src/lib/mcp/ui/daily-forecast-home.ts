import { peerWebOrigin } from "./daily-forecast-card";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fixed warm palette, literal hex values -- same discipline and reason as
 * the card (sandboxed iframe, no access to globals.css). Ported from
 * docs/design/peer-in-chatgpt-mcp-mockups.html lines 269-306
 * (.p-full/.pf-bar/.pf-h/.pf-sub/.fchips/.fchip/.pf-grid/.pf-card), plus
 * .p-mark (shared with the card, duplicated here since this is a separate
 * resource/document -- no shared stylesheet reaches a sandboxed iframe).
 * Two deliberate omissions from the mockup's own CSS, both host-chrome, not
 * Peer's to draw: `.pf-bar .x` (a Peer-drawn close button -- ChatGPT's
 * fullscreen mode already gets a documented "System close") and
 * `.pf-composer` (ChatGPT's own native composer). One deliberate addition
 * the mockup doesn't need (it's a static image, not a live layout): a
 * narrow-width fallback so the same template still reads sanely if
 * fullscreen promotion is never honored by a host.
 */
const HOME_STYLE = `
.p-full{background:#FDF6EE;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
.p-mark{width:19px;height:19px;border-radius:5px;background:#FDF6EE;border:1px solid #EAD9C4;color:#FF520D;font-family:"Iowan Old Style",Georgia,serif;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;flex:none;line-height:1;}
.pf-bar{height:48px;background:#FDF6EE;border-bottom:1px solid rgba(62,36,7,0.09);display:flex;align-items:center;gap:10px;padding:0 16px;flex:none;}
.pf-bar .t{font-family:"Iowan Old Style",Georgia,serif;font-weight:600;font-size:14.5px;color:#2B180A;}
.pf-bar .sep{color:#C9BCA9;}
.pf-bar .view{font-size:13px;color:#6B6156;}
.pf-bar .open{margin-left:auto;font-size:12px;color:#FF520D;font-weight:600;text-decoration:none;}
.pf-body{flex:1;overflow-y:auto;padding:20px 26px;}
.pf-h{font-family:"Iowan Old Style",Georgia,serif;font-size:23px;color:#2B180A;margin:0;font-weight:500;}
.pf-sub{font-size:12.5px;color:#94877C;margin:3px 0 14px;}
.pf-sub b{font-weight:600;color:#6B6156;}
.fchips{display:flex;gap:7px;margin-bottom:16px;flex-wrap:wrap;}
.fchip{font-size:12px;color:#6B6156;border:1px solid rgba(62,36,7,0.10);border-radius:999px;padding:4px 13px;background:transparent;cursor:default;}
.fchip.on{background:#2B180A;color:#FDF6EE;border-color:#2B180A;font-weight:500;}
.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media (max-width:620px){.pf-grid{grid-template-columns:1fr;}}
.pf-card{background:#F1E9DA;border-radius:14px;padding:13px 15px;box-shadow:0 1px 2px rgba(43,24,10,0.04);}
.pf-card .row1{display:flex;align-items:baseline;gap:8px;}
.pf-card .rel{font-family:"Iowan Old Style",Georgia,serif;font-weight:700;font-size:13px;color:#237A4B;background:rgba(35,122,75,0.09);border-radius:8px;padding:3px 7px;flex:none;line-height:1.3;}
.pf-card .ti{font-family:"Iowan Old Style",Georgia,serif;font-size:15px;font-weight:600;color:#2B180A;line-height:1.3;}
.pf-card .ti a{color:inherit;text-decoration:none;}
.pf-card .me{font-size:11.5px;color:#6B6156;margin-top:2px;}
.pf-card .why{font-size:11.5px;color:#A8642A;margin-top:6px;}
.pf-card .why b{font-weight:600;}
.pf-card .acts{display:flex;gap:6px;margin-top:9px;}
.pf-card .acts .acts-btn{font-size:11px;border:1px solid rgba(62,36,7,0.10);border-radius:6px;padding:2.5px 9px;color:#8C7A68;background:rgba(253,246,238,0.4);cursor:default;}
`.trim();

/**
 * Client-side widget script. Runs inside the host's sandboxed iframe.
 *
 * Duplicates a small amount of rendering logic against WIDGET_SCRIPT in
 * daily-forecast-card.ts (escapeHtml, formatDayAge/formatShortDate/
 * formatMatchPct, metaParts) for the same reason that file's own comment
 * gives: no client bundle step exists for MCP widget assets to share a
 * module through.
 *
 * Filter-chip counts (design tension (a), docs/handoff/MULTIAGENT-mcp-app.md
 * §4 "Round 3 -- Agent B"): chip *labels* always render from the latest
 * UNFILTERED call's counts, cached client-side in `latestCounts` -- a
 * filtered call's own response legitimately zeroes out the other lanes'
 * counts (that lane didn't run), and re-rendering from it verbatim would
 * make the other three chips flicker to "· 0". The header sub-line, not the
 * chips, reflects the *currently active* selection's own shown/total
 * (RULING 8 semantics, no redefinition).
 *
 * Chip clicks call `window.openai.callTool("open_home", ...)` -- the same
 * tool whose template is already mounted -- and are expected to reach the
 * same `ui/notifications/tool-result` message listener already wired for
 * the initial mount, reusing one proven data path for every update. NEEDS
 * LOCAL VERIFY (named in the state file): whether a widget-initiated
 * callTool result actually arrives there on a real host, or only via the
 * call's own promise. `render()` is written as a plain function of a
 * result object either way, so wiring a second call site later is a
 * same-file follow-up, not a redesign.
 */
const HOME_WIDGET_SCRIPT = `
(function () {
  var CHIP_DEFS = [
    { type: "", label: "All" },
    { type: "paper", label: "Papers" },
    { type: "event", label: "Events" },
    { type: "job", label: "Jobs" },
  ];

  var latestCounts = null; // unfiltered counts, cached across chip clicks
  var activeType = null;   // null = "All"

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // A date-only string ("2026-08-13") names a calendar day, not an instant.
  // new Date("2026-08-13") parses it as UTC midnight, which displays as the
  // PREVIOUS day for every viewer west of UTC -- construct date-only values
  // as local calendar dates instead. Full timestamps keep instant semantics.
  function parseDate(iso) {
    if (!iso) return null;
    // No regex here: this code lives inside a TS template literal, where a
    // cooked "\d" silently becomes "d" and the pattern never matches.
    var dateOnly = iso.length === 10 && iso.charAt(4) === "-" && iso.charAt(7) === "-";
    var d = dateOnly
      ? new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
      : new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDayAge(iso) {
    var d = parseDate(iso);
    if (!d) return null;
    var diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays < 1) return "Today";
    if (diffDays < 2) return "Yesterday";
    if (diffDays < 14) return diffDays + "d ago";
    if (diffDays < 60) return Math.floor(diffDays / 7) + "w ago";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  function formatShortDate(iso) {
    var d = parseDate(iso);
    if (!d) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatMatchPct(score) {
    if (score === null || score === undefined) return null;
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  }

  // Mirrors metaParts() in daily-forecast-card.ts -- keep in sync by hand.
  function metaParts(item) {
    var parts = [];
    if (item.org) parts.push(item.org);
    if (item.location) parts.push(item.location);
    var postedAge = item.posted ? formatDayAge(item.posted) : null;
    if (postedAge) parts.push("posted " + postedAge);
    var deadlineDate = item.deadline ? formatShortDate(item.deadline) : null;
    if (deadlineDate) parts.push("deadline " + deadlineDate);
    return parts;
  }

  // RULING 10: Save/Dismiss/Report -> all disabled-visible, uniformly.
  // Rendered by string concatenation only -- never getElementById'd, never
  // passed to addEventListener -- that omission is the actual enforcement
  // of "no pointer action, no fake affordance on hover" (there is no
  // :hover rule for .acts-btn anywhere in HOME_STYLE either).
  function renderActs() {
    return '<div class="acts">' +
      '<span class="acts-btn" role="button" aria-disabled="true">Save</span>' +
      '<span class="acts-btn" role="button" aria-disabled="true">Dismiss</span>' +
      '<span class="acts-btn" role="button" aria-disabled="true">Report →</span>' +
      "</div>";
  }

  // Per-card title links to the item's own external source (item.deepLink)
  // when present -- never Peer web's own /jobs/[id] or /events/[id], which
  // resolve purely from client-side store state with no fetch-by-id
  // fallback and would 404/empty on a cold external click (verified this
  // round, see the state file's "Checking A's claims").
  function renderCard(item) {
    var pct = formatMatchPct(item.relevance);
    var relBadge = pct === null ? "" : '<span class="rel">' + pct + "%</span>";
    var titleText = escapeHtml(item.title || "");
    var titleInner = item.deepLink
      ? '<a href="' + escapeHtml(item.deepLink) + '" target="_blank" rel="noopener noreferrer">' + titleText + "</a>"
      : titleText;
    var meta = metaParts(item).join(" · ");
    var meLine = meta ? '<div class="me">' + escapeHtml(meta) + "</div>" : "";
    var whyLine = item.whyItMatters
      ? '<div class="why"><b>Why:</b> ' + escapeHtml(item.whyItMatters) + "</div>"
      : "";
    return (
      '<div class="pf-card"><div class="row1">' + relBadge +
      '<span class="ti">' + titleInner + "</span></div>" +
      meLine + whyLine + renderActs() +
      "</div>"
    );
  }

  function chipCount(counts, type) {
    if (!counts) return 0;
    if (type === "") return counts.total || 0;
    if (type === "job") return counts.jobs || 0;
    if (type === "paper") return counts.papers || 0;
    if (type === "event") return counts.events || 0;
    return 0;
  }

  function renderChips() {
    var el = document.getElementById("chips-slot");
    if (!el) return;
    el.innerHTML = CHIP_DEFS.map(function (chip) {
      var count = chipCount(latestCounts, chip.type);
      var on = (activeType || "") === chip.type ? " on" : "";
      return (
        '<span class="fchip' + on + '" data-type="' + chip.type + '">' +
        escapeHtml(chip.label) + " · " + count + "</span>"
      );
    }).join("");
  }

  function typeNoun(type) {
    if (type === "job") return "jobs";
    if (type === "paper") return "papers";
    if (type === "event") return "events";
    return "opportunities";
  }

  function renderHeader(result) {
    var hEl = document.getElementById("pf-h-slot");
    var subEl = document.getElementById("pf-sub-slot");
    if (!hEl || !subEl) return;

    var d = result && result.date ? parseDate(result.date) : null;
    hEl.textContent = d
      ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(d)
      : (result && result.date) || "";

    var counts = (result && result.counts) || { shown: 0, total: 0 };
    var shown = counts.shown || 0;
    var total = counts.total || 0;
    // RULING 8 semantics, no redefinition: total is the pre-slice pool this
    // call considered, shown is the post-slice count actually returned.
    var countPhrase = shown < total
      ? shown + " shown of " + total + " considered today"
      : shown + " " + typeNoun(activeType) + " today";
    var personaPhrase = result && result.personaName
      ? "ranked for <b>" + escapeHtml(result.personaName) + "</b>'s Persona"
      : "ranked for your Persona";
    subEl.innerHTML = escapeHtml(countPhrase) + " · " + personaPhrase;
  }

  function renderGrid(result) {
    var el = document.getElementById("grid-slot");
    if (!el) return;
    var items = (result && result.items) || [];
    el.innerHTML = items.length > 0
      ? items.map(renderCard).join("")
      : '<div class="pf-card"><div class="me">No forecast items today.</div></div>';
  }

  function render(result) {
    if (result && result.counts && (!activeType || latestCounts === null)) {
      // Refresh the cache whenever this result IS the unfiltered one, or
      // (defensively) when nothing has been cached yet at all.
      latestCounts = result.counts;
    }
    renderChips();
    renderHeader(result);
    renderGrid(result);
  }

  function wireChips() {
    var chipsEl = document.getElementById("chips-slot");
    if (!chipsEl) return;
    // Event delegation on the stable container, attached once -- not
    // re-bound after every innerHTML replace.
    chipsEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.getAttribute) return;
      var type = target.getAttribute("data-type");
      if (type === null) return; // clicked the container, not a chip
      activeType = type || null;
      renderChips(); // optimistic: show the new "on" state immediately
      if (window.openai && typeof window.openai.callTool === "function") {
        window.openai.callTool("open_home", type ? { type: type } : {});
      }
    });
  }

  // MCP Apps postMessage bridge: the host delivers this tool's latest
  // result as a ui/notifications/tool-result JSON-RPC notification. Listen
  // FIRST, before anything else, so an early notification is never missed.
  window.addEventListener(
    "message",
    function (event) {
      if (event.source !== window.parent) return;
      var message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.method === "ui/notifications/tool-result") {
        render(message.params && message.params.structuredContent);
      }
    },
    { passive: true },
  );

  wireChips();

  // No _meta field lets a tool declare "opens directly in fullscreen" --
  // every app initially appears inline. This widget's own script always
  // requests promotion unconditionally on mount; the card's widget script
  // must never do this (promoting a card the user only asked a quick
  // question with would defeat the point of a compact view).
  if (window.openai && typeof window.openai.requestDisplayMode === "function") {
    window.openai.requestDisplayMode({ mode: "fullscreen" });
  }
})();
`.trim();

/**
 * The fullscreen home's static template (screen-3 mockup): top bar (mark,
 * "Peer · Daily Forecast", Open-in-Peer -- no Peer-drawn close button,
 * ChatGPT's fullscreen mode already provides a documented "System close"),
 * date header + counts sub-line, filter chips (real facets: All/Papers/
 * Events/Jobs), card grid, per-card disabled-visible Save/Dismiss/Report
 * row (RULING 10). Registered once as a `ui://` resource and reused for
 * every call -- see the WIDGET_SCRIPT comment for why.
 */
export function buildDailyForecastHomeWidgetHtml(): string {
  const origin = escapeHtml(peerWebOrigin());
  return (
    `<style>${HOME_STYLE}</style>` +
    `<div class="p-full">` +
    `<div class="pf-bar"><span class="p-mark">P</span><span class="t">Peer</span>` +
    `<span class="sep">·</span><span class="view">Daily Forecast</span>` +
    `<a class="open" href="${origin}" target="_blank" rel="noopener noreferrer">Open in Peer ↗</a></div>` +
    `<div class="pf-body">` +
    `<h3 class="pf-h" id="pf-h-slot">Loading…</h3>` +
    `<div class="pf-sub" id="pf-sub-slot"></div>` +
    `<div class="fchips" id="chips-slot"></div>` +
    `<div class="pf-grid" id="grid-slot"></div>` +
    `</div>` +
    `</div>` +
    `<script>${HOME_WIDGET_SCRIPT}</script>`
  );
}

/** Exposed for daily-forecast-home.test.ts to execute HOME_WIDGET_SCRIPT via Node's `vm` module. */
export function __getHomeWidgetScriptForTest(): string {
  return HOME_WIDGET_SCRIPT;
}
