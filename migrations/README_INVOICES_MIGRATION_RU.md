# 📋 Invoice System — Миграция Базы Данных

## ⚠️ ВАЖНО: Запусти миграцию перед использованием Invoice функций!

---

## ✅ ЧТО СДЕЛАНО (Phase 1):

### 1. **База данных (SQL миграция)**
- ✅ Таблица `invoices` (счета: номер, статус, суммы, данные клиента)
- ✅ Таблица `invoice_items` (строки счета — привязка услуг)
- ✅ Колонка `invoice_id` в `order_services` (блокировка услуг от повторного выставления)
- ✅ RLS политики (tenant isolation)
- ✅ Индексы для производительности

### 2. **Frontend компоненты**
- ✅ `InvoiceList.tsx` — список счетов в Finance tab
- ✅ `InvoiceCreator.tsx` — форма + live preview счета
- ✅ `OrderServicesBlock.tsx` — чекбоксы для выбора услуг, зеленая иконка документа если счет выставлен
- ✅ Floating Action Bar — показывает количество выбранных услуг и сумму
- ✅ Интеграция в Finance tab (переключение между списком и созданием)

### 3. **UI/UX улучшения**
- ✅ Услуги перенесены выше клиента (приоритет)
- ✅ Payment Status (Amount/Paid/Debt) в секции клиента
- ✅ Маршрут с метками "From", "To", "Return"
- ✅ Дни/ночи после дат
- ✅ Увеличенные шрифты

---

## 🔧 ЧТО ТЕБЕ НУЖНО СДЕЛАТЬ ВРУЧНУЮ:

### Шаг 1: Запусти SQL миграцию в Supabase

1. Открой **Supabase Dashboard** → **SQL Editor**
2. Скопируй весь контент файла `migrations/create_invoices_tables.sql`
3. Вставь в SQL Editor
4. Нажми **Run** (▶️)

**Файл:** `migrations/create_invoices_tables.sql`

---

### Шаг 2: Проверь что миграция прошла успешно

Запусти эту проверку в SQL Editor:

```sql
-- Должно вернуть 2 строки: invoices, invoice_items
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoices', 'invoice_items');

-- Должно вернуть 1 строку (проверка колонки invoice_id)
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'order_services'
AND column_name = 'invoice_id';
```

**Ожидаемый результат:**
- ✅ 2 таблицы найдены (invoices, invoice_items)
- ✅ Колонка invoice_id добавлена в order_services

---

### Шаг 3: (Опционально) Проверь тестовые данные

После миграции можешь проверить структуру таблиц:

```sql
-- Структура таблицы invoices
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Структура таблицы invoice_items
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns
WHERE table_name = 'invoice_items'
ORDER BY ordinal_position;
```

---

## ⚠️ ЧТО НЕ ГОТОВО (требует доработки):

### API Endpoints (НЕ РЕАЛИЗОВАНЫ)
Следующие endpoint'ы нужно будет доделать с правильным `supabaseAdmin`:

- `GET /api/orders/[orderCode]/invoices` — список счетов
- `POST /api/orders/[orderCode]/invoices` — создание счета
- `PATCH /api/orders/[orderCode]/invoices/[invoiceId]` — отмена счета

**Причина:** Проект использует `@/lib/supabaseAdmin`, а не `@/lib/supabase/server`

**Примечание:** См. `migrations/CREATE_INVOICE_API_NOTE.md`

---

## 🧪 Как проверить что Phase 1 работает:

1. ✅ Открой любой Order Detail (например, `/orders/ORD-001`)
2. ✅ Видишь чекбоксы в колонке "Invoice" в таблице услуг
3. ✅ Выбери несколько услуг → появляется Floating Action Bar с кнопкой "Issue Invoice"
4. ✅ Нажми "Issue Invoice" → переключает на Finance tab
5. ✅ В Finance tab видишь форму InvoiceCreator слева + Live Preview справа
6. ⚠️ **Кнопка "Save & Issue" пока не работает** (нужны API endpoints)

---

## 🔄 Rollback (если нужно откатить миграцию):

```sql
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
ALTER TABLE public.order_services DROP COLUMN IF EXISTS invoice_id;
```

---

## 📁 Измененные файлы:

**NEW:**
- `migrations/create_invoices_tables.sql`
- `migrations/README_INVOICES_MIGRATION_RU.md` (этот файл)
- `migrations/CREATE_INVOICE_API_NOTE.md`
- `app/orders/[orderCode]/_components/InvoiceList.tsx`

**UPDATED:**
- `app/orders/[orderCode]/_components/InvoiceCreator.tsx`
- `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`
- `app/orders/[orderCode]/_components/OrderClientSection.tsx`
- `app/orders/[orderCode]/_components/AddServiceModal.tsx`
- `app/orders/[orderCode]/page.tsx`
- `app/globals.css` (slideUp animation)

**COMMITS:**
- `51add59` — Phase 1 Invoice System (UI + DB schema)
- `66338ae` — Логи (CODE_WRITER_LOG + PROJECT_LOG + PROJECT_TODO)

---

## 📞 Если что-то не работает:

1. Проверь что миграция прошла успешно (Шаг 2)
2. Проверь что build проходит: `npm run build`
3. Проверь консоль браузера на ошибки
4. Проверь что сервер запущен: `npm run dev`

---

**Готов к использованию после миграции!** 🚀
