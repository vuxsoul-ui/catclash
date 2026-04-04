-- Secure password reset tokens + one-time recovery backup codes

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  requested_ip_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON public.password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS public.password_recovery_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_codes_user_id
  ON public.password_recovery_codes(user_id);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_recovery_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.password_reset_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.password_recovery_codes FROM anon, authenticated;
