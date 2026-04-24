// GET  /api/profile — returns the signed-in user's profile row (or null)
// PUT  /api/profile — upserts the signed-in user's profile
//
// RLS enforces user_id ownership, but we still derive user_id from the session
// server-side so clients can't claim someone else's row via request body.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

// ── DB ↔ client type mapping ────────────────────────────────────

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  research_topics: string[];
  preferred_methods: string[];
  preferred_venues: string[];
  location_preferences: string[];
  career_stage: string | null;
  industry_vs_academia: string | null;
  phd_year: number | null;
  digest_enabled: boolean;
  digest_hour_local: number;
  digest_timezone: string;
  digest_channel: UserProfile["digestChannel"];
  digest_frequency: UserProfile["digestFrequency"];
  updated_at: string;
}

function rowToProfile(row: ProfileRow): Partial<UserProfile> {
  return {
    displayName: row.display_name ?? undefined,
    researchTopics: row.research_topics,
    preferredMethods: row.preferred_methods,
    preferredVenues: row.preferred_venues,
    locationPreferences: row.location_preferences,
    careerStage: (row.career_stage ?? undefined) as UserProfile["careerStage"] | undefined,
    industryVsAcademia: (row.industry_vs_academia ?? undefined) as
      | UserProfile["industryVsAcademia"]
      | undefined,
    phdYear: row.phd_year ?? undefined,
    digestEnabled: row.digest_enabled,
    digestHourLocal: row.digest_hour_local,
    digestTimezone: row.digest_timezone,
    digestChannel: row.digest_channel,
    digestFrequency: row.digest_frequency,
  };
}

function profileToRow(p: Partial<UserProfile>, userId: string) {
  // Only include columns the caller meant to set. `undefined` means "leave
  // existing value alone" — important so sending a display-name update
  // doesn't wipe digest prefs (and vice versa).
  const row: Record<string, unknown> = { user_id: userId };
  if (p.displayName !== undefined) row.display_name = p.displayName;
  if (p.researchTopics !== undefined) row.research_topics = p.researchTopics;
  if (p.preferredMethods !== undefined) row.preferred_methods = p.preferredMethods;
  if (p.preferredVenues !== undefined) row.preferred_venues = p.preferredVenues;
  if (p.locationPreferences !== undefined) row.location_preferences = p.locationPreferences;
  if (p.careerStage !== undefined) row.career_stage = p.careerStage;
  if (p.industryVsAcademia !== undefined) row.industry_vs_academia = p.industryVsAcademia;
  if (p.phdYear !== undefined) row.phd_year = p.phdYear;
  if (p.digestEnabled !== undefined) row.digest_enabled = p.digestEnabled;
  if (p.digestHourLocal !== undefined) row.digest_hour_local = p.digestHourLocal;
  if (p.digestTimezone !== undefined) row.digest_timezone = p.digestTimezone;
  if (p.digestChannel !== undefined) row.digest_channel = p.digestChannel;
  if (p.digestFrequency !== undefined) row.digest_frequency = p.digestFrequency;
  return row;
}

// ── Handlers ────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ profile: null }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: data ? rowToProfile(data as ProfileRow) : null,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<UserProfile>;
  const row = profileToRow(body, user.id);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: rowToProfile(data as ProfileRow) });
}
