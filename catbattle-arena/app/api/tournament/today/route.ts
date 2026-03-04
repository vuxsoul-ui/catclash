// REPLACE: app/api/tournament/today/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";
import { isThumbUrl, thumbUrlForCat } from "../../_lib/images";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data?: { publicUrl?: string } };
    };
  };
};

function resolveImageUrl(
  supabase: StorageClient,
  catId: string | null | undefined,
  imagePath: string | null
): string | null {
  const id = String(catId || '').trim();
  if (id) return thumbUrlForCat(id);
  if (!imagePath) return null;
  if (isThumbUrl(imagePath)) return imagePath;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return null;
  return supabase.storage.from('cat-images').getPublicUrl(imagePath).data?.publicUrl || null;
}

type CatDTO = {
  id: string;
  name: string;
  image_path?: string | null;
  image_url?: string | null;
};

type MatchDTO = {
  match_id: string;
  cat_a_id?: string;
  cat_b_id?: string;
  cat_a: CatDTO;
  cat_b: CatDTO;
  status: string;
  votes_a: number;
  votes_b: number;
};

type TournamentDTO = {
  tournament_id: string;
  date: string;
  round: number;
  matches: MatchDTO[];
};

export async function GET() {
  try {
    const guestId = await getGuestId();

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.rpc("get_today_tournament");

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to get tournament: " + error.message },
        { status: 500 }
      );
    }

    // Normalize nested vs flat shape
    const inner: TournamentDTO | null =
      (data?.tournament as TournamentDTO | undefined) ??
      (data as TournamentDTO | null);

    const matches = inner?.matches ?? [];

    const matchIds = matches.map((m) => String(m.match_id || '')).filter(Boolean);
    const { data: battleRows } = matchIds.length > 0
      ? await supabase
        .from('tournament_matches')
        .select('id, cat_a_id, cat_b_id')
        .in('id', matchIds)
      : { data: [] as Array<{ id: string; cat_a_id: string | null; cat_b_id: string | null }> };
    const battleById = new Map<string, { cat_a_id: string | null; cat_b_id: string | null }>();
    for (const row of battleRows || []) {
      battleById.set(String(row.id), { cat_a_id: row.cat_a_id || null, cat_b_id: row.cat_b_id || null });
    }

    const voteCounts = new Map<string, { votes_a: number; votes_b: number }>();
    if (matchIds.length > 0) {
      const { data: voteRows } = await supabase
        .from('votes')
        .select('battle_id, voted_for')
        .in('battle_id', matchIds);
      for (const vote of voteRows || []) {
        const battleId = String(vote.battle_id || '');
        if (!battleId) continue;
        const refs = battleById.get(battleId);
        if (!refs?.cat_a_id || !refs?.cat_b_id) {
          console.warn('[tournament/today] missing cat ids for match', { battleId });
          voteCounts.set(battleId, voteCounts.get(battleId) || { votes_a: 0, votes_b: 0 });
          continue;
        }
        const tally = voteCounts.get(battleId) || { votes_a: 0, votes_b: 0 };
        if (String(vote.voted_for) === String(refs.cat_a_id)) tally.votes_a += 1;
        if (String(vote.voted_for) === String(refs.cat_b_id)) tally.votes_b += 1;
        voteCounts.set(battleId, tally);
      }
    }

    // Enrich with image URLs
    const enrichedMatches: MatchDTO[] = matches.map((match) => {
      const pathA = match.cat_a?.image_path ?? null;
      const pathB = match.cat_b?.image_path ?? null;

      const urlA = resolveImageUrl(supabase, match.cat_a?.id, pathA);
      const urlB = resolveImageUrl(supabase, match.cat_b?.id, pathB);
      const refs = battleById.get(String(match.match_id || ''));
      const tally = voteCounts.get(String(match.match_id || ''));
      const catAId = refs?.cat_a_id || match.cat_a?.id || null;
      const catBId = refs?.cat_b_id || match.cat_b?.id || null;

      return {
        ...match,
        cat_a_id: catAId || undefined,
        cat_b_id: catBId || undefined,
        cat_a: { ...match.cat_a, image_url: urlA ?? null },
        cat_b: { ...match.cat_b, image_url: urlB ?? null },
        votes_a: Number(tally?.votes_a ?? 0),
        votes_b: Number(tally?.votes_b ?? 0),
      };
    });

    // Get which matches this user already voted on
    const votedMatches: Record<string, string> = {};
    if (guestId && matchIds.length > 0) {
      const { data: votes } = await supabase
        .from("votes")
        .select("battle_id, voted_for")
        .eq("voter_user_id", guestId)
        .in("battle_id", matchIds);

      if (votes) {
        for (const v of votes) {
          votedMatches[v.battle_id] = v.voted_for;
        }
      }
    }

    const tournament: TournamentDTO | null = inner
      ? { ...inner, matches: enrichedMatches }
      : null;

    return NextResponse.json({
      success: true,
      guest_id: guestId,
      tournament,
      voted_matches: votedMatches,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
