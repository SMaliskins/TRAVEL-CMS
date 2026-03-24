-- Client mobile app: show Referral tab when enabled in Directory (client role).
-- Apply in Supabase SQL Editor (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_party' AND column_name = 'show_referral_in_app'
  ) THEN
    ALTER TABLE public.client_party
      ADD COLUMN show_referral_in_app boolean NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.client_party.show_referral_in_app IS
      'When true, client mobile app shows the Referral section (commission overview) for this party';
  END IF;
END $$;
