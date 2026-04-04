-- Cached AI translations of email template subject/body per locale (ISO codes: ru, lv, …).
-- Master text remains in subject/body; Settings save triggers regeneration.
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN email_templates.translations IS
  'Map locale code -> { "subject": string, "body": string }; placeholders {{var}} preserved. Master stays in subject/body; en uses columns, not this map.';
