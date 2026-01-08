-- Диагностика для party ID 5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6
-- Проверка: существует ли запись и все связанные данные

-- 1. Проверка существования
SELECT 
    'EXISTS CHECK' as test,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as result,
    COUNT(*) as count
FROM public.party
WHERE id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 2. Данные party
SELECT 
    'PARTY DATA' as test,
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

-- 3. Данные party_company (если тип = company)
SELECT 
    'PARTY_COMPANY' as test,
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address
FROM public.party_company
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 4. Данные party_person (если тип = person)
SELECT 
    'PARTY_PERSON' as test,
    party_id,
    first_name,
    last_name,
    title,
    personal_code,
    dob
FROM public.party_person
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 5. Роли
-- client_party
SELECT 
    'CLIENT_PARTY' as test,
    id::text,
    party_id::text,
    client_type::text as role_info
FROM public.client_party
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6'

UNION ALL

-- partner_party (supplier)
SELECT 
    'PARTNER_PARTY' as test,
    id::text,
    party_id::text,
    partner_role::text as role_info
FROM public.partner_party
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6'

UNION ALL

-- subagents
SELECT 
    'SUBAGENTS' as test,
    id::text,
    party_id::text,
    COALESCE(commission_scheme::text, 'NULL') as role_info
FROM public.subagents
WHERE party_id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';

-- 6. Tenant check - company_id записи
SELECT 
    'TENANT CHECK' as test,
    p.id,
    p.display_name,
    p.company_id as party_company_id,
    c.name as party_company_name
FROM public.party p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.id = '5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6';
