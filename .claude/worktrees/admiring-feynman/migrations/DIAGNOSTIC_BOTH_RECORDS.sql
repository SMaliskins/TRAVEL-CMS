-- ============================================
-- ДИАГНОСТИКА ОБЕИХ ПРОБЛЕМНЫХ ЗАПИСЕЙ
-- ============================================
-- Записи: 
-- 1. 4642eea4-38ed-464d-866c-3d2bea38235e (Gulliver Travel)
-- 2. 5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6
-- ============================================

-- ============================================
-- ЗАПИСЬ 1: 4642eea4-38ed-464d-866c-3d2bea38235e (Gulliver Travel)
-- ============================================

-- 1.1. Существует ли запись?
SELECT 
    'RECORD 1 - EXISTS CHECK' as test,
    '4642eea4-38ed-464d-866c-3d2bea38235e' as record_id,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as result,
    COUNT(*) as count
FROM public.party
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- 1.2. Данные party
SELECT 
    'RECORD 1 - PARTY DATA' as test,
    id,
    display_name,
    party_type,
    status,
    company_id,
    email,
    phone,
    created_at,
    updated_at
FROM public.party
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- 1.3. Данные party_company
SELECT 
    'RECORD 1 - PARTY_COMPANY' as test,
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address,
    bank_details
FROM public.party_company
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- 1.4. Роли - client_party
SELECT 
    'RECORD 1 - CLIENT_PARTY' as test,
    id::text,
    party_id::text,
    client_type::text as role_info
FROM public.client_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'

UNION ALL

-- 1.4. Роли - partner_party
SELECT 
    'RECORD 1 - PARTNER_PARTY' as test,
    id::text,
    party_id::text,
    partner_role::text as role_info
FROM public.partner_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'

UNION ALL

-- 1.4. Роли - subagents
SELECT 
    'RECORD 1 - SUBAGENTS' as test,
    id::text,
    party_id::text,
    COALESCE(commission_scheme::text, 'NULL') as role_info
FROM public.subagents
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- 1.5. Tenant check - company_id записи vs пользователи
SELECT 
    'RECORD 1 - TENANT CHECK' as test,
    p.id,
    p.display_name,
    p.company_id as party_company_id,
    c.name as party_company_name,
    (SELECT json_agg(json_build_object(
        'user_id', user_id,
        'company_id', company_id,
        'company_name', (SELECT name FROM public.companies WHERE id = profiles.company_id)
    )) FROM public.profiles) as all_user_companies
FROM public.party p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ЗАПИСЬ 2: 5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6
-- ============================================

-- 2.1. Существует ли запись?
SELECT 
    'RECORD 2 - EXISTS CHECK' as test,
    '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6' as record_id,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as result,
    COUNT(*) as count
FROM public.party
WHERE id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 2.2. Данные party
SELECT 
    'RECORD 2 - PARTY DATA' as test,
    id,
    display_name,
    party_type,
    status,
    company_id,
    email,
    phone,
    created_at,
    updated_at
FROM public.party
WHERE id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 2.3. Данные party_company (если тип = company)
SELECT 
    'RECORD 2 - PARTY_COMPANY' as test,
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address
FROM public.party_company
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 2.4. Данные party_person (если тип = person)
SELECT 
    'RECORD 2 - PARTY_PERSON' as test,
    party_id,
    first_name,
    last_name,
    title,
    personal_code,
    dob
FROM public.party_person
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 2.5. Роли
SELECT 
    'RECORD 2 - CLIENT_PARTY' as test,
    id::text,
    party_id::text,
    client_type::text as role_info
FROM public.client_party
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6'

UNION ALL

SELECT 
    'RECORD 2 - PARTNER_PARTY' as test,
    id::text,
    party_id::text,
    partner_role::text as role_info
FROM public.partner_party
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6'

UNION ALL

SELECT 
    'RECORD 2 - SUBAGENTS' as test,
    id::text,
    party_id::text,
    COALESCE(commission_scheme::text, 'NULL') as role_info
FROM public.subagents
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 2.6. Tenant check - company_id записи
SELECT 
    'RECORD 2 - TENANT CHECK' as test,
    p.id,
    p.display_name,
    p.company_id as party_company_id,
    c.name as party_company_name
FROM public.party p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- ============================================
-- ОБЩАЯ ПРОВЕРКА: Все пользователи и их company_id
-- ============================================
SELECT 
    'ALL USERS - TENANT INFO' as test,
    user_id,
    company_id,
    (SELECT name FROM public.companies WHERE id = profiles.company_id) as company_name,
    (SELECT email FROM auth.users WHERE id = profiles.user_id) as user_email
FROM public.profiles
ORDER BY company_id, user_id;

-- ============================================
-- ПРОВЕРКА: Все компании в системе
-- ============================================
SELECT 
    'ALL COMPANIES' as test,
    id,
    name,
    created_at
FROM public.companies
ORDER BY created_at DESC;

