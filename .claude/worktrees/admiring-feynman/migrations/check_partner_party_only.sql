-- ============================================
-- CHECK: partner_party table structure ONLY
-- ============================================
-- Purpose: Check only partner_party to see required fields
-- ============================================

-- Partner Party structure
SELECT 
    'partner_party structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️  REQUIRED (no default)'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ REQUIRED (has default)'
        WHEN is_nullable = 'YES' THEN 'ℹ️  OPTIONAL'
        ELSE 'UNKNOWN'
    END as column_status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- API INSERT analysis for partner_party
SELECT 
    'API INSERT analysis' as check_type,
    'partner_party' as table_name,
    column_name,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️  REQUIRED - Check if API provides this'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ Has default - OK if missing'
        WHEN is_nullable = 'YES' THEN 'ℹ️  Optional - OK if missing'
        ELSE 'UNKNOWN'
    END as api_insert_status,
    CASE 
        WHEN column_name = 'party_id' THEN '✅ API provides (required FK)'
        WHEN column_name IN ('created_at', 'updated_at') THEN 'ℹ️  Usually auto-set by DB'
        WHEN is_nullable = 'NO' AND column_default IS NULL AND column_name != 'party_id' THEN '❌ API might be missing this required field'
        ELSE '✅ OK'
    END as recommendation
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'partner_party'
ORDER BY ordinal_position;





