-- Migration: Add gender to party_person table
-- male / female (мужчина / женщина)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_person'
        AND column_name = 'gender'
    ) THEN
        ALTER TABLE public.party_person
        ADD COLUMN gender text;

        COMMENT ON COLUMN public.party_person.gender IS 'Gender: male, female';
    END IF;
END $$;
