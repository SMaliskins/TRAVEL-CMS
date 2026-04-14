-- Latest CRM / order-log activity per user (order_communications.sent_by).
-- Used by GET /api/auth/company-sessions for "Last activity" column.
-- Run in Supabase SQL editor if Staff sessions should include order log timestamps.

CREATE OR REPLACE FUNCTION public.company_users_last_comm_activity(p_company_id uuid)
RETURNS TABLE(user_id uuid, last_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oc.sent_by AS user_id, MAX(oc.created_at) AS last_at
  FROM public.order_communications oc
  WHERE oc.company_id = p_company_id
    AND oc.sent_by IS NOT NULL
  GROUP BY oc.sent_by;
$$;

REVOKE ALL ON FUNCTION public.company_users_last_comm_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_users_last_comm_activity(uuid) TO service_role;
