// POST /api/feedback — append a feedback event
//
// Append-only signal stream. Future Tier 1/2 re-ranking reads from here.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ItemKind = "paper" | "event" | "job";
type Feedback = "liked" | "saved" | "notInterested" | "moreLikeThis";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as {
    itemId?: string;
    itemKind?: ItemKind;
    feedback?: Feedback;
  };
  if (!body.itemId || !body.itemKind || !body.feedback) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { error } = await supabase.from("feedback_events").insert({
    user_id: user.id,
    item_id: body.itemId,
    item_kind: body.itemKind,
    feedback: body.feedback,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
