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

    // Enrich with image URLs
    const enrichedMatches: MatchDTO[] = matches.map((match) => {
      const pathA = match.cat_a?.image_path ?? null;
      const pathB = match.cat_b?.image_path ?? null;

      const urlA = resolveImageUrl(supabase, match.cat_a?.id, pathA);
      const urlB = resolveImageUrl(supabase, match.cat_b?.id, pathB);

      return {
        ...match,
        cat_a: { ...match.cat_a, image_url: urlA ?? null },
        cat_b: { ...match.cat_b, image_url: urlB ?? null },
      };
    });

    // Get which matches this user already voted on
    const matchIds = enrichedMatches.map(m => m.match_id);
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
