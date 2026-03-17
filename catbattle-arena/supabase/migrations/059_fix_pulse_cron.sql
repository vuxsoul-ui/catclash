-- MANUAL STEP REQUIRED BEFORE THIS MIGRATION:
-- Run in Supabase SQL editor (not here):
--   SELECT vault.create_secret(
--     'SERVICE_ROLE_KEY',
--     '[your_service_role_key]',
--     'Service role key for pulse cron trigger'
--   );
-- Do not commit the actual key to this file.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  BEGIN
    SELECT jobid
      INTO v_job_id
    FROM cron.job
    WHERE jobname = 'pulse-resolution'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      v_job_id := NULL;
  END;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_pulse_resolution()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret TEXT;
  v_url TEXT := 'https://zjskvepaefxhcesooaee.supabase.co/functions/v1/resolve-pulse';
BEGIN
  SELECT decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SERVICE_ROLE_KEY'
  LIMIT 1;

  IF COALESCE(v_secret, '') = '' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_KEY vault secret not found';
  END IF;

  PERFORM net.http_post(
    url := v_url,
    body := '{"resolved_by":"scheduler"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    )
  );
END;
$$;

SELECT cron.schedule(
  'pulse-resolution',
  '0 0 * * 1',
  'SELECT public.trigger_pulse_resolution();'
);
