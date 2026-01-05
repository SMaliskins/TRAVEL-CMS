# DB / SUPABASE SPECIALIST REPORT

Подробный отчёт агента DB / Supabase Specialist.

---

## [2026-01-05] Orders Schema Verification

### Контекст задачи
Проверить схему таблицы `orders`, подтвердить маппинг полей для API, ответить на вопросы SPEC WRITER.

### Что проверял
- `supabase_schema.sql` — базовая схема
- `supabase_migration.sql` — миграции
- Таблицы: `orders`, `profiles`, `companies`

---

### Ответы на OPEN QUESTIONS

**Q1: Откуда брать `company_id`?**

**A:** Из таблицы `profiles`. Структура:
```sql
profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_id uuid REFERENCES companies(id),
  role text DEFAULT 'agent',
  initials text,
  display_name text
)
```

Логика получения:
```sql
SELECT company_id FROM profiles WHERE user_id = auth.uid()
```

**Q2: Как формировать `order_no`?**

**A:** Нужен counter per (company_id, year). Варианты:
1. Таблица `order_counters` (уже есть в коде, но без company_id)
2. Или: `SELECT MAX(order_no) + 1 FROM orders WHERE company_id = X AND order_year = Y`

Рекомендация: использовать `order_counters` с добавлением `company_id`.

---

### Подтверждённый маппинг: API → DB

| API field (current) | DB column (correct) | Action |
|---------------------|---------------------|--------|
| `order_number` | `order_code` | **RENAME** |
| `manager_user_id` | `owner_user_id` | **RENAME** |
| — | `company_id` | **ADD** (from profiles) |
| — | `order_no` | **ADD** (generate) |
| — | `order_year` | **ADD** (current year) |
| `client_party_id` | — | Lookup → `client_display_name` |
| `cities[]` | `countries_cities` | Join array |
| `check_in_date` | `date_from` | **RENAME** |
| `return_date` | `date_to` | **RENAME** |
| `order_type` | `order_type` | OK |
| `status` | `status` | OK |

---

### Таблица orders — полная схема

```sql
CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    owner_user_id uuid NOT NULL REFERENCES auth.users(id),
    order_no int NOT NULL,
    order_year int NOT NULL,
    order_code text NOT NULL,  -- "0001/25-SM"
    order_type text NOT NULL DEFAULT 'TA',
    status text NOT NULL DEFAULT 'Active',
    client_display_name text,
    countries_cities text,
    date_from date,
    date_to date,
    amount_total numeric(12,2) DEFAULT 0,
    amount_paid numeric(12,2) DEFAULT 0,
    amount_debt numeric(12,2) DEFAULT 0,
    profit_estimated numeric(12,2) DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(company_id, order_year, order_no),
    UNIQUE(company_id, order_code)
);
```

---

### Риски

1. **RLS:** Таблица `orders` должна иметь RLS policy для фильтрации по `company_id`
2. **order_counters:** Текущая таблица не имеет `company_id` — либо добавить, либо использовать fallback

---

### Что НЕ делал
- Не вносил изменения в схему
- Не создавал миграции
- Только проверил и задокументировал

---

### Вывод
Маппинг подтверждён. CODE WRITER может приступать к исправлению API.

---

## [2026-01-05] ISSUE: client_display_name column missing

### Проблема
Ошибка: `column orders.client_display_name does not exist`

### Анализ
- `supabase_schema.sql` содержит `client_display_name text`
- `supabase_migration.sql` **НЕ содержит** миграцию для этой колонки
- Колонка **не существует** в реальной БД

### Решение
Нужна миграция для добавления колонки:
```sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_display_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS countries_cities text;
```

### Альтернатива (без изменения схемы)
Использовать существующую колонку или хранить client_id и делать JOIN.

Проверить какие колонки реально есть в orders нужно в Supabase Dashboard.

---
