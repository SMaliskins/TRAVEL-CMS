-- Проверка mapping полей API с базой данных для party ID 4642eea4-38ed-464d-866c-3d2bea38235e
-- Party: Gulliver Travel

-- ============================================
-- ПРОВЕРКА 1: Структура таблицы party
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party'
ORDER BY ordinal_position;

-- ============================================
-- ПРОВЕРКА 2: Данные party (как видит API)
-- ============================================
SELECT 
    id,
    display_name,
    party_type,
    status,
    company_id,
    email,
    phone,
    rating,
    notes,
    email_marketing_consent,
    phone_marketing_consent,
    created_at,
    updated_at,
    created_by
FROM public.party
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 3: Данные party_company (API ожидает: company_name, reg_number, legal_address, actual_address)
-- ============================================
SELECT 
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address,
    bank_details
FROM public.party_company
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 4: Роли (API ожидает: is_client, is_supplier, is_subagent)
-- ============================================
-- Проверка client_party
SELECT 
    'client' as role_type,
    id,
    party_id,
    client_type
FROM public.client_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'

UNION ALL

-- Проверка partner_party (supplier)
SELECT 
    'supplier' as role_type,
    id::text,
    party_id::text,
    partner_role
FROM public.partner_party
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e'

UNION ALL

-- Проверка subagents
SELECT 
    'subagent' as role_type,
    id::text,
    party_id::text,
    COALESCE(commission_scheme::text, 'NULL')
FROM public.subagents
WHERE party_id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 5: Полный JOIN (как API собирает данные)
-- ============================================
SELECT 
    p.id,
    p.display_name,
    p.party_type,
    p.status,
    p.company_id,
    p.email,
    p.phone,
    -- Company fields
    pc.company_name,
    pc.reg_number,
    pc.legal_address,
    pc.actual_address,
    -- Roles (как boolean флаги)
    CASE WHEN cp.party_id IS NOT NULL THEN true ELSE false END as is_client,
    CASE WHEN pp.party_id IS NOT NULL THEN true ELSE false END as is_supplier,
    CASE WHEN s.party_id IS NOT NULL THEN true ELSE false END as is_subagent,
    -- Supplier fields (API использует их в buildDirectoryRecord)
    pp.business_category,
    pp.commission_type,
    pp.commission_value,
    pp.commission_currency,
    -- Subagent fields
    s.commission_scheme,
    s.commission_tiers,
    s.payout_details
FROM public.party p
LEFT JOIN public.party_company pc ON pc.party_id = p.id
LEFT JOIN public.client_party cp ON cp.party_id = p.id
LEFT JOIN public.partner_party pp ON pp.party_id = p.id
LEFT JOIN public.subagents s ON s.party_id = p.id
WHERE p.id = '4642eea4-38ed-464d-866c-3d2bea38235e';

-- ============================================
-- ПРОВЕРКА 6: Структура всех связанных таблиц (для сравнения с API)
-- ============================================
-- Структура party_company
SELECT 
    'party_company' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party_company'
ORDER BY ordinal_position;

-- Структура client_party
SELECT 
    'client_party' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_party'
ORDER BY ordinal_position;

-- Структура partner_party
SELECT 
    'partner_party' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- Структура subagents
SELECT 
    'subagents' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subagents'
ORDER BY ordinal_position;

