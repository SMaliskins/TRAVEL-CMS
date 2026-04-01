-- ============================================
-- ПОЛНАЯ ПРОВЕРКА СХЕМЫ DIRECTORY ТАБЛИЦ
-- Для обновления DIRECTORY_FORM_DB_MAPPING.md
-- ============================================

-- ============================================
-- 1. Таблица party (Core table)
-- ============================================
SELECT 
    'party' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'uuid' THEN 'UUID'
        WHEN data_type = 'text' THEN 'TEXT'
        WHEN data_type = 'boolean' THEN 'BOOLEAN'
        WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
        WHEN data_type = 'integer' THEN 'INTEGER'
        ELSE data_type
    END as simplified_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party'
ORDER BY ordinal_position;

-- Constraints для party
SELECT 
    'party' as table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'party'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check constraints для party
SELECT 
    'party' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.party'::regclass
  AND contype = 'c';

-- ============================================
-- 2. Таблица party_person
-- ============================================
SELECT 
    'party_person' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'uuid' THEN 'UUID'
        WHEN data_type = 'text' THEN 'TEXT'
        WHEN data_type = 'date' THEN 'DATE'
        ELSE data_type
    END as simplified_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party_person'
ORDER BY ordinal_position;

-- Constraints для party_person
SELECT 
    'party_person' as table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'party_person'
ORDER BY tc.constraint_type, tc.constraint_name;

-- ============================================
-- 3. Таблица party_company
-- ============================================
SELECT 
    'party_company' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'uuid' THEN 'UUID'
        WHEN data_type = 'text' THEN 'TEXT'
        ELSE data_type
    END as simplified_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party_company'
ORDER BY ordinal_position;

-- Constraints для party_company
SELECT 
    'party_company' as table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'party_company'
ORDER BY tc.constraint_type, tc.constraint_name;

-- ============================================
-- 4. Таблица client_party
-- ============================================
SELECT 
    'client_party' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'uuid' THEN 'UUID'
        WHEN data_type = 'text' THEN 'TEXT'
        ELSE data_type
    END as simplified_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_party'
ORDER BY ordinal_position;

-- Constraints для client_party
SELECT 
    'client_party' as table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'client_party'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check constraints для client_party
SELECT 
    'client_party' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.client_party'::regclass
  AND contype = 'c';

-- ============================================
-- 5. Таблица partner_party
-- ============================================
SELECT 
    'partner_party' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'uuid' THEN 'UUID'
        WHEN data_type = 'text' THEN 'TEXT'
        WHEN data_type = 'numeric' THEN 'NUMERIC'
        WHEN data_type = 'date' THEN 'DATE'
        ELSE data_type
    END as simplified_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- Constraints для partner_party
SELECT 
    'partner_party' as table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'partner_party'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check constraints для partner_party
SELECT 
    'partner_party' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.partner_party'::regclass
  AND contype = 'c';

-- ============================================
-- 6. Таблица subagents
-- ============================================
SELECT 
    'subagents' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN data_type = 'uuid' THEN 'UUID'
        WHEN data_type = 'text' THEN 'TEXT'
        WHEN data_type = 'jsonb' THEN 'JSONB'
        ELSE data_type
    END as simplified_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subagents'
ORDER BY ordinal_position;

-- Constraints для subagents
SELECT 
    'subagents' as table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'subagents'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check constraints для subagents
SELECT 
    'subagents' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.subagents'::regclass
  AND contype = 'c';

-- ============================================
-- 7. Indexes для всех таблиц
-- ============================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents')
ORDER BY tablename, indexname;

-- ============================================
-- 8. RLS Policies
-- ============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents')
ORDER BY tablename, policyname;

