-- Проверка подключения базы данных для orders/new
-- Проверка существования таблиц и доступности данных

-- ============================================
-- 1. Проверка таблицы orders
-- ============================================
SELECT 
    'orders TABLE CHECK' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as table_exists,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'orders';

-- Структура таблицы orders
SELECT 
    'orders COLUMNS' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
ORDER BY ordinal_position
LIMIT 20;

-- ============================================
-- 2. Проверка таблицы profiles (для company_id)
-- ============================================
SELECT 
    'profiles TABLE CHECK' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as table_exists,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'profiles';

-- Структура таблицы profiles
SELECT 
    'profiles COLUMNS' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================
-- 3. Проверка таблицы party (для PartySelect)
-- ============================================
SELECT 
    'party TABLE CHECK' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as table_exists,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'party';

-- Количество записей в party
SELECT 
    'party COUNT' as check_type,
    COUNT(*) as total_records
FROM public.party;

-- ============================================
-- 4. Проверка таблицы client_party (для фильтрации)
-- ============================================
SELECT 
    'client_party TABLE CHECK' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as table_exists,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'client_party';

-- Количество клиентов
SELECT 
    'client_party COUNT' as check_type,
    COUNT(*) as total_clients
FROM public.client_party;

-- ============================================
-- 5. Проверка RLS на таблицах
-- ============================================
SELECT 
    'RLS STATUS' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'profiles', 'party', 'client_party')
ORDER BY tablename;

