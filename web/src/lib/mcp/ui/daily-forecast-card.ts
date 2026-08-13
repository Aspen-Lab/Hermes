import { formatDate, formatDayAge, formatMatchPct } from "@/lib/format";
import type { ForecastItemType, DailyForecastResult } from "../types";

const TYPE_LABELS: Record<ForecastItemType, string> = {
  job: "Job",
  paper: "Paper",
  event: "Event",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Peer web app origin for the card's "Open in Peer" footer link — the one
 * link in the card that isn't item data (RULING 4's last bullet). Mirrors
 * `web/src/app/api/jobs/dispatch-digests/route.ts`'s `originUrlFor`, but
 * only its env-var-first branch: that function's request-header fallback
 * needs a `NextRequest`, which isn't available this deep inside the MCP
 * SDK's own resource/tool callbacks. `NEXT_PUBLIC_SITE_URL` is expected to
 * be set in any real deployment; the hardcoded fallback below is the same
 * one `originUrlFor` itself falls back to. Safe to bake in once here (unlike
 * forecast data): the site origin is a deployment constant, not per-call
 * data, so it doesn't run into the same-template-every-call problem below.
 */
export function peerWebOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://hermes-flax-six.vercel.app";
}

/**
 * "org · location · posted 5d ago · deadline Aug 21" — only the parts a
 * given item actually has. Per-type absent fields (no location/deadline
 * for papers, a job with no reported deadline, …) simply produce a shorter
 * line — never a placeholder dash for the missing piece (RULING 4). Used
 * by the server-side text fallback only — the card's own equivalent runs
 * client-side, see WIDGET_SCRIPT below.
 */
function metaParts(item: {
  org?: string;
  location?: string;
  posted?: string;
  deadline?: string;
}): string[] {
  const parts: string[] = [];
  if (item.org) parts.push(item.org);
  if (item.location) parts.push(item.location);
  const postedAge = item.posted ? formatDayAge(item.posted) : null;
  if (postedAge) parts.push(`posted ${postedAge}`);
  const deadlineDate = item.deadline ? formatDate(item.deadline, "short") : null;
  if (deadlineDate) parts.push(`deadline ${deadlineDate}`);
  return parts;
}

// Fixed warm palette, literal hex values — the widget renders in a
// sandboxed host iframe with no access to Peer's own stylesheet, so CSS
// custom properties (web/src/app/globals.css) aren't reachable here.
// Reused verbatim from docs/design/peer-in-chatgpt-mcp-mockups.html lines
// 195-267 (.peer-card/.pc-head/.p-row/.rel/.ptag/.pc-foot/.p-mark) --
// `.psave` is deliberately not carried over (RULING 7 -- Save stays M5
// scope on the inline card). `.pc-head .expand` WAS also excluded here but
// is wired up as of M2 (3-03): RULING 7 draws Save's and Expand's
// exclusions as two separate, independently-timed things, and the
// fullscreen home this now opens (open_home) exists as of this same
// round -- don't read this comment as implying both lift together.
const CARD_STYLE = `
.peer-card{border:1px solid #ECECEC;border-radius:16px;overflow:hidden;margin-bottom:14px;background:#FFFDF9;max-width:560px;}
.pc-head{background:#FDF6EE;padding:11px 14px;display:flex;align-items:center;gap:9px;border-bottom:1px solid rgba(62,36,7,0.07);}
.p-mark{width:19px;height:19px;border-radius:5px;background:#FDF6EE;border:1px solid #EAD9C4;color:#FF520D;font-family:"Iowan Old Style",Georgia,serif;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;flex:none;line-height:1;}
.pc-head .t{font-family:"Iowan Old Style",Georgia,serif;font-weight:600;font-size:14.5px;color:#2B180A;}
.pc-head .m{font-size:11.5px;color:#94877C;margin-left:auto;}
.pc-head .expand{font-size:11.5px;color:#6B6156;border:1px solid rgba(62,36,7,0.12);border-radius:6px;padding:2px 8px;background:#FFFDF9;cursor:default;}
.p-row{padding:11px 14px;display:flex;gap:12px;align-items:flex-start;border-bottom:1px solid rgba(62,36,7,0.06);}
.p-row:last-of-type{border-bottom:0;}
.rel{font-family:"Iowan Old Style",Georgia,serif;font-weight:700;font-size:13px;color:#237A4B;background:rgba(35,122,75,0.09);border-radius:8px;padding:3px 7px;flex:none;line-height:1.3;}
.p-row .body{min-width:0;flex:1;}
.p-row .ti{font-family:"Iowan Old Style",Georgia,serif;font-size:14.5px;font-weight:600;color:#2B180A;line-height:1.35;}
.p-row .me{font-size:12px;color:#6B6156;margin-top:1px;}
.p-row .why{font-size:12px;color:#A8642A;margin-top:3px;}
.p-row .why b{font-weight:600;}
.ptag{display:inline-block;font-size:10.5px;font-weight:600;color:#A8642A;background:rgba(168,100,42,0.10);border-radius:5px;padding:1.5px 7px;margin-right:5px;vertical-align:1px;}
.pc-foot{padding:9px 14px;display:flex;align-items:center;gap:10px;background:#FDF6EE;border-top:1px solid rgba(62,36,7,0.07);font-size:12px;color:#6B6156;}
.pc-foot .open{color:#FF520D;font-weight:600;text-decoration:none;}
.pc-foot .attr{margin-left:auto;font-size:11px;color:#94877C;}
`.trim();

/**
 * Client-side widget script. Runs inside the host's sandboxed iframe.
 *
 * ARCHITECTURE NOTE (corrects B's guide, verified against
 * developers.openai.com/apps-sdk/build/custom-ux, "decoupled" pattern,
 * fetched this round — not in B's earlier framework-facts research): a
 * `ui://` resource is a **static template, fetched once and cached** ("treat
 * the resource URI as a cache key" — the docs' own words). It is NOT
 * re-rendered per tool call. Per-call data reaches the widget over a
 * postMessage JSON-RPC bridge as a `ui/notifications/tool-result`
 * notification carrying `structuredContent` — the exact object
 * get_daily_forecast's tool handler returns. B's design (a resource
 * callback that bakes one specific forecast's HTML into the resource's
 * `text` on every read) doesn't fit this: under `mcp-handler`'s stateless,
 * fresh-server-per-request model a `resources/read` call wouldn't even
 * share a server instance with the `tools/call` that preceded it, so
 * nothing could have been baked in anyway. Rebuilt as a real static
 * template + listener instead of patched, since this is a protocol fact,
 * not a scope judgment call.
 *
 * Duplicates a small amount of rendering logic against `metaParts` above
 * (day-age/short-date formatting, `escapeHtml`, the org/location/posted/
 * deadline line, RULING 4's per-type omission) because there is no client
 * bundle step for MCP widget assets in this repo to import a shared TS
 * module through — this is a plain inline `<script>`, evaluated as-is by
 * the host's iframe. Keep the two in sync by hand; `daily-forecast-card.test.ts`
 * exercises this exact script text (via Node's `vm` module) against
 * RULING-4 fixtures so drift fails the gate, not just a visual check.
 */
const WIDGET_SCRIPT = `
(function () {
  var TYPE_LABELS = { job: "Job", paper: "Paper", event: "Event" };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDayAge(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays < 1) return "Today";
    if (diffDays < 2) return "Yesterday";
    if (diffDays < 14) return diffDays + "d ago";
    if (diffDays < 60) return Math.floor(diffDays / 7) + "w ago";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  function formatShortDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatMatchPct(score) {
    if (score === null || score === undefined) return null;
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
  }

  // Mirrors metaParts() in daily-forecast-card.ts -- keep in sync by hand
  // (see the module-level comment above WIDGET_SCRIPT).
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

  function renderRow(item) {
    var pct = formatMatchPct(item.relevance);
    var relBadge = pct === null ? "" : '<span class="rel">' + pct + '%</span>';
    var meta = metaParts(item).join(" · ");
    var meLine = meta ? '<div class="me">' + escapeHtml(meta) + "</div>" : "";
    var whyText = item.whyItMatters
      ? "<b>Matches:</b> " + escapeHtml(item.whyItMatters) + " "
      : "";
    var tag = '<span class="ptag">' + (TYPE_LABELS[item.type] || "") + "</span>";
    return (
      '<div class="p-row">' + relBadge + '<div class="body">' +
      '<div class="ti">' + escapeHtml(item.title || "") + "</div>" +
      meLine +
      '<div class="why">' + whyText + tag + "</div>" +
      "</div></div>"
    );
  }

  // Returns only the ".m" meta text -- mark/title/Expand are static,
  // persistent siblings in the markup (see buildDailyForecastWidgetHtml),
  // never replaced by a render() call, so Expand's own click listener
  // (wired once, see wireExpand below) stays attached to a live DOM node
  // across every re-render.
  function renderHeader(result) {
    var d = result.date ? new Date(result.date) : null;
    var weekday = d && !isNaN(d.getTime())
      ? new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d)
      : "";
    var dateLabel = formatShortDate(result.date) || result.date || "";
    var headerDate = weekday ? weekday + " · " + dateLabel : dateLabel;
    var counts = result.counts || { shown: 0, total: 0 };
    return escapeHtml(headerDate) + " · " + counts.shown + "/" + counts.total;
  }

  function render(result) {
    var head = document.getElementById("pc-head-slot");
    var rows = document.getElementById("rows-slot");
    if (!head || !rows) return;
    head.innerHTML = renderHeader(result || {});
    var items = (result && result.items) || [];
    rows.innerHTML = items.length > 0
      ? items.map(renderRow).join("")
      : '<div class="p-row"><div class="body"><div class="me">No forecast items today.</div></div></div>';
  }

  function wireExpand() {
    var btn = document.getElementById("pc-expand-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (window.openai && typeof window.openai.callTool === "function") {
        window.openai.callTool("open_home", {});
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

  wireExpand();
})();
`.trim();

/**
 * The inline Apps-SDK card's static template (screen-2 mockup): header
 * (mark, "Daily Forecast", date + shown/total, Expand -- wired as of M2,
 * 3-03, closing RULING 7's Expand exclusion), one row per item (relevance
 * badge, title, org/location/posted/deadline meta, why-it-matters, type
 * tag — no Save button, RULING 7 still excludes Save on this surface),
 * footer ("Open in Peer" + attribution, baked in once since the site
 * origin is a deployment constant). Registered once as a `ui://` resource
 * and reused for every call — see the WIDGET_SCRIPT comment for why.
 */
export function buildDailyForecastWidgetHtml(): string {
  const origin = escapeHtml(peerWebOrigin());
  return (
    `<style>${CARD_STYLE}</style>` +
    `<div class="peer-card">` +
    `<div class="pc-head"><span class="p-mark">P</span><span class="t">Daily Forecast</span>` +
    `<span class="m" id="pc-head-slot">Loading…</span>` +
    `<span class="expand" id="pc-expand-btn">Expand</span></div>` +
    `<div id="rows-slot"><div class="p-row"><div class="body"><div class="me">Loading…</div></div></div></div>` +
    `<div class="pc-foot"><a class="open" href="${origin}" target="_blank" rel="noopener noreferrer">Open in Peer ↗</a>` +
    `<span class="attr">Peer app · data from your Peer account</span></div>` +
    `</div>` +
    `<script>${WIDGET_SCRIPT}</script>`
  );
}

/** Exposed for daily-forecast-card.test.ts to execute WIDGET_SCRIPT via Node's `vm` module. */
export function __getWidgetScriptForTest(): string {
  return WIDGET_SCRIPT;
}

/**
 * Plain-text fallback for hosts that can't render `ui://` resources (e.g. a
 * Claude connector in text mode) — this is the `content` array on the
 * tool's `CallToolResult`, not a separate "detect the host" code path. This
 * one genuinely is per-call server-rendered data (it's part of the tool's
 * own response, not a separately-fetched resource), so no bridge is needed.
 */
export function renderDailyForecastText(result: DailyForecastResult): string {
  if (result.items.length === 0) {
    return `Peer Daily Forecast — ${result.date}: no items today.`;
  }
  const lines = result.items.map((item) => {
    const pct = formatMatchPct(item.relevance);
    const relPart = pct === null ? "" : `${pct}% — `;
    const meta = metaParts(item).join(" · ");
    const metaPart = meta ? ` (${meta})` : "";
    const linkPart = item.deepLink ? ` — ${item.deepLink}` : "";
    return `- ${relPart}[${TYPE_LABELS[item.type]}] ${item.title}${metaPart}${linkPart}`;
  });
  return [
    `Peer Daily Forecast — ${result.date} (${result.counts.shown}/${result.counts.total})`,
    ...lines,
    `Open in Peer: ${peerWebOrigin()}`,
  ].join("\n");
}
