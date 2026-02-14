// REPLACE: app/api/cats/approved/route.ts
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
      .select('id, name, image_path, rarity, attack, defense, speed, charisma, chaos, ability, power, cat_level, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[APPROVED] Query error:', error);
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
        stats: {
          attack: cat.attack || 0,
          defense: cat.defense || 0,
          speed: cat.speed || 0,
          charisma: cat.charisma || 0,
          chaos: cat.chaos || 0,
        },
        ability: cat.ability,
        power: cat.power || (cat.attack + cat.defense + cat.speed + cat.charisma + cat.chaos),
        cat_level: cat.cat_level || 1,
      };
    });

    return NextResponse.json({ ok: true, cats: catsWithUrls });
  } catch (e) {
    console.error('[APPROVED] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}