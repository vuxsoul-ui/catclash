export type DuelVoteSummary = {
  cat_a: number;
  cat_b: number;
  total: number;
  user_vote_cat_id: string | null;
};

export type DuelCatLite = {
  id: string;
  name: string;
  image_url: string | null;
  ability?: string | null;
  special_ability_id?: string | null;
  rarity?: string | null;
  level?: number | null;
  stats?: { atk: number; def: number; spd: number; cha: number; chs: number } | null;
};

export type DuelCosmetics = {
  border_slug: string | null;
  title_slug: string | null;
  title_name: string | null;
  title_rarity: string | null;
  vote_effect_slug: string | null;
  badge_slug: string | null;
  badge_name: string | null;
} | null;

export type DuelRowData = {
  id: string;
  challenger_user_id: string;
  challenged_user_id: string;
  challenger_username: string;
  challenged_username: string;
  challenger_guild?: string | null;
  challenged_guild?: string | null;
  challenger_cat: DuelCatLite | null;
  challenged_cat: DuelCatLite | null;
  challenger_cosmetics?: DuelCosmetics;
  challenged_cosmetics?: DuelCosmetics;
  winner_cat?: DuelCatLite | null;
  winner_cat_id?: string | null;
  status?: 'pending' | 'voting' | 'declined' | 'completed' | 'canceled' | string;
  created_at?: string;
  votes?: DuelVoteSummary;
};

