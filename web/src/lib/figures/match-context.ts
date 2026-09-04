import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";

/**
 * Whose request a figure matcher is running for.
 *
 * ABC-freemium 1-07 · R-SEC-1. The two matchers used to call
 * `resolveProvider()` with no arguments — they were the only two no-argument
 * acquisitions in the tree, reached from `GET /api/figure`, which had no
 * authentication of any kind. R-SEC-1 requires them to "never resolve a server
 * provider without an authenticated request context passed in explicitly", so
 * this type is a **required** argument on both.
 *
 * Required, not optional, on purpose: an optional context would make A's scan-4
 * count zero today and non-zero the first time someone adds a caller who forgets
 * it. A new caller now has to state whose request this is before it compiles.
 */
export interface FigureMatchContext {
  /** From `supabase.auth.getUser()` only, via the route's entitlement check. */
  userId: string | null;
  /** True when the call runs on the reader's own key. */
  byok: boolean;
  /** The reader's BYOK override, when they supplied one. */
  override?: ProviderOverrideConfig | null;
}
