import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateWinRate } from '../_lib/catStats';
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
const LOOKUP_BATCH_SIZE = 150;

type ApprovedCatRow = {
  id: string;
  name: string;
  image_path: string | null;
  rarity: string;
  user_id: string | null;
  wins: number | null;
  losses: number | null;
  battles_fought: number | null;
  prestige_weight?: number | null;
};

function normalizeUsername(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function isPlaceholderUsername(value: string | null | undefined): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  return PLACEHOLDER_USERNAME_PATTERNS.some((re) => re.test(v));
}

function pickDisplayUsername(userId: string, username: string | null | undefined, used: Set<string>): string {
  const current = String(username || '').trim();
  if (!isPlaceholderUsername(current)) {
    const lower = normalizeUsername(current);
    if (lower) used.add(lower);
    return current;
  }
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = pickXboxStyleUsername(userId, attempt);
    const lower = normalizeUsername(candidate);
    if (!used.has(lower)) {
      used.add(lower);
      return candidate;
    }
  }
  const fallback = `Player ${String(userId).slice(0, 8)}`;
  used.add(normalizeUsername(fallback));
  return fallback;
}

function chunkValues<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [
      { data: approvedCats, error: catsErr },
      { data: progressTop, error: progressErr },
    ] = await Promise.all([
      supabase
        .from('cats')
        .select('id, name, image_path, rarity, user_id, wins, losses, battles_fought, prestige_weight')
        .eq('status', 'approved')
        .limit(5000),
      supabase
        .from('user_progress')
        .select('user_id, xp, level, sigils')
        .order('level', { ascending: false })
        .order('xp', { ascending: false })
        .order('sigils', { ascending: false })
        .limit(500),
    ]);

    if (catsErr || progressErr) {
      const msg = catsErr?.message || progressErr?.message || 'Failed to load leaderboard';
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const catsList = (approvedCats || []) as ApprovedCatRow[];
    const topCats = catsList
      .map((cat) => {
        const battles = Math.max(0, Number(cat.battles_fought || 0));
        const wins = Math.max(0, Number(cat.wins || 0));
        const losses = Math.max(0, Number(cat.losses || 0));
        return {
          ...cat,
          wins,
          losses,
          battles_fought: battles,
        };
      })
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.battles_fought !== a.battles_fought) return b.battles_fought - a.battles_fought;
        return String(a.id).localeCompare(String(b.id));
      })
      .slice(0, 25);

    const progressMap = Object.fromEntries((progressTop || []).map((p) => [String(p.user_id), p]));
    const winsMap = catsList.reduce((acc, cat) => {
      const userId = String(cat.user_id || '');
      if (!userId) return acc;
      acc[userId] = (acc[userId] || 0) + Math.max(0, Number(cat.wins || 0));
      return acc;
    }, {} as Record<string, number>);

    const playerIds = Array.from(new Set([
      ...catsList.map((cat) => String(cat.user_id || '')).filter(Boolean),
      ...(progressTop || []).map((p) => String(p.user_id || '')).filter(Boolean),
    ]));

    let profiles: Array<{ id: string; username: string | null }> = [];
    let streaks: Array<{ user_id: string; current_streak: number | null }> = [];
    if (playerIds.length > 0) {
      const playerChunks = chunkValues(playerIds, LOOKUP_BATCH_SIZE);
      const [profileBatches, streakBatches] = await Promise.all([
        Promise.all(playerChunks.map((ids) => supabase.from('profiles').select('id, username').in('id', ids))),
        Promise.all(playerChunks.map((ids) => supabase.from('streaks').select('user_id, current_streak').in('user_id', ids))),
      ]);
      const profilesErr = profileBatches.find((batch) => batch.error)?.error;
      const streaksErr = streakBatches.find((batch) => batch.error)?.error;
      if (profilesErr || streaksErr) {
        return NextResponse.json({ ok: false, error: profilesErr?.message || streaksErr?.message || 'Failed to load leaderboard candidates' }, { status: 500 });
      }
      profiles = profileBatches.flatMap((batch) => (batch.data || []) as Array<{ id: string; username: string | null }>);
      streaks = streakBatches.flatMap((batch) => (batch.data || []) as Array<{ user_id: string; current_streak: number | null }>);
    }

    const usedNames = new Set<string>();
    const profileMap = Object.fromEntries(
      profiles.map((profile) => [
        String(profile.id),
        pickDisplayUsername(String(profile.id), profile.username, usedNames),
      ])
    );
    const streakMap = Object.fromEntries((streaks || []).map((s) => [String(s.user_id), Number(s.current_streak || 0)]));

    const catsWithUrls = await Promise.all(
      topCats.map(async (cat) => ({
        id: cat.id,
        name: cat.name,
        image_url: (await resolveCatImageUrl(supabase, cat.image_path)) || '',
        rarity: cat.rarity,
        wins: cat.wins,
        losses: cat.losses,
        battles_fought: cat.battles_fought,
        win_rate: calculateWinRate(cat.wins, cat.losses),
        user_id: cat.user_id || null,
      }))
    );

    const players = playerIds
      .map((id) => {
        const progress = progressMap[id] || {};
        return {
          id,
          username: profileMap[id] || `Player ${String(id).slice(0, 8)}`,
          level: Number(progress.level || 1),
          xp: Number(progress.xp || 0),
          sigils: Number(progress.sigils || 0),
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
