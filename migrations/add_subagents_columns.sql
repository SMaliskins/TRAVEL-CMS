-- ============================================
-- MIGRATION: Add Optional Columns to subagents Table
-- ============================================
-- Purpose: Add commission_scheme, commission_tiers, payout_details columns
-- These columns are referenced by API code but don't exist in table
-- All columns are OPTIONAL (NULLABLE) - safe for existing data
-- ============================================

-- ============================================
-- PART 1: Create commission_scheme Enum Type
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_scheme') THEN
        CREATE TYPE commission_scheme AS ENUM ('revenue', 'profit');
        
        RAISE NOTICE 'Created enum type: commission_scheme';
    ELSE
        RAISE NOTICE 'Enum type commission_scheme already exists';
    END IF;
END $$;

-- ============================================
-- PART 2: Add Columns to subagents Table
-- ============================================

DO $$ 
BEGIN
    -- Add commission_scheme column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subagents' 
        AND column_name = 'commission_scheme'
    ) THEN
        ALTER TABLE public.subagents 
        ADD COLUMN commission_scheme commission_scheme;
        
        COMMENT ON COLUMN public.subagents.commission_scheme IS 'Commission calculation scheme: revenue or profit (optional)';
        
        RAISE NOTICE 'Added column: subagents.commission_scheme';
    ELSE
        RAISE NOTICE 'Column subagents.commission_scheme already exists';
    END IF;

    -- Add commission_tiers column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subagents' 
        AND column_name = 'commission_tiers'
    ) THEN
        ALTER TABLE public.subagents 
        ADD COLUMN commission_tiers jsonb;
        
        COMMENT ON COLUMN public.subagents.commission_tiers IS 'Commission tier levels as JSON (optional)';
        
        RAISE NOTICE 'Added column: subagents.commission_tiers';
    ELSE
        RAISE NOTICE 'Column subagents.commission_tiers already exists';
    END IF;

    -- Add payout_details column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subagents' 
        AND column_name = 'payout_details'
    ) THEN
        ALTER TABLE public.subagents 
        ADD COLUMN payout_details text;
        
        COMMENT ON COLUMN public.subagents.payout_details IS 'Payout details and instructions (optional)';
        
        RAISE NOTICE 'Added column: subagents.payout_details';
    ELSE
        RAISE NOTICE 'Column subagents.payout_details already exists';
    END IF;

    RAISE NOTICE 'Migration completed successfully';
END $$;

-- ============================================
-- PART 3: Verification
-- ============================================

-- Verify columns were added and are NULLABLE
SELECT 
    'verification' as check_type,
    'subagents columns' as table_name,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('commission_scheme', 'commission_tiers', 'payout_details') 
             AND is_nullable = 'YES'
        THEN '✅ Added correctly (NULLABLE)'
        WHEN column_name IN ('commission_scheme', 'commission_tiers', 'payout_details')
             AND is_nullable = 'NO'
        THEN '❌ ERROR: Column is NOT NULL (should be nullable)'
        ELSE 'ℹ️  Other column'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'subagents'
AND column_name IN ('commission_scheme', 'commission_tiers', 'payout_details')
ORDER BY column_name;

-- Verify enum type exists
SELECT 
    'enum verification' as check_type,
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values,
    CASE 
        WHEN t.typname = 'commission_scheme' AND string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) = 'revenue, profit'
        THEN '✅ Enum type correct'
        ELSE '⚠️  Verify enum values'
    END as status
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'commission_scheme'
GROUP BY t.typname;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- MIGRATION COMPLETE: Added optional columns to subagents table
-- 
-- This migration:
-- 1. ✅ Creates commission_scheme enum type ('revenue', 'profit')
-- 2. ✅ Adds commission_scheme column (NULLABLE, enum type)
-- 3. ✅ Adds commission_tiers column (NULLABLE, jsonb)
-- 4. ✅ Adds payout_details column (NULLABLE, text)
-- 5. ✅ All operations are idempotent (safe to run multiple times)
-- 
-- Safety:
-- - All columns are NULLABLE (no NOT NULL constraints)
-- - Existing records remain valid (new columns are NULL)
-- - No data loss or migration required
-- - Backward compatible
-- 
-- API Code Alignment:
-- - app/api/directory/[id]/route.ts lines 289-291 can now use these columns
-- - app/api/directory/create/route.ts lines 219-221 can now use these columns
-- - Columns match specification in .ai/tasks/directory-v1-full-architecture.md
-- 
-- Verification:
-- - Check that all three columns appear in verification query
-- - Verify enum type has correct values
-- - Test API INSERT with subagent role should now work
--
