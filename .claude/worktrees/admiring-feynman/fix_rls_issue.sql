-- ============================================
-- Быстрое исправление: Отключение RLS на новых таблицах
-- Выполните этот скрипт в SQL Editor Supabase
-- ============================================

-- Временно отключаем RLS на всех новых таблицах party системы
ALTER TABLE public.party DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_person DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_company DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_party DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_party DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subagents DISABLE ROW LEVEL SECURITY;

-- Проверка: убедитесь, что сайт снова работает
-- После этого можно будет настроить правильные RLS политики позже



