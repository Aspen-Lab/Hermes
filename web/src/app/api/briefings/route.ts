// GET  /api/briefings            — list this user's past briefing deliveries
// POST /api/briefings/open       — NB: split into a separate route below

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface BriefingRow {
  id: number;
  delivered_at: string;
  channel: "inapp" | "email" | "both";
  item_ids: string[];
  payload: unknown;
  opened_at: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ briefings: [] }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("briefing_deliveries")
    .select("id, delivered_at, channel, item_ids, payload, opened_at")
    .eq("user_id", user.id)
    .order("delivered_at", { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as BriefingRow[];
  return NextResponse.json({
    briefings: rows.map((r) => ({
      id: r.id,
      deliveredAt: r.delivered_at,
      channel: r.channel,
      itemIds: r.item_ids,
      payload: r.payload,
      openedAt: r.opened_at,
    })),
  });
}
