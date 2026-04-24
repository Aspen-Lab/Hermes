// GET /api/jobs/dispatch-digests
//
// Cron-triggered hourly. For each enabled user whose local hour matches
// the current hour in their timezone (and whose frequency rule admits
// today), runs the feed pipeline and writes a `briefing_deliveries` row.
//
// Triggered by Vercel Cron per vercel.json. Vercel sends a special
// `x-vercel-cron` header; we also accept `Authorization: Bearer <CRON_SECRET>`
// for manual/local runs.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFeedPipeline } from "@/lib/feed/pipeline";
import { sendDigestEmail } from "@/lib/email/send-digest";

function originUrlFor(req: NextRequest): string {
  // Prefer explicit override; fall back to the request origin (Vercel sets
  // x-forwarded-host). Strip trailing slash.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return "https://hermes-flax-six.vercel.app";
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — digest runs may hit multiple source APIs

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  research_topics: string[];
  preferred_methods: string[];
  preferred_venues: string[];
  digest_enabled: boolean;
  digest_hour_local: number;
  digest_timezone: string;
  digest_channel: "inapp" | "email" | "both";
  digest_frequency: "daily" | "weekdays" | "weekly" | "off";
}

// Returns the hour (0–23) of the given instant in the given IANA timezone.
function hourInTimezone(instant: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).formatToParts(instant);
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
    // "24" can appear for midnight depending on runtime — normalize.
    const h = parseInt(hourPart, 10) % 24;
    return Number.isFinite(h) ? h : -1;
  } catch {
    return -1;
  }
}

// Returns 0 (Sun) – 6 (Sat) for the given instant in the given timezone.
function weekdayInTimezone(instant: Date, tz: string): number {
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    }).format(instant);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  } catch {
    return -1;
  }
}

function frequencyAdmitsToday(
  frequency: ProfileRow["digest_frequency"],
  weekday: number,
): boolean {
  if (frequency === "off") return false;
  if (frequency === "daily") return true;
  if (frequency === "weekdays") return weekday >= 1 && weekday <= 5;
  if (frequency === "weekly") return weekday === 1; // Monday digest
  return false;
}

export async function GET(req: NextRequest) {
  // Auth: Vercel cron OR shared secret for manual invocation.
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const hasSecret =
    secret && authHeader === `Bearer ${secret}`;
  if (!isVercelCron && !hasSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // Only fetch profiles that might fire today — rough pre-filter on
  // digest_enabled + frequency != off. Hour/timezone check happens per row.
  const { data, error } = await admin
    .from("profiles")
    .select(
      "user_id, display_name, research_topics, preferred_methods, preferred_venues, digest_enabled, digest_hour_local, digest_timezone, digest_channel, digest_frequency",
    )
    .eq("digest_enabled", true)
    .neq("digest_frequency", "off");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ProfileRow[];
  const dispatched: string[] = [];
  const skipped: { user_id: string; reason: string }[] = [];
  const failed: { user_id: string; error: string }[] = [];
  const emailsSent: { user_id: string; messageId?: string }[] = [];
  const emailsFailed: { user_id: string; error: string }[] = [];
  const originUrl = originUrlFor(req);

  for (const row of rows) {
    const hour = hourInTimezone(now, row.digest_timezone);
    if (hour !== row.digest_hour_local) {
      skipped.push({ user_id: row.user_id, reason: `hour ${hour} != ${row.digest_hour_local}` });
      continue;
    }
    const weekday = weekdayInTimezone(now, row.digest_timezone);
    if (!frequencyAdmitsToday(row.digest_frequency, weekday)) {
      skipped.push({ user_id: row.user_id, reason: `frequency ${row.digest_frequency} skips today` });
      continue;
    }
    if (!row.research_topics || row.research_topics.length === 0) {
      skipped.push({ user_id: row.user_id, reason: "no topics" });
      continue;
    }

    try {
      // De-dup guard: don't double-send within 6h of the last delivery.
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("briefing_deliveries")
        .select("id")
        .eq("user_id", row.user_id)
        .gte("delivered_at", sixHoursAgo)
        .limit(1);
      if (recent && recent.length > 0) {
        skipped.push({ user_id: row.user_id, reason: "recent delivery" });
        continue;
      }

      const feed = await runFeedPipeline({
        topics: row.research_topics,
        methods: row.preferred_methods.length > 0 ? row.preferred_methods : undefined,
        venues: row.preferred_venues.length > 0 ? row.preferred_venues : undefined,
        topN: 10,
      });

      const itemIds = feed.items.map((i) => i.id);
      const { error: insertErr } = await admin
        .from("briefing_deliveries")
        .insert({
          user_id: row.user_id,
          channel: row.digest_channel,
          item_ids: itemIds,
          payload: { items: feed.items },
        });

      if (insertErr) {
        failed.push({ user_id: row.user_id, error: insertErr.message });
        continue;
      }

      dispatched.push(row.user_id);

      // Email delivery — fire only when user picked email or both.
      // Never block the cron loop on mail failures; they're reported out
      // alongside the per-user result.
      if (row.digest_channel === "email" || row.digest_channel === "both") {
        const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
        const to = userData?.user?.email ?? null;
        if (!to) {
          emailsFailed.push({ user_id: row.user_id, error: "no email on auth user" });
        } else {
          const firstName = row.display_name?.trim().split(/\s+/)[0] || undefined;
          const result = await sendDigestEmail({
            to,
            firstName,
            items: feed.items,
            originUrl,
          });
          if (result.sent) {
            emailsSent.push({ user_id: row.user_id, messageId: result.messageId });
          } else {
            emailsFailed.push({ user_id: row.user_id, error: result.error ?? "unknown" });
          }
        }
      }
    } catch (err) {
      failed.push({
        user_id: row.user_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ran_at: now.toISOString(),
    dispatched_count: dispatched.length,
    dispatched,
    skipped_count: skipped.length,
    failed_count: failed.length,
    failed,
    emails_sent_count: emailsSent.length,
    emails_sent: emailsSent,
    emails_failed_count: emailsFailed.length,
    emails_failed: emailsFailed,
  });
}
