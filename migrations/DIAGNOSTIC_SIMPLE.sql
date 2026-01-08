-- ============================================
-- ПРОСТАЯ ДИАГНОСТИКА - Все результаты в одном запросе
-- ============================================

WITH 
-- Проверка записи 1
record1_data AS (
    SELECT 
        p.id,
        p.company_id,
        c.name as company_name,
        p.display_name,
        p.party_type,
        p.status
    FROM public.party p
    LEFT JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = '4642eea4-38ed-464d-866c-3d2bea38235e'
),
record1_check AS (
    SELECT 
        'RECORD 1' as record_name,
        '4642eea4-38ed-464d-866c-3d2bea38235e' as record_id,
        CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END as exists_status,
        COUNT(*) as count,
        (SELECT company_id FROM record1_data LIMIT 1) as party_company_id,
        (SELECT company_name FROM record1_data LIMIT 1) as party_company_name,
        (SELECT display_name FROM record1_data LIMIT 1) as display_name,
        (SELECT party_type FROM record1_data LIMIT 1) as party_type,
        (SELECT status FROM record1_data LIMIT 1) as status
    FROM record1_data
),
-- Проверка записи 2
record2_data AS (
    SELECT 
        p.id,
        p.company_id,
        c.name as company_name,
        p.display_name,
        p.party_type,
        p.status
    FROM public.party p
    LEFT JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6'
),
record2_check AS (
    SELECT 
        'RECORD 2' as record_name,
        '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6' as record_id,
        CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END as exists_status,
        COUNT(*) as count,
        (SELECT company_id FROM record2_data LIMIT 1) as party_company_id,
        (SELECT company_name FROM record2_data LIMIT 1) as party_company_name,
        (SELECT display_name FROM record2_data LIMIT 1) as display_name,
        (SELECT party_type FROM record2_data LIMIT 1) as party_type,
        (SELECT status FROM record2_data LIMIT 1) as status
    FROM record2_data
),
-- Проверка пользователей
users_check AS (
    SELECT 
        'USERS' as record_name,
        COUNT(*) as user_count,
        COUNT(*) FILTER (WHERE company_id IS NULL) as users_without_company,
        COUNT(*) FILTER (WHERE company_id = 'ca0143be-0696-4422-b949-4f4119adef36') as users_in_default_company
    FROM public.profiles
),
-- Проверка компаний
companies_check AS (
    SELECT 
        'COMPANIES' as record_name,
        COUNT(*) as company_count,
        STRING_AGG(id::text, ', ') as company_ids,
        STRING_AGG(name, ', ') as company_names
    FROM public.companies
)
-- Объединенные результаты
SELECT 
    record_name,
    record_id,
    exists_status,
    count,
    party_company_id,
    party_company_name,
    display_name,
    party_type,
    status,
    NULL::int as user_count,
    NULL::int as users_without_company,
    NULL::int as users_in_default_company,
    NULL::text as company_ids,
    NULL::text as company_names
FROM record1_check

UNION ALL

SELECT 
    record_name,
    record_id,
    exists_status,
    count,
    party_company_id,
    party_company_name,
    display_name,
    party_type,
    status,
    NULL::int as user_count,
    NULL::int as users_without_company,
    NULL::int as users_in_default_company,
    NULL::text as company_ids,
    NULL::text as company_names
FROM record2_check

UNION ALL

SELECT 
    record_name,
    NULL::text as record_id,
    NULL::text as exists_status,
    NULL::bigint as count,
    NULL::uuid as party_company_id,
    NULL::text as party_company_name,
    NULL::text as display_name,
    NULL::text as party_type,
    NULL::text as status,
    user_count,
    users_without_company,
    users_in_default_company,
    NULL::text as company_ids,
    NULL::text as company_names
FROM users_check

UNION ALL

SELECT 
    record_name,
    NULL::text as record_id,
    NULL::text as exists_status,
    NULL::bigint as count,
    NULL::uuid as party_company_id,
    NULL::text as party_company_name,
    NULL::text as display_name,
    NULL::text as party_type,
    NULL::text as status,
    company_count as user_count,
    NULL::int as users_without_company,
    NULL::int as users_in_default_company,
    company_ids,
    company_names
FROM companies_check;

-- ============================================
-- ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Tenant Isolation
-- ============================================
-- Запустите этот запрос отдельно, чтобы увидеть детали

SELECT 
    'TENANT ISOLATION CHECK' as check_type,
    p.id as party_id,
    p.display_name,
    p.company_id as party_company_id,
    c1.name as party_company_name,
    pr.user_id,
    pr.company_id as user_company_id,
    c2.name as user_company_name,
    CASE 
        WHEN p.company_id = pr.company_id THEN '✅ MATCH'
        WHEN p.company_id IS NULL THEN '⚠️ PARTY HAS NO COMPANY'
        WHEN pr.company_id IS NULL THEN '⚠️ USER HAS NO COMPANY'
        ELSE '❌ NO MATCH - TENANT ISOLATION ISSUE!'
    END as match_status
FROM public.party p
LEFT JOIN public.companies c1 ON c1.id = p.company_id
CROSS JOIN public.profiles pr
LEFT JOIN public.companies c2 ON c2.id = pr.company_id
WHERE p.id IN ('4642eea4-38ed-464d-866c-3d2bea38235e', '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6')
ORDER BY p.id, pr.user_id;

