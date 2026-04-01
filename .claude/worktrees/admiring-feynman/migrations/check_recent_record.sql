-- Check the most recent created record
-- Replace <RECORD_ID> with b0eb268e-a72c-43a5-a0c9-2ad2d2edf317 or 51fc094f-f11e-4c5c-868b-a161e9f8ca89

SELECT 
    id,
    display_name,
    party_type,
    status,
    company_id,
    created_at,
    created_by
FROM party
WHERE id IN ('b0eb268e-a72c-43a5-a0c9-2ad2d2edf317', '51fc094f-f11e-4c5c-868b-a161e9f8ca89')
ORDER BY created_at DESC;

-- Check roles
SELECT 
    'client' as role_type,
    id,
    party_id
FROM client_party
WHERE party_id IN ('b0eb268e-a72c-43a5-a0c9-2ad2d2edf317', '51fc094f-f11e-4c5c-868b-a161e9f8ca89')
UNION ALL
SELECT 
    'supplier' as role_type,
    id::text,
    party_id::text
FROM partner_party
WHERE party_id IN ('b0eb268e-a72c-43a5-a0c9-2ad2d2edf317', '51fc094f-f11e-4c5c-868b-a161e9f8ca89')
UNION ALL
SELECT 
    'subagent' as role_type,
    id::text,
    party_id::text
FROM subagents
WHERE party_id IN ('b0eb268e-a72c-43a5-a0c9-2ad2d2edf317', '51fc094f-f11e-4c5c-868b-a161e9f8ca89');

-- Check user's company_id
SELECT 
    user_id,
    company_id
FROM profiles
WHERE user_id = 'b7a050fb-ca8a-4a5c-b48d-c849b0f493bd';
