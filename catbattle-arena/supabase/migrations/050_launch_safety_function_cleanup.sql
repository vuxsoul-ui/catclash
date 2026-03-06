-- Minimal launch-safety cleanup for remaining function-level lint drift.
-- Scope:
-- - Keep behavior unchanged for arena paging and fallback seeding.
-- - Restore submit_cat_v2 insert shape to match current cats schema.
-- - Silence non-critical seed_npc shadow/unused warning by avoiding loop variable shadowing.
-- - Fix get_or_create_arena_page uuid[] initialization type mismatch warning.

CREATE OR REPLACE FUNCTION public.submit_cat_v2(
  p_user_id UUID,
  p_name TEXT,
  p_image_path TEXT,
  p_rarity TEXT,
  p_stats JSONB,
  p_ability TEXT DEFAULT 'Laser Eyes'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id UUID;
  v_attack INT;
  v_defense INT;
  v_speed INT;
  v_charisma INT;
  v_chaos INT;
BEGIN
  v_attack := LEAST(100, GREATEST(0, COALESCE((p_stats->>'attack')::int, 50)));
  v_defense := LEAST(100, GREATEST(0, COALESCE((p_stats->>'defense')::int, 50)));
  v_speed := LEAST(100, GREATEST(0, COALESCE((p_stats->>'speed')::int, 50)));
  v_charisma := LEAST(100, GREATEST(0, COALESCE((p_stats->>'charisma')::int, 50)));
  v_chaos := LEAST(100, GREATEST(0, COALESCE((p_stats->>'chaos')::int, 50)));

  INSERT INTO public.cats (
    id,
    user_id,
    name,
    image_path,
    rarity,
    attack,
    defense,
    speed,
    charisma,
    chaos,
    ability,
    cat_xp,
    cat_level,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    p_name,
    p_image_path,
    p_rarity,
    v_attack,
    v_defense,
    v_speed,
    v_charisma,
    v_chaos,
    COALESCE(NULLIF(BTRIM(p_ability), ''), 'Laser Eyes'),
    0,
    1,
    'pending',
    NOW()
  )
  RETURNING id INTO v_cat_id;

  RETURN jsonb_build_object('ok', true, 'cat_id', v_cat_id);
END;
$$;

DROP FUNCTION IF EXISTS public.submit_cat_v2(
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.seed_npc_cats_if_needed(p_count INT DEFAULT 16)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approved_count INT;
  v_needed INT;
  v_names TEXT[] := ARRAY['Shadow', 'Luna', 'Milo', 'Bella', 'Oliver', 'Kitty', 'Whiskers', 'Simba', 'Nala', 'Tiger', 'Leo', 'Cleo', 'Pumpkin', 'Ginger', 'Smokey', 'Bandit'];
  v_rarities TEXT[] := ARRAY['Common', 'Common', 'Common', 'Rare', 'Rare', 'Epic', 'Legendary'];
  v_ability_roll TEXT[] := ARRAY['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost'];
BEGIN
  SELECT COUNT(*) INTO v_approved_count FROM cats WHERE status = 'approved';

  v_needed := p_count - v_approved_count;

  IF v_needed <= 0 THEN
    RETURN 0;
  END IF;

  FOR i IN 1..v_needed LOOP
    INSERT INTO cats (
      user_id, name, image_path, rarity, attack, defense, speed, charisma, chaos,
      ability, cat_xp, cat_level, status
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_names[i] || ' (NPC)',
      'https://placekitten.com/' || (300 + i) || '/' || (300 + i),
      v_rarities[1 + (i % array_length(v_rarities, 1))],
      50 + (random() * 30)::int,
      50 + (random() * 30)::int,
      50 + (random() * 30)::int,
      50 + (random() * 30)::int,
      50 + (random() * 30)::int,
      v_ability_roll[1 + (i % array_length(v_ability_roll, 1))],
      0, 1, 'approved'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_needed;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_arena_page(
  p_identity_key TEXT,
  p_arena_type TEXT,
  p_page_size INT DEFAULT 6,
  p_total_size INT DEFAULT 36
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity TEXT := NULLIF(BTRIM(p_identity_key), '');
  v_arena TEXT := LOWER(NULLIF(BTRIM(p_arena_type), ''));
  v_page_size INT := GREATEST(1, LEAST(COALESCE(p_page_size, 6), 12));
  v_total_size INT := GREATEST(v_page_size, LEAST(COALESCE(p_total_size, 36), 120));
  v_day DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_tournament_id UUID;
  v_state public.arena_page_state%ROWTYPE;
  v_existing_count INT := 0;
  v_needed INT := 0;
  v_next_page_index INT := 0;
  v_start_pos INT := 0;
  v_match_ids UUID[] := '{}'::UUID[];
  v_voted_count INT := 0;
BEGIN
  IF v_identity IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_identity_key');
  END IF;

  IF v_arena NOT IN ('main', 'rookie') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_arena_type');
  END IF;

  SELECT t.id INTO v_tournament_id
  FROM public.tournaments t
  WHERE t.date = v_day
    AND LOWER(COALESCE(t.status, '')) IN ('active', 'in_progress')
  ORDER BY CASE WHEN LOWER(COALESCE(t.status, '')) = 'active' THEN 0 ELSE 1 END, t.created_at DESC
  LIMIT 1;

  IF v_tournament_id IS NULL THEN
    SELECT t.id INTO v_tournament_id
    FROM public.tournaments t
    WHERE LOWER(COALESCE(t.status, '')) IN ('active', 'in_progress')
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 1;
  END IF;

  IF v_tournament_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_tournament');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arena_page:' || v_identity || ':' || v_arena));

  SELECT COUNT(*)::INT INTO v_existing_count
  FROM public.arena_match_queue q
  WHERE q.tournament_id = v_tournament_id
    AND q.arena_type = v_arena;

  IF v_existing_count < v_total_size THEN
    v_needed := v_total_size - v_existing_count;
    INSERT INTO public.arena_match_queue (tournament_id, arena_type, match_id, position, status)
    SELECT
      v_tournament_id,
      v_arena,
      tm.id,
      v_existing_count + ROW_NUMBER() OVER (ORDER BY tm.created_at DESC, tm.id),
      'queued'
    FROM public.tournament_matches tm
    WHERE tm.tournament_id = v_tournament_id
      AND LOWER(COALESCE(tm.status, '')) IN ('active', 'in_progress', 'complete', 'completed')
      AND tm.cat_a_id IS NOT NULL
      AND tm.cat_b_id IS NOT NULL
      AND tm.cat_a_id <> tm.cat_b_id
      AND NOT EXISTS (
        SELECT 1 FROM public.arena_match_queue q
        WHERE q.tournament_id = v_tournament_id
          AND q.match_id = tm.id
      )
    ORDER BY tm.created_at DESC, tm.id
    LIMIT v_needed;
  END IF;

  SELECT * INTO v_state
  FROM public.arena_page_state s
  WHERE s.identity_key = v_identity
    AND s.arena_type = v_arena
  FOR UPDATE;

  IF FOUND THEN
    IF COALESCE(array_length(v_state.match_ids, 1), 0) > 0 THEN
      SELECT COUNT(*)::INT INTO v_voted_count
      FROM unnest(COALESCE(v_state.match_ids, '{}')) AS m
      WHERE m = ANY(COALESCE(v_state.voted_ids, '{}'));

      IF v_voted_count < COALESCE(array_length(v_state.match_ids, 1), 0) THEN
        RETURN jsonb_build_object(
          'ok', true,
          'arena_type', v_arena,
          'tournament_id', v_tournament_id,
          'page_index', v_state.page_index,
          'page_size', COALESCE(array_length(v_state.match_ids, 1), 0),
          'total_size', v_total_size,
          'match_ids', to_jsonb(COALESCE(v_state.match_ids, '{}')),
          'voted_ids', to_jsonb(COALESCE(v_state.voted_ids, '{}')),
          'voted_count', v_voted_count,
          'page_complete', false,
          'resumed', true
        );
      END IF;
    END IF;
    v_next_page_index := COALESCE(v_state.page_index, -1) + 1;
  ELSE
    v_next_page_index := 0;
  END IF;

  v_start_pos := v_next_page_index * v_page_size;

  SELECT ARRAY_AGG(q.match_id ORDER BY q.position)
  INTO v_match_ids
  FROM (
    SELECT q.match_id, q.position
    FROM public.arena_match_queue q
    WHERE q.tournament_id = v_tournament_id
      AND q.arena_type = v_arena
      AND q.status = 'queued'
      AND q.position >= v_start_pos
    ORDER BY q.position
    LIMIT v_page_size
  ) q;

  IF COALESCE(array_length(v_match_ids, 1), 0) = 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.arena_match_queue q
      WHERE q.tournament_id = v_tournament_id
        AND q.arena_type = v_arena
        AND q.status = 'served'
    ) THEN
      UPDATE public.arena_match_queue
      SET status = 'queued',
          served_at = NULL
      WHERE tournament_id = v_tournament_id
        AND arena_type = v_arena
        AND status = 'served';
    END IF;

    v_next_page_index := 0;
    v_start_pos := 0;
    SELECT ARRAY_AGG(q.match_id ORDER BY q.position)
    INTO v_match_ids
    FROM (
      SELECT q.match_id, q.position
      FROM public.arena_match_queue q
      WHERE q.tournament_id = v_tournament_id
        AND q.arena_type = v_arena
        AND q.status = 'queued'
      ORDER BY q.position
      LIMIT v_page_size
    ) q;
  END IF;

  IF COALESCE(array_length(v_match_ids, 1), 0) > 0 THEN
    UPDATE public.arena_match_queue q
    SET status = 'served', served_at = NOW()
    WHERE q.tournament_id = v_tournament_id
      AND q.arena_type = v_arena
      AND q.match_id = ANY(v_match_ids);
  END IF;

  INSERT INTO public.arena_page_state (identity_key, arena_type, page_index, match_ids, voted_ids, created_at, updated_at)
  VALUES (v_identity, v_arena, v_next_page_index, COALESCE(v_match_ids, '{}'), '{}', NOW(), NOW())
  ON CONFLICT (identity_key, arena_type)
  DO UPDATE SET
    page_index = EXCLUDED.page_index,
    match_ids = EXCLUDED.match_ids,
    voted_ids = EXCLUDED.voted_ids,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'arena_type', v_arena,
    'tournament_id', v_tournament_id,
    'page_index', v_next_page_index,
    'page_size', COALESCE(array_length(v_match_ids, 1), 0),
    'total_size', v_total_size,
    'match_ids', to_jsonb(COALESCE(v_match_ids, '{}')),
    'voted_ids', '[]'::jsonb,
    'voted_count', 0,
    'page_complete', false,
    'resumed', false
  );
END;
$$;
