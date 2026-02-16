import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const guestId = await getGuestId();
    if (!guestId) {
      return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
    }

    const { catId } = await req.json();
    
    if (!catId) {
      return NextResponse.json({ ok: false, error: "Missing catId" }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify cat belongs to user and is in draft status
    const { data: cat, error: fetchErr } = await sb
      .from("cats")
      .select("id, user_id, status")
      .eq("id", catId)
      .single();

    if (fetchErr || !cat) {
      return NextResponse.json({ ok: false, error: "Cat not found" }, { status: 404 });
    }

    if (cat.user_id !== guestId) {
      return NextResponse.json({ ok: false, error: "Not your cat" }, { status: 403 });
    }

    if (cat.status !== "draft") {
      return NextResponse.json({ ok: false, error: "Cat already submitted" }, { status: 400 });
    }

    // Update status to pending
    const { error: updateErr } = await sb
      .from("cats")
      .update({ status: "pending" })
      .eq("id", catId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: "Failed to finalize cat" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });

  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}