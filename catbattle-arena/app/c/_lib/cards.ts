import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { resolveCatImageUrl, resolveCatImageUrlOwnerPreview } from '../../api/_lib/images';
import { computePowerRating } from '../../_lib/combat';
import { GUEST_COOKIE_NAME, verifyGuestToken } from '../../api/_lib/guestAuth';
import { canonicalSiteOrigin } from '../../lib/site-origin';

export type ShareCardData = {
  id: string;
  public_slug: string;
  image_card_png_url: string;
  image_original_url: string;
  rarity: string;
  name: string;
  level: number;
  power_rating: number;
  stats: Record<string, number>;
  owner_display_name: string | null;
  owner_user_id?: string | null;
  cat_id?: string | null;
  description?: string | null;
  minted_at: string;
  is_public: boolean;
};

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

export async function getShareCard(slug: string): Promise<ShareCardData | null> {
  const { data } = await sb
    .from('share_cards')
    .select('id, public_slug, image_card_png_url, image_original_url, rarity, name, level, power_rating, stats, owner_display_name, owner_user_id, cat_id, minted_at, is_public')
    .eq('public_slug', slug)
    .maybeSingle();
  if (!data || !data.is_public) return null;

  const card = data as ShareCardData;
  const viewerToken = (await cookies()).get(GUEST_COOKIE_NAME)?.value || '';
  const viewerId = verifyGuestToken(viewerToken)?.guestId || null;
  const isOwner = !!viewerId && !!card.owner_user_id && viewerId === card.owner_user_id;

  if (isOwner && card.cat_id) {
    const { data: cat } = await sb
      .from('cats')
      .select('image_path, image_review_status, description')
      .eq('id', card.cat_id)
      .maybeSingle();
    card.description = String(cat?.description || '').trim() || null;

    const review = String(cat?.image_review_status || '').toLowerCase();
    if (cat?.image_path) {
      if (review === 'pending_review') {
        const preview = await resolveCatImageUrlOwnerPreview(sb, cat.image_path as string);
        if (preview) card.image_original_url = preview;
      } else {
        const resolved = await resolveCatImageUrl(sb, cat.image_path as string, cat.image_review_status as string | null);
        if (resolved) card.image_original_url = resolved;
      }
    }
  } else if (card.cat_id) {
    // Public/non-owner view should still reflect latest moderation state.
    const { data: cat } = await sb
      .from('cats')
      .select('image_path, image_review_status, description')
      .eq('id', card.cat_id)
      .maybeSingle();
    card.description = String(cat?.description || '').trim() || null;
    if (cat?.image_path) {
      const resolved = await resolveCatImageUrl(sb, cat.image_path as string, cat.image_review_status as string | null);
      if (resolved) card.image_original_url = resolved;
    }
  }

  return card;
}

export async function getOrCreateShareCardByCatId(catId: string): Promise<ShareCardData | null> {
  const cleanCatId = String(catId || '').trim();
  if (!isUuid(cleanCatId)) return null;

  const { data: existing } = await sb
    .from('share_cards')
    .select('id, public_slug, image_card_png_url, image_original_url, rarity, name, level, power_rating, stats, owner_display_name, owner_user_id, cat_id, minted_at, is_public')
    .eq('cat_id', cleanCatId)
    .order('minted_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing && existing.is_public) {
    return existing as ShareCardData;
  }

  const { data: cat } = await sb
    .from('cats')
    .select('id, user_id, name, rarity, ability, attack, defense, speed, charisma, chaos, image_path, image_review_status, cat_level, level, description')
    .eq('id', cleanCatId)
    .maybeSingle();

  if (!cat) return null;

  const { data: owner } = await sb
    .from('profiles')
    .select('username')
    .eq('id', String(cat.user_id || ''))
    .maybeSingle();

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
    level,
  });
  const slug = await generateUniqueSlug();
  const imageOriginalUrl = await resolveCatImageUrl(sb, String(cat.image_path || ''), cat.image_review_status || null, 'original');
  const origin = canonicalSiteOrigin();
  const hash = createHash('sha256')
    .update(JSON.stringify({
      catId: cleanCatId,
      name: cat.name,
      rarity: cat.rarity,
      level,
      stats,
      score,
      imageOriginalUrl,
      owner: owner?.username || null,
    }))
    .digest('hex');

  const { data: inserted } = await sb
    .from('share_cards')
    .insert({
      public_slug: slug,
      cat_id: cleanCatId,
      owner_user_id: String(cat.user_id || ''),
      owner_display_name: owner?.username || null,
      name: String(cat.name || 'Unnamed Cat'),
      rarity: String(cat.rarity || 'Common'),
      level,
      power_rating: score,
      stats,
      image_original_url: imageOriginalUrl || '/cat-placeholder.svg',
      image_card_png_url: `${origin}/api/cards/image/${slug}`,
      immutable_hash: hash,
      is_public: true,
    })
    .select('id, public_slug, image_card_png_url, image_original_url, rarity, name, level, power_rating, stats, owner_display_name, owner_user_id, cat_id, minted_at, is_public')
    .single();

  return inserted ? (inserted as ShareCardData) : null;
}
