# Directory Detail Page Not Opening - Field Mapping and Query Issues
**Priority:** CRITICAL  
**Type:** Bug Fix  
**Assigned to:** CODE WRITER  
**Status:** TODO

---

## 🔍 ПРОБЛЕМА

### Симптомы:
- Страница `/directory/[id]` не открывается для ID `4642eea4-38ed-464d-866c-3d2bea38235e`
- Страница `/directory/[id]` не открывается для ID `7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089` (проверено 2025-12-25)
- API возвращает ошибку: `{"error":"Party not found","details":"Cannot coerce the result to a single JSON object"}`
- Ошибка "Cannot coerce the result to a single JSON object" означает, что `.single()` получает 0 или >1 записей
- **Проблема воспроизводится на нескольких ID** - это системная проблема, не единичный случай

---

## 🔍 ПРИЧИНА

**Файл:** `app/api/directory/[id]/route.ts`

### Возможные причины:

1. **Tenant Isolation Issue (наиболее вероятно):**
   - Строки 117-119: Если пользователь авторизован, применяется фильтр `company_id`
   - Если запись была создана с другим `company_id`, она не будет найдена
   - Запрос возвращает 0 записей → `.single()` выдает ошибку

2. **Проблема с авторизацией:**
   - `fetchWithAuth` может не отправлять токен корректно
   - `getCurrentUser` может не находить пользователя
   - Если `user` = null, но запись требует tenant isolation, она не будет найдена

3. **Проблема с mapping полей:**
   - Возможно, какое-то поле не соответствует ожидаемому формату
   - Но это менее вероятно, так как ошибка происходит на этапе `.single()`

---

## 🔧 ИСПРАВЛЕНИЕ

### Файл: `app/api/directory/[id]/route.ts`

**Проблема 1: Tenant Isolation слишком строгий**

**Текущий код (строки 110-121):**
```typescript
// Fetch party
let query = supabaseAdmin
  .from("party")
  .select("*")
  .eq("id", id);

// Apply tenant isolation if user is authenticated
if (userCompanyId) {
  query = query.eq("company_id", userCompanyId);
}

const { data: party, error: partyError } = await query.single();
```

**Проблема:** Если запись существует, но с другим `company_id`, она не будет найдена.

**Решение 1 (рекомендуется):** Добавить диагностическое логирование и улучшить обработку ошибок:
```typescript
// Fetch party
let query = supabaseAdmin
  .from("party")
  .select("*")
  .eq("id", id);

// Apply tenant isolation if user is authenticated
if (userCompanyId) {
  query = query.eq("company_id", userCompanyId);
}

const { data: party, error: partyError } = await query.single();

if (partyError) {
  // Check if it's a "not found" error due to tenant isolation
  if (partyError.code === "PGRST116" || partyError.message?.includes("single")) {
    // Try without tenant isolation to see if record exists
    const { data: partyWithoutIsolation } = await supabaseAdmin
      .from("party")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();
    
    if (partyWithoutIsolation) {
      console.error("[Directory GET] Record exists but company_id mismatch:", {
        id,
        recordCompanyId: partyWithoutIsolation.company_id,
        userCompanyId,
      });
      return NextResponse.json(
        { 
          error: "Party not found", 
          details: "Record exists but belongs to a different company",
          hint: "Check company_id match"
        },
        { status: 404 }
      );
    }
  }
  
  console.error("[Directory GET] Error fetching party:", {
    id,
    error: partyError.message,
    code: partyError.code,
    details: partyError.details,
    hint: partyError.hint,
    userCompanyId,
  });
  return NextResponse.json(
    { error: "Party not found", details: partyError.message },
    { status: 404 }
  );
}
```

**Решение 2 (альтернатива):** Использовать `.maybeSingle()` вместо `.single()` для более мягкой обработки:
```typescript
const { data: party, error: partyError } = await query.maybeSingle();

if (partyError) {
  console.error("[Directory GET] Error fetching party:", {
    id,
    error: partyError.message,
    code: partyError.code,
    userCompanyId,
  });
  return NextResponse.json(
    { error: "Party not found", details: partyError.message },
    { status: 404 }
  );
}

if (!party) {
  // Check if record exists without tenant isolation
  const { data: partyWithoutIsolation } = await supabaseAdmin
    .from("party")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();
  
  if (partyWithoutIsolation) {
    return NextResponse.json(
      { 
        error: "Party not found", 
        details: "Record exists but belongs to a different company",
      },
      { status: 404 }
    );
  }
  
  return NextResponse.json(
    { error: "Party not found" },
    { status: 404 }
  );
}
```

---

## 📊 ВЛИЯНИЕ

### До исправления:
- ❌ Страница `/directory/[id]` не открывается для некоторых записей
- ❌ Ошибка "Cannot coerce the result to a single JSON object" не информативна
- ❌ Невозможно понять, почему запись не найдена (tenant isolation или не существует)
- ❌ Пользователь не видит детальную информацию о записи

### После исправления:
- ✅ Страница `/directory/[id]` открывается для всех записей пользователя
- ✅ Ошибки более информативны (показывают причину: tenant isolation или не существует)
- ✅ Логирование помогает диагностировать проблемы
- ✅ Пользователь видит детальную информацию о записи

---

## ✅ КРИТЕРИИ ПРИЕМКИ

1. ✅ Страница `/directory/[id]` открывается для существующих записей
2. ✅ Ошибки более информативны (показывают причину)
3. ✅ Логирование помогает диагностировать проблемы с tenant isolation
4. ✅ Записи с правильным `company_id` загружаются корректно
5. ✅ Записи с неправильным `company_id` возвращают понятную ошибку
6. ✅ Консоль браузера не показывает ошибки загрузки данных

---

## 🧪 ТЕСТИРОВАНИЕ

### Шаги для проверки:
1. Открыть `/directory/4642eea4-38ed-464d-866c-3d2bea38235e` → должна загрузиться страница
2. Проверить консоль браузера → не должно быть ошибок
3. Проверить логи сервера → должны быть информативные сообщения
4. Создать новую запись → должна открываться детальная страница
5. Попытаться открыть запись с другим `company_id` → должна быть понятная ошибка

### Ожидаемый результат:
- Страница открывается для всех записей пользователя
- Ошибки информативны и помогают диагностировать проблемы

---

## 📝 ПРИМЕЧАНИЯ

- **Важно:** Проверить, что запись существует в базе данных с правильным `company_id`
- **Важно:** Проверить, что `fetchWithAuth` отправляет токен корректно
- **Важно:** Проверить, что `getCurrentUser` находит пользователя
- После исправления нужно проверить все существующие записи

---

## 🔍 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА

**Проверить в базе данных:**
```sql
SELECT id, company_id, display_name, party_type 
FROM party 
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';
```

**Проверить company_id пользователя:**
```sql
SELECT user_id, company_id 
FROM profiles 
WHERE user_id = '<current_user_id>';
```

**Если запись существует, но с другим company_id:**
- Это проблема tenant isolation
- Нужно либо исправить company_id записи, либо изменить логику tenant isolation

---

**Created by:** QA Agent  
**Date:** 2025-12-25  
**Related:** Directory Detail Page, Tenant Isolation, Field Mapping

