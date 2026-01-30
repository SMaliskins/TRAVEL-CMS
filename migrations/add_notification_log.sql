-- Migration: Add notification_log table for tracking sent notifications
-- Date: 2026-01-19

-- Create notification_log table
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('checkin_open', 'checkin_reminder', 'checkin_closing', 'deadline_reminder', 'other')),
  recipient_email TEXT NOT NULL,
  flight_number TEXT,
  booking_ref TEXT,
  client_name TEXT,
  departure_time TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES auth.users(id),
  email_sent BOOLEAN DEFAULT FALSE,
  desktop_notification_shown BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for querying by booking ref and flight
CREATE INDEX IF NOT EXISTS idx_notification_log_booking_ref ON public.notification_log(booking_ref);
CREATE INDEX IF NOT EXISTS idx_notification_log_flight_number ON public.notification_log(flight_number);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON public.notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON public.notification_log(type);

-- Add RLS policies
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notification_log
  FOR SELECT
  USING (sent_by = auth.uid());

-- Users can insert notifications
CREATE POLICY "Users can insert notifications" ON public.notification_log
  FOR INSERT
  WITH CHECK (sent_by = auth.uid());

-- Add comments
COMMENT ON TABLE public.notification_log IS 'Log of all notifications sent (email, desktop) for check-in reminders, deadlines, etc.';
COMMENT ON COLUMN public.notification_log.type IS 'Type of notification: checkin_open, checkin_reminder, checkin_closing, deadline_reminder, other';
