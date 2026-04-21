-- Migration: Add 'payment_received' type to staff_notifications.
-- Allows surfacing incoming payments in the bell icon feed (with cash-register chime).
--
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE public.staff_notifications
  DROP CONSTRAINT IF EXISTS staff_notifications_type_check;

ALTER TABLE public.staff_notifications
  ADD CONSTRAINT staff_notifications_type_check
  CHECK (type IN (
    'checkin_open',
    'checkin_reminder',
    'passport_expiry',
    'payment_overdue',
    'system_update',
    'payment_received'
  ));

COMMENT ON COLUMN public.staff_notifications.type IS
  'Notification type: checkin_open, checkin_reminder, passport_expiry, payment_overdue, system_update, payment_received';
