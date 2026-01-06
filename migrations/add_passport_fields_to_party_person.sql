-- Migration: Add passport fields to party_person table
-- Run this in Supabase SQL Editor
-- Based on DB/SCHEMA Agent specification: .ai/DB_SCHEMA_PASSPORT_FIELDS.md

DO $$ 
BEGIN
    -- Add passport_number if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_number'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN passport_number text;
        
        COMMENT ON COLUMN public.party_person.passport_number IS 'Passport number/document number';
    END IF;

    -- Add passport_issue_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_issue_date'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN passport_issue_date date;
        
        COMMENT ON COLUMN public.party_person.passport_issue_date IS 'Date when passport was issued';
    END IF;

    -- Add passport_expiry_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_expiry_date'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN passport_expiry_date date;
        
        COMMENT ON COLUMN public.party_person.passport_expiry_date IS 'Passport expiration date';
    END IF;

    -- Add passport_issuing_country if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_issuing_country'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN passport_issuing_country text;
        
        COMMENT ON COLUMN public.party_person.passport_issuing_country IS 'Country that issued the passport (ISO code or name)';
    END IF;

    -- Add passport_full_name if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_full_name'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN passport_full_name text;
        
        COMMENT ON COLUMN public.party_person.passport_full_name IS 'Full name exactly as shown in passport document';
    END IF;

    -- Add nationality if not exists (check if citizenship exists first)
    -- If citizenship exists, we'll use it; otherwise add nationality
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'nationality'
    ) THEN
        -- Only add nationality if citizenship doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'party_person' 
            AND column_name = 'citizenship'
        ) THEN
            ALTER TABLE public.party_person 
            ADD COLUMN nationality text;
            
            COMMENT ON COLUMN public.party_person.nationality IS 'Nationality of the person';
        END IF;
    END IF;
END $$;

-- Create partial index on passport_number for search performance
CREATE INDEX IF NOT EXISTS idx_party_person_passport_number 
ON public.party_person(passport_number) 
WHERE passport_number IS NOT NULL;

-- Add CHECK constraint for date validation (expiry > issue date)
-- Only add if both columns exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_issue_date'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'passport_expiry_date'
    ) THEN
        -- Drop constraint if exists (to allow re-running migration)
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'party_person' 
            AND constraint_name = 'check_passport_dates'
        ) THEN
            ALTER TABLE public.party_person DROP CONSTRAINT check_passport_dates;
        END IF;
        
        -- Add constraint
        ALTER TABLE public.party_person 
        ADD CONSTRAINT check_passport_dates 
        CHECK (
            passport_issue_date IS NULL 
            OR passport_expiry_date IS NULL 
            OR passport_expiry_date > passport_issue_date
        );
    END IF;
END $$;

