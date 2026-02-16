// PLACE AT: app/api/tournament/champion/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Find yesterday's completed tournament
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, date')
      .eq('date', yesterdayStr)
      .eq('status', 'complete')
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ ok: true, champion: null });
    }

    // Find the final match (highest round) with a winner
    const { data: finalMatch, error: mErr } = await supabase
      .from('tournament_matches')
      .select('winner_id, round, votes_a, votes_b')
      .eq('tournament_id', tournament.id)
      .eq('status', 'complete')
      .not('winner_id', 'is', null)
      .order('round', { ascending: false })
      .limit(1)
      .single();

    if (mErr || !finalMatch || !finalMatch.winner_id) {
      return NextResponse.json({ ok: true, champion: null });
    }

    // Get champion cat details
    const { data: cat, error: cErr } = await supabase
      .from('cats')
      .select('id, name, image_path, rarity, ability, wins, battles_fought, attack, defense, speed, charisma, chaos')
      .eq('id', finalMatch.winner_id)
      .single();

    if (cErr || !cat) {
      return NextResponse.json({ ok: true, champion: null });
    }

    // Build image URL
    let image_url = '';
    if (cat.image_path) {
      const { data: urlData } = supabase.storage.from('cat-images').getPublicUrl(cat.image_path);
      image_url = urlData?.publicUrl || '';
    }

    return NextResponse.json({
      ok: true,
      champion: {
        id: cat.id,
        name: cat.name,
        image_url,
        rarity: cat.rarity,
        ability: cat.ability,
        wins: cat.wins || 0,
        battles_fought: cat.battles_fought || 0,
        stats: {
          attack: cat.attack || 0,
          defense: cat.defense || 0,
          speed: cat.speed || 0,
          charisma: cat.charisma || 0,
          chaos: cat.chaos || 0,
        },
        tournament_date: yesterdayStr,
      },
    });
  } catch (e) {
    console.error('[CHAMPION] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}