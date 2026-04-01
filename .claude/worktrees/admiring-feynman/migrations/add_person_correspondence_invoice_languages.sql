-- Add correspondence_languages and invoice_language to party_person for person clients
-- Same as party_company - used for Directory person clients

ALTER TABLE public.party_person
ADD COLUMN IF NOT EXISTS correspondence_languages jsonb DEFAULT '["en"]'::jsonb;

ALTER TABLE public.party_person
ADD COLUMN IF NOT EXISTS invoice_language text DEFAULT 'en';

COMMENT ON COLUMN public.party_person.correspondence_languages IS 'Languages of correspondence for person clients (e.g. ["en", "lv", "ru"])';
COMMENT ON COLUMN public.party_person.invoice_language IS 'Invoice language for person clients (e.g. en, lv, ru)';
