// GET    /api/read                  — list all read item ids
// GET    /api/read?aggregate=daily  — per-day counts for the reading calendar
// POST   /api/read                  — mark { itemId } read (upsert → refreshes read_at)
// DELETE /api/read?itemId=...       — mark unread

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("aggregate");

  if (mode === "daily") {
    // Group by day (user's local day isn't known server-side here; we
    // return UTC-day buckets — the calendar component does the bucketing
    // against its own grid so coarse UTC alignment is fine).
    const { data, error } = await supabase
      .from("read_items")
      .select("read_at")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const day = new Date(row.read_at as string).toISOString().slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return NextResponse.json({
      daily: [...counts.entries()].map(([date, count]) => ({ date, count })),
    });
  }

  const { data, error } = await supabase
    .from("read_items")
    .select("item_id, read_at")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      itemId: r.item_id as string,
      readAt: r.read_at as string,
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { itemId?: string };
  if (!body.itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  // Upsert → repeat reads refresh read_at (latest wins for ordering).
  const { error } = await supabase.from("read_items").upsert(
    {
      user_id: user.id,
      item_id: body.itemId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("read_items")
    .delete()
    .eq("user_id", user.id)
    .eq("item_id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
