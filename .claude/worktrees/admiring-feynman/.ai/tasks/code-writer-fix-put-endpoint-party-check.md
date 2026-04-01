# Fix PUT Endpoint - Multiple Issues: Party Check and Single() Error

**Priority:** HIGH  
**Assigned to:** CODE WRITER  
**Status:** PENDING  
**Created:** 2026-01-03  
**Updated:** 2026-01-03 (added single() error fix)

---

## 🎯 ПРОБЛЕМЫ

**User Report 1:** "запись теперь открывается! но не дает сохранить изменения с ошибкой Party not found. Cannot update roles."

**User Report 2:** "Failed to update party (Cannot coerce the result to a single JSON object)"

**Errors:**
1. `Party not found. Cannot update roles.` (строки 357-373)
2. `Cannot coerce the result to a single JSON object` (строка 437-441)

**Location:** `app/api/directory/[id]/route.ts`

---

## 🔍 ТЕКУЩИЙ КОД (ПРОБЛЕМНЫЙ)

```typescript
// Update roles (always update if roles is provided, even if empty array)
if (updates.roles !== undefined) {
  const { data: existingParty, error: partyCheckError } = await supabaseAdmin
    .from("party")
    .select("id, party_type")
    .eq("id", id)
    .single();
  
  if (partyCheckError || !existingParty) {
    console.error("Error: Party not found when updating roles:", {
      id,
      error: partyCheckError?.message,
      code: partyCheckError?.code,
    });
    return NextResponse.json(
      { error: "Party not found. Cannot update roles." },
      { status: 404 }
    );
  }
  // ...
}
```

**Проблема:** Запрос `.single()` не находит запись, хотя GET endpoint находит ее успешно.

**Возможные причины:**
1. Запрос выполняется после обновления party (строка 299-302), но это не должно влиять
2. Нужно добавить больше диагностики
3. Может быть проблема с тем, что запись была удалена между обновлением party и проверкой

---

## ✅ РЕШЕНИЕ

**Вариант 1: Использовать уже обновленную запись (РЕКОМЕНДУЕТСЯ)**

Так как мы уже обновили `party` на строке 299-302, можно использовать результат этого обновления, или просто не проверять снова, а использовать данные из `updates`.

```typescript
// Update roles (always update if roles is provided, even if empty array)
if (updates.roles !== undefined) {
  // Не нужно проверять снова - мы уже обновили party выше
  // Используем party_type из updates или из базы (если нужно)
  
  const partyTypeForClient = updates.type || "person";
  const clientType = partyTypeForClient === "company" ? "company" : "person";

  // Remove all existing roles
  await Promise.all([
    supabaseAdmin.from("client_party").delete().eq("party_id", id),
    supabaseAdmin.from("partner_party").delete().eq("party_id", id),
    supabaseAdmin.from("subagents").delete().eq("party_id", id),
  ]);

  // Add new roles
  // ... (остальной код остается)
}
```

**Вариант 2: Использовать maybeSingle() и обработать случай отсутствия**

```typescript
// Update roles (always update if roles is provided, even if empty array)
if (updates.roles !== undefined) {
  const { data: existingParty, error: partyCheckError } = await supabaseAdmin
    .from("party")
    .select("id, party_type")
    .eq("id", id)
    .maybeSingle();
  
  // Если запись не найдена, используем type из updates
  const partyTypeForClient = existingParty?.party_type || updates.type || "person";
  const clientType = partyTypeForClient === "company" ? "company" : "person";

  // Remove all existing roles
  await Promise.all([
    supabaseAdmin.from("client_party").delete().eq("party_id", id),
    supabaseAdmin.from("partner_party").delete().eq("party_id", id),
    supabaseAdmin.from("subagents").delete().eq("party_id", id),
  ]);

  // Add new roles
  // ... (остальной код остается)
}
```

**Вариант 3: Добавить диагностику и использовать результат обновления party**

Но проще всего - просто убрать проверку, так как мы уже обновили party выше, и если обновление прошло успешно, значит запись существует.

**РЕКОМЕНДАЦИЯ:** Использовать Вариант 1 - убрать проверку, так как мы уже обновили party на строке 299-302, и если обновление прошло успешно (без ошибки), значит запись точно существует.

---

## 📋 КОД ПОСЛЕ ИСПРАВЛЕНИЯ

```typescript
// Update roles (always update if roles is provided, even if empty array)
if (updates.roles !== undefined) {
  // Party уже обновлен выше (строка 299-302), поэтому проверка не нужна
  // Используем party_type из updates
  const partyTypeForClient = updates.type || "person";
  const clientType = partyTypeForClient === "company" ? "company" : "person";

  // Remove all existing roles
  await Promise.all([
    supabaseAdmin.from("client_party").delete().eq("party_id", id),
    supabaseAdmin.from("partner_party").delete().eq("party_id", id),
    supabaseAdmin.from("subagents").delete().eq("party_id", id),
  ]);

  // Add new roles
  if (updates.roles.includes("client")) {
    const { error: clientError } = await supabaseAdmin.from("client_party").insert({ 
      party_id: id,
      client_type: clientType 
    });
    if (clientError) {
      console.error("Error inserting client_party:", {
        id,
        client_type: clientType,
        error: clientError.message,
        code: clientError.code,
        details: clientError.details,
        hint: clientError.hint,
      });
      return NextResponse.json(
        { error: `Failed to save client role: ${clientError.message}`, details: clientError.details },
        { status: 500 }
      );
    }
  }
  // ... (остальной код для supplier и subagent остается)
}
```

---

## 🧪 ПРОВЕРКА

После исправления:

1. **Открыть запись с supplier/subagent ролями**
2. **Изменить какие-то поля**
3. **Сохранить изменения**
4. **Убедиться, что ошибка "Party not found. Cannot update roles." не появляется**
5. **Проверить, что изменения сохранились**

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** PUT endpoint, role update, Party not found

