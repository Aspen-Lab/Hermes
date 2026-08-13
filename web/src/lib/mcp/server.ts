import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDailyForecast } from "./tools/get-daily-forecast";
import type { DailyForecastResult } from "./types";

export interface PeerMcpContext {
  /**
   * Supabase `auth.users` id this call acts as. M1: always the dev-slug test
   * user (see `web/src/lib/mcp/dev-auth.ts`, RULING 2). M3 replaces the dev
   * slug with a real OAuth session's user id — nothing in tool bodies should
   * assume "dev slug" specifically, only that `userId` is trustworthy.
   */
  userId: string;
}

// Placeholder fallback rendering — replaced by the real
// renderDailyForecastText (1-03+1-04+1-09) once it exists. Honest (real
// titles/links only, nothing invented), just unpolished; the `content`
// array is required on every CallToolResult regardless of whether a host
// can render the `ui://` card, so this can't be deferred entirely to 1-09.
function simpleForecastSummary(result: DailyForecastResult): string {
  if (result.items.length === 0) {
    return "No forecast items today.";
  }
  return result.items
    .map((item) => {
      const link = item.deepLink ? ` — ${item.deepLink}` : "";
      return `- [${item.type}] ${item.title}${link}`;
    })
    .join("\n");
}

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
    },
    async (args) => {
      const result = await getDailyForecast(ctx.userId, args);
      return {
        content: [{ type: "text" as const, text: simpleForecastSummary(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  // 1-05: get_opportunity registers here.
}
