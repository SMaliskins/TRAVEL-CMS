# CRITICAL: Fix clientType Initialization - Type Switching Issue

**Priority:** CRITICAL  
**Assigned to:** CODE WRITER  
**Status:** PENDING  
**Created:** 2026-01-03

---

## 🎯 ПРОБЛЕМА

**User Report (QA Agent):** При добавлении роли Client к записи с Type = Company и Roles = Supplier/Subagent, Type автоматически переключается на Person.

**Root Cause:**
1. `clientType` инициализируется как "person" по умолчанию (строка 76-80)
2. `useEffect` вызывает `setBaseType(clientType)` при добавлении Client роли (строка 127)
3. Это переключает Type на Person, даже если запись была Company

**Impact:**
- Потеря данных (Type меняется непредсказуемо)
- Неожиданное поведение UI
- Путаница для пользователя

---

## 📁 ФАЙЛ ДЛЯ ИСПРАВЛЕНИЯ

**File:** `components/DirectoryForm.tsx`

**Lines:**
- 76-80: Инициализация clientType
- 125-132: useEffect, который обновляет baseType

---

## 🔍 ТЕКУЩИЙ КОД (ПРОБЛЕМНЫЙ)

### Проблема 1: Инициализация clientType (строки 76-80)

```typescript
// Client type selection (for Client role only)
const [clientType, setClientType] = useState<DirectoryType>(
  record?.roles.includes("client")
    ? record.type
    : "person"  // ← ПРОБЛЕМА: default "person" даже если record.type = "company"
);
```

**Проблема:** Если у записи нет Client роли, но есть record.type = "company", clientType все равно инициализируется как "person".

### Проблема 2: useEffect (строки 125-132)

```typescript
// Update baseType when roles change (for Client role)
useEffect(() => {
  if (roles.includes("client")) {
    setBaseType(clientType);  // ← ПРОБЛЕМА: setBaseType(clientType) перезаписывает baseType
  } else if (mode === "create") {
    setBaseType(baseType);
  }
}, [roles, clientType, mode, baseType]);
```

**Проблема:** Когда добавляется Client роль, `setBaseType(clientType)` переключает Type на значение clientType (которое = "person" по умолчанию), даже если baseType был "company".

---

## ✅ РЕШЕНИЕ

### Исправление 1: Инициализация clientType

**Инициализировать clientType из record.type (если record существует), а не из "person":**

```typescript
// Client type selection (for Client role only)
const [clientType, setClientType] = useState<DirectoryType>(
  record?.roles.includes("client")
    ? record.type
    : record?.type || "person"  // ← ИСПРАВЛЕНИЕ: Используем record.type, если он есть
);
```

**Или проще:**
```typescript
// Client type selection (for Client role only)
const [clientType, setClientType] = useState<DirectoryType>(
  record?.type || "person"  // ← ИСПРАВЛЕНИЕ: Всегда используем record.type, если он есть
);
```

### Исправление 2: useEffect

**В useEffect устанавливать clientType = baseType (а не наоборот), когда добавляется Client роль:**

```typescript
// Update clientType when roles change (for Client role)
useEffect(() => {
  if (roles.includes("client")) {
    // When Client role is added, set clientType to current baseType
    // This preserves the existing Type (Company/Person) when adding Client role
    setClientType(baseType);  // ← ИСПРАВЛЕНИЕ: setClientType(baseType) вместо setBaseType(clientType)
  }
}, [roles, baseType]);
```

**Объяснение:**
- Когда добавляется Client роль, мы хотим сохранить текущий Type
- Поэтому устанавливаем `clientType = baseType` (а не наоборот)
- Это сохраняет Type (Company остается Company, Person остается Person)

---

## 📋 ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД

### Исправление 1 (строка ~76):

```typescript
// Client type selection (for Client role only)
const [clientType, setClientType] = useState<DirectoryType>(
  record?.type || "person"  // Always use record.type if available, default to "person"
);
```

### Исправление 2 (строка ~125):

```typescript
// Update clientType when roles change (for Client role)
useEffect(() => {
  if (roles.includes("client")) {
    // When Client role is added, set clientType to current baseType
    // This preserves the existing Type (Company/Person) when adding Client role
    setClientType(baseType);
  }
}, [roles, baseType]);
```

**Примечание:** Убрать `clientType` и `mode` из dependencies, так как они больше не используются в логике.

---

## 🧪 ПРОВЕРКА

После исправления:

1. **Открыть запись с Type = Company и Roles = Supplier/Subagent (без Client)**
2. **Добавить роль Client (отметить checkbox)**
3. **Проверить, что Type остается "Company" (не переключается на Person)**
4. **Проверить, что поля Company остаются видимыми**
5. **Проверить, что данные сохраняются с правильным Type**

**Тест для Person:**
1. Открыть запись с Type = Person и Roles = Supplier/Subagent
2. Добавить роль Client
3. Проверить, что Type остается "Person"

---

## 📝 ДОПОЛНИТЕЛЬНЫЕ ЗАМЕЧАНИЯ

- **Важно:** При добавлении Client роли Type должен сохраняться, а не переключаться
- **Логика:** `clientType` должен синхронизироваться с `baseType` при добавлении Client роли
- **Направление:** `clientType = baseType` (не наоборот), чтобы сохранить существующий Type

---

**Created by:** ARCHITECT (based on QA Agent report)  
**Date:** 2026-01-03  
**Related:** DirectoryForm, clientType initialization, Type switching, Client role

