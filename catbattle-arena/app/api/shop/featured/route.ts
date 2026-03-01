import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { ensureLegacyRows, getItemConfig } from '../_lib/catalog';
import { nextUtcMidnightIso, pickFeaturedItems, utcDayKey } from '../_lib/featured';
import { canPurchaseCosmetic, normalizeCosmeticSlot, resolveCosmeticEffect } from '../../../_lib/cosmetics/effectsRegistry';
import { normalizeCategoryForCatalog, normalizeSlotForApi } from '../_lib/normalize';
import { isBlockedCosmetic, isSupportedVoteEffect, stablePriceSigils } from '../_lib/curation';

export const dynamic = 'force-dynamic';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    await sb.rpc('bootstrap_user', { p_user_id: userId });
    await ensureLegacyRows(sb);

    const [{ data: richCosmetics, error: richErr }, { data: inv }, { data: equipped }] = await Promise.all([
      sb
        .from('cosmetics')
        .select('id, slug, name, category, rarity, description, preview, price_sigils, metadata, active')
        .order('created_at', { ascending: false }),
      sb.from('user_inventory').select('cosmetic_id').eq('user_id', userId),
      sb.from('equipped_cosmetics').select('slot, cosmetic_id').eq('user_id', userId),
    ]);

    let cosmetics = richCosmetics as Array<Record<string, unknown>> | null;
    if (richErr) {
      const { data: legacyCosmetics } = await sb
        .from('cosmetics')
        .select('id, slug, name, category, rarity, description, preview')
        .order('created_at', { ascending: false });
      cosmetics = legacyCosmetics as Array<Record<string, unknown>> | null;
    }

    const ownedSet = new Set((inv || []).map((r) => r.cosmetic_id));
    const equippedMap: Record<string, string> = {};
    for (const row of equipped || []) equippedMap[normalizeSlotForApi(row.slot)] = row.cosmetic_id;

    const catalogRows = (cosmetics || [])
      .filter((c) => c.active !== false)
      .map((c) => {
        const slug = String(c.slug || '');
        const name = String(c.name || 'Unknown Item');
        const cfg = getItemConfig(slug);
        const rawCategory = normalizeCategoryForCatalog(String(c.category || ''));
        const category = cfg?.category || rawCategory;
        const dbMetadata = c.metadata && typeof c.metadata === 'object' ? c.metadata : null;
        const metadata = (dbMetadata || cfg?.metadata || {}) as Record<string, unknown>;
        const slot = normalizeCosmeticSlot({ slug, category, metadata });
        const effect = resolveCosmeticEffect({ slug, category, metadata });
        if (isBlockedCosmetic(slug, name)) return null;
        if (slot === 'vote_effect' && !isSupportedVoteEffect(slug, effect.id)) return null;

        return {
          id: String(c.id || ''),
          slug,
          name,
          category,
          rarity: String(c.rarity || 'Common'),
          description: c.description ? String(c.description) : null,
          preview: c.preview ? String(c.preview) : null,
          price_sigils: stablePriceSigils({
            slug,
            category,
            rarity: String(c.rarity || 'Common'),
            metadata,
            configuredPrice: cfg?.price_sigils ?? null,
          }),
          metadata,
          slot,
          effect_id: effect.id,
          effect_implemented: effect.isImplemented,
          purchasable: canPurchaseCosmetic({ slug, category, metadata }),
          owned: ownedSet.has(String(c.id || '')),
          equipped_slot: Object.entries(equippedMap).find(([, id]) => id === String(c.id || ''))?.[0] || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);

    const dayKey = utcDayKey();
    const { seed, items } = pickFeaturedItems(catalogRows, dayKey);
    const refreshAtUtc = nextUtcMidnightIso();

    return NextResponse.json(
      {
        ok: true,
        dayKey,
        seed,
        refreshAtUtc,
        items,
        limitedTime: [],
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
