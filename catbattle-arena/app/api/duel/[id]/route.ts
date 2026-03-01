import { NextRequest, NextResponse } from 'next/server';
import { getGuestId } from '../../_lib/guest';
import { duelSb as sb } from '../_lib';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const { id } = await context.params;
    const duelId = String(id || '').trim();
    if (!duelId) return NextResponse.json({ ok: false, error: 'Missing duel id' }, { status: 400 });

    const { data: duel, error } = await sb
      .from('duel_challenges')
      .select('id, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id, winner_cat_id, status, created_at, responded_at, resolved_at')
      .eq('id', duelId)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!duel) return NextResponse.json({ ok: false, error: 'Duel not found' }, { status: 404 });

    const userIds = [duel.challenger_user_id, duel.challenged_user_id].filter(Boolean);
    const catIds = [duel.challenger_cat_id, duel.challenged_cat_id, duel.winner_cat_id].filter(Boolean);
    const [{ data: profiles }, { data: cats }, { data: votes }] = await Promise.all([
      sb.from('profiles').select('id, username, guild').in('id', userIds),
      sb
        .from('cats')
        .select('id, name, image_path, ability, special_ability_id, rarity, cat_level, attack, defense, speed, charisma, chaos')
        .in('id', catIds),
      sb.from('duel_votes').select('voted_cat_id, voter_user_id').eq('duel_id', duelId),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const catMap = Object.fromEntries(
      await Promise.all(
        (cats || []).map(async (c) => [
          c.id,
          {
            id: c.id,
            name: c.name,
            image_url: await resolveCatImageUrl(sb, c.image_path),
            ability: c.ability || null,
            special_ability_id: c.special_ability_id || null,
            rarity: c.rarity || null,
            level: Number(c.cat_level || 1),
            stats: {
              atk: Number(c.attack || 0),
              def: Number(c.defense || 0),
              spd: Number(c.speed || 0),
              cha: Number(c.charisma || 0),
              chs: Number(c.chaos || 0),
            },
          },
        ])
      )
    );

    let votesA = 0;
    let votesB = 0;
    let myVote: string | null = null;
    for (const v of votes || []) {
      if (String(v.voted_cat_id || '') === String(duel.challenger_cat_id || '')) votesA += 1;
      if (String(v.voted_cat_id || '') === String(duel.challenged_cat_id || '')) votesB += 1;
      if (String(v.voter_user_id || '') === userId) myVote = String(v.voted_cat_id || '');
    }

    return NextResponse.json({
      ok: true,
      duel: {
        id: duel.id,
        status: duel.status,
        created_at: duel.created_at,
        responded_at: duel.responded_at,
        resolved_at: duel.resolved_at,
        challenger_user_id: duel.challenger_user_id,
        challenged_user_id: duel.challenged_user_id,
        challenger_username: String(profileMap[duel.challenger_user_id]?.username || `Player ${String(duel.challenger_user_id).slice(0, 8)}`),
        challenged_username: String(profileMap[duel.challenged_user_id]?.username || `Player ${String(duel.challenged_user_id).slice(0, 8)}`),
        challenger_guild: profileMap[duel.challenger_user_id]?.guild || null,
        challenged_guild: profileMap[duel.challenged_user_id]?.guild || null,
        challenger_cat: duel.challenger_cat_id ? (catMap[duel.challenger_cat_id] || null) : null,
        challenged_cat: duel.challenged_cat_id ? (catMap[duel.challenged_cat_id] || null) : null,
        winner_cat: duel.winner_cat_id ? (catMap[duel.winner_cat_id] || null) : null,
        votes: { cat_a: votesA, cat_b: votesB, total: votesA + votesB, user_vote_cat_id: myVote },
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
