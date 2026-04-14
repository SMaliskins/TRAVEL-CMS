-- Last authenticated CRM activity (server-side, throttled ~1 min per user).
-- Bumped from getApiUser on staff API requests. Apply in Supabase before relying on "Last activity".

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

COMMENT ON COLUMN public.user_profiles.last_activity_at IS
  'Last time this user hit the CRM API with a valid session (throttled in user_profile_bump_activity).';

CREATE OR REPLACE FUNCTION public.user_profile_bump_activity(p_user_id uuid, p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_activity_at = now()
  WHERE id = p_user_id AND company_id = p_company_id
    AND (last_activity_at IS NULL OR last_activity_at < now() - interval '1 minute');
END;
$$;

REVOKE ALL ON FUNCTION public.user_profile_bump_activity(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_profile_bump_activity(uuid, uuid) TO service_role;
