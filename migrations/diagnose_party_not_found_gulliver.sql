-- Диагностика: почему party ID 4642eea4-38ed-464d-866c-3d2bea38235e не найден
-- Party: Gulliver Travel
-- ПРОБЛЕМА: Список директории не фильтрует по company_id, а детальная страница фильтрует!

-- ============================================
-- ПРОВЕРКА 1: Существует ли запись в party?
-- ============================================
SELECT 
    '✅ party table' as check_type,
    id,
    display_name,
    party_type,
    status,
    company_id,
    email,
    phone,
    created_at
FROM public.party
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 2: Данные компании (party_company)
-- ============================================
SELECT 
    '✅ party_company table' as check_type,
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address
FROM public.party_company
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 3: Роли (client, supplier, subagent)
-- ============================================
SELECT 
    '✅ client_party role' as check_type,
    id::text,
    party_id::text,
    client_type
FROM public.client_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
UNION ALL
SELECT 
    '✅ partner_party role' as check_type,
    id::text,
    party_id::text,
    partner_role
FROM public.partner_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
UNION ALL
SELECT 
    '✅ subagents role' as check_type,
    id::text,
    party_id::text,
    COALESCE(commission_scheme::text, 'NULL')
FROM public.subagents
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 4: ⚠️ TENANT ISOLATION (ГЛАВНАЯ ПРОБЛЕМА!)
-- ============================================
-- Проверка company_id записи vs company_id пользователя
SELECT 
    '⚠️ tenant check' as check_type,
    p.id,
    p.display_name,
    p.company_id as party_company_id,
    c.name as party_company_name,
    (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()) as current_user_company_id,
    CASE 
        WHEN p.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()) 
        THEN '✅ MATCH - запись должна быть видна'
        ELSE '❌ NO MATCH - запись НЕ видна через API (tenant isolation)'
    END as tenant_match_status
FROM public.party p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 5: Все компании в системе
-- ============================================
SELECT 
    'companies list' as check_type,
    id,
    name,
    created_at
FROM public.companies
ORDER BY created_at DESC;

-- ============================================
-- ПРОВЕРКА 6: Текущий пользователь и его company_id
-- ============================================
SELECT 
    'current user profile' as check_type,
    user_id,
    company_id,
    (SELECT name FROM public.companies WHERE id = profiles.company_id) as company_name
FROM public.profiles
WHERE user_id = auth.uid();

-- ============================================
-- ПРОВЕРКА 7: Поиск всех записей "Gulliver Travel"
-- ============================================
SELECT 
    'search by name' as check_type,
    id,
    display_name,
    party_type,
    status,
    company_id,
    email
FROM public.party
WHERE display_name ILIKE '%Gulliver%Travel%'
   OR display_name ILIKE '%Gulliver%'
ORDER BY created_at DESC;

