import { NextRequest, NextResponse } from 'next/server';
import { requireGuestId } from '../../_lib/guest';
import { duelSb as sb } from '../_lib';
import { computePowerTieWinner, computeStatVoteSwing, type CombatProfile } from '../../_lib/combat-balance';

export const dynamic = 'force-dynamic';

function isMissingTable(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (m.includes('duel_votes') || m.includes('duel_challenges')) && (m.includes('does not exist') || m.includes('relation'));
}

const RESOLVE_TOTAL_THRESHOLD = 10;
const RESOLVE_DIFF_THRESHOLD = 2;
const FORCE_RESOLVE_TOTAL_THRESHOLD = 14;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const duelId = String(body?.duel_id || '').trim();
    const votedCatId = String(body?.voted_cat_id || '').trim();
    if (!duelId || !votedCatId) {
      return NextResponse.json({ ok: false, error: 'Missing duel_id or voted_cat_id' }, { status: 400 });
    }

    const { data: duel, error: duelErr } = await sb
      .from('duel_challenges')
      .select('id, status, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id, winner_cat_id')
      .eq('id', duelId)
      .maybeSingle();
    if (duelErr) {
      if (isMissingTable(duelErr.message)) {
        return NextResponse.json({ ok: false, error: 'Duel voting not enabled yet on this deployment' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: duelErr.message }, { status: 500 });
    }
    if (!duel) return NextResponse.json({ ok: false, error: 'Duel not found' }, { status: 404 });
    if (String(duel.status || '') !== 'voting') return NextResponse.json({ ok: false, error: 'Duel is not open for voting' }, { status: 400 });

    const catA = String(duel.challenger_cat_id || '');
    const catB = String(duel.challenged_cat_id || '');
    if (!catA || !catB) return NextResponse.json({ ok: false, error: 'Duel is missing cats' }, { status: 400 });
    if (votedCatId !== catA && votedCatId !== catB) {
      return NextResponse.json({ ok: false, error: 'Vote must target one of the duel cats' }, { status: 400 });
    }

    if (String(duel.challenger_user_id || '') === userId || String(duel.challenged_user_id || '') === userId) {
      return NextResponse.json({ ok: false, error: 'Participants cannot vote in their own duel' }, { status: 403 });
    }

    const { error: insErr } = await sb
      .from('duel_votes')
      .insert({ duel_id: duelId, voter_user_id: userId, voted_cat_id: votedCatId });
    if (insErr) {
      const msg = String(insErr.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return NextResponse.json({ ok: false, error: 'You already voted on this duel' }, { status: 409 });
      }
      if (isMissingTable(insErr.message)) {
        return NextResponse.json({ ok: false, error: 'Duel voting not enabled yet on this deployment' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    const { data: votes } = await sb
      .from('duel_votes')
      .select('voted_cat_id')
      .eq('duel_id', duelId);
    const aVotes = (votes || []).filter((v) => String(v.voted_cat_id || '') === catA).length;
    const bVotes = (votes || []).filter((v) => String(v.voted_cat_id || '') === catB).length;
    const totalVotes = aVotes + bVotes;
    let status = 'voting';
    let winnerCatId: string | null = null;

    if (totalVotes >= RESOLVE_TOTAL_THRESHOLD) {
      const { data: cats } = await sb
        .from('cats')
        .select('id, rarity, attack, defense, speed, charisma, chaos, cat_level, ability')
        .in('id', [catA, catB]);

      const combatById: Record<string, CombatProfile> = {};
      for (const c of (cats || []) as Array<Partial<CombatProfile> & { id: string }>) {
        combatById[c.id] = {
          id: c.id,
          rarity: c.rarity || null,
          attack: Number(c.attack || 0),
          defense: Number(c.defense || 0),
          speed: Number(c.speed || 0),
          charisma: Number(c.charisma || 0),
          chaos: Number(c.chaos || 0),
          cat_level: Number(c.cat_level || 1),
          ability: c.ability || null,
        };
      }

      const aCombat = combatById[catA];
      const bCombat = combatById[catB];
      const statSwing = aCombat && bCombat ? computeStatVoteSwing(aCombat, bCombat) : 0;
      const resolveDelta = (aVotes - bVotes) + statSwing;

      const resolveReady =
        Math.abs(aVotes - bVotes) >= RESOLVE_DIFF_THRESHOLD ||
        totalVotes >= FORCE_RESOLVE_TOTAL_THRESHOLD;

      if (resolveReady) {
        if (Math.abs(resolveDelta) <= 0.15 && aCombat && bCombat) {
          winnerCatId = computePowerTieWinner(aCombat, bCombat) === 'a' ? catA : catB;
        } else if (resolveDelta > 0) {
          winnerCatId = catA;
        } else if (resolveDelta < 0) {
          winnerCatId = catB;
        } else {
          winnerCatId = aVotes >= bVotes ? catA : catB;
        }

        status = 'completed';
        await sb
          .from('duel_challenges')
          .update({ winner_cat_id: winnerCatId, status: 'completed', resolved_at: new Date().toISOString() })
          .eq('id', duelId)
          .eq('status', 'voting');
      }
    }

    return NextResponse.json({
      ok: true,
      status,
      winner_cat_id: winnerCatId,
      votes: { cat_a: aVotes, cat_b: bVotes, total: totalVotes },
      resolved_threshold: {
        total: RESOLVE_TOTAL_THRESHOLD,
        diff: RESOLVE_DIFF_THRESHOLD,
        forced_total: FORCE_RESOLVE_TOTAL_THRESHOLD,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
