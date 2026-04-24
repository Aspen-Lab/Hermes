// POST /api/test-digest
//
// Manual smoke-test for digest email wiring. Runs the feed pipeline for
// the signed-in user's topics and emails the result to their auth email.
// Unlike the cron dispatcher, this ignores digest_enabled, frequency,
// and time-of-day — it fires immediately.
//
// Does NOT insert into briefing_deliveries (this is for testing, not a
// real delivery).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runFeedPipeline } from "@/lib/feed/pipeline";
import { sendDigestEmail } from "@/lib/email/send-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function originUrlFor(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return "https://hermes-flax-six.vercel.app";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "auth user has no email" }, { status: 400 });
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select(
      "display_name, research_topics, preferred_methods, preferred_venues",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }
  const topics = (profile?.research_topics ?? []) as string[];
  if (topics.length === 0) {
    return NextResponse.json(
      { error: "no research topics set on profile — add some first" },
      { status: 400 },
    );
  }

  const feed = await runFeedPipeline({
    topics,
    methods: profile?.preferred_methods?.length
      ? (profile.preferred_methods as string[])
      : undefined,
    venues: profile?.preferred_venues?.length
      ? (profile.preferred_venues as string[])
      : undefined,
    topN: 10,
  });

  const firstName =
    (profile?.display_name as string | null)?.trim().split(/\s+/)[0] || undefined;

  const result = await sendDigestEmail({
    to: user.email,
    firstName,
    items: feed.items,
    originUrl: originUrlFor(req),
  });

  return NextResponse.json({
    to: user.email,
    items_count: feed.items.length,
    ...result,
  });
}
