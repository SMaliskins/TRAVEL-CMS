-- System update notification: 2026-04-25
-- Run in Supabase SQL Editor. Idempotent per company+ref_id.
-- This release uses release_views for per-manager acknowledgement.

CREATE TABLE IF NOT EXISTS public.release_views (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  release_version text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (company_id, release_version, user_id)
);

CREATE INDEX IF NOT EXISTS idx_release_views_version
  ON public.release_views (company_id, release_version);

ALTER TABLE public.release_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "release_views_select_same_company" ON public.release_views
    FOR SELECT USING (
      company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "release_views_insert_own" ON public.release_views
    FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "release_views_update_own" ON public.release_views
    FOR UPDATE USING (
      auth.uid() = user_id
      AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.staff_notifications
  DROP CONSTRAINT IF EXISTS staff_notifications_type_check;

ALTER TABLE public.staff_notifications
  ADD CONSTRAINT staff_notifications_type_check
  CHECK (type IN ('checkin_open', 'checkin_reminder', 'passport_expiry', 'payment_overdue', 'payment_received', 'system_update'));

INSERT INTO public.staff_notifications (company_id, type, title, message, link, ref_id)
SELECT
  c.id,
  'system_update',
  $t${"en":"System update — Apr 25, 2026","ru":"Обновление системы — 25.04.2026","lv":"Sistēmas atjauninājums — 25.04.2026."}$t$,
  $m${"en":"• Service parties: Supplier, Client, Payer and Airline Channel supplier can now be typed manually in Add/Edit Service without creating a Directory record. If an existing Directory contact is selected, the link is still saved as before.\n• AI parsers: flight/package/document parsing now uses Vercel AI Gateway with GPT-5.5 for high-quality parsing and Anthropic Sonnet as fallback.\n• System notifications: important system updates now open as a required pop-up for every manager. The message cannot be dismissed until the manager clicks “I have read this”, and it will not be shown again to that manager after acknowledgement.","ru":"• Стороны услуги: Supplier, Client, Payer и Airline Channel supplier теперь можно вводить вручную в Add/Edit Service без создания записи в Directory. Если выбран существующий контакт из Directory, связь сохраняется как раньше.\n• AI-парсеры: разбор авиа/туров/документов теперь идёт через Vercel AI Gateway с GPT-5.5 для высокого качества и Anthropic Sonnet как fallback.\n• Системные уведомления: важные обновления теперь открываются обязательным pop-up для каждого менеджера. Его нельзя закрыть, пока менеджер не нажмёт «Ознакомился», и после подтверждения этому менеджеру повторно оно не показывается.","lv":"• Pakalpojuma puses: Supplier, Client, Payer un Airline Channel supplier tagad var ievadīt manuāli Add/Edit Service formās, neveidojot ierakstu Directory. Ja tiek izvēlēts esošs Directory kontakts, saite saglabājas kā iepriekš.\n• AI parsētāji: aviobiļešu/tūru/dokumentu parsēšana tagad izmanto Vercel AI Gateway ar GPT-5.5 augstai kvalitātei un Anthropic Sonnet kā rezerves modeli.\n• Sistēmas paziņojumi: svarīgi sistēmas atjauninājumi tagad tiek rādīti kā obligāts pop-up katram menedžerim. To nevar aizvērt, kamēr menedžeris nenospiež “Iepazinos”, un pēc apstiprinājuma tas šim menedžerim vairs netiks rādīts."}$m$,
  NULL,
  'system_update:2026-04-25'
FROM public.companies c
ON CONFLICT (company_id, ref_id) DO NOTHING;
