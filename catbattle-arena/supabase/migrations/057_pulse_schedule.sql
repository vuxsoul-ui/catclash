CREATE TABLE IF NOT EXISTS public.pulses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at TIMESTAMPTZ NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'locked', 'resolved', 'failed')),
  resolved_by TEXT,
  matchup_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulses_status_scheduled_at
  ON public.pulses (status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  cat_id UUID REFERENCES public.cats(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_owner_select'
  ) THEN
    CREATE POLICY notifications_owner_select
      ON public.notifications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_owner_update'
  ) THEN
    CREATE POLICY notifications_owner_update
      ON public.notifications
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.match_history
  DROP CONSTRAINT IF EXISTS match_history_pulse_id_fkey;

ALTER TABLE public.match_history
  ADD CONSTRAINT match_history_pulse_id_fkey
  FOREIGN KEY (pulse_id)
  REFERENCES public.pulses(id)
  ON DELETE CASCADE;

WITH next_pulse AS (
  SELECT ((date_trunc('week', now() AT TIME ZONE 'UTC') + interval '1 week') AT TIME ZONE 'UTC') AS scheduled_at
)
INSERT INTO public.pulses (scheduled_at, locked_at, status)
SELECT
  next_pulse.scheduled_at,
  next_pulse.scheduled_at - interval '2 hours',
  'pending'
FROM next_pulse
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pulses p
  WHERE p.scheduled_at = next_pulse.scheduled_at
);

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $pulse_schedule$
DECLARE
  existing_job_id BIGINT;
BEGIN
  BEGIN
    SELECT jobid
      INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'pulse-resolution'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      existing_job_id := NULL;
  END;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'pulse-resolution',
    '0 0 * * 1',
    $job$
      SELECT net.http_post(
        url := current_setting('app.edge_function_url') || '/resolve-pulse',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
          'Content-Type', 'application/json'
        )
      );
    $job$
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron or pg_net unavailable; pulse-resolution schedule not installed';
END
$pulse_schedule$;
