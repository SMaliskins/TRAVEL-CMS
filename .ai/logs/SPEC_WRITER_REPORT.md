# SPEC WRITER REPORT

Подробный отчёт агента SPEC WRITER.

---

## [2026-01-05] Spec: Orders List & Create — Working Version

### Контекст задачи
Привести `/orders` (список заказов) и `/orders/new` (создание заказа) в рабочую версию.

### Что проверял
1. `app/orders/page.tsx` — список заказов (использует mock data)
2. `app/orders/new/page.tsx` — форма создания заказа
3. `app/api/orders/create/route.ts` — API endpoint
4. `supabase_schema.sql` — схема таблицы `orders`

### Текущее состояние

**Список заказов (`/orders`):**
- Использует **mock data** (12 захардкоженных заказов)
- НЕ загружает данные из Supabase
- UI готов: дерево по годам/месяцам/дням, статусы, суммы

**Создание заказа (`/orders/new`):**
- Форма готова: выбор клиента, города, даты, тип заказа
- API endpoint существует
- Использует `resolveOrderColumns` для динамического определения колонок

### Схема таблицы `orders` (из supabase_schema.sql)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | PK | auto |
| company_id | uuid | YES | FK → companies |
| owner_user_id | uuid | YES | FK → auth.users |
| order_no | int | YES | sequence per year |
| order_year | int | YES | year |
| order_code | text | YES | "0001/25-SM" |
| order_type | text | YES | 'TA', 'TO', 'CORP', 'NON' |
| status | text | YES | 'Draft', 'Active', etc. |
| client_display_name | text | NO | |
| countries_cities | text | NO | |
| date_from | date | NO | |
| date_to | date | NO | |
| amount_total | numeric | YES | default 0 |
| amount_paid | numeric | YES | default 0 |
| amount_debt | numeric | YES | default 0 |
| profit_estimated | numeric | YES | default 0 |
| updated_at | timestamptz | auto | |
| created_at | timestamptz | auto | |

### Проблемы обнаружены

1. **Список заказов использует mock data** — нужно заменить на fetch из Supabase
2. **API create использует `order_number`** — в схеме это `order_code`
3. **API create использует `manager_user_id`** — в схеме это `owner_user_id`
4. **API create не передаёт `company_id`** — обязательное поле
5. **API create не передаёт `order_no` и `order_year`** — обязательные поля
6. **Нет API для получения списка заказов** (`GET /api/orders`)

### OPEN QUESTIONS

1. Откуда брать `company_id`? 
   - Из профиля пользователя (`profiles.company_id`)?
   - Нужна таблица `profiles` с `company_id`?

2. Как формировать `order_no`?
   - Sequence per company + year?
   - Нужен counter per (company_id, year)?

---

## Спецификация: Orders MVP

### 1. GET /api/orders — Список заказов

**Endpoint:** `GET /api/orders`

**Auth:** Required (Bearer token)

**Response:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "order_code": "0001/25-SM",
      "order_type": "TA",
      "status": "Active",
      "client_display_name": "John Smith",
      "countries_cities": "Italy, Rome",
      "date_from": "2025-03-15",
      "date_to": "2025-03-22",
      "amount_total": 2500,
      "amount_paid": 2500,
      "amount_debt": 0,
      "profit_estimated": 850,
      "updated_at": "2025-01-15T10:00:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**Filters (query params):**
- `status` — filter by status
- `order_type` — filter by type
- `from` / `to` — date range

### 2. POST /api/orders/create — Создание заказа

**Fixes needed:**
- Rename `order_number` → `order_code`
- Rename `manager_user_id` → `owner_user_id`
- Add `company_id` from user profile
- Add `order_no` and `order_year` generation

**Payload mapping:**
```
Form field → API field → DB column
-----------------------------------------
clientPartyId → client_party_id → client_display_name (lookup)
orderType → order_type → order_type
cities[] → cities → countries_cities (join)
checkIn → check_in_date → date_from
return → return_date → date_to
ownerAgent → owner_initials → (used in order_code)
```

### 3. Frontend: /orders page

**Changes:**
- Replace mock data with API call
- Add loading state
- Add error handling
- Keep existing UI (tree structure)

### 4. Frontend: /orders/new page

**Changes:**
- Update field names to match API
- Add company_id handling (if needed)

---

### Порядок выполнения (рекомендация для Runner)

1. **DB / SCHEMA** — Проверить актуальную схему в Supabase, подтвердить маппинг
2. **CODE WRITER** — Исправить API create (поля)
3. **CODE WRITER** — Создать API GET /api/orders
4. **CODE WRITER** — Обновить /orders page (fetch вместо mock)
5. **QA** — Проверить создание и список

---
