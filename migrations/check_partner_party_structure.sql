-- Проверка реальной структуры таблицы partner_party
-- Запустите этот скрипт в Supabase SQL Editor

-- ============================================
-- 1. Все колонки таблицы partner_party
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- ============================================
-- 2. Первичный ключ
-- ============================================
SELECT 
    'PRIMARY KEY' as constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'partner_party'
  AND tc.constraint_type = 'PRIMARY KEY';

-- ============================================
-- 3. Внешние ключи
-- ============================================
SELECT 
    'FOREIGN KEY' as constraint_type,
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
  AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================
-- 4. CHECK constraints (важно!)
-- ============================================
SELECT 
    'CHECK CONSTRAINT' as constraint_type,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.partner_party'::regclass
  AND contype = 'c';

-- ============================================
-- 5. Пример данных (если есть записи)
-- ============================================
SELECT 
    'SAMPLE DATA' as check_type,
    *
FROM public.partner_party
ORDER BY id DESC
LIMIT 3;

