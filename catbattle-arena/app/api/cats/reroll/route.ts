import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";

export const dynamic = "force-dynamic";

const REROLL_COST = 50;

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

    return NextResponse.json({
      ok: true,
      stats: result.new_stats,
      remainingSigils: result.new_sigils,
      cost: REROLL_COST,
    });

  } catch (e) {
    console.error('[REROLL] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}