import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\n/g, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/\n/g, '');

if (process.env.NODE_ENV === 'production') {
  console.error('resetFakeBattleData cannot run in production.');
  process.exit(1);
}

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isRealBattle(match) {
  const status = String(match.status || '').toLowerCase();
  const votesA = Number(match.votes_a || 0);
  const votesB = Number(match.votes_b || 0);
  return (status === 'complete' || status === 'completed') && !!match.winner_id && (votesA + votesB) > 0;
}

async function main() {
  const { error: deleteVotesError, count: deletedVotes } = await supabase
    .from('votes')
    .delete({ count: 'exact' })
    .eq('user_agent', 'seed-script');

  if (deleteVotesError) {
    throw new Error(`Failed deleting seed-script votes: ${deleteVotesError.message}`);
  }

  const { data: cats, error: catsError } = await supabase
    .from('cats')
    .select('id');
  if (catsError) {
    throw new Error(`Failed loading cats: ${catsError.message}`);
  }

  const { data: matches, error: matchesError } = await supabase
    .from('tournament_matches')
    .select('cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b');
  if (matchesError) {
    throw new Error(`Failed loading tournament matches: ${matchesError.message}`);
  }

  const statsByCatId = new Map();
  for (const cat of cats || []) {
    statsByCatId.set(cat.id, { wins: 0, losses: 0, battles_fought: 0 });
  }

  for (const match of matches || []) {
    if (!isRealBattle(match)) continue;
    const winnerId = String(match.winner_id);
    const loserId = winnerId === match.cat_a_id ? match.cat_b_id : match.cat_a_id;

    if (statsByCatId.has(winnerId)) {
      const next = statsByCatId.get(winnerId);
      next.wins += 1;
      next.battles_fought += 1;
    }
    if (loserId && statsByCatId.has(loserId)) {
      const next = statsByCatId.get(loserId);
      next.losses += 1;
      next.battles_fought += 1;
    }
  }

  for (const [catId, stats] of statsByCatId.entries()) {
    const { error: updateError } = await supabase
      .from('cats')
      .update(stats)
      .eq('id', catId);
    if (updateError) {
      throw new Error(`Failed updating cat ${catId}: ${updateError.message}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    deletedSeedVotes: deletedVotes || 0,
    catsRecomputed: statsByCatId.size,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
