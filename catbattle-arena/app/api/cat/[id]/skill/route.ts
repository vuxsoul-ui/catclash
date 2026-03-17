import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../../_lib/guest';
import { computePulseWindow } from '../../../_lib/pulse';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireGuestId();
    const { id: catId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const skillId = String(body?.skill_id || '').trim();

    if (!catId) {
      return NextResponse.json({ ok: false, error: 'Missing cat id' }, { status: 400 });
    }

    if (!skillId) {
      return NextResponse.json({ ok: false, error: 'Missing skill id' }, { status: 400 });
    }

    const pulse = await computePulseWindow(new Date());
    if (pulse.isLocked) {
      return Response.json(
        { error: 'pulse_locked', message: 'Skills are locked until Pulse resolves' },
        { status: 403 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: cat, error: catErr }, { data: skill, error: skillErr }, { data: existingRows, error: existingErr }] = await Promise.all([
      supabase.from('cats').select('id, user_id').eq('id', catId).maybeSingle(),
      supabase.from('skills').select('id, name, description, trigger, trigger_value, delta, is_counter, counter_to').eq('id', skillId).maybeSingle(),
      supabase
        .from('cat_skills')
        .select('id, locked')
        .eq('cat_id', catId)
        .order('equipped_at', { ascending: false }),
    ]);

    if (catErr || !cat) {
      return NextResponse.json({ ok: false, error: catErr?.message || 'Cat not found' }, { status: 404 });
    }
    if (cat.user_id !== userId) {
      return NextResponse.json({ ok: false, error: 'You can only equip skills on your own cat' }, { status: 403 });
    }
    if (skillErr || !skill) {
      return NextResponse.json({ ok: false, error: skillErr?.message || 'Skill not found' }, { status: 404 });
    }
    if (existingErr) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
    }

    const hasLockedRow = (existingRows || []).some((row) => !!row.locked);
    if (hasLockedRow) {
      return Response.json(
        { error: 'pulse_locked', message: 'Skills are locked until Pulse resolves' },
        { status: 403 }
      );
    }

    const { error: deleteErr } = await supabase.from('cat_skills').delete().eq('cat_id', catId).eq('locked', false);
    if (deleteErr) {
      return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from('cat_skills')
      .insert({
        cat_id: catId,
        skill_id: skillId,
        equipped_at: now,
        locked: false,
      })
      .select('id, cat_id, skill_id, equipped_at, locked')
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json({ ok: false, error: insertErr?.message || 'Failed to equip skill' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      equipped_skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description || null,
        trigger: skill.trigger,
        trigger_value: skill.trigger_value,
        delta: Number(skill.delta || 0),
        is_counter: !!skill.is_counter,
        counter_to: skill.counter_to || null,
      },
      equipped_at: inserted.equipped_at,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unauthorized' }, { status: 401 });
  }
}
