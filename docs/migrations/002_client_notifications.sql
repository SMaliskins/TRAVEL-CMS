-- Migration: client_notifications table
-- Stores in-app notification history for client mobile app

CREATE TABLE IF NOT EXISTS client_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT,
  type        TEXT        NOT NULL DEFAULT 'order_update',
  ref_id      UUID,
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notifications_client
  ON client_notifications(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_notifications_unread
  ON client_notifications(client_id) WHERE read = false;

ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own notifications"
  ON client_notifications FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Service role full access on client_notifications"
  ON client_notifications FOR ALL
  USING (true)
  WITH CHECK (true);
