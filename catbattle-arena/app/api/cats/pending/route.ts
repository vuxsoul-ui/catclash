// REPLACE: app/api/cats/pending/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Fix env vars - remove newlines and spaces
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET() {
  try {
    console.log('[DEBUG] URL:', supabaseUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch ALL cats, filter in JavaScript (bypass .eq() bug)
    let allCats: Array<Record<string, unknown>> | null = null;
    let allError: { message?: string } | null = null;

    const primaryQuery = await supabase
      .from('cats')
      .select('id, name, image_path, rarity, attack, defense, speed, charisma, chaos, ability, created_at, status, image_review_status')
      .order('created_at', { ascending: false });
    allCats = (primaryQuery.data as Array<Record<string, unknown>> | null) || null;
    allError = primaryQuery.error;

    if (allError?.message?.includes('image_review_status')) {
      const fallbackQuery = await supabase
        .from('cats')
        .select('id, name, image_path, rarity, attack, defense, speed, charisma, chaos, ability, created_at, status')
        .order('created_at', { ascending: false });
      allCats = (fallbackQuery.data as Array<Record<string, unknown>> | null) || null;
      allError = fallbackQuery.error;
    }

    if (allError) {
      console.error('[DEBUG] Query error:', allError);
      return NextResponse.json({ ok: false, error: allError.message }, { status: 500 });
    }

    console.log('[DEBUG] All cats count:', allCats?.length);
    console.log('[DEBUG] Statuses:', allCats?.map(c => c.status));

    // Filter pending in JavaScript
    const typedCats = (allCats || []) as Array<{ image_review_status?: string; status?: string; image_path?: string | null } & Record<string, unknown>>;
    const pendingCats = typedCats.filter((c) => {
      if (c.image_review_status) {
        return c.image_review_status === 'pending_review';
      }
      return c.status === 'pending';
    });
    console.log('[DEBUG] Pending count:', pendingCats.length);

    // Build URLs
    const catsWithUrls = pendingCats.map(cat => {
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
        created_at: cat.created_at,
      };
    });

    return NextResponse.json({ 
      ok: true, 
      cats: catsWithUrls,
      debug: {
        allCatsCount: allCats?.length,
        pendingCatsCount: pendingCats.length,
      }
    });

  } catch (e) {
    console.error('[DEBUG] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
