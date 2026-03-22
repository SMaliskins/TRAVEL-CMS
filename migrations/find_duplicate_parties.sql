-- Query: Find duplicate parties for manual review
-- Run AFTER cleanup_display_names_and_find_duplicates.sql
-- Results show groups of parties with same name — user picks the "main" record,
-- then use /api/directory/merge to merge others into it.

SELECT
  LOWER(TRIM(p.display_name)) AS normalized_name,
  p.party_type,
  COUNT(*) AS duplicates,
  jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'display_id', p.display_id,
      'display_name', p.display_name,
      'email', p.email,
      'phone', p.phone,
      'has_avatar', (pp.avatar_url IS NOT NULL),
      'has_dob', (pp.dob IS NOT NULL),
      'has_passport', (pp.passport_number IS NOT NULL AND pp.passport_number != ''),
      'orders_count', COALESCE(oc.cnt, 0)
    )
    ORDER BY COALESCE(oc.cnt, 0) DESC, p.display_id ASC
  ) AS parties
FROM public.party p
LEFT JOIN public.party_person pp ON pp.party_id = p.id
LEFT JOIN (
  SELECT client_party_id, COUNT(*) AS cnt
  FROM public.orders
  GROUP BY client_party_id
) oc ON oc.client_party_id = p.id
WHERE p.status = 'active'
GROUP BY LOWER(TRIM(p.display_name)), p.party_type, p.company_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, normalized_name;
