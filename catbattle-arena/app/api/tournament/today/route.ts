import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

function errToString(err: unknown) {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export async function GET() {
  try {
    const guestId = getGuestId();

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // get_today_tournament currently returns a nested shape from your SQL:
    // { success: true, tournament: { date, round, matches, tournament_id } }
    const { data, error } = await supabase.rpc("get_today_tournament");

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to get tournament: " + error.message },
        { status: 500 }
      );
    }

    // Normalize to the inner tournament object, whether it's nested or not
    const inner: TournamentDTO | null =
      (data?.tournament as TournamentDTO | undefined) ??
      (data as TournamentDTO | null);

    const matches = inner?.matches ?? [];

    // Enrich matches with image URLs (so frontend can just use match.cat_a.image_url)
    const enrichedMatches: MatchDTO[] = await Promise.all(
      matches.map(async (match) => {
        const pathA = match.cat_a?.image_path ?? null;
        const pathB = match.cat_b?.image_path ?? null;

        const urlA = pathA
          ? supabase.storage.from("cat-images").getPublicUrl(pathA).data?.publicUrl
          : null;

        const urlB = pathB
          ? supabase.storage.from("cat-images").getPublicUrl(pathB).data?.publicUrl
          : null;

        return {
          ...match,
          cat_a: { ...match.cat_a, image_url: urlA ?? null },
          cat_b: { ...match.cat_b, image_url: urlB ?? null },
        };
      })
    );

    const tournament: TournamentDTO | null = inner
      ? { ...inner, matches: enrichedMatches }
      : null;

    return NextResponse.json({
      success: true,
      guest_id: guestId,
      tournament,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: "Server error", details: errToString(e) },
      { status: 500 }
    );
  }
}
