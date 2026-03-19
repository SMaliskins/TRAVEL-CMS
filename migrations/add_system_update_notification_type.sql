-- Migration: Add 'system_update' type to staff_notifications
-- Allows publishing system news / changelog entries as in-app notifications

-- Drop and recreate CHECK constraint to add new type
ALTER TABLE public.staff_notifications
  DROP CONSTRAINT IF EXISTS staff_notifications_type_check;

ALTER TABLE public.staff_notifications
  ADD CONSTRAINT staff_notifications_type_check
  CHECK (type IN ('checkin_open', 'checkin_reminder', 'passport_expiry', 'payment_overdue', 'system_update'));

COMMENT ON COLUMN public.staff_notifications.type IS 'Notification type: checkin_open, checkin_reminder, passport_expiry, payment_overdue, system_update';
