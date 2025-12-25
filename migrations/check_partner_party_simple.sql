-- ============================================
-- SIMPLE CHECK: partner_party table columns
-- ============================================
-- Простой запрос - покажет все колонки partner_party
-- ============================================

SELECT 
    column_name as "Колонка",
    data_type as "Тип данных",
    is_nullable as "Может быть NULL?",
    column_default as "Значение по умолчанию",
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️ ОБЯЗАТЕЛЬНАЯ (нет default)'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ Обязательная (есть default)'
        WHEN is_nullable = 'YES' THEN 'ℹ️ Опциональная'
        ELSE 'UNKNOWN'
    END as "Статус"
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'partner_party'
ORDER BY ordinal_position;

