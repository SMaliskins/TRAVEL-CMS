-- Migration: Add is_alien_passport to party_person table
-- For Latvia/Estonia Alien's passports: document says "Alien's passport"
-- Statistics count by passport_issuing_country for alien passports

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_person'
        AND column_name = 'is_alien_passport'
    ) THEN
        ALTER TABLE public.party_person
        ADD COLUMN is_alien_passport boolean DEFAULT false;

        COMMENT ON COLUMN public.party_person.is_alien_passport IS 'Latvia/Estonia Alien''s passport - document says "Alien''s passport". Statistics count by passport_issuing_country.';
    END IF;
END $$;
