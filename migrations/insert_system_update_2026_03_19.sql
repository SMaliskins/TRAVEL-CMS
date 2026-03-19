-- System update notification: 2026-03-19
-- Inserts a notification for every company

INSERT INTO public.staff_notifications (company_id, type, title, message, link, ref_id)
SELECT
  c.id,
  'system_update',
  'System Update — March 19',
  'Traveller avatars fixed, dynamic titles (Mr/Mrs/Chd/Inf), Service Price Net for tours, Dashboard fix, Travellers modal redesigned.',
  NULL,
  'system_update:2026-03-19'
FROM public.companies c
ON CONFLICT (company_id, ref_id) DO NOTHING;
