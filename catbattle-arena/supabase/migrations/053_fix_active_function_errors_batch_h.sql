-- Fix only active error-level function issues (production-only drift cleanup).
-- This migration is intentionally limited to:
-- - public.open_crate: user_id/p_user_id uuid-text mismatch
-- - public.reroll_cat_stats: cats.updated_at reference
-- - public.resolve_match: cats.updated_at reference

CREATE OR REPLACE FUNCTION public.open_crate(
  p_user_id text,
  p_crate_type text DEFAULT 'daily'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_roll FLOAT;
  v_rarity TEXT;
  v_reward_type TEXT;
  v_xp_gain INT := 0;
  v_cosmetic RECORD;
  v_cosmetic_id UUID;
  v_result JSONB;
BEGIN
  BEGIN
    v_user_id := NULLIF(BTRIM(p_user_id), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user_id');
  END;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_user_id');
  END IF;

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

  IF v_rarity IN ('Common', 'Rare', 'Epic', 'Legendary') THEN
    SELECT c.* INTO v_cosmetic
    FROM public.cosmetics c
    WHERE c.rarity = v_rarity
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_inventory ui
        WHERE ui.user_id = v_user_id
          AND ui.cosmetic_id = c.id
      )
    ORDER BY random()
    LIMIT 1;

    IF v_cosmetic.id IS NOT NULL THEN
      v_reward_type := 'cosmetic';
      v_cosmetic_id := v_cosmetic.id;
      INSERT INTO public.user_inventory (user_id, cosmetic_id, source)
      VALUES (v_user_id, v_cosmetic.id, p_crate_type)
      ON CONFLICT DO NOTHING;
    ELSE
      v_reward_type := 'xp_sigils';
      v_rarity := 'xp_sigils';
      v_xp_gain := 5 + floor(random() * 15);
    END IF;
  ELSE
    v_reward_type := 'xp_sigils';
    v_xp_gain := 10 + floor(random() * 40);
  END IF;

  IF v_xp_gain > 0 THEN
    UPDATE public.user_progress
    SET xp = coalesce(xp, 0) + v_xp_gain,
        updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  v_result := jsonb_build_object(
    'ok', true,
    'rarity', COALESCE(v_rarity, 'Common'),
    'reward_type', v_reward_type,
    'xp_gained', v_xp_gain
  );

  IF v_cosmetic_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'cosmetic', jsonb_build_object(
        'id', v_cosmetic.id,
        'name', v_cosmetic.name,
        'slug', v_cosmetic.slug,
        'category', v_cosmetic.category,
        'rarity', v_cosmetic.rarity
      )
    );
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reroll_cat_stats(
  p_cat_id uuid,
  p_user_id uuid,
  p_reroll_cost integer DEFAULT 50
)
RETURNS TABLE(success boolean, new_stats jsonb, new_sigils integer, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_current_xp INTEGER;
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
  v_min INTEGER;
  v_max INTEGER;
BEGIN
  SELECT xp INTO v_current_xp
  FROM public.user_progress
  WHERE user_id = p_user_id;

  IF v_current_xp IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, 0, 'User progress not found';
    RETURN;
  END IF;

  IF v_current_xp < p_reroll_cost THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_xp, 'Insufficient sigils';
    RETURN;
  END IF;

  SELECT user_id, status, rarity
    INTO v_cat_user_id, v_cat_status, v_rarity
  FROM public.cats
  WHERE id = p_cat_id;

  IF v_cat_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_xp, 'Cat not found';
    RETURN;
  END IF;

  IF v_cat_user_id != p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_xp, 'Not your cat';
    RETURN;
  END IF;

  IF v_cat_status != 'draft' THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, v_current_xp, 'Cat already submitted';
    RETURN;
  END IF;

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
  v_new_power := v_powers[1 + floor(random() * array_length(v_powers, 1))::INTEGER];

  UPDATE public.user_progress
  SET xp = xp - p_reroll_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE public.cats
  SET
    attack = v_new_attack,
    defense = v_new_defense,
    speed = v_new_speed,
    charisma = v_new_charisma,
    chaos = v_new_chaos,
    ability = v_new_power
  WHERE id = p_cat_id;

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
    GREATEST(0, v_current_xp - p_reroll_cost),
    NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_match(p_match_id uuid, p_winner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match record;
  v_tournament_id uuid;
  v_round int;
  v_cat_a uuid;
  v_cat_b uuid;
  v_loser uuid;
  v_winner_count int;
  v_winner_ids uuid[];
  v_next_round int;
  v_pairs int;
  v_new_matches int := 0;
  v_update_sql text;
  v_set_clauses text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_found', 'match_id', p_match_id);
  END IF;

  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_completed', 'match_id', p_match_id);
  END IF;

  v_cat_a := v_match.cat_a_id;
  v_cat_b := v_match.cat_b_id;
  IF p_winner_id IS NULL OR (p_winner_id <> v_cat_a AND p_winner_id <> v_cat_b) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_winner',
      'winner_id', p_winner_id,
      'cat_a', v_cat_a,
      'cat_b', v_cat_b
    );
  END IF;

  IF p_winner_id = v_cat_a THEN
    v_loser := v_cat_b;
  ELSE
    v_loser := v_cat_a;
  END IF;

  UPDATE public.tournament_matches
  SET winner_id = p_winner_id,
      status = 'completed',
      votes_a = coalesce(votes_a,0),
      votes_b = coalesce(votes_b,0),
      created_at = coalesce(created_at, now())
  WHERE id = p_match_id;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cats' AND column_name = 'battles_fought') THEN
    v_set_clauses := array_append(v_set_clauses, 'battles_fought = coalesce(battles_fought,0) + 1');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cats' AND column_name = 'wins') THEN
    v_set_clauses := array_append(v_set_clauses, 'wins = coalesce(wins,0) + case when id = $1 then 1 else 0 end');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cats' AND column_name = 'losses') THEN
    v_set_clauses := array_append(v_set_clauses, 'losses = coalesce(losses,0) + case when id = $2 then 1 else 0 end');
  END IF;

  IF array_length(v_set_clauses, 1) IS NOT NULL THEN
    v_update_sql := format(
      'UPDATE public.cats SET %s WHERE id = ANY($3::uuid[])',
      array_to_string(v_set_clauses, ', ')
    );
    EXECUTE v_update_sql USING p_winner_id, v_loser, ARRAY[p_winner_id, v_loser];
  END IF;

  UPDATE public.user_progress up
  SET xp = up.xp + 10
  FROM public.cats c
  WHERE c.id = p_winner_id
    AND up.user_id = c.user_id;

  SELECT tournament_id, round INTO v_tournament_id, v_round FROM public.tournament_matches WHERE id = p_match_id;

  PERFORM 1
  FROM public.tournament_matches m
  WHERE m.tournament_id = v_tournament_id AND m.round = v_round AND m.status <> 'completed'
  LIMIT 1;
  IF NOT FOUND THEN
    SELECT array_agg(winner_id ORDER BY id) INTO v_winner_ids
    FROM public.tournament_matches
    WHERE tournament_id = v_tournament_id AND round = v_round;

    v_winner_count := array_length(v_winner_ids,1);

    IF v_winner_count IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'message', 'match_resolved', 'match_id', p_match_id, 'note', 'no_round_winners_found');
    END IF;

    IF v_winner_count = 1 THEN
      UPDATE public.tournaments
      SET status = 'completed', round = v_round
      WHERE id = v_tournament_id;
      RETURN jsonb_build_object('ok', true, 'message', 'tournament_completed', 'tournament_id', v_tournament_id, 'champion', v_winner_ids[1]);
    END IF;

    v_next_round := v_round + 1;
    DELETE FROM public.tournament_matches WHERE tournament_id = v_tournament_id AND round = v_next_round;

    v_pairs := floor(v_winner_count::numeric / 2)::int;
    FOR i IN 1..v_pairs LOOP
      INSERT INTO public.tournament_matches (id, tournament_id, round, cat_a_id, cat_b_id, status, votes_a, votes_b, created_at)
      VALUES (gen_random_uuid(), v_tournament_id, v_next_round, v_winner_ids[(i*2)-1], v_winner_ids[(i*2)], 'pending', 0, 0, now());
      v_new_matches := v_new_matches + 1;
    END LOOP;

    IF (v_winner_count % 2) = 1 THEN
      INSERT INTO public.tournament_matches (id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, created_at)
      VALUES (gen_random_uuid(), v_tournament_id, v_next_round, v_winner_ids[v_winner_count], NULL, v_winner_ids[v_winner_count], 'completed', 0, 0, now());
    END IF;

    UPDATE public.tournaments SET round = v_next_round WHERE id = v_tournament_id;

    RETURN jsonb_build_object('ok', true, 'message', 'next_round_created', 'tournament_id', v_tournament_id, 'round', v_next_round, 'new_matches', v_new_matches);
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', 'match_resolved', 'match_id', p_match_id, 'winner', p_winner_id);
EXCEPTION WHEN others THEN
  RAISE;
END;
$function$;
