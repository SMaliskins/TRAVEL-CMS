# Миграция: Order Source и Order Type

## ⚠️ КРИТИЧНО: Запусти миграцию для исправления ошибок!

### Проблема:

Ошибки в браузере:
```
Error updating order source: {}
Error updating order type: {}
```

**Причина:** В таблице `orders` отсутствуют колонки `order_source` и `order_type`.

---

## ✅ Решение

### Шаг 1: Проверь текущую схему (опционально)

1. Открой **Supabase Dashboard** → **SQL Editor**
2. Запусти: `migrations/check_orders_columns.sql`
3. Если видишь 0 строк → колонки НЕ СУЩЕСТВУЮТ

### Шаг 2: Запусти миграцию (ОБЯЗАТЕЛЬНО)

1. Открой **Supabase Dashboard** → **SQL Editor**
2. Скопируй весь контент файла: `migrations/add_orders_source_type_columns.sql`
3. Вставь в SQL Editor и нажми **Run** ▶️

### Что добавится:

✅ `order_source` (text, default: 'TA')
  - Возможные значения: TA, TO, CORP, NON

✅ `order_type` (text, default: 'leisure')
  - Возможные значения: leisure, business, lifestyle

✅ Indexes для производительности

---

## Верификация

После миграции запусти:

```sql
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('order_type', 'order_source');
```

**Ожидаемый результат:** 2 строки

---

## После миграции

1. **Hard Refresh** браузера (`Cmd + Shift + R` / `Ctrl + Shift + R`)
2. Открой любой Order
3. Попробуй изменить Order Source (TA/TO/CORP/NON) и Order Type (Leisure/Business/Lifestyle)
4. Изменения должны сохраниться без ошибок ✅

---

**Миграция безопасна:** Использует `IF NOT EXISTS`, можно запускать многократно.
