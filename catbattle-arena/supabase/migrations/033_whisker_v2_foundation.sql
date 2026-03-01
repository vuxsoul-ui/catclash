-- Whisker Arena V2 additive foundation

ALTER TABLE IF EXISTS public.user_progress
ADD COLUMN IF NOT EXISTS whisker_tokens INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.whisker_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whisker_telemetry_user_created
ON public.whisker_telemetry(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whisker_telemetry_event_created
ON public.whisker_telemetry(event_name, created_at DESC);
