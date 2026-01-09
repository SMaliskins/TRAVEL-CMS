-- Проверка текущей структуры таблицы party_person
-- Для определения структуры полей паспорта

-- ============================================
-- 1. Текущая структура party_person
-- ============================================
SELECT 
    'party_person CURRENT SCHEMA' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party_person'
ORDER BY ordinal_position;

-- ============================================
-- 2. Constraints для party_person
-- ============================================
SELECT 
    'party_person CONSTRAINTS' as check_type,
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
-- 3. Проверка существования passport полей
-- ============================================
SELECT 
    'PASSPORT FIELDS CHECK' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as status,
    STRING_AGG(column_name, ', ') as existing_passport_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party_person'
  AND (
    column_name LIKE '%passport%' 
    OR column_name LIKE '%nationality%'
    OR column_name LIKE '%issu%'
    OR column_name LIKE '%expir%'
  );

