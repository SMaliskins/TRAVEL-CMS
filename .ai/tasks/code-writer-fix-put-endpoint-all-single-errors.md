# Fix PUT Endpoint - All Single() Errors

**Priority:** HIGH  
**Assigned to:** CODE WRITER  
**Status:** PENDING  
**Created:** 2026-01-03

---

## 🎯 ПРОБЛЕМА

**User Report:** "Failed to update party (Cannot coerce the result to a single JSON object)"

**Error:** `Cannot coerce the result to a single JSON object` (PGRST116)

**Location:** `app/api/directory/[id]/route.ts`

**Проблема:** Использование `.single()` в нескольких местах, которое выдает ошибку если запрос возвращает 0 строк.

---

## 🔍 МЕСТА С ПРОБЛЕМОЙ

### Проблема 1: Строка 299-304 (обновление party)

```typescript
const { data: partyAfterUpdate, error: partyError } = await supabaseAdmin
  .from("party")
  .update(partyUpdates)
  .eq("id", id)
  .select()
  .single();
```

**Проблема:** Если update не находит запись (например, из-за неправильного ID), `.single()` выдает ошибку PGRST116.

**Но:** На самом деле, если `.update().eq("id", id)` не находит запись, он просто не обновит ничего и вернет пустой результат. `.single()` затем выдаст ошибку.

**Решение:** Использовать `.maybeSingle()` или убрать `.single()` (так как `.select()` после `.update()` уже возвращает обновленные строки).

### Проблема 2: Строка 456-460 (получение обновленной записи)

```typescript
// Fetch updated record
const { data: updatedParty } = await supabaseAdmin
  .from("party")
  .select("*")
  .eq("id", id)
  .single();
```

**Проблема:** Если запись не найдена, `.single()` выдает ошибку PGRST116.

**Решение:** Заменить на `.maybeSingle()` и обработать ошибку.

---

## ✅ РЕШЕНИЕ

### Исправление 1: Строка 299-304

**Вариант A: Убрать `.single()`, так как `.update().select()` возвращает массив**

```typescript
const { data: partyAfterUpdate, error: partyError } = await supabaseAdmin
  .from("party")
  .update(partyUpdates)
  .eq("id", id)
  .select();

if (partyError) {
  console.error("Error updating party:", partyError);
  return NextResponse.json(
    { error: "Failed to update party", details: partyError.message },
    { status: 500 }
  );
}

if (!partyAfterUpdate || partyAfterUpdate.length === 0) {
  return NextResponse.json(
    { error: "Party not found or update failed" },
    { status: 404 }
  );
}
```

**Вариант B: Использовать `.maybeSingle()`**

```typescript
const { data: partyAfterUpdate, error: partyError } = await supabaseAdmin
  .from("party")
  .update(partyUpdates)
  .eq("id", id)
  .select()
  .maybeSingle();

if (partyError) {
  console.error("Error updating party:", partyError);
  return NextResponse.json(
    { error: "Failed to update party", details: partyError.message },
    { status: 500 }
  );
}

if (!partyAfterUpdate) {
  return NextResponse.json(
    { error: "Party not found or update failed" },
    { status: 404 }
  );
}
```

**РЕКОМЕНДАЦИЯ:** Вариант A - убрать `.single()`, так как `.update().select()` уже возвращает массив обновленных записей.

### Исправление 2: Строка 456-460

```typescript
// Fetch updated record
const { data: updatedParty, error: fetchError } = await supabaseAdmin
  .from("party")
  .select("*")
  .eq("id", id)
  .maybeSingle();

if (fetchError) {
  console.error("Error fetching updated party:", {
    id,
    error: fetchError.message,
    code: fetchError.code,
    details: fetchError.details,
  });
  return NextResponse.json(
    { error: "Failed to fetch updated record", details: fetchError.message },
    { status: 500 }
  );
}

if (!updatedParty) {
  console.error("Updated party not found after update:", id);
  return NextResponse.json(
    { error: "Failed to fetch updated record: Record not found after update" },
    { status: 500 }
  );
}
```

---

## 📋 ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД

### Исправление 1 (строка ~299):

```typescript
const { data: partyAfterUpdate, error: partyError } = await supabaseAdmin
  .from("party")
  .update(partyUpdates)
  .eq("id", id)
  .select();

if (partyError) {
  console.error("Error updating party:", partyError);
  return NextResponse.json(
    { error: "Failed to update party", details: partyError.message },
    { status: 500 }
  );
}

if (!partyAfterUpdate || partyAfterUpdate.length === 0) {
  return NextResponse.json(
    { error: "Party not found or update failed" },
    { status: 404 }
  );
}
```

### Исправление 2 (строка ~456):

```typescript
// Fetch updated record
const { data: updatedParty, error: fetchError } = await supabaseAdmin
  .from("party")
  .select("*")
  .eq("id", id)
  .maybeSingle();

if (fetchError) {
  console.error("Error fetching updated party:", {
    id,
    error: fetchError.message,
    code: fetchError.code,
    details: fetchError.details,
  });
  return NextResponse.json(
    { error: "Failed to fetch updated record", details: fetchError.message },
    { status: 500 }
  );
}

if (!updatedParty) {
  console.error("Updated party not found after update:", id);
  return NextResponse.json(
    { error: "Failed to fetch updated record: Record not found after update" },
    { status: 500 }
  );
}
```

---

## 🧪 ПРОВЕРКА

После исправления:

1. **Открыть запись для редактирования**
2. **Изменить поля (например, Company Name)**
3. **Нажать "Save" или "Save & Close"**
4. **Убедиться, что ошибка "Cannot coerce the result to a single JSON object" не появляется**
5. **Проверить, что изменения сохранились**

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** PUT endpoint, single() error, PGRST116, update().select()

