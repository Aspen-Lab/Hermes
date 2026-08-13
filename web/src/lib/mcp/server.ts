import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDailyForecast } from "./tools/get-daily-forecast";
import { getOpportunity } from "./tools/get-opportunity";
import { openHome } from "./tools/open-home";
import { buildDailyForecastWidgetHtml, renderDailyForecastText } from "./ui/daily-forecast-card";
import { buildDailyForecastHomeWidgetHtml } from "./ui/daily-forecast-home";
import type { ForecastItem } from "./types";

export interface PeerMcpContext {
  /**
   * Supabase `auth.users` id this call acts as. M1: always the dev-slug test
   * user (see `web/src/lib/mcp/dev-auth.ts`, RULING 2). M3 replaces the dev
   * slug with a real OAuth session's user id — nothing in tool bodies should
   * assume "dev slug" specifically, only that `userId` is trustworthy.
   */
  userId: string;
}

const DAILY_FORECAST_CARD_URI = "ui://peer/daily-forecast-card.html";
const DAILY_FORECAST_HOME_URI = "ui://peer/daily-forecast-home.html";

const getDailyForecastInputShape = {
  type: z
    .enum(["job", "paper", "event"])
    .optional()
    .describe(
      "Restrict the forecast to one opportunity type: 'job' for job/" +
        "internship/postdoc postings, 'paper' for research papers, 'event' " +
        "for conferences/workshops/seminars with a submission or " +
        "registration deadline. Omit for a single merged forecast across " +
        "all three, ranked together by relevance — this is what the " +
        "inline Daily Forecast card shows and what most requests want.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe(
      "Maximum number of items to return, highest relevance first. " +
        "Defaults to 9. Raise this only if the user explicitly asks for " +
        "more than the default view.",
    ),
};

const openHomeInputShape = {
  type: z
    .enum(["job", "paper", "event"])
    .optional()
    .describe(
      "Restrict the home view to one opportunity type: 'job', 'paper', or " +
        "'event'. Omit for the merged/'All' view -- what 'open my Peer " +
        "home' means by default.",
    ),
};

const getOpportunityInputShape = {
  id: z
    .string()
    .min(1)
    .describe(
      "The exact `id` field from a get_daily_forecast item (its " +
        "`items[].id`, e.g. \"remotive:12345\" or \"arxiv:2508.00001\") — " +
        "never a title, a guess, or an id from anywhere else. Returns that " +
        "item's full detail in the same per-type shape as a forecast row, " +
        "or `{ found: false, id }` if it no longer resolves to anything " +
        "today (never a partial or invented result).",
    ),
};

// get_opportunity has no inline card of its own in M1 — A's frozen
// criterion 7 / the mockup's screen-2 annotations only ask for a card on
// get_daily_forecast. This plain-text response is get_opportunity's
// permanent M1 shape, not a placeholder awaiting a renderer.
function simpleOpportunitySummary(result: ForecastItem | { found: false; id: string }): string {
  // Plain `in` check, not `"found" in result && result.found === false` --
  // the compound `&&` form defeats TS's narrowing on the fall-through
  // branch below (verified: TS negates the whole `&&` expression rather
  // than eliminating the `{ found: false }` member), even though `found` is
  // a `false`-only literal so the two forms are behaviorally identical.
  if ("found" in result) {
    return `No item found for id "${result.id}".`;
  }
  const link = result.deepLink ? ` — ${result.deepLink}` : "";
  return `[${result.type}] ${result.title}${link}`;
}

/**
 * Registers every Peer MCP tool onto a caller-supplied McpServer instance.
 *
 * `mcp-handler`'s `createMcpHandler` owns McpServer construction; this
 * function is the registration callback it invokes. Call sites build a
 * fresh handler — and therefore a fresh server and a fresh call to this
 * function — per incoming request (see
 * `web/src/app/api/mcp/[slug]/route.ts`). Never a module-level singleton, so
 * `ctx.userId` is always correct for the request currently being served.
 *
 * M1 registers two read-only tools (get_daily_forecast, get_opportunity).
 * Write tools (save/dismiss — M5 scope) get their own `server.registerTool`
 * calls added here later, behind real OAuth (M3+, a different auth path
 * than the dev slug entirely) — nothing to scaffold for them yet.
 */
export function registerPeerTools(server: McpServer, ctx: PeerMcpContext): void {
  // Static template, fetched once by the host and cached ("treat the
  // resource URI as a cache key" — developers.openai.com/apps-sdk/build/
  // custom-ux). Its content never depends on any specific tool call, so a
  // config of `{}` (no mimeType there — mimeType belongs on the returned
  // content item, matching that doc's own registerResource example) and a
  // fixed HTML string are correct. Per-call data reaches the widget over
  // the postMessage bridge (see WIDGET_SCRIPT in daily-forecast-card.ts),
  // not through this callback.
  server.registerResource(
    "daily-forecast-card",
    DAILY_FORECAST_CARD_URI,
    {},
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          // Not plain "text/html" (what B's guide said) -- the Apps SDK's
          // own documented MIME type for a widget resource is
          // "text/html;profile=mcp-app", confirmed against
          // developers.openai.com/apps-sdk/build/custom-ux this round.
          mimeType: "text/html;profile=mcp-app",
          text: buildDailyForecastWidgetHtml(),
        },
      ],
    }),
  );

  // Same static-template shape as the card resource above -- see
  // daily-forecast-home.ts's own architecture note. Registered as a second,
  // separately-addressable resource rather than a display-mode-branching
  // single resource: registerResource's callback only ever receives `uri`,
  // nothing to branch a display mode on (docs/handoff/MULTIAGENT-mcp-app.md
  // §4 "Round 3 -- Agent B", Design decision 1).
  server.registerResource(
    "daily-forecast-home",
    DAILY_FORECAST_HOME_URI,
    {},
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html;profile=mcp-app",
          text: buildDailyForecastHomeWidgetHtml(),
        },
      ],
    }),
  );

  server.registerTool(
    "get_daily_forecast",
    {
      title: "Get Daily Forecast",
      description:
        "Today's Peer Daily Forecast for the signed-in user: their " +
        "highest-relevance job postings, research papers, and academic " +
        "events/conferences, ranked together — the same signal Peer's own " +
        "web app shows on its dashboard. Call this when the user asks " +
        "what's new, what's worth their attention today, for a briefing, " +
        "digest, or forecast of opportunities, or anything like \"what " +
        "should I look at today\" / \"anything new for me\". Answers " +
        "instantly from the user's existing Peer profile — no arguments " +
        "are required and no setup or login step is needed first.",
      inputSchema: getDailyForecastInputShape,
      _meta: {
        "openai/outputTemplate": DAILY_FORECAST_CARD_URI,
        "openai/toolInvocation/invoking": "Checking today's Peer forecast…",
        "openai/toolInvocation/invoked": "Here's today's Peer forecast",
        "openai/widgetAccessible": true,
        ui: { resourceUri: DAILY_FORECAST_CARD_URI },
      },
    },
    async (args) => {
      const result = await getDailyForecast(ctx.userId, args);
      // structuredContent is exactly what reaches the widget client-side,
      // over the postMessage bridge, as a ui/notifications/tool-result
      // notification's `params.structuredContent` -- not through the
      // resource above at all.
      return {
        content: [{ type: "text" as const, text: renderDailyForecastText(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "get_opportunity",
    {
      title: "Get Opportunity Detail",
      description:
        "Full detail for one specific job, paper, or event, by its id — " +
        "the 'tell me more' / 'open that one' follow-up after " +
        "get_daily_forecast. Requires an id from a prior " +
        "get_daily_forecast call in this conversation; do not call this " +
        "with a guessed, remembered, or made-up id. Returns " +
        "`{ found: false, id }` if the id no longer resolves to anything " +
        "today, rather than guessing at what it might have been.",
      inputSchema: getOpportunityInputShape,
    },
    async (args) => {
      const result = await getOpportunity(ctx.userId, args);
      return {
        content: [{ type: "text" as const, text: simpleOpportunitySummary(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "open_home",
    {
      title: "Open Peer Daily Forecast Home",
      description:
        "Opens Peer's full Daily Forecast home -- the fullscreen surface " +
        "with every ranked job, paper, and event for today, filterable by " +
        "type, not just the short inline preview. Call this when the user " +
        "asks to 'open Peer', 'open my Peer home', 'show my full forecast', " +
        "or wants to see everything rather than the top few. Answers " +
        "instantly from the user's existing Peer profile -- no arguments " +
        "are required and no setup or login step is needed first.",
      inputSchema: openHomeInputShape,
      _meta: {
        "openai/outputTemplate": DAILY_FORECAST_HOME_URI,
        "openai/toolInvocation/invoking": "Opening your Peer home…",
        "openai/toolInvocation/invoked": "Here's your Peer home",
        "openai/widgetAccessible": true,
        ui: { resourceUri: DAILY_FORECAST_HOME_URI },
      },
    },
    async (args) => {
      const result = await openHome(ctx.userId, args);
      // Reuses renderDailyForecastText verbatim -- open_home's
      // structuredContent is the same DailyForecastResult shape
      // get_daily_forecast returns, so the same text fallback already
      // produces a correct result with zero new function.
      return {
        content: [{ type: "text" as const, text: renderDailyForecastText(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
