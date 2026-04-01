# ROOT CAUSE НАЙДЕН: Spread Operator перезаписывает ID!

**Date:** 2026-01-03  
**Status:** ROOT CAUSE IDENTIFIED

---

## 🎯 ПРОБЛЕМА НАЙДЕНА!

**Файл:** `app/api/directory/route.ts` (строка 235-244)

```typescript
const record = buildDirectoryRecord({
  ...party,        // ← party.id = '11293ddb-6ac7-465b-bc18-ded62ce784f4' ✅
  ...person,
  ...company,
  is_client: clientSet.has(party.id),
  is_supplier: !!supplier,
  is_subagent: !!subagent,
  ...supplier,     // ← ПРОБЛЕМА! supplier.id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317' ❌
  ...subagent,     // ← ПРОБЛЕМА! subagent.id может перезаписать!
});
```

**Что происходит:**
1. `...party` устанавливает `id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` ✅
2. `...supplier` перезаписывает `id: 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'` ❌
3. `buildDirectoryRecord` получает `row.id = 'b0eb268e...'` ❌
4. Frontend использует `record.id = 'b0eb268e...'` ❌
5. GET endpoint ищет в `party` по ID `b0eb268e...` → не находит ❌

---

## 🔍 ТА ЖЕ ПРОБЛЕМА В GET ENDPOINT!

**Файл:** `app/api/directory/[id]/route.ts` (строка 247-256)

```typescript
const record = buildDirectoryRecord({
  ...party,
  ...personData.data,
  ...companyData.data,
  is_client: !!clientData.data,
  is_supplier: !!supplierData.data,
  is_subagent: !!subagentData.data,
  ...supplierData.data,  // ← ПРОБЛЕМА!
  ...subagentData.data,  // ← ПРОБЛЕМА!
});
```

**Но в GET endpoint это не влияет на поиск**, потому что запрос уже выполнен с правильным ID.

**Проблема только в LIST endpoint** - он возвращает неправильный ID!

---

## ✅ РЕШЕНИЕ

**Нужно исправить:** `app/api/directory/route.ts`

**Проблемный код (строка 235-244):**
```typescript
const record = buildDirectoryRecord({
  ...party,
  ...person,
  ...company,
  is_client: clientSet.has(party.id),
  is_supplier: !!supplier,
  is_subagent: !!subagent,
  ...supplier,     // ← УБРАТЬ! Или использовать только нужные поля
  ...subagent,     // ← УБРАТЬ! Или использовать только нужные поля
});
```

**Исправление:**
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
    // ... другие поля, но НЕ id
  } : {}),
  ...(subagent ? {
    commission_scheme: subagent.commission_scheme,
    // ... другие поля, но НЕ id
  } : {}),
});
```

**Или проще:**
```typescript
// Удаляем id из supplier и subagent перед spread
const { id: supplierId, ...supplierData } = supplier || {};
const { id: subagentId, ...subagentData } = subagent || {};

const record = buildDirectoryRecord({
  ...party,
  ...person,
  ...company,
  is_client: clientSet.has(party.id),
  is_supplier: !!supplier,
  is_subagent: !!subagent,
  ...supplierData,
  ...subagentData,
});
```

---

## 📝 ЗАДАЧА ДЛЯ CODE WRITER

**Файл:** `app/api/directory/route.ts`

**Исправить строки 235-244:**
- Убрать `...supplier` и `...subagent` из spread
- Извлекать только нужные поля, исключая `id`
- Убедиться, что `party.id` не перезаписывается

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Status:** Root cause identified, solution proposed

