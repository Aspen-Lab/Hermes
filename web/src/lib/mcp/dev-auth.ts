import { timingSafeEqual } from "node:crypto";

/**
 * M1 dev auth gate (RULING 2, docs/handoff/MULTIAGENT-mcp-app.md §1c). The
 * slug lives only in the gitignored `web/.env.local` as `MCP_DEV_SLUG` and
 * maps server-side to one designated test user. It is never logged, never
 * committed, and this route + this file are deleted in M3 the same day real
 * OAuth lands — nothing here should become a long-term auth pattern.
 *
 * Constant-time comparison (`crypto.timingSafeEqual`, not `===`) so a
 * network attacker measuring response latency can't narrow down the slug
 * character-by-character.
 */
export function verifyDevSlug(candidate: string | undefined | null): boolean {
  const expected = process.env.MCP_DEV_SLUG;
  // No compare attempted when either side is empty/unset — an unset env var
  // must never accidentally "match" an empty candidate, and `timingSafeEqual`
  // itself would throw on a zero-length buffer pairing inconsistently.
  if (!expected || !candidate) return false;

  const expectedBuf = Buffer.from(expected);
  const candidateBuf = Buffer.from(candidate);
  // Different lengths would make `timingSafeEqual` throw a RangeError —
  // guard first so a mismatched-length probe fails the same way (false,
  // never a thrown error) as any other wrong guess.
  if (expectedBuf.length !== candidateBuf.length) return false;

  return timingSafeEqual(expectedBuf, candidateBuf);
}

/**
 * The Supabase `auth.users` id the dev slug maps to. M1 registers only
 * read-only tools (get_daily_forecast, get_opportunity), so there is
 * nothing further to lock down here — write tools (M5) arrive behind real
 * OAuth (M3+), a wholly different auth path from the dev slug.
 */
export function getDevTestUserId(): string {
  const userId = process.env.MCP_DEV_TEST_USER_ID;
  if (!userId) {
    throw new Error("MCP_DEV_TEST_USER_ID is not set");
  }
  return userId;
}
