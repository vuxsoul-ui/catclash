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
  v_match_ids UUID[] := '{}';
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

CREATE OR REPLACE FUNCTION public.get_today_tournament()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_tournament_id UUID;
BEGIN
  -- Check if tournament exists for today
  SELECT id INTO v_tournament_id FROM tournaments WHERE date = v_today;
  
  IF v_tournament_id IS NULL THEN
    -- Seed NPC cats if needed
    PERFORM seed_npc_cats_if_needed(16);
    
    -- Create new tournament
    INSERT INTO tournaments (date, status, round)
    VALUES (v_today, 'active', 1)
    RETURNING id INTO v_tournament_id;
    
    -- Get 16 random approved cats (now includes NPCs)
    INSERT INTO tournament_entries (tournament_id, cat_id, user_id, seed)
    SELECT v_tournament_id, c.id, c.user_id, row_number() OVER ()
    FROM (
      SELECT id, user_id FROM cats
      WHERE status = 'approved'
      ORDER BY RANDOM()
      LIMIT 16
    ) c;
    
    -- Create round 1 matches (8 matches)
    INSERT INTO tournament_matches (tournament_id, round, cat_a_id, cat_b_id, status)
    SELECT 
      v_tournament_id,
      1,
      e1.cat_id,
      e2.cat_id,
      'pending'
    FROM tournament_entries e1
    JOIN tournament_entries e2 ON e2.seed = e1.seed + 1
    WHERE e1.tournament_id = v_tournament_id
      AND e1.seed % 2 = 1
      AND e2.seed % 2 = 0;
  END IF;
  
  -- Return tournament with matches including image_url
  RETURN (
    SELECT jsonb_build_object(
      'tournament_id', t.id,
      'date', t.date,
      'round', t.round,
      'matches', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'match_id', m.id,
          'cat_a', jsonb_build_object(
            'id', c1.id,
            'name', c1.name,
            'image_path', c1.image_path,
            'image_url', COALESCE(
              c1.image_url_card,
              c1.image_url_original,
              c1.image_path
            )
          ),
          'cat_b', jsonb_build_object(
            'id', c2.id,
            'name', c2.name,
            'image_path', c2.image_path,
            'image_url', COALESCE(
              c2.image_url_card,
              c2.image_url_original,
              c2.image_path
            )
          ),
          'status', m.status,
          'votes_a', m.votes_a,
          'votes_b', m.votes_b
        ))
        FROM tournament_matches m
        JOIN cats c1 ON c1.id = m.cat_a_id
        JOIN cats c2 ON c2.id = m.cat_b_id
        WHERE m.tournament_id = t.id AND m.round = t.round
      ), '[]'::jsonb)
    )
    FROM tournaments t
    WHERE t.id = v_tournament_id
  );
END;
$$;
