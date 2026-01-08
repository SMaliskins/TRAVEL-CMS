-- Проверка записи b0eb268e-a72c-43a5-a0c9-2ad2d2edf317
-- Проблема: GET endpoint возвращает 0 rows
-- Цель: Проверить, откуда берется ID и какой party_id соответствует

-- ==========================================
-- ШАГ 1: Проверить, существует ли ID в partner_party
-- ==========================================
SELECT 
    'STEP 1: partner_party lookup' as step,
    id as partner_party_id,
    party_id,
    partner_role
FROM partner_party
WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317';

-- ==========================================
-- ШАГ 2: Найти party_id для этой записи
-- ==========================================
SELECT 
    'STEP 2: Get party_id from partner_party' as step,
    party_id
FROM partner_party
WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317';

-- ==========================================
-- ШАГ 3: Проверить, существует ли party с этим party_id
-- ==========================================
SELECT 
    'STEP 3: Check party exists' as step,
    id as party_id,
    display_name,
    party_type,
    company_id,
    status
FROM party
WHERE id = (
    SELECT party_id 
    FROM partner_party 
    WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'
);

-- ==========================================
-- ШАГ 4: Проверить tenant isolation (company_id)
-- ==========================================
SELECT 
    'STEP 4: Tenant isolation check' as step,
    id as party_id,
    display_name,
    company_id,
    CASE 
        WHEN company_id = 'ca0143be-0696-4422-b949-4f4119adef36' THEN 'MATCH'
        ELSE 'MISMATCH'
    END as tenant_match
FROM party
WHERE id = (
    SELECT party_id 
    FROM partner_party 
    WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'
)
AND company_id = 'ca0143be-0696-4422-b949-4f4119adef36';

-- ==========================================
-- ШАГ 5: Проверить все роли для этого party_id
-- ==========================================
WITH party_id_lookup AS (
    SELECT party_id 
    FROM partner_party 
    WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'
)
SELECT 
    'client' as role_type,
    cp.id::text as role_record_id,
    cp.party_id::text
FROM client_party cp, party_id_lookup pil
WHERE cp.party_id = pil.party_id
UNION ALL
SELECT 
    'supplier' as role_type,
    pp.id::text as role_record_id,
    pp.party_id::text
FROM partner_party pp, party_id_lookup pil
WHERE pp.party_id = pil.party_id
UNION ALL
SELECT 
    'subagent' as role_type,
    s.id::text as role_record_id,
    s.party_id::text
FROM subagents s, party_id_lookup pil
WHERE s.party_id = pil.party_id;

-- ==========================================
-- ШАГ 6: ПОЧЕМУ GET endpoint не находит запись?
-- Проверить, что GET endpoint ищет по неправильному ID
-- ==========================================
SELECT 
    'STEP 6: Why GET fails?' as step,
    'GET endpoint searches in party table' as explanation,
    'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317' as searched_id,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM party 
            WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'
        ) THEN 'FOUND in party table'
        ELSE 'NOT FOUND in party table (this is the problem!)'
    END as result,
    (
        SELECT party_id 
        FROM partner_party 
        WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'
    ) as correct_party_id;

-- ==========================================
-- ШАГ 7: Проверить, что правильный ID работает
-- ==========================================
SELECT 
    'STEP 7: Test with correct ID' as step,
    id as party_id,
    display_name,
    company_id,
    party_type,
    status,
    'This ID should work in GET endpoint' as note
FROM party
WHERE id = (
    SELECT party_id 
    FROM partner_party 
    WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'
)
AND company_id = 'ca0143be-0696-4422-b949-4f4119adef36';
