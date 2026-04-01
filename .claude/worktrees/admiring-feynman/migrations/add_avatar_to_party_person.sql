-- Migration: Add avatar_url to party_person table
-- For storing passport photo extracted from PDF

DO $$ 
BEGIN
    -- Add avatar_url if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN avatar_url text;
        
        COMMENT ON COLUMN public.party_person.avatar_url IS 'URL to avatar/photo image (extracted from passport or uploaded)';
    END IF;
END $$;
