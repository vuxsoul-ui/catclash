CREATE TABLE IF NOT EXISTS public.crate_openings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_key TEXT NOT NULL,
  crate_type TEXT NOT NULL CHECK (crate_type IN ('daily', 'premium', 'epic')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete')),
  cat_id UUID NULL REFERENCES public.cats(id) ON DELETE SET NULL,
  reward_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  dismissed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_crate_openings_identity_created
  ON public.crate_openings(identity_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crate_openings_identity_active
  ON public.crate_openings(identity_key, dismissed_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crate_openings_pending
  ON public.crate_openings(identity_key, crate_type)
  WHERE status = 'pending';

ALTER TABLE public.crate_openings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crate_openings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_crate(
  identity_key TEXT,
  crate_type TEXT,
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

  PERFORM pg_advisory_xact_lock(hashtext('crate_open:' || v_identity || ':' || v_crate));

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
    RETURN jsonb_build_object('ok', true, 'resume', true, 'just_created', false, 'opening', to_jsonb(v_existing));
  END IF;

  INSERT INTO public.crate_openings (identity_key, crate_type, status)
  VALUES (v_identity, v_crate, 'pending')
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object('ok', true, 'resume', false, 'just_created', true, 'opening', to_jsonb(v_inserted));
END;
$$;
