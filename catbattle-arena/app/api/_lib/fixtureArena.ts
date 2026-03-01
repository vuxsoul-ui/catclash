export type FixtureArenaType = "main" | "rookie";
export type FixtureArenaTab = "voting" | "results";

type FixtureCat = {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  ability: string | null;
  owner_username: string | null;
  owner_guild: "sun" | "moon" | null;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
};

type FixtureMatch = {
  match_id: string;
  status: string;
  votes_a: number;
  votes_b: number;
  winner_id: string | null;
  is_close_match: boolean;
  user_prediction: { predicted_cat_id: string; bet_sigils: number } | null;
  cat_a: FixtureCat;
  cat_b: FixtureCat;
};

export function isFixtureModeRequest(request?: Request): boolean {
  if (process.env.FIXTURE_MODE === "1" || process.env.NEXT_PUBLIC_FIXTURE_MODE === "1") return true;
  if (!request) return false;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("fixture") === "1") return true;
  } catch {
    // ignore
  }
  return request.headers.get("x-fixture-mode") === "1";
}

function fixtureCat(base: {
  id: string;
  name: string;
  rarity: string;
  guild: "sun" | "moon" | null;
  owner: string;
  image: string;
  stats: [number, number, number, number, number];
  ability?: string;
}): FixtureCat {
  return {
    id: base.id,
    name: base.name,
    image_url: base.image,
    rarity: base.rarity,
    ability: base.ability || null,
    owner_username: base.owner,
    owner_guild: base.guild,
    stats: {
      attack: base.stats[0],
      defense: base.stats[1],
      speed: base.stats[2],
      charisma: base.stats[3],
      chaos: base.stats[4],
    },
  };
}

function fixturePool(arena: FixtureArenaType) {
  const prefix = arena === "main" ? "fxm" : "fxr";
  return [
    fixtureCat({ id: `${prefix}-1`, name: arena === "main" ? "Furboss" : "Rookiebyte", rarity: "Common", guild: "moon", owner: "vuxsal", image: "/cat-placeholder.svg", stats: [14, 12, 11, 10, 8], ability: "Solar Blink" }),
    fixtureCat({ id: `${prefix}-2`, name: arena === "main" ? "Couchraider" : "Napquill", rarity: "Rare", guild: "sun", owner: "kais", image: "/cat-placeholder.svg", stats: [13, 14, 9, 11, 8], ability: "Moon Guard" }),
    fixtureCat({ id: `${prefix}-3`, name: arena === "main" ? "Whiskerverse" : "Mrrpflash", rarity: "Epic", guild: "sun", owner: "lute", image: "/cat-placeholder.svg", stats: [17, 13, 12, 15, 10], ability: "Chaos Tail" }),
    fixtureCat({ id: `${prefix}-4`, name: arena === "main" ? "Grumpynimbus" : "Tempox", rarity: "Legendary", guild: "moon", owner: "miso", image: "/cat-placeholder.svg", stats: [16, 15, 13, 11, 12], ability: "Volt Pounce" }),
    fixtureCat({ id: `${prefix}-5`, name: arena === "main" ? "Zephyrtail" : "Sparkmitt", rarity: "Common", guild: null, owner: "nova", image: "/cat-placeholder.svg", stats: [11, 10, 14, 9, 9] }),
    fixtureCat({ id: `${prefix}-6`, name: arena === "main" ? "Whiskerbyte" : "Crumbshot", rarity: "Rare", guild: "sun", owner: "ivy", image: "/cat-placeholder.svg", stats: [12, 11, 13, 10, 10] }),
    fixtureCat({ id: `${prefix}-7`, name: arena === "main" ? "Snaccattack" : "Driftpaw", rarity: "Epic", guild: "moon", owner: "hex", image: "/cat-placeholder.svg", stats: [15, 12, 12, 13, 11] }),
    fixtureCat({ id: `${prefix}-8`, name: arena === "main" ? "Tempo" : "Cloudpuff", rarity: "Common", guild: null, owner: "zen", image: "/cat-placeholder.svg", stats: [10, 11, 12, 9, 8] }),
  ];
}

function buildFixtureMatches(arena: FixtureArenaType, tab: FixtureArenaTab): FixtureMatch[] {
  const pool = fixturePool(arena);
  const pairings: Array<[number, number]> = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
  ];
  return pairings.map(([aIdx, bIdx], i) => {
    const a = pool[aIdx];
    const b = pool[bIdx];
    const votesA = 18 + i * 3;
    const votesB = 16 + ((i + 1) % 3) * 4;
    const status = tab === "results" ? "complete" : "active";
    const winner = tab === "results" ? (votesA >= votesB ? a.id : b.id) : null;
    return {
      match_id: `${arena}-${tab}-fixture-${i + 1}`,
      status,
      votes_a: votesA,
      votes_b: votesB,
      winner_id: winner,
      is_close_match: Math.abs(votesA - votesB) <= 2,
      user_prediction: null,
      cat_a: a,
      cat_b: b,
    };
  });
}

export function fixtureArenaPage(arena: FixtureArenaType, tab: FixtureArenaTab, pageIndex = 0) {
  const matches = buildFixtureMatches(arena, tab);
  return {
    dayKey: new Date().toISOString().slice(0, 10),
    arena,
    tab,
    pageIndex: 0,
    pageSize: 16,
    totalMatches: matches.length,
    totalPages: 1,
    matches,
    matchIds: matches.map((m) => m.match_id),
    activeVoters10m: 42 + (arena === "main" ? 11 : 5),
  };
}

export function fixtureActiveArenas() {
  const mainVoting = buildFixtureMatches("main", "voting");
  const rookieVoting = buildFixtureMatches("rookie", "voting");
  return {
    ok: true,
    arenas: [
      {
        tournament_id: "fixture-main-tournament",
        type: "main",
        date: new Date().toISOString().slice(0, 10),
        current_round: 1,
        status: "active",
        champion: null,
        rounds: [{ round: 1, matches: mainVoting }],
      },
      {
        tournament_id: "fixture-rookie-tournament",
        type: "rookie",
        date: new Date().toISOString().slice(0, 10),
        current_round: 1,
        status: "active",
        champion: null,
        rounds: [{ round: 1, matches: rookieVoting }],
      },
    ],
    voted_matches: {},
    prediction_meta: {
      current_streak: 1,
      best_streak: 3,
      bonus_rolls: 0,
      streak_bonus_pct: 5,
    },
  };
}
