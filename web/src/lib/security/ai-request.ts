import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocalDevRuntime } from "@/lib/env/local-dev";
import {
  endOfUtcHour,
  getCounterStore,
  rateKey,
  underLimit,
} from "@/lib/usage/counters";

function hasSupabaseAuthConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function deployedRuntimeNeedsAuth(): boolean {
  return Boolean(
    process.env.NODE_ENV === "production" ||
      process.env.VERCEL ||
      process.env.VERCEL_ENV,
  );
}

/**
 * ABC-freemium 1-01 — the three-condition body moved to `lib/env/local-dev.ts`
 * so this, `canUseLocalServerProvider` and `resolveEntitlement` cannot drift
 * apart. Local name and meaning unchanged.
 */
function isLocalDevelopment(): boolean {
  return isLocalDevRuntime();
}

/**
 * Protect an endpoint immediately before it spends a user's BYOK model key.
 * Tier 0 routes stay public; local `next dev` stays convenient.
 */
export async function protectAiRequest(
  scope: string,
  limitPerHour = 30,
): Promise<NextResponse | null> {
  if (isLocalDevelopment()) return null;

  if (!hasSupabaseAuthConfig()) {
    return deployedRuntimeNeedsAuth()
      ? NextResponse.json(
          { error: "AI features require sign-in configuration" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        )
      : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in before using an AI feature" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ABC-freemium 1-02 · R-METER-3 — this was a module-scope `Map`, so a
  // serverless instance that had just started always saw zero and the limit was
  // per-instance rather than per-user. The shared store counts once per user
  // across every instance and survives a cold start.
  //
  // Increment first, then compare: the post-increment value is this caller's
  // own, so two instances cannot both see 59 and both proceed. The limits
  // themselves are unchanged — 60/h feeds, 20/h reports, passed by each route.
  //
  // The window is now a fixed UTC clock hour carried in the key rather than an
  // hour rolling from the user's first request. A user who sends 60 requests at
  // 10:59 can send 60 more at 11:00; that is the trade for a counter that
  // survives a cold start. **Fails open** — an unreachable store must not answer
  // 429 to every signed-in user (see `counters.ts`).
  const now = new Date();
  const reading = await getCounterStore().increment(
    rateKey(scope, user.id, now),
    endOfUtcHour(now),
  );

  if (!underLimit(reading, limitPerHour)) {
    const retryAfter = Math.max(
      1,
      Math.ceil((endOfUtcHour(now).getTime() - now.getTime()) / 1000),
    );
    return NextResponse.json(
      { error: "AI request limit reached. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return null;
}
