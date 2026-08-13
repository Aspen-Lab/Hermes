import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface PeerMcpContext {
  /**
   * Supabase `auth.users` id this call acts as. M1: always the dev-slug test
   * user (see `web/src/lib/mcp/dev-auth.ts`, RULING 2). M3 replaces the dev
   * slug with a real OAuth session's user id — nothing in tool bodies should
   * assume "dev slug" specifically, only that `userId` is trustworthy.
   */
  userId: string;
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
  void server;
  void ctx;
  // 1-02: get_daily_forecast registers here.
  // 1-05: get_opportunity registers here.
}
