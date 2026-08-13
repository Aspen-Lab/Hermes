import { describe, expect, it } from "vitest";
import {
  __getHomeWidgetScriptForTest,
  buildDailyForecastHomeWidgetHtml,
} from "./daily-forecast-home";

// Mirrors daily-forecast-card.test.ts's own static-template checks for the
// same architecture (docs/handoff/MULTIAGENT-mcp-app.md §4 "Round 3 --
// Agent B", item 3-01). Content-specific assertions (palette, chips, grid,
// actions row, top bar) are added in the very next commit's content item
// (3-04/3-05/3-07/3-08/3-09/3-10/3-11/3-12) -- this file only proves the
// skeleton's own architecture is sound so it isn't re-litigated later.
describe("buildDailyForecastHomeWidgetHtml (static template)", () => {
  it("is identical across two calls -- a static template, not baked per-call data", () => {
    expect(buildDailyForecastHomeWidgetHtml()).toBe(buildDailyForecastHomeWidgetHtml());
  });

  it("never mentions Save, Dismiss, or a Peer-drawn close button yet (nothing built here beyond the shell)", () => {
    const html = buildDailyForecastHomeWidgetHtml();
    expect(html.toLowerCase()).not.toContain("save");
    expect(html.toLowerCase()).not.toContain("dismiss");
  });

  it("embeds a widget script that exists and is non-empty", () => {
    expect(__getHomeWidgetScriptForTest().length).toBeGreaterThan(0);
  });
});
