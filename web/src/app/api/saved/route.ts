// GET    /api/saved               — list all saved items for the signed-in user
// POST   /api/saved               — upsert { itemId, itemKind, payload }
// DELETE /api/saved?itemId=...    — remove one saved item
//
// RLS ensures user_id ownership; user_id is derived from the session, never the body.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ItemKind = "paper" | "event" | "job";

interface SavedRow {
  user_id: string;
  item_id: string;
  item_kind: ItemKind;
  payload: unknown;
  saved_at: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_items")
    .select("*")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SavedRow[];
  return NextResponse.json({
    items: rows.map((r) => ({
      itemId: r.item_id,
      itemKind: r.item_kind,
      payload: r.payload,
      savedAt: r.saved_at,
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

  const body = (await request.json()) as {
    itemId?: string;
    itemKind?: ItemKind;
    payload?: unknown;
  };
  if (!body.itemId || !body.itemKind || body.payload === undefined) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { error } = await supabase.from("saved_items").upsert(
    {
      user_id: user.id,
      item_id: body.itemId,
      item_kind: body.itemKind,
      payload: body.payload,
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
    .from("saved_items")
    .delete()
    .eq("user_id", user.id)
    .eq("item_id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
