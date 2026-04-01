# Task: Add Missing Columns Migration for Orders Table

**Agent:** CODE WRITER
**Priority:** HIGH
**Status:** TODO
**Created:** 2026-01-05

---

## Problem

DB/SCHEMA Specialist выявил, что колонки `client_display_name` и `countries_cities` отсутствуют в реальной БД, хотя они есть в схеме `supabase_schema.sql`.

**Error:**
```
column orders.client_display_name does not exist
```

**DB Report:** `.ai/logs/DB_REPORT.md` (Issue: client_display_name column missing)

---

## Root Cause

- `supabase_schema.sql` содержит `client_display_name text`
- `supabase_migration.sql` **НЕ содержит** миграцию для этой колонки
- Колонка **не существует** в реальной БД

---

## Solution

Создать миграцию для добавления недостающих колонок:

```sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_display_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS countries_cities text;
```

---

## Implementation Details

1. **Создать файл миграции:**
   - Путь: `migrations/add_orders_client_columns.sql`
   - Или добавить в существующий файл миграций

2. **SQL миграция:**
   ```sql
   -- Add missing columns for orders table
   -- Date: 2026-01-05
   -- Issue: client_display_name and countries_cities columns missing from real DB
   
   ALTER TABLE public.orders 
     ADD COLUMN IF NOT EXISTS client_display_name text;
   
   ALTER TABLE public.orders 
     ADD COLUMN IF NOT EXISTS countries_cities text;
   
   -- Optional: Add comment
   COMMENT ON COLUMN public.orders.client_display_name IS 'Client display name (denormalized from party)';
   COMMENT ON COLUMN public.orders.countries_cities IS 'Countries and cities as text (joined from cities array)';
   ```

3. **Проверить существование колонок перед добавлением:**
   - Использовать `IF NOT EXISTS` для безопасности
   - Или проверить через `information_schema.columns`

---

## Files to Create/Modify

- `migrations/add_orders_client_columns.sql` (new file)

---

## Testing

1. Запустить миграцию в Supabase Dashboard или через CLI
2. Проверить, что колонки добавлены:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'orders' 
     AND column_name IN ('client_display_name', 'countries_cities');
   ```
3. Проверить, что Orders API работает без ошибок
4. Создать тестовый order и проверить, что данные сохраняются

---

## Acceptance Criteria

- [ ] Миграция создана
- [ ] Колонки `client_display_name` и `countries_cities` добавлены в таблицу `orders`
- [ ] Orders API работает без ошибок "column does not exist"
- [ ] Можно создать order с client_display_name и countries_cities

---

## Related Issues

- DB Report: `.ai/logs/DB_REPORT.md` (Issue: client_display_name column missing)
- Orders API уже использует эти колонки, но они отсутствуют в БД

---
