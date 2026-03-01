ALTER TABLE public.crate_openings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crate_openings_identity_idempotency
  ON public.crate_openings(identity_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.open_crate_idempotent(
  identity_key TEXT,
  crate_type TEXT,
  idempotency_key TEXT DEFAULT NULL,
  resume_window_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity TEXT := NULLIF(BTRIM(identity_key), '');
  v_crate TEXT := LOWER(NULLIF(BTRIM(crate_type), ''));
  v_idem TEXT := NULLIF(BTRIM(idempotency_key), '');
  v_window INTERVAL := make_interval(mins => GREATEST(1, LEAST(COALESCE(resume_window_minutes, 10), 120)));
  v_existing public.crate_openings%ROWTYPE;
  v_inserted public.crate_openings%ROWTYPE;
BEGIN
  IF v_identity IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_identity');
  END IF;

  IF v_crate IS NULL THEN
    v_crate := 'daily';
  END IF;

  IF v_crate NOT IN ('daily', 'premium', 'epic') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_crate_type');
  END IF;

  IF v_idem IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.crate_openings co
    WHERE co.identity_key = v_identity
      AND co.idempotency_key = v_idem
    ORDER BY co.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'resume', true,
        'just_created', false,
        'idempotency_hit', true,
        'opening', to_jsonb(v_existing)
      );
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crate_open:' || v_identity || ':' || COALESCE(v_idem, v_crate)));

  IF v_idem IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.crate_openings co
    WHERE co.identity_key = v_identity
      AND co.idempotency_key = v_idem
    ORDER BY co.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'resume', true,
        'just_created', false,
        'idempotency_hit', true,
        'opening', to_jsonb(v_existing)
      );
    END IF;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.crate_openings co
  WHERE co.identity_key = v_identity
    AND co.crate_type = v_crate
    AND co.status = 'pending'
    AND co.created_at >= NOW() - v_window
  ORDER BY co.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'resume', true,
      'just_created', false,
      'idempotency_hit', false,
      'opening', to_jsonb(v_existing)
    );
  END IF;

  INSERT INTO public.crate_openings (identity_key, crate_type, idempotency_key, status)
  VALUES (v_identity, v_crate, v_idem, 'pending')
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'resume', false,
    'just_created', true,
    'idempotency_hit', false,
    'opening', to_jsonb(v_inserted)
  );
END;
$$;
