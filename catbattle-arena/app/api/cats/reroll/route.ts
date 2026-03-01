import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireGuestId } from "../../_lib/guest";
import { normalizeStatsForRarity } from "../../_lib/stat-balance";

export const dynamic = "force-dynamic";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

const REROLL_COST = 50;

export async function POST(req: NextRequest) {
  try {
    let guestId = "";
    try {
      guestId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { catId } = await req.json();
    
    if (!catId) {
      return NextResponse.json({ ok: false, error: "Missing catId" }, { status: 400 });
    }

    // Use the fixed variables
    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Call the RPC function
    const { data, error } = await sb.rpc('reroll_cat_stats', {
      p_cat_id: catId,
      p_user_id: guestId,
      p_reroll_cost: REROLL_COST,
    });

    if (error) {
      console.error('[REROLL] RPC error:', error);
      return NextResponse.json({ ok: false, error: "Reroll failed" }, { status: 500 });
    }

    const result = data?.[0];

    if (!result?.success) {
      return NextResponse.json({ 
        ok: false, 
        error: result?.error_message || "Reroll failed",
        currentSigils: result?.new_sigils 
      }, { status: 400 });
    }

    const { data: catRow } = await sb
      .from("cats")
      .select("id, rarity")
      .eq("id", catId)
      .eq("user_id", guestId)
      .maybeSingle();
    if (!catRow) {
      return NextResponse.json({ ok: false, error: "Cat not found" }, { status: 404 });
    }

    const normalizedStats = normalizeStatsForRarity(String(catRow.rarity || "Common"), {
      attack: Number(result?.new_stats?.attack || 0),
      defense: Number(result?.new_stats?.defense || 0),
      speed: Number(result?.new_stats?.speed || 0),
      charisma: Number(result?.new_stats?.charisma || 0),
      chaos: Number(result?.new_stats?.chaos || 0),
    });

    await sb
      .from("cats")
      .update(normalizedStats)
      .eq("id", catId)
      .eq("user_id", guestId);

    return NextResponse.json({
      ok: true,
      stats: normalizedStats,
      remainingSigils: result.new_sigils,
      cost: REROLL_COST,
    });

  } catch (e) {
    console.error('[REROLL] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
