// REPLACE: app/api/crate/claim/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST() {
  try {
    const guestId = await getGuestId();
    if (!guestId) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    const { data, error } = await sb.rpc("open_crate", {
      p_user_id: guestId,
      p_crate_type: "daily",
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error || "Failed" }, { status: 400 });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}