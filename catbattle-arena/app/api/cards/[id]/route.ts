import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await params;
    const id = String(p.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });

    const { data, error } = await sb
      .from('share_cards')
      .select('id, public_slug, cat_id, image_card_png_url, image_original_url, rarity, name, level, power_rating, stats, owner_display_name, minted_at, is_public')
      .eq('public_slug', id)
      .maybeSingle();

    if (error || !data || !data.is_public) {
      return NextResponse.json({ ok: false, error: 'Card not found' }, { status: 404 });
    }

    let description: string | null = null;
    if (data?.cat_id) {
      const { data: cat } = await sb
        .from('cats')
        .select('description')
        .eq('id', data.cat_id)
        .maybeSingle();
      description = String(cat?.description || '').trim() || null;
    }

    return NextResponse.json({
      ok: true,
      card: {
        id: data.id,
        publicSlug: data.public_slug,
        imageCardPngUrl: data.image_card_png_url,
        imageOriginalUrl: data.image_original_url,
        rarity: data.rarity,
        name: data.name,
        level: data.level,
        powerRating: data.power_rating,
        stats: data.stats || {},
        ownerDisplayName: data.owner_display_name,
        description,
        mintedAt: data.minted_at,
        isPublic: !!data.is_public,
      },
    }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
