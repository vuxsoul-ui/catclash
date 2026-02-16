// PLACE AT: app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cats, error } = await supabase
      .from('cats')
      .select('id, name, image_path, rarity, wins, losses, battles_fought')
      .eq('status', 'approved')
      .gt('battles_fought', 0)
      .order('wins', { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const catsWithUrls = (cats || []).map(cat => {
      let image_url = '';
      if (cat.image_path) {
        const { data: urlData } = supabase.storage.from('cat-images').getPublicUrl(cat.image_path);
        image_url = urlData?.publicUrl || '';
      }
      return {
        id: cat.id,
        name: cat.name,
        image_url,
        rarity: cat.rarity,
        wins: cat.wins || 0,
        losses: cat.losses || 0,
        battles_fought: cat.battles_fought || 0,
      };
    });

    return NextResponse.json({ ok: true, cats: catsWithUrls });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}