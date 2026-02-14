import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function errToString(err: unknown) {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export async function GET() {
  try {
    const projectHost = new URL(supabaseUrl).host;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cats, error } = await supabase
      .from("cats")
      .select("id, name, image_path, rarity, stats, ability, power, cat_level, created_at, status")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ ok: false, projectHost, error: error.message }, { status: 500 });
    }

    const catsWithUrls =
      cats?.map((cat) => {
        const { data: urlData } = supabase.storage.from("cat-images").getPublicUrl(cat.image_path);
        return { ...cat, image_url: urlData?.publicUrl ?? null };
      }) ?? [];

    // ✅ debug fields
    return NextResponse.json({
      ok: true,
      projectHost,
      count: catsWithUrls.length,
      cats: catsWithUrls,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "Server error", details: errToString(e) },
      { status: 500 }
    );
  }
}
