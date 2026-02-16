// PLACE AT: app/api/inventory/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../_lib/guest";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const guestId = await getGuestId();
    if (!guestId) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    // Get sigils
    const { data: progress } = await sb
      .from("user_progress")
      .select("sigils")
      .eq("user_id", guestId)
      .single();

    // Get owned cosmetics
    const { data: inventory } = await sb
      .from("user_inventory")
      .select("cosmetic_id, acquired_at, cosmetics(id, slug, name, category, rarity, description)")
      .eq("user_id", guestId)
      .order("acquired_at", { ascending: false });

    // Get equipped
    const { data: equipped } = await sb
      .from("equipped_cosmetics")
      .select("cat_id, slot, cosmetic_id")
      .eq("user_id", guestId);

    return NextResponse.json({
      ok: true,
      sigils: progress?.sigils || 0,
      items: (inventory || []).map((i: Record<string, unknown>) => i.cosmetics),
      equipped: equipped || [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}