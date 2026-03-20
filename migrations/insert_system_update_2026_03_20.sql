-- System update notification: 2026-03-20
-- Multilingual: title and message are JSON {"en": "...", "ru": "...", "lv": "..."}
-- TopBar.tsx parses JSON and shows text in user's interface language

-- Insert for any companies that don't have it yet
INSERT INTO public.staff_notifications (company_id, type, title, message, link, ref_id)
SELECT
  c.id,
  'system_update',
  '{"en":"System Update — March 20","ru":"Обновление системы — 20 марта","lv":"Sistēmas atjauninājums — 20. marts"}',
  '{"en":"• Credit invoices: amounts as negative, Debt = 0 when refund paid\n• Refund payments: amount stored and displayed as negative (red)\n• Order header: Refund due when client overpaid after cancellation\n• Total (active): includes cancelled with formal credit (665+(-110)+110=665)\n• Bulk ops (Supplier, Payer, Client): now work on invoiced services\n• Cancel Service modal, Restore to Original, Company expenses, Directory merge","ru":"• Кредит-счета: суммы отрицательные, Debt=0 при оплаченном возврате\n• Платёжки возврата: сумма с минусом (красным)\n• Заголовок заказа: К возврату при переплате после отмены\n• Total: включает отменённые с формальным кредитом\n• Bulk ops (Supplier, Payer, Client): для услуг в счёте\n• Cancel Service, Restore to Original, Company expenses, Directory merge","lv":"• Kredītrēķini: summas negatīvas, Debt=0, kad atgriezums apmaksāts\n• Atgriezuma maksājumi: summa ar mīnusu (sarkans)\n• Pasūtījuma galvene: Jāatdod, kad klients pārmaksājis pēc atcelšanas\n• Total: iekļauj atceltos ar formālu kredītu\n• Bulk ops (Supplier, Payer, Client): rēķinā esošiem pakalpojumiem\n• Cancel Service, Restore to Original, Company expenses, Directory merge"}',
  NULL,
  'system_update:2026-03-20'
FROM public.companies c
ON CONFLICT (company_id, ref_id) DO NOTHING;
