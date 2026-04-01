# 🗃️ DB SPECIALIST TASK — Verify Invoice Migration

**Date:** 2026-01-10  
**From:** Code Writer  
**To:** DB Specialist  
**Priority:** HIGH  
**Pipeline:** DB → CW → QA  

---

## 📋 Задача

Проверить SQL миграцию для Invoice System перед запуском в production.

**Файл:** `migrations/rollback_and_create_invoices.sql`

---

## ✅ Что нужно проверить:

### 1. Schema Correctness
- [ ] Все колонки имеют правильные типы данных
- [ ] Foreign keys корректны (orders.id, companies.id, party.id)
- [ ] Constraints логичны (CHECK status IN (...))
- [ ] Defaults установлены правильно

### 2. RLS Policies
- [ ] Tenant isolation работает корректно (company_id)
- [ ] Policies покрывают все операции (SELECT, INSERT, UPDATE, DELETE)
- [ ] Нет уязвимостей в политиках

### 3. Indexes
- [ ] Индексы на правильных колонках
- [ ] Нет дублирующихся индексов
- [ ] Partial indexes используются правильно (WHERE clause)

### 4. Rollback Safety
- [ ] Rollback скрипт удаляет всё в правильном порядке
- [ ] Используется IF EXISTS для безопасности
- [ ] CASCADE используется правильно

### 5. Integration Check
- [ ] `order_services.invoice_id` интегрируется правильно
- [ ] ON DELETE поведение логично:
  - invoices → CASCADE (удаление счета удаляет items)
  - order_services → SET NULL (удаление счета разблокирует услуги)

---

## 📁 Файлы для проверки:

1. `migrations/rollback_and_create_invoices.sql` — основная миграция
2. `migrations/create_invoices_tables.sql` — старая версия (для сравнения)
3. `app/api/orders/[orderCode]/invoices/route.ts` — API для понимания бизнес-логики

---

## 📋 Expected Output:

1. **Verification Report** в `.ai/logs/DB_INVOICE_MIGRATION_VERIFICATION.md`
2. **Mapping Document** для Code Writer (если нужны изменения в API)
3. **Approval или Rework Directive**

---

## 🚨 Критично:

User уже пытался запустить миграцию 2 раза:
- Error 1: `column "invoice_date" does not exist`
- Error 2: `column "due_date" does not exist`

Проблема была в частичном выполнении миграции.

**Текущий rollback script должен исправить это!**

---

**Status:** PENDING  
**Assigned:** DB Specialist  
**Due:** ASAP (blocking Invoice System)

