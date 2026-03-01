import { createClient } from '@supabase/supabase-js';
import { resolveCatImageUrl } from '../../api/_lib/images';

export type PublicDuel = {
  id: string;
  status: 'pending' | 'voting' | 'declined' | 'completed' | 'canceled';
  created_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  challenger_username: string;
  challenged_username: string;
  challenger_guild: string | null;
  challenged_guild: string | null;
  challenger_cat: {
    id: string;
    name: string;
    image_url: string | null;
    rarity: string | null;
    wins: number;
    losses: number;
    special_ability_id: string | null;
  } | null;
  challenged_cat: {
    id: string;
    name: string;
    image_url: string | null;
    rarity: string | null;
    wins: number;
    losses: number;
    special_ability_id: string | null;
  } | null;
  winner_cat_id: string | null;
  votes: {
    cat_a: number;
    cat_b: number;
    total: number;
    pct_a: number;
    pct_b: number;
  };
  social_proof_text: string;
  pulse_number: number;
};

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function defaultUsername(id: string): string {
  return `Player ${String(id || '').slice(0, 8)}`;
}

function pulseFromDate(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(1, Math.floor(t / (1000 * 60 * 60)));
}

export async function getPublicDuel(duelId: string): Promise<PublicDuel | null> {
  const id = String(duelId || '').trim();
  if (!id) return null;

  const { data: duel } = await sb
    .from('duel_challenges')
    .select('id, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id, winner_cat_id, status, created_at, responded_at, resolved_at')
    .eq('id', id)
    .maybeSingle();
  if (!duel) return null;

  const userIds = [duel.challenger_user_id, duel.challenged_user_id].filter(Boolean);
  const catIds = [duel.challenger_cat_id, duel.challenged_cat_id].filter(Boolean);
  const [{ data: profiles }, { data: cats }, { data: votes }] = await Promise.all([
    sb.from('profiles').select('id, username, guild').in('id', userIds),
    sb.from('cats').select('id, name, image_path, rarity, wins, losses, special_ability_id').in('id', catIds),
    sb.from('duel_votes').select('voted_cat_id').eq('duel_id', id),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]));
  const catMap = Object.fromEntries(
    await Promise.all(
      (cats || []).map(async (c) => [
        String(c.id),
        {
          id: String(c.id),
          name: String(c.name || 'Unknown Cat'),
          image_url: await resolveCatImageUrl(sb, c.image_path),
          rarity: c.rarity || null,
          wins: Number(c.wins || 0),
          losses: Number(c.losses || 0),
          special_ability_id: c.special_ability_id || null,
        },
      ])
    )
  );

  let catA = 0;
  let catB = 0;
  for (const v of votes || []) {
    const picked = String(v.voted_cat_id || '');
    if (picked && picked === String(duel.challenger_cat_id || '')) catA += 1;
    if (picked && picked === String(duel.challenged_cat_id || '')) catB += 1;
  }
  const total = catA + catB;
  const pctA = total ? Math.round((catA / total) * 100) : 50;
  const pctB = total ? 100 - pctA : 50;

  const socialProofText = `${pctA}% picked ${catMap[String(duel.challenger_cat_id || '')]?.name || 'Cat A'}`;

  return {
    id: String(duel.id),
    status: String(duel.status || 'pending') as PublicDuel['status'],
    created_at: String(duel.created_at || ''),
    responded_at: duel.responded_at || null,
    resolved_at: duel.resolved_at || null,
    challenger_username: String(profileMap[String(duel.challenger_user_id || '')]?.username || defaultUsername(String(duel.challenger_user_id || ''))),
    challenged_username: String(profileMap[String(duel.challenged_user_id || '')]?.username || defaultUsername(String(duel.challenged_user_id || ''))),
    challenger_guild: profileMap[String(duel.challenger_user_id || '')]?.guild || null,
    challenged_guild: profileMap[String(duel.challenged_user_id || '')]?.guild || null,
    challenger_cat: catMap[String(duel.challenger_cat_id || '')] || null,
    challenged_cat: catMap[String(duel.challenged_cat_id || '')] || null,
    winner_cat_id: duel.winner_cat_id ? String(duel.winner_cat_id) : null,
    votes: {
      cat_a: catA,
      cat_b: catB,
      total,
      pct_a: pctA,
      pct_b: pctB,
    },
    social_proof_text: socialProofText,
    pulse_number: pulseFromDate(String(duel.created_at || '')),
  };
}

