-- System update notification: 2026-03-19
-- Multilingual: title and message are JSON {"en": "...", "ru": "...", "lv": "..."}
-- TopBar.tsx parses JSON and shows text in user's interface language

-- Insert for any companies that don't have it yet
INSERT INTO public.staff_notifications (company_id, type, title, message, link, ref_id)
SELECT
  c.id,
  'system_update',
  '{"en":"System Update — March 19","ru":"Обновление системы — 19 марта","lv":"Sistēmas atjauninājums — 19. marts"}',
  '{"en":"• Traveller avatars now display correctly\n• Titles auto-calculated by gender and age (Mr/Mrs/Ms/Chd/Inf)\n• Service Price Net for Package Tours — operator cost always visible\n• Dashboard loading fixed\n• Travellers modal redesigned — horizontal layout\n• Up to 5 traveller avatars shown in services list","ru":"• Аватары клиентов теперь отображаются корректно\n• Обращения (Title) определяются автоматически по полу и возрасту (Mr/Mrs/Ms/Chd/Inf)\n• Себестоимость услуги (Service Price Net) для пакетных туров — сумма к оплате оператору всегда видна\n• Исправлена загрузка Dashboard\n• Модальное окно Travellers переработано — горизонтальная раскладка\n• До 5 аватаров клиентов в списке услуг","lv":"• Ceļotāju avatāri tagad tiek attēloti pareizi\n• Uzruna tiek noteikta automātiski pēc dzimuma un vecuma (Mr/Mrs/Ms/Chd/Inf)\n• Pakalpojuma neto cena tūrēm — operatora izmaksas vienmēr redzamas\n• Dashboard ielāde izlabota\n• Ceļotāju logs pārveidots — horizontāls izkārtojums\n• Līdz 5 ceļotāju avatāriem pakalpojumu sarakstā"}',
  NULL,
  'system_update:2026-03-19'
FROM public.companies c
ON CONFLICT (company_id, ref_id) DO NOTHING;

-- Update existing rows to multilingual format
UPDATE public.staff_notifications
SET
  title = '{"en":"System Update — March 19","ru":"Обновление системы — 19 марта","lv":"Sistēmas atjauninājums — 19. marts"}',
  message = '{"en":"• Traveller avatars now display correctly\n• Titles auto-calculated by gender and age (Mr/Mrs/Ms/Chd/Inf)\n• Service Price Net for Package Tours — operator cost always visible\n• Dashboard loading fixed\n• Travellers modal redesigned — horizontal layout\n• Up to 5 traveller avatars shown in services list","ru":"• Аватары клиентов теперь отображаются корректно\n• Обращения (Title) определяются автоматически по полу и возрасту (Mr/Mrs/Ms/Chd/Inf)\n• Себестоимость услуги (Service Price Net) для пакетных туров — сумма к оплате оператору всегда видна\n• Исправлена загрузка Dashboard\n• Модальное окно Travellers переработано — горизонтальная раскладка\n• До 5 аватаров клиентов в списке услуг","lv":"• Ceļotāju avatāri tagad tiek attēloti pareizi\n• Uzruna tiek noteikta automātiski pēc dzimuma un vecuma (Mr/Mrs/Ms/Chd/Inf)\n• Pakalpojuma neto cena tūrēm — operatora izmaksas vienmēr redzamas\n• Dashboard ielāde izlabota\n• Ceļotāju logs pārveidots — horizontāls izkārtojums\n• Līdz 5 ceļotāju avatāriem pakalpojumu sarakstā"}',
  read = false
WHERE ref_id = 'system_update:2026-03-19';
