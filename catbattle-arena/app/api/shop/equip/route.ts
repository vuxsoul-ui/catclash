import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { getItemConfig } from '../_lib/catalog';
import { slotCandidatesForCosmetic } from '../_lib/normalize';

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

    const { data: cosmetic } = await sb
      .from('cosmetics')
      .select('id, slug, category')
      .eq('slug', slug)
      .maybeSingle();

    if (!cosmetic) return NextResponse.json({ ok: false, error: 'Cosmetic not found' }, { status: 404 });

    const cfg = getItemConfig(cosmetic.slug);
    const effectiveCategory = String((cfg?.category as string) || cosmetic.category || '');
    const slots = slotCandidatesForCosmetic({
      slug: cosmetic.slug,
      category: effectiveCategory,
      metadata: cfg?.metadata || null,
    });
    if (!slots.length) return NextResponse.json({ ok: false, error: 'This item cannot be equipped' }, { status: 400 });

    const { data: owned } = await sb
      .from('user_inventory')
      .select('cosmetic_id')
      .eq('user_id', userId)
      .eq('cosmetic_id', cosmetic.id)
      .maybeSingle();

    if (!owned) return NextResponse.json({ ok: false, error: 'Not owned' }, { status: 403 });

    const { error, usedSlot } = await setEquippedCosmetic(userId, slots, String(cosmetic.id));

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, slot: usedSlot || slots[0], slug: cosmetic.slug });
  } catch (e) {
    const msg = String(e || '');
    if (msg.includes('relation') && msg.includes('does not exist')) {
      return NextResponse.json({ ok: false, error: 'Shop tables missing. Run latest migrations.' }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
