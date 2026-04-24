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
  };
}

function profileToRow(p: Partial<UserProfile>, userId: string) {
  return {
    user_id: userId,
    display_name: p.displayName ?? null,
    research_topics: p.researchTopics ?? [],
    preferred_methods: p.preferredMethods ?? [],
    preferred_venues: p.preferredVenues ?? [],
    location_preferences: p.locationPreferences ?? [],
    career_stage: p.careerStage ?? null,
    industry_vs_academia: p.industryVsAcademia ?? null,
    phd_year: p.phdYear ?? null,
  };
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
