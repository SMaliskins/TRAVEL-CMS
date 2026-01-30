-- Enable ai_parsing module for a company (manual override)
-- Run in Supabase SQL Editor
--
-- Option 1: Enable for ALL companies (add ai_parsing to Free plan)
-- UPDATE public.subscription_plans
-- SET included_modules = array_append(included_modules, 'ai_parsing')
-- WHERE name = 'Free' AND NOT ('ai_parsing' = ANY(included_modules));
--
-- Option 2: Enable for YOUR company via company_modules
-- Replace YOUR_COMPANY_ID with your company UUID (from companies table)

-- Get your company_id first:
-- SELECT id, name FROM public.companies;

-- Then run (replace 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' with your company_id):
/*
INSERT INTO public.company_modules (company_id, module_id, is_enabled, notes)
SELECT 
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid,
  m.id,
  true,
  'Developer override - AI parsing enabled'
FROM public.modules m
WHERE m.code = 'ai_parsing'
ON CONFLICT (company_id, module_id) DO UPDATE SET is_enabled = true, notes = 'Developer override';
*/

-- Option 3: Enable for first company (quick dev setup)
-- INSERT INTO public.company_modules (company_id, module_id, is_enabled, notes)
-- SELECT c.id, m.id, true, 'Developer override'
-- FROM (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1) c
-- CROSS JOIN (SELECT id FROM public.modules WHERE code = 'ai_parsing') m
-- ON CONFLICT (company_id, module_id) DO UPDATE SET is_enabled = true;

-- Option 4: Enable for companies with "Developer" or "Demo" in name
INSERT INTO public.company_modules (company_id, module_id, is_enabled, notes)
SELECT c.id, m.id, true, 'Developer override - AI parsing enabled'
FROM public.companies c
CROSS JOIN public.modules m
WHERE m.code = 'ai_parsing'
  AND (c.name ILIKE '%developer%' OR c.name ILIKE '%demo%' OR c.is_demo = true)
ON CONFLICT (company_id, module_id) DO UPDATE SET is_enabled = true, notes = 'Developer override';
