-- Полная диагностика для party ID 4642eea4-38ed-464d-866c-3d2bea38235e
-- Проверка: mapping полей и tenant isolation

-- ============================================
-- 1. Проверка: существует ли запись?
-- ============================================
SELECT 
    'EXISTS CHECK' as test,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as result,
    COUNT(*) as count
FROM public.party
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- 2. Все данные party (как API запрашивает)
-- ============================================
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
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- 3. Проверка: все связанные данные
-- ============================================
-- party_company
SELECT 
    'PARTY_COMPANY' as test,
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address,
    bank_details
FROM public.party_company
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- client_party
SELECT 
    'CLIENT_PARTY' as test,
    id,
    party_id,
    client_type
FROM public.client_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- partner_party (supplier)
SELECT 
    'PARTNER_PARTY' as test,
    id,
    party_id,
    partner_role,
    business_category,
    commission_type,
    commission_value,
    commission_currency
FROM public.partner_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- subagents
SELECT 
    'SUBAGENTS' as test,
    id,
    party_id,
    commission_scheme,
    commission_tiers,
    payout_details
FROM public.subagents
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- 4. TENANT ISOLATION CHECK
-- ============================================
-- Проверка: какой company_id у записи и у пользователей
SELECT 
    'TENANT CHECK' as test,
    p.id,
    p.display_name,
    p.company_id as party_company_id,
    c.name as party_company_name,
    -- Список всех пользователей и их company_id
    (SELECT json_agg(json_build_object(
        'user_id', user_id,
        'company_id', company_id,
        'company_name', (SELECT name FROM public.companies WHERE id = profiles.company_id)
    )) FROM public.profiles) as all_user_companies
FROM public.party p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- 5. Имитация запроса API (как API собирает данные)
-- ============================================
WITH party_data AS (
    SELECT * FROM public.party WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e'
),
person_data AS (
    SELECT * FROM public.party_person WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
),
company_data AS (
    SELECT * FROM public.party_company WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
),
client_data AS (
    SELECT party_id FROM public.client_party WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
),
supplier_data AS (
    SELECT * FROM public.partner_party WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
),
subagent_data AS (
    SELECT * FROM public.subagents WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'
)
SELECT 
    'API SIMULATION' as test,
    json_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'party_type', p.party_type,
        'status', p.status,
        'company_id', p.company_id,
        'email', p.email,
        'phone', p.phone,
        -- Company fields
        'company_name', cd.company_name,
        'reg_number', cd.reg_number,
        'legal_address', cd.legal_address,
        'actual_address', cd.actual_address,
        -- Roles (boolean flags)
        'is_client', CASE WHEN cl.party_id IS NOT NULL THEN true ELSE false END,
        'is_supplier', CASE WHEN sd.party_id IS NOT NULL THEN true ELSE false END,
        'is_subagent', CASE WHEN sa.party_id IS NOT NULL THEN true ELSE false END,
        -- Supplier fields
        'business_category', sd.business_category,
        'commission_type', sd.commission_type,
        'commission_value', sd.commission_value,
        'commission_currency', sd.commission_currency,
        -- Subagent fields
        'commission_scheme', sa.commission_scheme,
        'commission_tiers', sa.commission_tiers,
        'payout_details', sa.payout_details
    ) as api_response_data
FROM party_data p
LEFT JOIN person_data pd ON true
LEFT JOIN company_data cd ON true
LEFT JOIN client_data cl ON true
LEFT JOIN supplier_data sd ON true
LEFT JOIN subagent_data sa ON true;

