import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { preferCardImage, resolveCatImageUrl } from '../../_lib/images';
import { computePowerRating } from '../../../_lib/combat';

export const dynamic = 'force-dynamic';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function slugPart(): string {
  return randomBytes(4).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
}

async function generateUniqueSlug(): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const slug = `c_${slugPart()}`;
    const { data } = await sb.from('share_cards').select('id').eq('public_slug', slug).maybeSingle();
    if (!data) return slug;
  }
  return `c_${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await sb.rpc('bootstrap_user', { p_user_id: userId });

    const body = await req.json().catch(() => ({}));
    const catId = String(body?.cat_id || '').trim();
    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });

    const { data: existing } = await sb
      .from('share_cards')
      .select('id, public_slug, image_card_png_url, image_original_url, rarity, name, level, power_rating, stats, owner_display_name, minted_at')
      .eq('cat_id', catId)
      .order('minted_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const existingOriginal = String(existing.image_original_url || '').trim();
      const existingPreferred = preferCardImage(existingOriginal);
      const existingFinal = existingPreferred || existingOriginal || '/cat-placeholder.svg';
      return NextResponse.json({
        ok: true,
        minted: false,
        card: {
          id: existing.id,
          publicSlug: existing.public_slug,
          imageCardPngUrl: existing.image_card_png_url,
          imageUrl: existingFinal,
          imageOriginalUrl: existing.image_original_url,
          rarity: existing.rarity,
          name: existing.name,
          level: existing.level,
          powerRating: existing.power_rating,
          stats: existing.stats,
          ownerDisplayName: existing.owner_display_name,
          mintedAt: existing.minted_at,
          isPublic: true,
          publicUrl: `${req.nextUrl.origin}/c/${existing.public_slug}`,
        },
      });
    }

    const { data: cat } = await sb
      .from('cats')
      .select('id, user_id, name, rarity, attack, defense, speed, charisma, chaos, image_path, image_review_status, cat_level, level')
      .eq('id', catId)
      .maybeSingle();

    if (!cat) {
      return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    }

    const { data: owner } = await sb
      .from('profiles')
      .select('username')
      .eq('id', String(cat.user_id || ''))
      .maybeSingle();

    const imageOriginalUrl = await resolveCatImageUrl(sb, cat.image_path, cat.image_review_status || null, "original");
    const imagePreferredUrl = preferCardImage(imageOriginalUrl);
    const imageFinalUrl = imagePreferredUrl || imageOriginalUrl || '/cat-placeholder.svg';
    const slug = await generateUniqueSlug();
    const level = Math.max(1, Number(cat.cat_level || cat.level || 1));
    const stats = {
      atk: Math.max(0, Number(cat.attack || 0)),
      def: Math.max(0, Number(cat.defense || 0)),
      spd: Math.max(0, Number(cat.speed || 0)),
      cha: Math.max(0, Number(cat.charisma || 0)),
      chs: Math.max(0, Number(cat.chaos || 0)),
    };
    const score = computePowerRating({
      attack: cat.attack,
      defense: cat.defense,
      speed: cat.speed,
      charisma: cat.charisma,
      chaos: cat.chaos,
      rarity: cat.rarity,
      ability: (cat as { ability?: string | null }).ability || null,
      level: cat.cat_level || cat.level || 1,
    });
    const imageCardPngUrl = `${req.nextUrl.origin}/api/cards/image/${slug}`;
    const hash = createHash('sha256')
      .update(JSON.stringify({
        catId,
        name: cat.name,
        rarity: cat.rarity,
        level,
        stats,
        score,
        imageUrl: imageFinalUrl,
        imageOriginalUrl,
        owner: owner?.username || null,
      }))
      .digest('hex');

    const { data: inserted, error: insErr } = await sb
      .from('share_cards')
      .insert({
        public_slug: slug,
        cat_id: cat.id,
        owner_user_id: String(cat.user_id || ''),
        owner_display_name: owner?.username || null,
        name: String(cat.name || 'Unnamed Cat'),
        rarity: String(cat.rarity || 'Common'),
        level,
        power_rating: score,
        stats,
        image_original_url: imageOriginalUrl || '/cat-placeholder.svg',
        image_card_png_url: imageCardPngUrl,
        immutable_hash: hash,
        is_public: true,
      })
      .select('id, public_slug, image_card_png_url, image_original_url, rarity, name, level, power_rating, stats, owner_display_name, minted_at')
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ ok: false, error: insErr?.message || 'Mint failed' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      minted: true,
      card: {
        id: inserted.id,
        publicSlug: inserted.public_slug,
        imageCardPngUrl: inserted.image_card_png_url,
        imageUrl: imageFinalUrl,
        imageOriginalUrl: inserted.image_original_url,
        rarity: inserted.rarity,
        name: inserted.name,
        level: inserted.level,
        powerRating: inserted.power_rating,
        stats: inserted.stats,
        ownerDisplayName: inserted.owner_display_name,
        mintedAt: inserted.minted_at,
        isPublic: true,
        publicUrl: `${req.nextUrl.origin}/c/${inserted.public_slug}`,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
