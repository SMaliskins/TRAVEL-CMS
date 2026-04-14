-- Staff browser/device presence for Supervisor session visibility (updated via /api/auth/session-heartbeat)
-- Apply in Supabase SQL editor or your migration runner.

CREATE TABLE IF NOT EXISTS public.user_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_auth_sessions_user_device UNIQUE (user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_sessions_company_last_seen
  ON public.user_auth_sessions (company_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_auth_sessions_user_id
  ON public.user_auth_sessions (user_id);

COMMENT ON TABLE public.user_auth_sessions IS 'Staff UI sessions; rows upserted from API using service role only.';
