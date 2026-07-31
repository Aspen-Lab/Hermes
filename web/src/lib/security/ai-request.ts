import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map<string, RateBucket>();

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

function isLocalDevelopment(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV
  );
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

  const now = Date.now();
  const key = `${scope}:${user.id}`;
  const current = rateBuckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (bucket.count >= limitPerHour) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
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

  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return null;
}
