// PLACE AT: app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCatImageUrl } from '../_lib/images';
import { pickXboxStyleUsername } from '../_lib/xbox-usernames';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

const PLACEHOLDER_USERNAME_PATTERNS = [
  /^player\s+[0-9a-f]{8}$/i,
  /^guest[_\-\s]?[0-9a-z]+$/i,
  /^user[_\-\s]?[0-9a-z]+$/i,
  /^anon(ymous)?[_\-\s]?[0-9a-z]*$/i,
];

function normalizeUsername(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function isPlaceholderUsername(value: string | null | undefined): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  return PLACEHOLDER_USERNAME_PATTERNS.some((re) => re.test(v));
}

function pickUniqueXboxUsername(seed: string, used: Set<string>): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = pickXboxStyleUsername(seed, attempt);
    const lower = normalizeUsername(candidate);
    if (!used.has(lower)) {
      used.add(lower);
      return candidate;
    }
  }
  const fallback = `Arena${pickXboxStyleUsername(seed, 777)}`.replace(/[^a-zA-Z_]/g, '');
  const lower = normalizeUsername(fallback);
  used.add(lower);
  return fallback;
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [
      { data: allCats, error: catsErr },
      { data: progressTop, error: progressErr },
      { data: tournamentMatches, error: tmErr },
      { data: duelMatches, error: duelErr },
    ] = await Promise.all([
      supabase
        .from('cats')
        .select('id, name, image_path, rarity, user_id, status, origin, prestige_weight')
        .eq('status', 'approved')
        .limit(5000),
      supabase
        .from('user_progress')
        .select('user_id, xp, level, sigils')
        .order('level', { ascending: false })
        .order('xp', { ascending: false })
        .order('sigils', { ascending: false })
        .limit(500),
      supabase
        .from('tournament_matches')
        .select('winner_id, cat_a_id, cat_b_id, status')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(10000),
      supabase
        .from('duel_challenges')
        .select('winner_cat_id, challenger_cat_id, challenged_cat_id, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10000),
    ]);

    if (catsErr || progressErr || tmErr || duelErr) {
      const msg = catsErr?.message || progressErr?.message || tmErr?.message || duelErr?.message || 'Failed to load leaderboard';
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const catsList = (allCats || []) as Array<{
      id: string;
      name: string;
      image_path: string | null;
      rarity: string;
      user_id: string | null;
      status: string;
      origin?: string | null;
      prestige_weight?: number | null;
    }>;
    const catOwnerMap = Object.fromEntries(catsList.map((c) => [String(c.id), c]));
    const catWinsMap: Record<string, number> = {};
    const catBattlesMap: Record<string, number> = {};

    for (const m of (tournamentMatches || []) as Array<{ winner_id?: string | null; cat_a_id?: string | null; cat_b_id?: string | null }>) {
      const a = String(m.cat_a_id || '');
      const b = String(m.cat_b_id || '');
      const w = String(m.winner_id || '');
      if (a && catOwnerMap[a]) catBattlesMap[a] = (catBattlesMap[a] || 0) + 1;
      if (b && catOwnerMap[b]) catBattlesMap[b] = (catBattlesMap[b] || 0) + 1;
      if (w && catOwnerMap[w]) catWinsMap[w] = (catWinsMap[w] || 0) + 1;
    }
    for (const d of (duelMatches || []) as Array<{ winner_cat_id?: string | null; challenger_cat_id?: string | null; challenged_cat_id?: string | null }>) {
      const a = String(d.challenger_cat_id || '');
      const b = String(d.challenged_cat_id || '');
      const w = String(d.winner_cat_id || '');
      if (a && catOwnerMap[a]) catBattlesMap[a] = (catBattlesMap[a] || 0) + 1;
      if (b && catOwnerMap[b]) catBattlesMap[b] = (catBattlesMap[b] || 0) + 1;
      if (w && catOwnerMap[w]) catWinsMap[w] = (catWinsMap[w] || 0) + 1;
    }

    const topCats = catsList
      .map((cat) => ({
        ...cat,
        trusted_wins: Number(catWinsMap[cat.id] || 0),
        trusted_battles: Number(catBattlesMap[cat.id] || 0),
      }))
      .filter((cat) => cat.trusted_battles > 0)
      .sort((a, b) => {
        if (b.trusted_wins !== a.trusted_wins) return b.trusted_wins - a.trusted_wins;
        if (b.trusted_battles !== a.trusted_battles) return b.trusted_battles - a.trusted_battles;
        return String(a.id).localeCompare(String(b.id));
      })
      .slice(0, 25);

    const catsWithUrls = await Promise.all(topCats.map(async (cat) => {
      const image_url = (await resolveCatImageUrl(supabase, cat.image_path)) || '';
      const safeBattles = Math.max(0, Number(cat.trusted_battles || 0));
      const safeWins = Math.max(0, Math.min(Number(cat.trusted_wins || 0), safeBattles));
      const safeLosses = Math.max(0, safeBattles - safeWins);
      return {
        id: cat.id,
        name: cat.name,
        image_url,
        rarity: cat.rarity,
        wins: safeWins,
        losses: safeLosses,
        battles_fought: safeBattles,
        user_id: cat.user_id || null,
      };
    }));

    const winsMap = catsList.reduce((acc, row) => {
      const key = String(row.user_id || '');
      if (!key) return acc;
      const weight = Number(row.prestige_weight || 1);
      const safeWins = Math.max(0, Number(catWinsMap[row.id] || 0));
      acc[key] = (acc[key] || 0) + Math.round(safeWins * weight);
      return acc;
    }, {} as Record<string, number>);

    const progressMap = Object.fromEntries((progressTop || []).map((p) => [String(p.user_id), p]));
    const topWinUserIds = Object.entries(winsMap)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 500)
      .map(([id]) => id);
    const candidateIds = Array.from(new Set([
      ...(progressTop || []).map((p) => String(p.user_id || '')).filter(Boolean),
      ...topWinUserIds,
    ]));

    let profiles: Array<{ id: string; username: string | null }> = [];
    let streaks: Array<{ user_id: string; current_streak: number | null }> = [];
    if (candidateIds.length > 0) {
      const [{ data: pRows, error: profilesErr }, { data: sRows, error: streaksErr }] = await Promise.all([
        supabase.from('profiles').select('id, username').in('id', candidateIds),
        supabase.from('streaks').select('user_id, current_streak').in('user_id', candidateIds),
      ]);
      if (profilesErr || streaksErr) {
        return NextResponse.json({ ok: false, error: profilesErr?.message || streaksErr?.message || 'Failed to load leaderboard candidates' }, { status: 500 });
      }
      profiles = (pRows || []) as typeof profiles;
      streaks = (sRows || []) as typeof streaks;

      // Launch safety: normalize placeholder names into Xbox-style usernames for leaderboard clarity.
      const used = new Set<string>();
      for (const p of profiles) {
        const n = normalizeUsername(String(p.username || ''));
        if (n) used.add(n);
      }
      const profileMapRaw = Object.fromEntries((profiles || []).map((p) => [String(p.id), p])) as Record<string, { id: string; username: string | null }>;
      const profileUpdates: Array<{ id: string; username: string }> = [];
      for (const userId of candidateIds) {
        const row = profileMapRaw[userId];
        const current = row?.username || null;
        if (isPlaceholderUsername(current)) {
          const next = pickUniqueXboxUsername(userId, used);
          profileUpdates.push({ id: userId, username: next });
          if (row) row.username = next;
          else profileMapRaw[userId] = { id: userId, username: next };
        }
      }
      if (profileUpdates.length > 0) {
        await Promise.all(profileUpdates.map((u) =>
          supabase.from('profiles').update({ username: u.username }).eq('id', u.id)
        ));
      }
      profiles = Object.values(profileMapRaw);
    }
    const profileMap = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]));
    const streakMap = Object.fromEntries((streaks || []).map((s) => [String(s.user_id), Number(s.current_streak || 0)]));

    const players = candidateIds
      .map((id) => {
        const pr = progressMap[id] || {};
        const rawUsername = String(profileMap[id]?.username || '').trim();
        const fallback = `Player ${String(id).slice(0, 8)}`;
        const username = rawUsername || fallback;
        return {
          id,
          username,
          level: Number(pr.level || 1),
          xp: Number(pr.xp || 0),
          sigils: Number(pr.sigils || 0),
          current_streak: Number(streakMap[id] || 0),
          total_wins: Number(winsMap[id] || 0),
        };
      })
      .sort((a, b) => {
        if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
        if (b.xp !== a.xp) return b.xp - a.xp;
        if (b.level !== a.level) return b.level - a.level;
        return b.sigils - a.sigils;
      })
      .slice(0, 25);

    return NextResponse.json(
      { ok: true, cats: catsWithUrls, players },
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
