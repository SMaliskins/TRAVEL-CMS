-- Проверка маппинга полей Supplier
-- Сравнение: Форма → API → База данных (partner_party)

-- ============================================
-- 1. Структура таблицы partner_party
-- ============================================
SELECT 
    'partner_party COLUMNS' as check_type,
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
-- 2. Constraints для partner_party
-- ============================================
SELECT 
    'partner_party CONSTRAINTS' as check_type,
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

-- ============================================
-- 3. CHECK constraints (важно для business_category, commission_type)
-- ============================================
SELECT 
    'partner_party CHECK CONSTRAINTS' as check_type,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.partner_party'::regclass
  AND contype = 'c';

-- ============================================
-- 4. Пример данных (если есть записи Supplier)
-- ============================================
SELECT 
    'partner_party SAMPLE DATA' as check_type,
    id,
    party_id,
    partner_role,
    business_category,
    commission_type,
    commission_value,
    commission_currency,
    commission_valid_from,
    commission_valid_to,
    commission_notes
FROM public.partner_party
ORDER BY id DESC
LIMIT 5;

-- ============================================
-- 5. Маппинг Form → DB (для справки)
-- ============================================
-- Форма отправляет:
--   supplierExtras.activityArea → DB: business_category
--   supplierExtras.commissionType → DB: commission_type
--   supplierExtras.commissionValue → DB: commission_value
--   supplierExtras.commissionCurrency → DB: commission_currency
--   supplierExtras.commissionValidFrom → DB: commission_valid_from
--   supplierExtras.commissionValidTo → DB: commission_valid_to

