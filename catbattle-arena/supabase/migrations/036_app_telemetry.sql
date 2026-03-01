CREATE TABLE IF NOT EXISTS public.app_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_telemetry_event_created
  ON public.app_telemetry(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_telemetry_user_created
  ON public.app_telemetry(user_id, created_at DESC);
