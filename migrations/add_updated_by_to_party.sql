-- Migration: Add updated_by to party table
-- Tracks which agent last edited the record (for audit)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party'
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE public.party
        ADD COLUMN updated_by uuid REFERENCES auth.users(id);

        COMMENT ON COLUMN public.party.updated_by IS 'User who last updated this party record';
    END IF;
END $$;
