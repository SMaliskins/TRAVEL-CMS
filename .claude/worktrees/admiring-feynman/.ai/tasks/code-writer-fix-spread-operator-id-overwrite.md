# CRITICAL: Fix Spread Operator ID Overwrite in Directory List Endpoint

**Priority:** CRITICAL  
**Assigned to:** CODE WRITER  
**Status:** PENDING  
**Created:** 2026-01-03

---

## 🎯 ПРОБЛЕМА

**Root Cause:** Spread оператор в `app/api/directory/route.ts` перезаписывает `party.id` на `supplier.id` или `subagent.id`.

**Симптомы:**
- Записи с supplier/subagent ролями создаются, но не открываются
- GET endpoint возвращает 404 "Record not found"
- URL содержит ID из `partner_party` или `subagents`, а не из `party`

**Пример:**
- Правильный ID: `11293ddb-6ac7-465b-bc18-ded62ce784f4` (из `party`)
- Неправильный ID в URL: `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` (из `partner_party`)

---

## 📁 ФАЙЛ ДЛЯ ИСПРАВЛЕНИЯ

**File:** `app/api/directory/route.ts`

**Lines:** 235-244

---

## 🔍 ТЕКУЩИЙ КОД (ПРОБЛЕМНЫЙ)

```typescript
const record = buildDirectoryRecord({
  ...party,        // ← party.id = '11293ddb-6ac7-465b-bc18-ded62ce784f4' ✅
  ...person,
  ...company,
  is_client: clientSet.has(party.id),
  is_supplier: !!supplier,
  is_subagent: !!subagent,
  ...supplier,     // ← ПРОБЛЕМА! supplier.id перезаписывает party.id ❌
  ...subagent,     // ← ПРОБЛЕМА! subagent.id может перезаписать ❌
});
```

**Проблема:** Spread оператор `...supplier` и `...subagent` перезаписывают `id` из `party`.

---

## ✅ РЕШЕНИЕ

**Вариант 1: Исключить `id` из spread (РЕКОМЕНДУЕТСЯ)**

```typescript
// Удаляем id из supplier и subagent перед spread
const { id: _supplierId, ...supplierData } = supplier || {};
const { id: _subagentId, ...subagentData } = subagent || {};

const record = buildDirectoryRecord({
  ...party,
  ...person,
  ...company,
  is_client: clientSet.has(party.id),
  is_supplier: !!supplier,
  is_subagent: !!subagent,
  ...supplierData,  // ← Без id
  ...subagentData,  // ← Без id
});
```

**Вариант 2: Явно указывать только нужные поля**

```typescript
const record = buildDirectoryRecord({
  ...party,
  ...person,
  ...company,
  is_client: clientSet.has(party.id),
  is_supplier: !!supplier,
  is_subagent: !!subagent,
  // Извлекаем только нужные поля из supplier, исключая id
  ...(supplier ? {
    business_category: supplier.business_category,
    commission_type: supplier.commission_type,
    commission_value: supplier.commission_value,
    commission_currency: supplier.commission_currency,
    commission_valid_from: supplier.commission_valid_from,
    commission_valid_to: supplier.commission_valid_to,
    commission_notes: supplier.commission_notes,
    partner_role: supplier.partner_role,
  } : {}),
  // Извлекаем только нужные поля из subagent, исключая id
  ...(subagent ? {
    commission_scheme: subagent.commission_scheme,
    commission_tiers: subagent.commission_tiers,
  } : {}),
});
```

**РЕКОМЕНДАЦИЯ:** Использовать Вариант 1 (исключить `id`), так как он проще и безопаснее.

---

## 🧪 ПРОВЕРКА

После исправления:

1. **Создать запись с supplier ролью**
2. **Проверить список записей** - ID должен быть из `party`
3. **Открыть запись** - должна открываться без ошибок
4. **Проверить в браузере** - URL должен содержать правильный ID

**Пример проверки:**
- Создать запись с supplier ролью
- В списке записей ID должен быть `party.id` (не `partner_party.id`)
- Кликнуть на запись - должна открыться без 404

---

## 📋 ДОПОЛНИТЕЛЬНЫЕ ЗАМЕЧАНИЯ

- **Не менять GET endpoint** (`app/api/directory/[id]/route.ts`) - там проблема не критична, но можно исправить для консистентности
- **Убедиться**, что `buildDirectoryRecord` все еще получает правильные данные
- **Проверить**, что все поля из `supplier` и `subagent` правильно маппятся в `buildDirectoryRecord`

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** Spread operator, ID mismatch, Record not found

