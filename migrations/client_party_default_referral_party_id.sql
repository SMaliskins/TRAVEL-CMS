-- Default referral partner for a client: auto-filled on new orders (see lib/referral/clientDefaultReferralParty.ts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_party' AND column_name = 'default_referral_party_id'
  ) THEN
    ALTER TABLE public.client_party
      ADD COLUMN default_referral_party_id uuid NULL
      REFERENCES public.party (id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.client_party.default_referral_party_id IS
      'Referral partner party_id auto-applied to new orders for this client; cleared when client has no non-cancelled trip activity for 2+ years.';
    CREATE INDEX IF NOT EXISTS idx_client_party_default_referral_party_id
      ON public.client_party (default_referral_party_id)
      WHERE default_referral_party_id IS NOT NULL;
  END IF;
END $$;
