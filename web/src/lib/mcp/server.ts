import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDailyForecast } from "./tools/get-daily-forecast";
import { getOpportunity } from "./tools/get-opportunity";
import { buildDailyForecastWidgetHtml, renderDailyForecastText } from "./ui/daily-forecast-card";
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

const getDailyForecastInputShape = {
  type: z
    .enum(["job", "paper", "event"])
    .optional()
    .describe(
      "Restrict the forecast to one opportunity type. Omit for a single " +
        "merged forecast across jobs, papers, and events ranked together " +
        "by relevance — this is what the inline Daily Forecast card shows.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe("Maximum number of items to return, highest relevance first. Defaults to 9."),
};

const getOpportunityInputShape = {
  id: z
    .string()
    .min(1)
    .describe(
      "The exact `id` field from a get_daily_forecast item (its " +
        "`items[].id`). Returns that item's full detail in the same shape, " +
        "or `{ found: false, id }` if it no longer resolves to anything — " +
        "never a guessed or partial result.",
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

  server.registerTool(
    "get_daily_forecast",
    {
      title: "Get Daily Forecast",
      description:
        "Today's Peer Daily Forecast for the signed-in user: the " +
        "highest-relevance jobs, papers, and events ranked together, the " +
        "same signal Peer's own web app shows on its dashboard. Call this " +
        "when the user asks what's new, what's worth their attention " +
        "today, or for a briefing/forecast/digest of opportunities. No " +
        "arguments are required.",
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
        "Full detail for a single job, paper, or event by its id — the " +
        "'tell me more' follow-up after get_daily_forecast. Only accepts " +
        "ids that came from a get_daily_forecast call; returns " +
        "`{ found: false, id }` if the id doesn't resolve to anything " +
        "today (never a guess).",
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
}
