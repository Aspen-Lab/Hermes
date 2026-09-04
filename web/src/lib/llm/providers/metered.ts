/**
 * `meterProvider` — wrap a provider so every call it makes is recorded.
 *
 * ABC-freemium 1-03 · R-METER-1.
 *
 * Applied at `resolveProvider`'s single return point, which is the only place a
 * provider is ever obtained (checked: no module outside `lib/llm/providers/`
 * constructs one). That is why R-METER-1 asks for a wrapper rather than a user
 * id threaded through thirteen call sites.
 *
 * **The three things it must not break**, each an assertion in `metered.test.ts`:
 *
 *  1. **Method presence is copied, never assumed.** `generateJsonText` and
 *     `generateVisionJsonText` are optional on `DigestProvider`, and eleven call
 *     sites decide whether to degrade by testing for them —
 *     `provider?.generateJsonText` is what makes `digest`, the three report
 *     routes and `papers/report` return their no-LLM payload. DeepSeek
 *     deliberately has no `generateVisionJsonText`. A wrapper that defined both
 *     unconditionally would turn "degrade cleanly" into "call a method the
 *     provider cannot serve".
 *  2. **`id` survives.** It is part of the `DigestProvider` contract and is
 *     asserted in the registry and route tests.
 *  3. **A throw still throws.** Every existing catch/degrade path depends on it.
 *
 * **One row per call, not two.** The providers already call `logLlmUsage` on
 * both success and failure, and that is where the token counts are, so the
 * wrapper does not write its own row for a call that logged one. It writes an
 * `ok: false` row only when a call throws *before* any logging happened —
 * a missing Vertex project, a client that would not construct.
 *
 * `resolveProvider` stays **synchronous**: this is pure object construction and
 * the recording inside `logLlmUsage` is fire-and-forget, so nothing becomes
 * async and none of the eleven un-awaited call sites change.
 */
import { recordUsageEvent } from "@/lib/usage/events";
import {
  withUsageContext,
  type UsageCallScope,
  type UsageContext,
} from "@/lib/usage/context";
import type { DigestProvider } from "./types";

function meterCall<A extends unknown[], R>(
  provider: DigestProvider,
  ctx: UsageContext,
  fallbackPath: string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const scope: UsageCallScope = { ...ctx, recorded: false };
    const started = Date.now();
    try {
      return await withUsageContext(scope, () => fn.apply(provider, args));
    } catch (error) {
      if (!scope.recorded) {
        recordUsageEvent({
          user_id: ctx.userId,
          kind: "llm",
          path: ctx.path ?? fallbackPath,
          provider: provider.id,
          model: null,
          latency_ms: Date.now() - started,
          ok: false,
          byok: ctx.byok,
        });
      }
      throw error;
    }
  };
}

export function meterProvider(
  provider: DigestProvider,
  ctx: UsageContext,
): DigestProvider {
  const metered: DigestProvider = {
    id: provider.id,
    generateDigest: meterCall(
      provider,
      ctx,
      "digest",
      provider.generateDigest,
    ),
    testConnection: meterCall(
      provider,
      ctx,
      "test-connection",
      provider.testConnection,
    ),
  };

  // Point 1 above: define these only when the wrapped provider has them.
  if (typeof provider.generateJsonText === "function") {
    metered.generateJsonText = meterCall(
      provider,
      ctx,
      "json",
      provider.generateJsonText,
    );
  }
  if (typeof provider.generateVisionJsonText === "function") {
    metered.generateVisionJsonText = meterCall(
      provider,
      ctx,
      "vision",
      provider.generateVisionJsonText,
    );
  }

  return metered;
}
