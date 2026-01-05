# Fix PUT Endpoint "Party not found or update failed"

**Priority:** HIGH  
**Assigned to:** CODE WRITER  
**Status:** PENDING  
**Created:** 2026-01-03

---

## 🎯 ПРОБЛЕМА

**User Report:** "снова- Party not found or update failed"

**Error:** `Party not found or update failed`

**Location:** `app/api/directory/[id]/route.ts` (строка 313-318)

**Симптомы:**
- Запись открывается успешно (GET endpoint работает)
- При сохранении изменений (PUT endpoint) получаем ошибку
- `.update().select()` возвращает пустой массив (запись не найдена)

---

## 🔍 ТЕКУЩИЙ КОД (ПРОБЛЕМНЫЙ)

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
  console.error("Party not found after update attempt:", { id });
  return NextResponse.json(
    { error: "Party not found or update failed" },
    { status: 404 }
  );
}
```

**Проблема:** `.update().select()` возвращает пустой массив, если запись не найдена.

**Возможные причины:**
1. ID неправильный (но GET endpoint работает с тем же ID)
2. Запись существует, но что-то не так с update запросом
3. Tenant isolation (но используем supabaseAdmin, который должен обходить RLS)

---

## ✅ РЕШЕНИЕ

**Добавить проверку существования записи перед update и больше диагностики:**

```typescript
const { id } = await params;
const body = await request.json();
const updates = body as Partial<DirectoryRecord>;

// Диагностика: проверить, существует ли запись перед update
const { data: existingParty, error: checkError } = await supabaseAdmin
  .from("party")
  .select("id, company_id")
  .eq("id", id)
  .maybeSingle();

console.log("[Directory PUT] Checking party existence:", {
  id,
  exists: !!existingParty,
  company_id: existingParty?.company_id,
  error: checkError?.message,
});

if (checkError) {
  console.error("[Directory PUT] Error checking party:", checkError);
  return NextResponse.json(
    { error: "Failed to verify party existence", details: checkError.message },
    { status: 500 }
  );
}

if (!existingParty) {
  console.error("[Directory PUT] Party not found before update:", { id });
  return NextResponse.json(
    { error: "Party not found" },
    { status: 404 }
  );
}

// Update party table
const partyUpdates: any = {};
if (updates.isActive !== undefined) {
  partyUpdates.status = updates.isActive ? "active" : "inactive";
}
if (updates.email !== undefined) {
  partyUpdates.email = (typeof updates.email === 'string' && updates.email.trim()) ? updates.email.trim() : null;
}
if (updates.phone !== undefined) {
  partyUpdates.phone = (typeof updates.phone === 'string' && updates.phone.trim()) ? updates.phone.trim() : null;
}
partyUpdates.updated_at = new Date().toISOString();

console.log("[Directory PUT] Updating party:", {
  id,
  updates: partyUpdates,
});

const { data: partyAfterUpdate, error: partyError } = await supabaseAdmin
  .from("party")
  .update(partyUpdates)
  .eq("id", id)
  .select();

if (partyError) {
  console.error("[Directory PUT] Error updating party:", {
    id,
    error: partyError.message,
    code: partyError.code,
    details: partyError.details,
  });
  return NextResponse.json(
    { error: "Failed to update party", details: partyError.message },
    { status: 500 }
  );
}

if (!partyAfterUpdate || partyAfterUpdate.length === 0) {
  console.error("[Directory PUT] Party not found after update:", {
    id,
    existingPartyId: existingParty?.id,
    existingPartyCompanyId: existingParty?.company_id,
  });
  return NextResponse.json(
    { error: "Party not found or update failed" },
    { status: 404 }
  );
}

console.log("[Directory PUT] Party updated successfully:", {
  id,
  updatedRecords: partyAfterUpdate.length,
});
```

---

## 🧪 ПРОВЕРКА

После исправления:

1. **Открыть запись для редактирования**
2. **Изменить поля**
3. **Сохранить**
4. **Проверить логи в консоли:**
   - Проверка существования записи
   - ID, который используется
   - Результат update
5. **Если ошибка все еще возникает, логи покажут, где именно проблема**

---

## 📋 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА

Если проблема все еще возникает, проверить:

1. **Какой ID приходит в PUT endpoint?** (должен быть ID из party, не из partner_party)
2. **Существует ли запись в базе?** (SQL запрос)
3. **Правильный ли company_id?** (tenant isolation)

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** PUT endpoint, Party not found, update failed

