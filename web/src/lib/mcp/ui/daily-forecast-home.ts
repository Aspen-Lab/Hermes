/**
 * Fullscreen Daily Forecast home -- the `open_home` tool's widget.
 *
 * Same static-template + postMessage-bridge architecture as
 * `daily-forecast-card.ts` (see that file's own architecture note): a
 * `ui://` resource is fetched once by the host and cached ("treat the
 * resource URI as a cache key" -- developers.openai.com/apps-sdk/build/
 * custom-ux), never re-rendered per tool call. Per-call data reaches the
 * widget over the same `ui/notifications/tool-result` postMessage bridge.
 *
 * This item (3-01) is the container + registration only -- content (top
 * bar, date header, filter chips, card grid, per-card actions row, Peer
 * visual identity) is items 3-04/3-05/3-07/3-08/3-09/3-10/3-11/3-12, added
 * in the very next commit. An empty/loading-state shell here is fine
 * transiently -- the same allowance M1's own build order used for its
 * endpoint (docs/handoff/MULTIAGENT-mcp-app.md §4 "Round 3 -- Agent B").
 */
const HOME_STYLE = `
.p-full{font-family:"Iowan Old Style",Georgia,serif;background:#FDF6EE;color:#2B180A;}
.pf-body{padding:14px;}
`.trim();

/**
 * Client-side widget script. Runs inside the host's sandboxed iframe.
 * Mirrors WIDGET_SCRIPT's own "listen FIRST" comment in daily-forecast-card.ts
 * -- the message listener must be registered before anything else so an
 * early notification is never missed.
 */
const HOME_WIDGET_SCRIPT = `
(function () {
  function render(result) {
    var body = document.getElementById("pf-body-slot");
    if (!body) return;
    // Filled out in the next commit (3-04/3-05/3-07/3-08/3-09/3-10/3-11/3-12).
    body.innerHTML = result ? "Loading…" : "Loading…";
  }

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
})();
`.trim();

/**
 * The fullscreen home's static template. Zero arguments, byte-static --
 * the exact discipline `buildDailyForecastWidgetHtml` already enforces (the
 * regression test for the static-template architecture bug C found and
 * fixed once in M1 -- don't reintroduce it here).
 */
export function buildDailyForecastHomeWidgetHtml(): string {
  return (
    `<style>${HOME_STYLE}</style>` +
    `<div class="p-full"><div class="pf-body" id="pf-body-slot">Loading…</div></div>` +
    `<script>${HOME_WIDGET_SCRIPT}</script>`
  );
}

/** Exposed for daily-forecast-home.test.ts to execute HOME_WIDGET_SCRIPT via Node's `vm` module. */
export function __getHomeWidgetScriptForTest(): string {
  return HOME_WIDGET_SCRIPT;
}
