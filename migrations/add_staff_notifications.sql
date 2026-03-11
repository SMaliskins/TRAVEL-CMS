-- Staff notifications for CMS dashboard (bell icon)
-- Used by cron reminders: check-in, passport expiry, overdue payments

CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('checkin_open', 'checkin_reminder', 'passport_expiry', 'payment_overdue')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  ref_id text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_notifications_ref_id_idx
  ON public.staff_notifications (company_id, ref_id);

CREATE INDEX IF NOT EXISTS staff_notifications_company_unread_idx
  ON public.staff_notifications (company_id, read, created_at DESC);

COMMENT ON TABLE public.staff_notifications IS 'In-app notifications for CMS staff (bell icon in TopBar)';
COMMENT ON COLUMN public.staff_notifications.ref_id IS 'Dedup key to prevent duplicate notifications (e.g. checkin:serviceId:segIdx)';
COMMENT ON COLUMN public.staff_notifications.type IS 'Notification type: checkin_open, checkin_reminder, passport_expiry, payment_overdue';
