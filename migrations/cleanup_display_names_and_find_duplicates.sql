-- Migration: Clean up display_names and find potential duplicates
-- Step 1: Remove <> from party_person first_name and last_name
-- Step 2: Rebuild display_name in party from cleaned person names
-- Step 3: Show potential duplicate groups for manual merge

-- ============================================================
-- STEP 1: Clean party_person fields (remove <> and trim)
-- ============================================================
UPDATE public.party_person
SET first_name = TRIM(REPLACE(first_name, '<>', ''))
WHERE first_name LIKE '%<>%';

UPDATE public.party_person
SET last_name = TRIM(REPLACE(last_name, '<>', ''))
WHERE last_name LIKE '%<>%';

-- ============================================================
-- STEP 2: Rebuild display_name from cleaned first_name + last_name
-- ============================================================
UPDATE public.party p
SET display_name = TRIM(
  COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')
)
FROM public.party_person pp
WHERE pp.party_id = p.id
AND p.display_name LIKE '%<>%';

-- Also clean any remaining <> in display_name directly
UPDATE public.party
SET display_name = TRIM(REPLACE(display_name, '<>', ''))
WHERE display_name LIKE '%<>%';

-- ============================================================
-- STEP 3: Find potential duplicate groups (QUERY ONLY — no changes)
-- Run this SELECT separately to review before merging
-- ============================================================
-- SELECT
--   LOWER(TRIM(display_name)) AS normalized_name,
--   party_type,
--   company_id,
--   COUNT(*) AS cnt,
--   ARRAY_AGG(
--     jsonb_build_object(
--       'id', id,
--       'display_id', display_id,
--       'display_name', display_name,
--       'email', email,
--       'phone', phone
--     )
--     ORDER BY display_id ASC
--   ) AS parties
-- FROM public.party
-- WHERE status = 'active'
-- GROUP BY LOWER(TRIM(display_name)), party_type, company_id
-- HAVING COUNT(*) > 1
-- ORDER BY cnt DESC, normalized_name;
