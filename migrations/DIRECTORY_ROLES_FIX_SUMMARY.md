# Заключение: Проблемы с Directory Roles и Решения

**Дата:** 2025-12-25  
**Статус:** Частично решено

---

## 🔍 Что было найдено

### 1. ✅ РЕШЕНО: client_party - отсутствующий client_type
**Проблема:** 
- Таблица `client_party` имеет обязательное поле `client_type` (NOT NULL, no default)
- API код вставлял запись без `client_type` → ошибка при INSERT

**Решение:**
- ✅ Добавлена запись в `client_party` с правильным `client_type`
- ✅ API теперь возвращает `roles: ["client"]` (не пустой массив)

**Файлы:**
- `migrations/fix_directory_roles_direct.sql` - использован для исправления
- `app/api/directory/[id]/route.ts` - исправлен (строки 260-263)

---

### 2. ⚠️ НАЙДЕНО: subagents - несоответствие API кода и структуры таблицы

**Проблема:**
- API код использует колонки: `commission_scheme`, `commission_tiers`, `payout_details`
- В реальной таблице этих колонок НЕТ
- Таблица имеет: `commission_type`, `commission_value`, `currency`, `is_active`
- По спецификации должны быть: `commission_scheme`, `commission_tiers`, `payout_details`

**Статус:** Проблема найдена, но НЕ исправлена

**Последствия:**
- INSERT в `subagents` будет падать с ошибкой "column does not exist"
- Когда пользователь попытается создать/обновить party с ролью "subagent"

**Файлы с проблемой:**
- `app/api/directory/[id]/route.ts` (строки 289-291)
- `app/api/directory/create/route.ts` (строки 219-221)

---

### 3. 🔍 ТРЕБУЕТСЯ ПРОВЕРКА: partner_party - структура не проверена

**Статус:** Структура проверена диагностическим скриптом, но результаты не предоставлены

**Возможные проблемы:**
- Могут быть обязательные поля (NOT NULL без default)
- Может быть несоответствие между API кодом и структурой таблицы

---

## 📋 Пошаговая инструкция по исправлению

### 👤 ДЛЯ ВАС (USER)

#### Шаг 1: Проверить partner_party структуру
**Действие:**
1. Откройте файл: `migrations/check_partner_party_only.sql`
2. Скопируйте содержимое
3. Вставьте в Supabase SQL Editor
4. Нажмите "Run"
5. **Покажите результаты** (особенно секцию "API INSERT analysis")

**Цель:** Узнать, есть ли обязательные поля в `partner_party`

**Файл:** `migrations/check_partner_party_only.sql`

---

#### Шаг 2: Решить проблему с subagents

**ВАРИАНТ A: Добавить недостающие колонки в таблицу (РЕКОМЕНДУЕТСЯ)**

Попросите **DB/SUPABASE SPECIALIST** создать миграцию:
- Добавить `commission_scheme` (enum: 'revenue', 'profit')
- Добавить `commission_tiers` (jsonb)
- Добавить `payout_details` (text)

Это соответствует спецификации: `.ai/tasks/directory-v1-full-architecture.md`

**ВАРИАНТ B: Исправить API код**

Попросите **CODE WRITER** обновить API:
- Использовать существующие колонки: `commission_type`, `commission_value`, `currency`
- Убрать ссылки на `commission_scheme`, `commission_tiers`, `payout_details`

Но это НЕ соответствует спецификации!

---

### 👨‍💻 ДЛЯ CODE WRITER

#### Задача 1: Исправить API код для client_party (если еще не исправлено)

**Файл:** `app/api/directory/create/route.ts`

**Проблема:** При создании party с ролью "client", INSERT может быть без `client_type`

**Решение:**
```typescript
// Строка ~192 (в блоке if (data.roles.includes("client")))
const partyType = data.party_type || "person";
const clientType = partyType === "company" ? "company" : "person";

await supabaseAdmin.from("client_party").insert({ 
  party_id: partyId,
  client_type: clientType  // ✅ Добавить это
});
```

**Файл:** `app/api/directory/[id]/route.ts`  
**Статус:** ✅ УЖЕ ИСПРАВЛЕНО (строки 260-263)

---

#### Задача 2: Исправить API код для subagents (ВАРИАНТ B)

**Если решено НЕ добавлять колонки в таблицу**, обновить API код:

**Файлы:**
- `app/api/directory/[id]/route.ts` (строки 286-298)
- `app/api/directory/create/route.ts` (строки 216-234)

**Изменения:**
```typescript
// ВМЕСТО:
if (updates.subagent_details.commission_scheme) subagentData.commission_scheme = ...;
if (updates.subagent_details.commission_tiers) subagentData.commission_tiers = ...;
if (updates.subagent_details.payout_details) subagentData.payout_details = ...;

// ИСПОЛЬЗОВАТЬ:
if (updates.subagent_details.commission_type) subagentData.commission_type = ...;
if (updates.subagent_details.commission_value) subagentData.commission_value = ...;
// Убрать commission_tiers (колонки нет)
// payout_details → использовать currency или убрать
```

**⚠️ НО:** Это не соответствует спецификации!

---

### 🗄️ ДЛЯ DB/SUPABASE SPECIALIST

#### Задача 1: Создать миграцию для subagents (ВАРИАНТ A - РЕКОМЕНДУЕТСЯ)

**Создать файл:** `migrations/add_subagents_columns.sql`

**Содержимое:**
```sql
-- Add missing columns to subagents table (per specification)

-- 1. Create commission_scheme enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_scheme') THEN
        CREATE TYPE commission_scheme AS ENUM ('revenue', 'profit');
    END IF;
END $$;

-- 2. Add commission_scheme column
ALTER TABLE public.subagents 
ADD COLUMN IF NOT EXISTS commission_scheme commission_scheme;

-- 3. Add commission_tiers column (jsonb)
ALTER TABLE public.subagents 
ADD COLUMN IF NOT EXISTS commission_tiers jsonb;

-- 4. Add payout_details column (text)
ALTER TABLE public.subagents 
ADD COLUMN IF NOT EXISTS payout_details text;
```

**Цель:** Добавить колонки, которые использует API код

---

#### Задача 2: Проверить partner_party и создать миграцию (если нужно)

**После получения результатов** от USER из `check_partner_party_only.sql`:

- Если есть обязательные поля (NOT NULL без default) → создать миграцию для добавления значений
- Если структура отличается от API кода → создать миграцию или исправить структуру

---

### 🏗️ ДЛЯ ARCHITECT AGENT

#### Задача: Принять решение по subagents

**Решение требуется:**
- Следовать спецификации (добавить колонки в таблицу) — ВАРИАНТ A
- Или изменить спецификацию (обновить API код) — ВАРИАНТ B

**Рекомендация:** ВАРИАНТ A (добавить колонки), так как:
1. Спецификация явно указывает эти колонки
2. API код уже написан под спецификацию
3. Легче добавить колонки, чем переписывать API

---

## ✅ Чеклист исправлений

- [x] **client_party client_type** - исправлено (роль добавлена, API исправлен)
- [ ] **subagents колонки** - требуется решение (добавить колонки или исправить API)
- [ ] **partner_party проверка** - требуется результаты диагностики
- [ ] **API код для create endpoint** - проверить наличие client_type

---

## 📁 Файлы для работы

### Диагностические скрипты:
- `migrations/check_client_party_structure.sql` ✅
- `migrations/check_partner_subagent_structure.sql` ✅
- `migrations/check_partner_party_only.sql` ✅ (для USER)
- `migrations/diagnose_directory_roles.sql` ✅ (исправлен)

### Fix скрипты:
- `migrations/fix_directory_roles_direct.sql` ✅ (использован для client_party)

### API файлы:
- `app/api/directory/[id]/route.ts` - частично исправлен
- `app/api/directory/create/route.ts` - требует проверки

---

## 🎯 Приоритет действий

1. **ВЫСОКИЙ:** USER → Запустить `check_partner_party_only.sql` и показать результаты
2. **ВЫСОКИЙ:** ARCHITECT → Принять решение по subagents (добавить колонки или исправить API)
3. **СРЕДНИЙ:** DB/SUPABASE → Создать миграцию для subagents (если решение: добавить колонки)
4. **СРЕДНИЙ:** CODE WRITER → Исправить API код для create endpoint (проверить client_type)
5. **НИЗКИЙ:** Тестирование всех ролей после исправлений

---

## 📝 Команды для коммита

```bash
# Если создана миграция для subagents:
git add migrations/add_subagents_columns.sql && \
git commit -m "fix(db): add missing columns to subagents table (commission_scheme, commission_tiers, payout_details)"

# Если исправлен API код:
git add app/api/directory/create/route.ts && \
git commit -m "fix(api): add client_type to client_party INSERT in create endpoint"
```

---

## 💬 Сообщение для Architect Agent

**Directory Roles Structure Issues - Summary**

**RESOLVED:**
- client_party missing client_type → FIXED (role added, API updated)

**REQUIRES DECISION:**
- subagents table missing columns (commission_scheme, commission_tiers, payout_details)
- API code uses these columns but they don't exist in table
- Option A: Add columns (matches spec) - RECOMMENDED
- Option B: Fix API code (use existing columns) - breaks spec

**REQUIRES VERIFICATION:**
- partner_party structure needs user to run diagnostic and provide results

**Next:** USER needs to run check_partner_party_only.sql and share results before proceeding.




