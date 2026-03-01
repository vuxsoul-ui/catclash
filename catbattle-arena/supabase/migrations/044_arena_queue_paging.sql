CREATE TABLE IF NOT EXISTS public.arena_match_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  arena_type TEXT NOT NULL CHECK (arena_type IN ('main', 'rookie')),
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  position INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'served')),
  served_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_arena_match_queue_tournament_match
  ON public.arena_match_queue(tournament_id, match_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_arena_match_queue_position
  ON public.arena_match_queue(tournament_id, arena_type, position);

CREATE INDEX IF NOT EXISTS idx_arena_match_queue_status
  ON public.arena_match_queue(tournament_id, arena_type, status, position);

CREATE TABLE IF NOT EXISTS public.arena_page_state (
  identity_key TEXT NOT NULL,
  arena_type TEXT NOT NULL CHECK (arena_type IN ('main', 'rookie')),
  page_index INT NOT NULL DEFAULT 0,
  match_ids UUID[] NOT NULL DEFAULT '{}',
  voted_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identity_key, arena_type)
);

CREATE INDEX IF NOT EXISTS idx_arena_page_state_updated
  ON public.arena_page_state(arena_type, updated_at DESC);

ALTER TABLE public.arena_match_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_page_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.arena_match_queue FROM anon, authenticated;
REVOKE ALL ON TABLE public.arena_page_state FROM anon, authenticated;

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
    AND t.tournament_type = v_arena
    AND LOWER(COALESCE(t.status, '')) IN ('active', 'in_progress')
  ORDER BY CASE WHEN LOWER(COALESCE(t.status, '')) = 'active' THEN 0 ELSE 1 END, t.created_at DESC
  LIMIT 1;

  IF v_tournament_id IS NULL THEN
    SELECT t.id INTO v_tournament_id
    FROM public.tournaments t
    WHERE t.tournament_type = v_arena
      AND LOWER(COALESCE(t.status, '')) IN ('active', 'in_progress')
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
    'voted_ids', to_jsonb('{}'::UUID[]),
    'voted_count', 0,
    'page_complete', false,
    'resumed', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_arena_page_vote(
  p_identity_key TEXT,
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity TEXT := NULLIF(BTRIM(p_identity_key), '');
  v_state public.arena_page_state%ROWTYPE;
  v_page_size INT := 0;
  v_voted_count INT := 0;
  v_contains BOOLEAN := FALSE;
BEGIN
  IF v_identity IS NULL OR p_match_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_params');
  END IF;

  SELECT * INTO v_state
  FROM public.arena_page_state s
  WHERE s.identity_key = v_identity
    AND p_match_id = ANY(COALESCE(s.match_ids, '{}'))
  ORDER BY s.updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'matched', false,
      'page_complete', false,
      'voted_count', 0,
      'page_size', 0,
      'page_index', 0
    );
  END IF;

  v_page_size := COALESCE(array_length(v_state.match_ids, 1), 0);
  v_contains := p_match_id = ANY(COALESCE(v_state.voted_ids, '{}'));

  IF NOT v_contains THEN
    UPDATE public.arena_page_state
    SET voted_ids = array_append(COALESCE(voted_ids, '{}'), p_match_id),
        updated_at = NOW()
    WHERE identity_key = v_state.identity_key
      AND arena_type = v_state.arena_type;

    v_state.voted_ids := array_append(COALESCE(v_state.voted_ids, '{}'), p_match_id);
  END IF;

  SELECT COUNT(*)::INT INTO v_voted_count
  FROM unnest(COALESCE(v_state.match_ids, '{}')) AS m
  WHERE m = ANY(COALESCE(v_state.voted_ids, '{}'));

  RETURN jsonb_build_object(
    'ok', true,
    'matched', true,
    'arena_type', v_state.arena_type,
    'page_index', v_state.page_index,
    'page_size', v_page_size,
    'voted_count', v_voted_count,
    'page_complete', (v_page_size > 0 AND v_voted_count >= v_page_size)
  );
END;
$$;
