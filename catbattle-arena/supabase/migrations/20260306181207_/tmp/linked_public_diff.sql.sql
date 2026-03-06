drop policy "Users can view own cats" on "public"."cats";

drop policy "Users can view own progress" on "public"."user_progress";

revoke delete on table "public"."user_arena_progress" from "anon";

revoke insert on table "public"."user_arena_progress" from "anon";

revoke references on table "public"."user_arena_progress" from "anon";

revoke select on table "public"."user_arena_progress" from "anon";

revoke trigger on table "public"."user_arena_progress" from "anon";

revoke truncate on table "public"."user_arena_progress" from "anon";

revoke update on table "public"."user_arena_progress" from "anon";

revoke delete on table "public"."user_arena_progress" from "authenticated";

revoke insert on table "public"."user_arena_progress" from "authenticated";

revoke references on table "public"."user_arena_progress" from "authenticated";

revoke select on table "public"."user_arena_progress" from "authenticated";

revoke trigger on table "public"."user_arena_progress" from "authenticated";

revoke truncate on table "public"."user_arena_progress" from "authenticated";

revoke update on table "public"."user_arena_progress" from "authenticated";

revoke delete on table "public"."user_arena_progress" from "service_role";

revoke insert on table "public"."user_arena_progress" from "service_role";

revoke references on table "public"."user_arena_progress" from "service_role";

revoke select on table "public"."user_arena_progress" from "service_role";

revoke trigger on table "public"."user_arena_progress" from "service_role";

revoke truncate on table "public"."user_arena_progress" from "service_role";

revoke update on table "public"."user_arena_progress" from "service_role";

alter table "public"."cosmetics" drop constraint "cosmetics_price_sigils_check";

alter table "public"."equipped_cosmetics" drop constraint "equipped_cosmetics_user_id_fkey";

alter table "public"."tournaments" drop constraint "tournaments_date_key";

alter table "public"."user_arena_progress" drop constraint "user_arena_progress_arena_check";

alter table "public"."user_arena_progress" drop constraint "user_arena_progress_user_id_arena_day_key_key";

alter table "public"."user_inventory" drop constraint "user_inventory_user_id_fkey";

alter table "public"."user_progress" drop constraint "user_progress_user_id_fkey";

alter table "public"."cosmetics" drop constraint "cosmetics_category_check";

alter table "public"."equipped_cosmetics" drop constraint "equipped_cosmetics_cat_id_fkey";

alter table "public"."equipped_cosmetics" drop constraint "equipped_cosmetics_cosmetic_id_fkey";

alter table "public"."user_inventory" drop constraint "user_inventory_cosmetic_id_fkey";

alter table "public"."votes" drop constraint "votes_battle_id_fkey";

alter table "public"."user_arena_progress" drop constraint "user_arena_progress_pkey";

alter table "public"."equipped_cosmetics" drop constraint "equipped_cosmetics_pkey";

alter table "public"."user_inventory" drop constraint "user_inventory_pkey";

drop index if exists "public"."cosmetics_active_idx";

drop index if exists "public"."idx_user_arena_progress_user_day";

drop index if exists "public"."tournaments_date_key";

drop index if exists "public"."user_arena_progress_pkey";

drop index if exists "public"."user_arena_progress_user_id_arena_day_key_key";

drop index if exists "public"."user_inventory_user_idx";

drop index if exists "public"."equipped_cosmetics_pkey";

drop index if exists "public"."user_inventory_pkey";

drop table "public"."user_arena_progress";


  create table "public"."crate_opens" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "crate_type" text default 'daily'::text,
    "rarity_roll" text not null,
    "reward_type" text not null,
    "reward_value" integer,
    "cosmetic_id" uuid,
    "opened_at" timestamp with time zone default now()
      );


alter table "public"."crate_opens" enable row level security;

alter table "public"."app_telemetry" alter column "id" set default public.uuid_generate_v4();

alter table "public"."arena_events" alter column "id" set default public.uuid_generate_v4();

alter table "public"."arena_match_queue" alter column "id" set default public.uuid_generate_v4();

alter table "public"."arena_matches" alter column "id" set default public.uuid_generate_v4();

alter table "public"."arena_snapshots" alter column "id" set default public.uuid_generate_v4();

alter table "public"."cat_forge_history" alter column "id" set default public.uuid_generate_v4();

alter table "public"."cats" add column "battles_fought" integer default 0;

alter table "public"."cats" add column "description" text;

alter table "public"."cats" add column "evolution" text;

alter table "public"."cats" add column "level" integer default 1;

alter table "public"."cats" add column "losses" integer default 0;

alter table "public"."cats" add column "power" integer default 20;

alter table "public"."cats" add column "stats" jsonb default jsonb_build_object('attack', 5, 'defense', 5, 'speed', 5, 'chaos', 5);

alter table "public"."cats" add column "wins" integer default 0;

alter table "public"."cats" add column "xp" integer default 0;

alter table "public"."cats" alter column "attack" set default 0;

alter table "public"."cats" alter column "chaos" set default 0;

alter table "public"."cats" alter column "charisma" set default 0;

alter table "public"."cats" alter column "defense" set default 0;

alter table "public"."cats" alter column "speed" set default 0;

alter table "public"."cosmetics" drop column "active";

alter table "public"."cosmetics" drop column "metadata";

alter table "public"."cosmetics" drop column "price_sigils";

alter table "public"."cosmetics" add column "preview" text;

alter table "public"."cosmetics" alter column "created_at" drop not null;

alter table "public"."crate_cat_drops" alter column "id" set default public.uuid_generate_v4();

alter table "public"."crate_openings" alter column "id" set default public.uuid_generate_v4();

alter table "public"."duel_challenges" alter column "id" set default public.uuid_generate_v4();

alter table "public"."duel_votes" alter column "id" set default public.uuid_generate_v4();

alter table "public"."equipped_cosmetics" add column "id" uuid not null default gen_random_uuid();

alter table "public"."equipped_cosmetics" alter column "equipped_at" drop not null;

alter table "public"."match_predictions" alter column "id" set default public.uuid_generate_v4();

alter table "public"."match_tactics" alter column "id" set default public.uuid_generate_v4();

alter table "public"."referral_edges_daily" alter column "id" set default public.uuid_generate_v4();

alter table "public"."referral_events" alter column "id" set default public.uuid_generate_v4();

alter table "public"."share_cards" alter column "id" set default public.uuid_generate_v4();

alter table "public"."social_feed_events" alter column "id" set default public.uuid_generate_v4();

alter table "public"."social_referrals" alter column "id" set default public.uuid_generate_v4();

alter table "public"."tournament_comments" alter column "id" set default public.uuid_generate_v4();

alter table "public"."tournament_entries" alter column "id" set default gen_random_uuid();

alter table "public"."tournament_entries" alter column "user_id" drop not null;

alter table "public"."tournament_matches" alter column "id" set default gen_random_uuid();

alter table "public"."tournaments" add column "champion_id" uuid;

alter table "public"."tournaments" add column "tournament_type" text default 'main'::text;

alter table "public"."tournaments" alter column "id" set default gen_random_uuid();

alter table "public"."user_inventory" add column "id" uuid not null default gen_random_uuid();

alter table "public"."user_inventory" alter column "acquired_at" drop not null;

alter table "public"."user_inventory" alter column "source" set default 'crate'::text;

alter table "public"."user_inventory" alter column "source" drop not null;

alter table "public"."user_progress" add column "sigils" integer not null default 0;

alter table "public"."whisker_telemetry" alter column "id" set default public.uuid_generate_v4();

CREATE UNIQUE INDEX crate_opens_pkey ON public.crate_opens USING btree (id);

CREATE UNIQUE INDEX equipped_cosmetics_user_id_cat_id_slot_key ON public.equipped_cosmetics USING btree (user_id, cat_id, slot);

CREATE INDEX idx_tournaments_date_type ON public.tournaments USING btree (date, tournament_type);

CREATE UNIQUE INDEX tournaments_date_type_key ON public.tournaments USING btree (date, tournament_type);

CREATE UNIQUE INDEX user_inventory_user_id_cosmetic_id_key ON public.user_inventory USING btree (user_id, cosmetic_id);

CREATE UNIQUE INDEX equipped_cosmetics_pkey ON public.equipped_cosmetics USING btree (id);

CREATE UNIQUE INDEX user_inventory_pkey ON public.user_inventory USING btree (id);

alter table "public"."crate_opens" add constraint "crate_opens_pkey" PRIMARY KEY using index "crate_opens_pkey";

alter table "public"."equipped_cosmetics" add constraint "equipped_cosmetics_pkey" PRIMARY KEY using index "equipped_cosmetics_pkey";

alter table "public"."user_inventory" add constraint "user_inventory_pkey" PRIMARY KEY using index "user_inventory_pkey";

alter table "public"."cosmetics" add constraint "cosmetics_rarity_check" CHECK ((rarity = ANY (ARRAY['Common'::text, 'Rare'::text, 'Epic'::text, 'Legendary'::text]))) not valid;

alter table "public"."cosmetics" validate constraint "cosmetics_rarity_check";

alter table "public"."crate_opens" add constraint "crate_opens_cosmetic_id_fkey" FOREIGN KEY (cosmetic_id) REFERENCES public.cosmetics(id) not valid;

alter table "public"."crate_opens" validate constraint "crate_opens_cosmetic_id_fkey";

alter table "public"."equipped_cosmetics" add constraint "equipped_cosmetics_user_id_cat_id_slot_key" UNIQUE using index "equipped_cosmetics_user_id_cat_id_slot_key";

alter table "public"."tournaments" add constraint "tournaments_champion_id_fkey" FOREIGN KEY (champion_id) REFERENCES public.cats(id) not valid;

alter table "public"."tournaments" validate constraint "tournaments_champion_id_fkey";

alter table "public"."tournaments" add constraint "tournaments_date_type_key" UNIQUE using index "tournaments_date_type_key";

alter table "public"."user_inventory" add constraint "user_inventory_user_id_cosmetic_id_key" UNIQUE using index "user_inventory_user_id_cosmetic_id_key";

alter table "public"."cosmetics" add constraint "cosmetics_category_check" CHECK ((category = ANY (ARRAY['cat_title'::text, 'cat_border'::text, 'voter_badge'::text, 'vote_effect'::text]))) not valid;

alter table "public"."cosmetics" validate constraint "cosmetics_category_check";

alter table "public"."equipped_cosmetics" add constraint "equipped_cosmetics_cat_id_fkey" FOREIGN KEY (cat_id) REFERENCES public.cats(id) not valid;

alter table "public"."equipped_cosmetics" validate constraint "equipped_cosmetics_cat_id_fkey";

alter table "public"."equipped_cosmetics" add constraint "equipped_cosmetics_cosmetic_id_fkey" FOREIGN KEY (cosmetic_id) REFERENCES public.cosmetics(id) not valid;

alter table "public"."equipped_cosmetics" validate constraint "equipped_cosmetics_cosmetic_id_fkey";

alter table "public"."user_inventory" add constraint "user_inventory_cosmetic_id_fkey" FOREIGN KEY (cosmetic_id) REFERENCES public.cosmetics(id) not valid;

alter table "public"."user_inventory" validate constraint "user_inventory_cosmetic_id_fkey";

alter table "public"."votes" add constraint "votes_battle_id_fkey" FOREIGN KEY (battle_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE not valid;

alter table "public"."votes" validate constraint "votes_battle_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.award_battle_xp(p_winner_id uuid, p_loser_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_winner RECORD;
  v_loser RECORD;
BEGIN
  SELECT cat_level, cat_xp INTO v_winner FROM cats WHERE id = p_winner_id;
  UPDATE cats SET cat_xp = COALESCE(cat_xp, 0) + 25 + (COALESCE(v_winner.cat_level, 1) * 2) WHERE id = p_winner_id;
  UPDATE cats SET cat_xp = COALESCE(cat_xp, 0) + 10 WHERE id = p_loser_id;
  SELECT cat_level, cat_xp INTO v_winner FROM cats WHERE id = p_winner_id;
  IF v_winner.cat_xp >= v_winner.cat_level * 100 THEN
    PERFORM level_up_cat(p_winner_id);
  END IF;
  SELECT cat_level, cat_xp INTO v_loser FROM cats WHERE id = p_loser_id;
  IF v_loser.cat_xp >= v_loser.cat_level * 100 THEN
    PERFORM level_up_cat(p_loser_id);
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calc_battle_power(p_cat_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_cat RECORD;
  v_base INT;
  v_level_bonus INT;
  v_rarity_bonus INT;
  v_chaos_roll INT;
BEGIN
  SELECT * INTO v_cat FROM cats WHERE id = p_cat_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_base := (
    COALESCE(v_cat.attack, 0) * 12 +
    COALESCE(v_cat.defense, 0) * 10 +
    COALESCE(v_cat.speed, 0) * 11 +
    COALESCE(v_cat.charisma, 0) * 8 +
    COALESCE(v_cat.chaos, 0) * 5
  ) / 10;
  v_level_bonus := COALESCE(v_cat.cat_level, v_cat.level, 1) * 3;
  CASE v_cat.rarity
    WHEN 'Common'    THEN v_rarity_bonus := 0;
    WHEN 'Rare'      THEN v_rarity_bonus := 10;
    WHEN 'Epic'      THEN v_rarity_bonus := 25;
    WHEN 'Legendary' THEN v_rarity_bonus := 45;
    WHEN 'Mythic'    THEN v_rarity_bonus := 70;
    WHEN 'God-Tier'  THEN v_rarity_bonus := 100;
    ELSE v_rarity_bonus := 0;
  END CASE;
  v_chaos_roll := floor(random() * greatest(COALESCE(v_cat.chaos, 0) / 5, 1));
  RETURN v_base + v_level_bonus + v_rarity_bonus + v_chaos_roll;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cast_vote(p_match_id uuid, p_voter_user_id uuid, p_voted_for uuid, p_ip_hash text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_match record;
  v_rate_key text;
  v_rl record;
  v_limit int := 20; -- max votes per window
  v_window_seconds int := 60; -- window length in seconds
  v_count_before int;
  v_exists boolean;
  v_votes_a int;
  v_votes_b int;
begin
  -- Lock the match row to avoid race conditions
  select * into v_match
  from tournament_matches
  where id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'match_not_found');
  end if;

  if (v_match.status is null) then
    return jsonb_build_object('ok', false, 'error', 'match_has_no_status');
  end if;

  if v_match.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'match_already_completed');
  end if;

  -- ensure voted_for is one of the contestants
  if not (p_voted_for = v_match.cat_a_id OR p_voted_for = v_match.cat_b_id) then
    return jsonb_build_object('ok', false, 'error', 'invalid_candidate');
  end if;

  -- Decide rate limit key: prefer user id if present, else IP hash
  if p_voter_user_id is not null then
    v_rate_key := 'vote:user:' || p_voter_user_id::text;
  else
    if p_ip_hash is null then
      return jsonb_build_object('ok', false, 'error', 'no_identifier_for_rate_limit');
    end if;
    v_rate_key := 'vote:ip:' || p_ip_hash;
  end if;

  -- Rate limit record (row-level locking)
  SELECT * INTO v_rl FROM rate_limits WHERE key = v_rate_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO rate_limits(key, count, window_start, updated_at)
    VALUES (v_rate_key, 0, v_now, now())
    RETURNING * INTO v_rl;
  END IF;

  -- reset window if expired
  IF v_now - v_rl.window_start > (v_window_seconds || ' seconds')::interval THEN
    UPDATE rate_limits SET count = 0, window_start = v_now, updated_at = now() WHERE key = v_rate_key;
    v_rl.count := 0;
    v_rl.window_start := v_now;
  END IF;

  v_count_before := coalesce(v_rl.count,0);

  IF v_count_before + 1 > v_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited', 'limit', v_limit, 'window_seconds', v_window_seconds);
  END IF;

  -- Duplicate vote prevention
  IF p_voter_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM votes WHERE battle_id = p_match_id AND voter_user_id = p_voter_user_id) INTO v_exists;
    IF v_exists THEN
      RETURN jsonb_build_object('ok', false, 'error', 'duplicate_vote_user');
    END IF;
  ELSE
    SELECT EXISTS(SELECT 1 FROM votes WHERE battle_id = p_match_id AND ip_hash = p_ip_hash) INTO v_exists;
    IF v_exists THEN
      RETURN jsonb_build_object('ok', false, 'error', 'duplicate_vote_ip');
    END IF;
  END IF;

  -- Insert the vote
  INSERT INTO votes(id, battle_id, voter_user_id, ip_hash, user_agent, voted_for, created_at)
  VALUES (gen_random_uuid(), p_match_id, p_voter_user_id, p_ip_hash, p_user_agent, p_voted_for, now());

  -- Increment the match vote counters
  IF p_voted_for = v_match.cat_a_id THEN
    UPDATE tournament_matches
    SET votes_a = coalesce(votes_a,0) + 1
    WHERE id = p_match_id;
  ELSE
    UPDATE tournament_matches
    SET votes_b = coalesce(votes_b,0) + 1
    WHERE id = p_match_id;
  END IF;

  -- Update rate limit counter
  UPDATE rate_limits
  SET count = count + 1, updated_at = now()
  WHERE key = v_rate_key;

  -- Return updated counts
  SELECT votes_a, votes_b INTO v_votes_a, v_votes_b FROM tournament_matches WHERE id = p_match_id;

  RETURN jsonb_build_object('ok', true, 'votes_a', coalesce(v_votes_a,0), 'votes_b', coalesce(v_votes_b,0));
exception when others then
  -- bubble up error
  raise;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_tournament(p_type text DEFAULT 'main'::text, p_cat_count integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_tournament_id UUID;
  v_cat_ids UUID[];
  v_i INT;
BEGIN
  -- Check if this type already has an active tournament today
  SELECT id INTO v_tournament_id
  FROM tournaments
  WHERE date = v_today AND tournament_type = p_type AND status = 'active';

  IF v_tournament_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tournament already exists for today', 'tournament_id', v_tournament_id);
  END IF;

  -- Pick random approved cats
  SELECT ARRAY(
    SELECT id FROM cats
    WHERE status = 'approved'
    ORDER BY random()
    LIMIT p_cat_count
  ) INTO v_cat_ids;

  IF array_length(v_cat_ids, 1) IS NULL OR array_length(v_cat_ids, 1) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough approved cats');
  END IF;

  -- Ensure even number
  IF array_length(v_cat_ids, 1) % 2 != 0 THEN
    v_cat_ids := v_cat_ids[1:array_length(v_cat_ids, 1) - 1];
  END IF;

  -- Create tournament
  INSERT INTO tournaments (id, date, status, round, tournament_type, created_at)
  VALUES (gen_random_uuid(), v_today, 'active', 1, p_type, NOW())
  RETURNING id INTO v_tournament_id;

  -- Create entries
  FOR v_i IN 1..array_length(v_cat_ids, 1) LOOP
    INSERT INTO tournament_entries (tournament_id, cat_id, seed, eliminated, votes)
    VALUES (v_tournament_id, v_cat_ids[v_i], v_i, FALSE, 0);
  END LOOP;

  -- Create round 1 matches
  FOR v_i IN 1..array_length(v_cat_ids, 1) / 2 LOOP
    INSERT INTO tournament_matches (tournament_id, round, cat_a_id, cat_b_id, status, votes_a, votes_b)
    VALUES (v_tournament_id, 1, v_cat_ids[(v_i - 1) * 2 + 1], v_cat_ids[(v_i - 1) * 2 + 2], 'active', 0, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'tournament_id', v_tournament_id,
    'type', p_type,
    'cat_count', array_length(v_cat_ids, 1),
    'matches', array_length(v_cat_ids, 1) / 2
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.daily_tournament_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_tournament RECORD;
  v_result JSONB;
  v_results JSONB := '[]'::JSONB;
  v_new_tournament JSONB;
BEGIN
  -- 1. Resolve all active tournaments with active matches that have votes
  FOR v_tournament IN
    SELECT DISTINCT t.id, t.tournament_type
    FROM tournaments t
    JOIN tournament_matches m ON m.tournament_id = t.id
    WHERE t.status = 'active'
    AND m.status = 'active'
    AND m.round = t.round
    AND (m.votes_a + m.votes_b) > 0
    -- Only resolve if ALL matches in the round have at least 1 vote
    AND NOT EXISTS (
      SELECT 1 FROM tournament_matches m2
      WHERE m2.tournament_id = t.id
      AND m2.round = t.round
      AND m2.status = 'active'
      AND (m2.votes_a + m2.votes_b) = 0
    )
  LOOP
    v_result := resolve_tournament_round(v_tournament.id);
    v_results := v_results || jsonb_build_object('tournament_id', v_tournament.id, 'type', v_tournament.tournament_type, 'result', v_result);
  END LOOP;

  -- 2. Create today's main tournament if none exists
  IF NOT EXISTS (SELECT 1 FROM tournaments WHERE date = v_today AND tournament_type = 'main' AND status IN ('active', 'complete')) THEN
    v_new_tournament := create_tournament('main', 8);
    v_results := v_results || jsonb_build_object('action', 'created_main', 'result', v_new_tournament);
  END IF;

  -- 3. Create today's rookie arena if none exists (for newer cats)
  IF NOT EXISTS (SELECT 1 FROM tournaments WHERE date = v_today AND tournament_type = 'rookie' AND status IN ('active', 'complete')) THEN
    v_new_tournament := create_tournament('rookie', 8);
    v_results := v_results || jsonb_build_object('action', 'created_rookie', 'result', v_new_tournament);
  END IF;

  RETURN jsonb_build_object('ok', true, 'actions', v_results);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_cat_stats(p_rarity text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_min INT;
  v_max INT;
BEGIN
  CASE p_rarity
    WHEN 'Common'    THEN v_min := 30; v_max := 55;
    WHEN 'Rare'      THEN v_min := 45; v_max := 70;
    WHEN 'Epic'      THEN v_min := 55; v_max := 82;
    WHEN 'Legendary' THEN v_min := 68; v_max := 92;
    WHEN 'Mythic'    THEN v_min := 78; v_max := 96;
    WHEN 'God-Tier'  THEN v_min := 88; v_max := 99;
    ELSE v_min := 30; v_max := 55;
  END CASE;
  RETURN jsonb_build_object(
    'attack',   v_min + floor(random() * (v_max - v_min + 1)),
    'defense',  v_min + floor(random() * (v_max - v_min + 1)),
    'speed',    v_min + floor(random() * (v_max - v_min + 1)),
    'charisma', v_min + floor(random() * (v_max - v_min + 1)),
    'chaos',    v_min + floor(random() * (v_max - v_min + 1))
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_cat_counter(p_cat_id uuid, p_field text, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_field = 'wins' then
    update public.cats set wins = coalesce(wins,0) + p_amount where id = p_cat_id;
  elsif p_field = 'losses' then
    update public.cats set losses = coalesce(losses,0) + p_amount where id = p_cat_id;
  else
    raise exception 'invalid field %', p_field;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.level_up_cat(p_cat_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cat RECORD;
  v_xp_needed INT;
  v_new_level INT;
  v_remaining_xp INT;
  v_rarity_bonus INT;
  v_stat_gain_1 INT;
  v_stat_gain_2 INT;
  v_stat_keys TEXT[] := ARRAY['attack', 'defense', 'speed', 'charisma', 'chaos'];
  v_stat1 TEXT;
  v_stat2 TEXT;
  v_evolved BOOLEAN := FALSE;
  v_new_evolution TEXT;
BEGIN
  SELECT * INTO v_cat FROM cats WHERE id = p_cat_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cat not found');
  END IF;
  v_xp_needed := COALESCE(v_cat.cat_level, 1) * 100;
  IF COALESCE(v_cat.cat_xp, 0) < v_xp_needed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough XP');
  END IF;
  v_new_level := COALESCE(v_cat.cat_level, 1) + 1;
  v_remaining_xp := COALESCE(v_cat.cat_xp, 0) - v_xp_needed;
  CASE v_cat.rarity
    WHEN 'Common'    THEN v_rarity_bonus := 0;
    WHEN 'Rare'      THEN v_rarity_bonus := 1;
    WHEN 'Epic'      THEN v_rarity_bonus := 1;
    WHEN 'Legendary' THEN v_rarity_bonus := 2;
    WHEN 'Mythic'    THEN v_rarity_bonus := 2;
    WHEN 'God-Tier'  THEN v_rarity_bonus := 3;
    ELSE v_rarity_bonus := 0;
  END CASE;
  v_stat1 := v_stat_keys[1 + floor(random() * 5)];
  v_stat2 := v_stat_keys[1 + floor(random() * 5)];
  WHILE v_stat2 = v_stat1 LOOP
    v_stat2 := v_stat_keys[1 + floor(random() * 5)];
  END LOOP;
  v_stat_gain_1 := 1 + floor(random() * 2) + v_rarity_bonus;
  v_stat_gain_2 := 1 + floor(random() * 2);
  EXECUTE format('UPDATE cats SET %I = LEAST(COALESCE(%I, 0) + $1, 99) WHERE id = $2', v_stat1, v_stat1) USING v_stat_gain_1, p_cat_id;
  EXECUTE format('UPDATE cats SET %I = LEAST(COALESCE(%I, 0) + $1, 99) WHERE id = $2', v_stat2, v_stat2) USING v_stat_gain_2, p_cat_id;
  v_new_evolution := COALESCE(v_cat.evolution, 'Kitten');
  IF v_new_level >= 20 AND v_new_evolution != 'Supreme Overlord' THEN
    v_new_evolution := 'Supreme Overlord'; v_evolved := TRUE;
  ELSIF v_new_level >= 10 AND v_new_evolution NOT IN ('Battle Beast', 'Supreme Overlord') THEN
    v_new_evolution := 'Battle Beast'; v_evolved := TRUE;
  ELSIF v_new_level >= 5 AND v_new_evolution NOT IN ('Elite Floof', 'Battle Beast', 'Supreme Overlord') THEN
    v_new_evolution := 'Elite Floof'; v_evolved := TRUE;
  END IF;
  UPDATE cats SET cat_level = v_new_level, cat_xp = v_remaining_xp, level = v_new_level, xp = v_remaining_xp, evolution = v_new_evolution WHERE id = p_cat_id;
  RETURN jsonb_build_object('ok', true, 'new_level', v_new_level, 'stat_gains', jsonb_build_object(v_stat1, v_stat_gain_1, v_stat2, v_stat_gain_2), 'evolved', v_evolved, 'evolution', v_new_evolution);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.open_crate(p_user_id text, p_crate_type text DEFAULT 'daily'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_roll FLOAT;
  v_rarity TEXT;
  v_reward_type TEXT;
  v_xp_gain INT := 0;
  v_sigil_gain INT := 0;
  v_cosmetic RECORD;
  v_cosmetic_id UUID;
  v_already_owned BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check daily limit
  IF p_crate_type = 'daily' THEN
    IF EXISTS (
      SELECT 1 FROM crate_opens
      WHERE user_id = p_user_id AND crate_type = 'daily'
      AND opened_at::date = CURRENT_DATE
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Already opened daily crate today');
    END IF;
  END IF;

  -- Roll rarity
  v_roll := random();
  IF v_roll < 0.02 THEN
    v_rarity := 'Legendary';
  ELSIF v_roll < 0.10 THEN
    v_rarity := 'Epic';
  ELSIF v_roll < 0.25 THEN
    v_rarity := 'Rare';
  ELSIF v_roll < 0.50 THEN
    v_rarity := 'Common';
  ELSE
    v_rarity := 'xp_sigils';
  END IF;

  -- If cosmetic rarity, try to give a cosmetic
  IF v_rarity IN ('Common', 'Rare', 'Epic', 'Legendary') THEN
    -- Pick a random cosmetic of this rarity that user doesn't own
    SELECT c.* INTO v_cosmetic
    FROM cosmetics c
    WHERE c.rarity = v_rarity
    AND NOT EXISTS (SELECT 1 FROM user_inventory ui WHERE ui.user_id = p_user_id AND ui.cosmetic_id = c.id)
    ORDER BY random()
    LIMIT 1;

    IF v_cosmetic.id IS NOT NULL THEN
      v_reward_type := 'cosmetic';
      v_cosmetic_id := v_cosmetic.id;
      -- Add to inventory
      INSERT INTO user_inventory (user_id, cosmetic_id, source)
      VALUES (p_user_id, v_cosmetic.id, p_crate_type)
      ON CONFLICT DO NOTHING;
      -- Also give some sigils as bonus
      CASE v_rarity
        WHEN 'Common'    THEN v_sigil_gain := 5 + floor(random() * 10);
        WHEN 'Rare'      THEN v_sigil_gain := 15 + floor(random() * 15);
        WHEN 'Epic'      THEN v_sigil_gain := 30 + floor(random() * 30);
        WHEN 'Legendary' THEN v_sigil_gain := 75 + floor(random() * 75);
      END CASE;
    ELSE
      -- User owns all cosmetics of this rarity, give sigils instead
      v_reward_type := 'sigils';
      v_rarity := 'duplicate';
      CASE v_rarity
        WHEN 'duplicate' THEN v_sigil_gain := 20 + floor(random() * 40);
      END CASE;
    END IF;
  ELSE
    -- XP + Sigils roll
    v_reward_type := 'xp_sigils';
    v_xp_gain := 10 + floor(random() * 40);
    v_sigil_gain := 5 + floor(random() * 25);
  END IF;

  -- Apply rewards
  IF v_sigil_gain > 0 OR v_xp_gain > 0 THEN
    INSERT INTO user_progress (user_id, xp, level, sigils)
    VALUES (p_user_id, v_xp_gain, 1, v_sigil_gain)
    ON CONFLICT (user_id)
    DO UPDATE SET
      xp = user_progress.xp + v_xp_gain,
      sigils = COALESCE(user_progress.sigils, 0) + v_sigil_gain;
  END IF;

  -- Log crate open
  INSERT INTO crate_opens (user_id, crate_type, rarity_roll, reward_type, reward_value, cosmetic_id)
  VALUES (p_user_id, p_crate_type, COALESCE(v_rarity, 'xp_sigils'), v_reward_type, v_sigil_gain + v_xp_gain, v_cosmetic_id);

  -- Build result
  v_result := jsonb_build_object(
    'ok', true,
    'rarity', COALESCE(v_rarity, 'Common'),
    'reward_type', v_reward_type,
    'xp_gained', v_xp_gain,
    'sigils_gained', v_sigil_gain
  );

  IF v_cosmetic_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'cosmetic', jsonb_build_object(
        'id', v_cosmetic.id,
        'name', v_cosmetic.name,
        'slug', v_cosmetic.slug,
        'category', v_cosmetic.category,
        'rarity', v_cosmetic.rarity,
        'description', v_cosmetic.description
      )
    );
  END IF;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reroll_cat_stats(p_cat_id uuid, p_user_id uuid, p_reroll_cost integer DEFAULT 50)
 RETURNS TABLE(success boolean, new_stats jsonb, new_sigils integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_current_sigils INTEGER;
  v_cat_user_id UUID;
  v_cat_status TEXT;
  v_rarity TEXT;
  v_new_attack INTEGER;
  v_new_defense INTEGER;
  v_new_speed INTEGER;
  v_new_charisma INTEGER;
  v_new_chaos INTEGER;
  v_new_power TEXT;
  v_powers TEXT[] := ARRAY['Laser Eyes','Ultimate Fluff','Chaos Mode','Nine Lives','Royal Aura','Underdog Boost','Shadow Step','Thunder Paws','Frost Bite','Hypno Purr'];
BEGIN
  -- Get user's current sigils from user_progress
  SELECT sigils INTO v_current_sigils
  FROM user_progress
  WHERE user_id = p_user_id;
  
  IF v_current_sigils IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, 0, 'User progress not found';
    RETURN;
  END IF;
  
  -- Check if user has enough sigils
  IF v_current_sigils < p_reroll_cost THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_sigils, 'Insufficient sigils';
    RETURN;
  END IF;
  
  -- Verify cat exists and belongs to user
  SELECT user_id, status, rarity 
  INTO v_cat_user_id, v_cat_status, v_rarity
  FROM cats
  WHERE id = p_cat_id;
  
  IF v_cat_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_sigils, 'Cat not found';
    RETURN;
  END IF;
  
  IF v_cat_user_id != p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_sigils, 'Not your cat';
    RETURN;
  END IF;
  
  -- Only allow reroll if cat is in draft status
  IF v_cat_status != 'draft' THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_sigils, 'Cat already submitted';
    RETURN;
  END IF;
  
  -- Generate new stats based on rarity
  DECLARE
    v_min INTEGER;
    v_max INTEGER;
  BEGIN
    CASE v_rarity
      WHEN 'Common' THEN v_min := 30; v_max := 55;
      WHEN 'Rare' THEN v_min := 45; v_max := 70;
      WHEN 'Epic' THEN v_min := 55; v_max := 82;
      WHEN 'Legendary' THEN v_min := 68; v_max := 92;
      WHEN 'Mythic' THEN v_min := 78; v_max := 96;
      WHEN 'God-Tier' THEN v_min := 88; v_max := 99;
      ELSE v_min := 30; v_max := 55;
    END CASE;
    
    v_new_attack := v_min + floor(random() * (v_max - v_min + 1))::INTEGER;
    v_new_defense := v_min + floor(random() * (v_max - v_min + 1))::INTEGER;
    v_new_speed := v_min + floor(random() * (v_max - v_min + 1))::INTEGER;
    v_new_charisma := v_min + floor(random() * (v_max - v_min + 1))::INTEGER;
    v_new_chaos := v_min + floor(random() * (v_max - v_min + 1))::INTEGER;
  END;
  
  -- Roll new power
  v_new_power := v_powers[1 + floor(random() * array_length(v_powers, 1))::INTEGER];
  
  -- Deduct sigils and update cat in single transaction
  UPDATE user_progress 
  SET sigils = sigils - p_reroll_cost 
  WHERE user_id = p_user_id;
  
  UPDATE cats 
  SET 
    attack = v_new_attack,
    defense = v_new_defense,
    speed = v_new_speed,
    charisma = v_new_charisma,
    chaos = v_new_chaos,
    ability = v_new_power,
    updated_at = NOW()
  WHERE id = p_cat_id;
  
  -- Return success with new stats
  RETURN QUERY SELECT 
    TRUE,
    jsonb_build_object(
      'attack', v_new_attack,
      'defense', v_new_defense,
      'speed', v_new_speed,
      'charisma', v_new_charisma,
      'chaos', v_new_chaos,
      'power', v_new_power
    ),
    v_current_sigils - p_reroll_cost,
    NULL::TEXT;
    
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_current_round(p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_round int;
  v_tournament_status text;
  v_winners uuid[];
  v_winner_count int;
begin
  -- Lock tournament row so two resolves can't run at once
  select round, status
    into v_round, v_tournament_status
  from public.tournaments
  where id = p_tournament_id
  for update;

  if v_tournament_status is null then
    return jsonb_build_object('ok', false, 'error', 'tournament_not_found');
  end if;

  if v_tournament_status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'tournament_not_active');
  end if;

  -- Resolve all matches in the current round that are active/pending
  update public.tournament_matches m
  set
    status = 'completed',
    winner_id = case
      when coalesce(m.votes_a,0) > coalesce(m.votes_b,0) then m.cat_a_id
      when coalesce(m.votes_b,0) > coalesce(m.votes_a,0) then m.cat_b_id
      -- tie-breaker: deterministic (lowest uuid wins) to avoid randomness
      else least(m.cat_a_id, m.cat_b_id)
    end
  where m.tournament_id = p_tournament_id
    and m.round = v_round
    and m.status in ('pending','active');

  -- Collect winners for this round
  select array_agg(winner_id order by winner_id)
    into v_winners
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and round = v_round
    and status = 'completed';

  v_winner_count := coalesce(array_length(v_winners, 1), 0);

  if v_winner_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_matches_to_resolve', 'round', v_round);
  end if;

  -- If only 1 winner remains, tournament is complete.
  if v_winner_count = 1 then
    update public.tournaments
    set status = 'completed'
    where id = p_tournament_id;

    return jsonb_build_object(
      'ok', true,
      'tournament_id', p_tournament_id,
      'status', 'completed',
      'round', v_round,
      'champion_cat_id', v_winners[1]
    );
  end if;

  -- Advance tournament round
  update public.tournaments
  set round = v_round + 1
  where id = p_tournament_id;

  -- Create next round matches by pairing winners in order: (1v2), (3v4), ...
  insert into public.tournament_matches (tournament_id, round, cat_a_id, cat_b_id, status, votes_a, votes_b)
  select
    p_tournament_id,
    v_round + 1,
    v_winners[i],
    v_winners[i+1],
    'active',
    0,
    0
  from generate_series(1, v_winner_count, 2) as g(i)
  where i+1 <= v_winner_count;

  return jsonb_build_object(
    'ok', true,
    'tournament_id', p_tournament_id,
    'status', 'active',
    'resolved_round', v_round,
    'new_round', v_round + 1,
    'winners', v_winners
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_match(p_match_id uuid, p_winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_match record;
  v_tournament_id uuid;
  v_round int;
  v_cat_a uuid;
  v_cat_b uuid;
  v_loser uuid;
  v_now timestamptz := now();
  v_winner_count int;
  v_winner_ids uuid[];
  v_next_round int;
  v_pairs int;
  v_pair_idx int := 1;
  v_new_matches int := 0;
begin
  -- Load match
  select * into v_match from tournament_matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'match_not_found', 'match_id', p_match_id);
  end if;

  -- Basic validations
  if v_match.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'already_completed', 'match_id', p_match_id);
  end if;

  -- must be one of the contestants
  v_cat_a := v_match.cat_a_id;
  v_cat_b := v_match.cat_b_id;
  if p_winner_id is null or (p_winner_id <> v_cat_a and p_winner_id <> v_cat_b) then
    return jsonb_build_object('ok', false, 'error', 'invalid_winner', 'winner_id', p_winner_id, 'cat_a', v_cat_a, 'cat_b', v_cat_b);
  end if;

  -- Set loser
  if p_winner_id = v_cat_a then
    v_loser := v_cat_b;
  else
    v_loser := v_cat_a;
  end if;

  -- Update the match: winner, status completed
  update tournament_matches
  set winner_id = p_winner_id,
      status = 'completed',
      votes_a = coalesce(votes_a,0),
      votes_b = coalesce(votes_b,0),
      created_at = coalesce(created_at, now())
  where id = p_match_id;

  -- Update cats: battles, wins/losses
  update cats
  set battles_fought = coalesce(battles_fought,0) + 1,
      wins = coalesce(wins,0) + case when id = p_winner_id then 1 else 0 end,
      losses = coalesce(losses,0) + case when id = v_loser then 1 else 0 end,
      updated_at = now()
  where id in (p_winner_id, v_loser);

  -- Optionally: grant small XP to winner and participants (customize)
  update user_progress up
  set xp = up.xp + 10
  from profiles p
  where p.id = cats.user_id and cats.id = p_winner_id
  and up.user_id = p.user_id;

  -- Determine tournament and round
  select tournament_id, round into v_tournament_id, v_round from tournament_matches where id = p_match_id;

  -- If all matches in this round are completed, create next round
  perform 1 from tournament_matches m where m.tournament_id = v_tournament_id and m.round = v_round and m.status <> 'completed' limit 1;
  if not found then
    -- gather winners of this round, ordered by match id (stable)
    select array_agg(winner_id order by id) into v_winner_ids
    from tournament_matches
    where tournament_id = v_tournament_id and round = v_round;

    v_winner_count := array_length(v_winner_ids,1);

    -- If only one winner remains overall, mark tournament completed
    if v_winner_count is null then
      -- no winners? unexpected
      return jsonb_build_object('ok', true, 'message', 'match_resolved', 'match_id', p_match_id, 'note', 'no_round_winners_found');
    end if;

    if v_winner_count = 1 then
      -- tournament finished
      update tournaments set status = 'completed', round = v_round where id = v_tournament_id;
      return jsonb_build_object('ok', true, 'message', 'tournament_completed', 'tournament_id', v_tournament_id, 'champion', v_winner_ids[1]);
    end if;

    -- else create next round matches
    v_next_round := v_round + 1;
    -- delete any pre-existing matches for safety for this tournament/round (idempotency)
    delete from tournament_matches where tournament_id = v_tournament_id and round = v_next_round;

    -- pair winners: 1 vs 2, 3 vs 4, ...
    v_pairs := floor(v_winner_count::numeric / 2)::int;
    for i in 1..v_pairs loop
      -- compute indices
      -- match between winner_ids[(i*2)-1] and winner_ids[(i*2)]
      insert into tournament_matches (id, tournament_id, round, cat_a_id, cat_b_id, status, votes_a, votes_b, created_at)
      values (gen_random_uuid(), v_tournament_id, v_next_round, v_winner_ids[(i*2)-1], v_winner_ids[(i*2)], 'pending', 0, 0, now());
      v_new_matches := v_new_matches + 1;
    end loop;

    -- If odd winner_count, carry last one to next round as auto-advance / bye
    if (v_winner_count % 2) = 1 then
      -- The last element has no pair — create a placeholder match with b = NULL and mark it active/completed or create a bye container
      insert into tournament_matches (id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, created_at)
      values (gen_random_uuid(), v_tournament_id, v_next_round, v_winner_ids[v_winner_count], NULL, v_winner_ids[v_winner_count], 'completed', 0, 0, now());
    end if;

    -- bump tournament round
    update tournaments set round = v_next_round where id = v_tournament_id;

    return jsonb_build_object('ok', true, 'message', 'next_round_created', 'tournament_id', v_tournament_id, 'round', v_next_round, 'new_matches', v_new_matches);
  end if;

  -- otherwise just return success for single match resolve
  return jsonb_build_object('ok', true, 'message', 'match_resolved', 'match_id', p_match_id, 'winner', p_winner_id);
exception when others then
  -- bubble up error details
  raise;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_tournament_round(p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tournament RECORD;
  v_match RECORD;
  v_winner_id UUID;
  v_loser_id UUID;
  v_winners UUID[] := ARRAY[]::UUID[];
  v_results JSONB := '[]'::JSONB;
  v_next_round INT;
  v_i INT;
  v_power_a INT;
  v_power_b INT;
  v_total_votes INT;
  v_score_a FLOAT;
  v_score_b FLOAT;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tournament not found or not active');
  END IF;
  FOR v_match IN
    SELECT * FROM tournament_matches
    WHERE tournament_id = p_tournament_id AND round = v_tournament.round AND status = 'active'
    FOR UPDATE
  LOOP
    v_power_a := calc_battle_power(v_match.cat_a_id);
    v_power_b := calc_battle_power(v_match.cat_b_id);
    v_total_votes := COALESCE(v_match.votes_a, 0) + COALESCE(v_match.votes_b, 0);
    IF v_total_votes > 0 THEN
      v_score_a := (COALESCE(v_match.votes_a, 0)::FLOAT / v_total_votes) * 70 + (v_power_a::FLOAT / GREATEST(v_power_a + v_power_b, 1)) * 30;
      v_score_b := (COALESCE(v_match.votes_b, 0)::FLOAT / v_total_votes) * 70 + (v_power_b::FLOAT / GREATEST(v_power_a + v_power_b, 1)) * 30;
    ELSE
      v_score_a := v_power_a;
      v_score_b := v_power_b;
    END IF;
    IF v_score_a > v_score_b THEN
      v_winner_id := v_match.cat_a_id;
    ELSIF v_score_b > v_score_a THEN
      v_winner_id := v_match.cat_b_id;
    ELSE
      v_winner_id := CASE WHEN random() > 0.5 THEN v_match.cat_a_id ELSE v_match.cat_b_id END;
    END IF;
    v_loser_id := CASE WHEN v_winner_id = v_match.cat_a_id THEN v_match.cat_b_id ELSE v_match.cat_a_id END;
    UPDATE tournament_matches SET winner_id = v_winner_id, status = 'complete' WHERE id = v_match.id;
    UPDATE cats SET wins = COALESCE(wins,0) + 1, battles_fought = COALESCE(battles_fought,0) + 1 WHERE id = v_winner_id;
    UPDATE cats SET losses = COALESCE(losses,0) + 1, battles_fought = COALESCE(battles_fought,0) + 1 WHERE id = v_loser_id;
    PERFORM award_battle_xp(v_winner_id, v_loser_id);
    UPDATE tournament_entries SET eliminated = TRUE WHERE tournament_id = p_tournament_id AND cat_id = v_loser_id;
    v_winners := v_winners || v_winner_id;
    v_results := v_results || jsonb_build_object('match_id', v_match.id, 'winner_id', v_winner_id, 'power_a', v_power_a, 'power_b', v_power_b, 'votes_a', v_match.votes_a, 'votes_b', v_match.votes_b);
  END LOOP;
  IF array_length(v_winners, 1) = 1 THEN
    UPDATE tournaments SET status = 'complete', champion_id = v_winners[1] WHERE id = p_tournament_id;
    UPDATE cats SET cat_xp = COALESCE(cat_xp,0) + 200 WHERE id = v_winners[1];
    PERFORM level_up_cat(v_winners[1]);
    RETURN jsonb_build_object('ok', true, 'status', 'complete', 'champion_id', v_winners[1], 'round_resolved', v_tournament.round, 'results', v_results);
  END IF;
  v_next_round := v_tournament.round + 1;
  FOR v_i IN 1..array_length(v_winners, 1) / 2 LOOP
    INSERT INTO tournament_matches (tournament_id, round, cat_a_id, cat_b_id, status, votes_a, votes_b)
    VALUES (p_tournament_id, v_next_round, v_winners[(v_i-1)*2+1], v_winners[(v_i-1)*2+2], 'active', 0, 0);
  END LOOP;
  IF array_length(v_winners, 1) % 2 != 0 THEN
    INSERT INTO tournament_matches (tournament_id, round, cat_a_id, cat_b_id, winner_id, status)
    VALUES (p_tournament_id, v_next_round, v_winners[array_length(v_winners,1)], v_winners[array_length(v_winners,1)], v_winners[array_length(v_winners,1)], 'complete');
  END IF;
  UPDATE tournaments SET round = v_next_round WHERE id = p_tournament_id;
  RETURN jsonb_build_object('ok', true, 'status', 'advanced', 'round_resolved', v_tournament.round, 'next_round', v_next_round, 'winners', array_length(v_winners, 1), 'results', v_results);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_cat(p_user_id uuid, p_name text, p_image_path text, p_rarity text, p_stats jsonb, p_power integer, p_ability text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat_id uuid;
BEGIN
  INSERT INTO public.cats (
    id, user_id, name, image_path, rarity, stats, power, ability, created_at
  )
  VALUES (
    gen_random_uuid(),
    p_user_id,
    p_name,
    p_image_path,
    p_rarity,
    p_stats,
    p_power,
    p_ability,
    now()
  )
  RETURNING id INTO v_cat_id;

  RETURN jsonb_build_object('ok', true, 'cat_id', v_cat_id);
END;
$function$
;

create or replace view "public"."user_streaks" as  SELECT user_id,
    current_streak,
    last_claim_date,
    updated_at
   FROM public.streaks;


CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE sql
AS $function$
  SELECT gen_random_uuid();
$function$
;

CREATE OR REPLACE FUNCTION public.bootstrap_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into profiles (id, username, created_at)
  values (p_user_id, null, now())
  on conflict (id) do nothing;

  insert into user_progress (user_id, xp, level, updated_at)
  values (p_user_id, 0, 1, now())
  on conflict (user_id) do nothing;

  insert into streaks (user_id, current_streak, last_claim_date, updated_at)
  values (p_user_id, 0, null, now())
  on conflict (user_id) do nothing;

  insert into daily_rewards (user_id, last_claim_date, claimed_today, updated_at)
  values (p_user_id, null, false, now())
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_daily_crate(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := public.utc_today();
  v_last date;
  v_xp int;
  v_type text;
begin
  -- Ensure user rows exist
  perform public.bootstrap_user(p_user_id);

  select last_claim_date into v_last
  from daily_rewards
  where user_id = p_user_id;

  if v_last = v_today then
    return jsonb_build_object(
      'ok', false,
      'error', 'already_claimed',
      'claimed_at', v_today
    );
  end if;

  -- Simple reward logic (replace later with Sigils + better loot tables)
  v_xp := 50;
  v_type := 'common';

  update daily_rewards
  set last_claim_date = v_today,
      claimed_today = true,
      updated_at = now()
  where user_id = p_user_id;

  update user_progress
  set xp = xp + v_xp,
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'crate_type', v_type,
    'claimed_at', v_today
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_daily_streak(p_user_id uuid)
 RETURNS TABLE(success boolean, new_streak integer, xp_earned integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_check record;
  v_new_streak int;
  v_xp int;
  v_today date := public.utc_today();
begin
  select * into v_check from public.check_streak(p_user_id);

  if not v_check.can_claim then
    return query select false, v_check.current_streak, 0;
    return;
  end if;

  v_xp := case
    when v_check.streak_broken then 10
    when v_check.current_streak % 7 = 6 then 100
    when v_check.current_streak % 7 = 2 then 25
    else 10 + (v_check.current_streak % 7) * 2
  end;

  v_new_streak := case
    when v_check.streak_broken then 1
    else v_check.current_streak + 1
  end;

  update public.streaks
  set current_streak = v_new_streak,
      last_claim_date = v_today,
      updated_at = now()
  where user_id = p_user_id;

  update public.user_progress
  set xp = xp + v_xp,
      updated_at = now()
  where user_id = p_user_id;

  return query select true, v_new_streak, v_xp;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.utc_today()
 RETURNS date
 LANGUAGE sql
 STABLE
AS $function$
  select (now() at time zone 'UTC')::date;
$function$
;

grant delete on table "public"."crate_opens" to "service_role";

grant insert on table "public"."crate_opens" to "service_role";

grant references on table "public"."crate_opens" to "service_role";

grant select on table "public"."crate_opens" to "service_role";

grant trigger on table "public"."crate_opens" to "service_role";

grant truncate on table "public"."crate_opens" to "service_role";

grant update on table "public"."crate_opens" to "service_role";


  create policy "Allow all reads"
  on "public"."cats"
  as permissive
  for select
  to public
using (true);



  create policy "crate_opens_private"
  on "public"."crate_opens"
  as permissive
  for all
  to public
using (false)
with check (false);



  create policy "Users can view own progress"
  on "public"."user_progress"
  as permissive
  for select
  to public
using (true);



