-- ============================================
-- Альтернативное решение: Добавить полные политики вместо отключения RLS
-- Выполните этот скрипт, если хотите оставить RLS включенным
-- ============================================

-- Удаляем старые политики только для SELECT
DROP POLICY IF EXISTS "Allow authenticated read" ON public.party;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.party_person;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.party_company;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.client_party;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.partner_party;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.subagents;

-- Создаем полные политики для всех операций (для разработки)
-- ВАЖНО: Это позволяет всем аутентифицированным пользователям делать все операции
-- Используйте только для разработки, в продакшене нужны более строгие политики

-- Party table
CREATE POLICY "Allow all for authenticated" ON public.party
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.party_person
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.party_company
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.client_party
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.partner_party
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.subagents
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);



