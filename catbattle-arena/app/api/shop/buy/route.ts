import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { ensureLegacyRows, getItemConfig } from '../_lib/catalog';
import { grantPendingCatXp } from '../../_lib/cat-progression';
import { canPurchaseCosmetic, normalizeCosmeticSlot, resolveCosmeticEffect } from '../../../_lib/cosmetics/effectsRegistry';
import { slotCandidatesForCosmetic } from '../_lib/normalize';
import { isBlockedCosmetic, isSupportedVoteEffect, stablePriceSigils } from '../_lib/curation';

export const dynamic = 'force-dynamic';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function setEquippedCosmetic(userId: string, slots: string[], cosmeticId: string): Promise<{ error: { message: string } | null; usedSlot: string | null }> {
  const now = new Date().toISOString();
  let lastErr: { message: string } | null = null;

  for (const slot of slots) {
    const updateRes = await sb
      .from('equipped_cosmetics')
      .update({ cosmetic_id: cosmeticId, equipped_at: now })
      .eq('user_id', userId)
      .eq('slot', slot)
      .select('user_id')
      .limit(1);
    if (updateRes.error) {
      const msg = String(updateRes.error.message || '').toLowerCase();
      if (msg.includes('slot_check') || msg.includes('violates check constraint')) {
        lastErr = updateRes.error;
        continue;
      }
      return { error: updateRes.error, usedSlot: null };
    }
    if ((updateRes.data || []).length > 0) return { error: null, usedSlot: slot };

    const insertRes = await sb
      .from('equipped_cosmetics')
      .insert({ user_id: userId, slot, cosmetic_id: cosmeticId, equipped_at: now });
    if (!insertRes.error) return { error: null, usedSlot: slot };

    const msg = String(insertRes.error.message || '').toLowerCase();
    if (msg.includes('slot_check') || msg.includes('violates check constraint')) {
      lastErr = insertRes.error;
      continue;
    }
    if (!msg.includes('duplicate') && !msg.includes('unique')) return { error: insertRes.error, usedSlot: null };

    const deleteRes = await sb.from('equipped_cosmetics').delete().eq('user_id', userId).eq('slot', slot);
    if (deleteRes.error) return { error: deleteRes.error, usedSlot: null };

    const retryRes = await sb
      .from('equipped_cosmetics')
      .insert({ user_id: userId, slot, cosmetic_id: cosmeticId, equipped_at: now });
    if (!retryRes.error) return { error: null, usedSlot: slot };
    lastErr = retryRes.error;
  }

  return { error: lastErr || { message: 'Unable to match equipped slot constraint.' }, usedSlot: null };
}

export async function POST(request: NextRequest) {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const slug = String(body.slug || '').trim();
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 });

    await sb.rpc('bootstrap_user', { p_user_id: userId });
    await ensureLegacyRows(sb);

    const [{ data: progress }] = await Promise.all([
      sb.from('user_progress').select('xp, level, sigils').eq('user_id', userId).maybeSingle(),
    ]);

    let cosmetic: Record<string, unknown> | null = null;
    const rich = await sb
      .from('cosmetics')
      .select('id, slug, name, category, rarity, description, preview, price_sigils, metadata, active')
      .eq('slug', slug)
      .maybeSingle();

    if (rich.error) {
      const legacy = await sb
        .from('cosmetics')
        .select('id, slug, name, category, rarity, description, preview')
        .eq('slug', slug)
        .maybeSingle();
      cosmetic = (legacy.data || null) as Record<string, unknown> | null;
    } else {
      cosmetic = (rich.data || null) as Record<string, unknown> | null;
    }

    if (!cosmetic) return NextResponse.json({ ok: false, error: 'Item unavailable' }, { status: 404 });
    if (cosmetic.active === false) return NextResponse.json({ ok: false, error: 'Item unavailable' }, { status: 404 });

    const cosmeticSlug = String(cosmetic.slug || '');
    const cosmeticName = String(cosmetic.name || '');
    if (isBlockedCosmetic(cosmeticSlug, cosmeticName)) {
      return NextResponse.json({ ok: false, error: 'Item unavailable' }, { status: 404 });
    }
    const cfg = getItemConfig(cosmeticSlug);
    const cosmeticCategory = String((cfg?.category as string) || cosmetic.category || '');
    const metadata = (cosmetic.metadata && typeof cosmetic.metadata === 'object')
      ? (cosmetic.metadata as Record<string, unknown>)
      : (cfg?.metadata ?? {});
    const slot = normalizeCosmeticSlot({ slug: cosmeticSlug, category: cosmeticCategory, metadata });
    const effect = resolveCosmeticEffect({ slug: cosmeticSlug, category: cosmeticCategory, metadata });
    if (slot === 'vote_effect' && !isSupportedVoteEffect(cosmeticSlug, effect.id)) {
      return NextResponse.json({ ok: false, error: 'Vote effect unavailable' }, { status: 400 });
    }
    const priceSigils = stablePriceSigils({
      slug: cosmeticSlug,
      category: cosmeticCategory,
      rarity: String(cosmetic.rarity || 'Common'),
      metadata,
      configuredPrice: cfg?.price_sigils ?? null,
    });
    const canPurchase = canPurchaseCosmetic({ slug: cosmeticSlug, category: cosmeticCategory, metadata });
    if (!canPurchase) {
      return NextResponse.json({ ok: false, error: 'Preview coming soon for this cosmetic' }, { status: 400 });
    }

    const sigils = progress?.sigils || 0;
    if (sigils < priceSigils) {
      return NextResponse.json({ ok: false, error: 'Not enough sigils', sigils }, { status: 400 });
    }

    const nextSigils = sigils - priceSigils;

    if (cosmeticCategory === 'xp_boost' || cosmeticCategory === 'xp') {
      const xpGain = Math.max(0, Number((metadata as { xp?: number } | null)?.xp || 0));
      const nextXp = (progress?.xp || 0) + xpGain;

      const { error: updateErr } = await sb
        .from('user_progress')
        .update({ sigils: nextSigils, xp: nextXp })
        .eq('user_id', userId);

      if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

      await sb.rpc('check_level_up', { p_user_id: userId });
      const { data: refreshed } = await sb.from('user_progress').select('xp, level, sigils').eq('user_id', userId).maybeSingle();
      const catXpBanked = await grantPendingCatXp(sb, userId, xpGain);

      return NextResponse.json({
        ok: true,
        purchase_type: 'xp_boost',
        slug: cosmeticSlug,
        xp_gained: xpGain,
        cat_xp_banked: catXpBanked,
        sigils: refreshed?.sigils || nextSigils,
        xp: refreshed?.xp || nextXp,
        level: refreshed?.level || progress?.level || 1,
      });
    }

    const { data: exists } = await sb
      .from('user_inventory')
      .select('cosmetic_id')
      .eq('user_id', userId)
      .eq('cosmetic_id', String(cosmetic.id))
      .maybeSingle();

    if (exists?.cosmetic_id) {
      return NextResponse.json({ ok: false, error: 'Already owned' }, { status: 409 });
    }

    const { error: deductErr } = await sb
      .from('user_progress')
      .update({ sigils: nextSigils })
      .eq('user_id', userId);
    if (deductErr) return NextResponse.json({ ok: false, error: deductErr.message }, { status: 500 });

    const { error: invErr } = await sb
      .from('user_inventory')
      .insert({ user_id: userId, cosmetic_id: String(cosmetic.id), source: 'shop' });

    if (invErr) {
      await sb.from('user_progress').update({ sigils }).eq('user_id', userId);
      return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });
    }

    const slots = slotCandidatesForCosmetic({ slug: cosmeticSlug, category: cosmeticCategory, metadata });
    let equippedSlot: string | null = null;
    if (slots.length > 0) {
      const eq = await setEquippedCosmetic(userId, slots, String(cosmetic.id));
      equippedSlot = eq.usedSlot || slots[0];
    }

    return NextResponse.json({ ok: true, purchase_type: 'cosmetic', slug: cosmeticSlug, sigils: nextSigils, equipped_slot: equippedSlot });
  } catch (e) {
    const msg = String(e || '');
    if (msg.includes('relation') && msg.includes('does not exist')) {
      return NextResponse.json({ ok: false, error: 'Shop tables missing. Run latest migrations.' }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
