# ROOT CAUSE: ID Mismatch Between CREATE and GET

**Date:** 2026-01-03  
**Issue:** Records with supplier+subagent create but don't open

---

## 🔍 ПРОБЛЕМА НАЙДЕНА!

**Из данных Supabase:**

### partner_party таблица:
- `id: 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'` ← Это ID записи в partner_party
- `party_id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` ← Это ID записи в party

### party таблица:
- `id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` ✅ Существует
- `company_id: 'ca0143be-0696-4422-b949-4f4119adef36'` ✅ Совпадает с userCompanyId

**НО!** GET endpoint получает ID `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` (ID из partner_party), а не `11293ddb-6ac7-465b-bc18-ded62ce784f4` (ID из party)!

---

## 🎯 ROOT CAUSE

**Проблема:** Frontend использует неправильный ID для навигации!

**Что происходит:**
1. CREATE endpoint создает запись в `party` с ID `11293ddb-6ac7-465b-bc18-ded62ce784f4`
2. CREATE endpoint возвращает `{ ok: true, record: { id: partyId, display_name: ... } }`
3. Frontend получает `newRecord.id` = `11293ddb-6ac7-465b-bc18-ded62ce784f4` ✅ Правильно
4. Frontend делает `router.push(\`/directory/${newRecord.id}\`)` ✅ Правильно
5. **НО!** Откуда-то берется ID `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` (ID из partner_party) ❌

**Возможные причины:**
1. Frontend получает ID из другого источника (список записей?)
2. CREATE endpoint возвращает неправильный ID
3. URL формируется неправильно

---

## 🔍 ДОПОЛНИТЕЛЬНЫЕ ПРИЧИНЫ (кроме фильтра)

### 1. RLS (Row Level Security) в Supabase

**Как проверить:**
- Supabase Dashboard → Authentication → Policies
- Проверить политики для таблицы `party`
- Проверить политики для `partner_party`, `subagents`

**Если RLS блокирует:**
- Политика может разрешать только записи с `client_party`, но не `partner_party`
- Или политика проверяет наличие записи в `client_party` перед доступом

**SQL для проверки RLS:**
```sql
-- Проверить RLS политики для party
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'party';
```

### 2. Разные таблицы (не наш случай)

В нашем случае все роли используют одну таблицу `party` с разными role таблицами (`client_party`, `partner_party`, `subagents`).

### 3. Тип сущности (Party Type)

В нашем случае `party_type` может быть 'person' или 'company', но это не влияет на доступ - фильтрации по типу нет.

---

## 📊 Запросы, которые выполняет GET endpoint

### Query 1: Fetch Party (строка 124-142)

```typescript
let query = supabaseAdmin
  .from("party")
  .select("*")
  .eq("id", id);

if (userCompanyId) {
  query = query.eq("company_id", userCompanyId);
}

const { data: party, error: partyError } = await query.single();
```

**SQL эквивалент:**
```sql
SELECT * 
FROM party 
WHERE id = '<RECORD_ID>' 
  AND company_id = '<USER_COMPANY_ID>';
```

**Проблема:** Если ID неправильный (из partner_party вместо party), запрос вернет 0 rows.

### Query 2-6: Fetch Related Data (строки 201-227)

После успешного получения `party`, выполняются параллельные запросы:

```typescript
const [personData, companyData, clientData, supplierData, subagentData] = await Promise.all([
  supabaseAdmin.from("party_person").select("*").eq("party_id", id).maybeSingle(),
  supabaseAdmin.from("party_company").select("*").eq("party_id", id).maybeSingle(),
  supabaseAdmin.from("client_party").select("party_id").eq("party_id", id).maybeSingle(),
  supabaseAdmin.from("partner_party").select("*").eq("party_id", id).maybeSingle(),
  supabaseAdmin.from("subagents").select("*").eq("party_id", id).maybeSingle(),
]);
```

**SQL эквиваленты:**
```sql
-- Query 2: Person data
SELECT * FROM party_person WHERE party_id = '<RECORD_ID>';

-- Query 3: Company data
SELECT * FROM party_company WHERE party_id = '<RECORD_ID>';

-- Query 4: Client role
SELECT party_id FROM client_party WHERE party_id = '<RECORD_ID>';

-- Query 5: Supplier role
SELECT * FROM partner_party WHERE party_id = '<RECORD_ID>';

-- Query 6: Subagent role
SELECT * FROM subagents WHERE party_id = '<RECORD_ID>';
```

**Важно:** Все эти запросы используют `party_id` (ID из таблицы `party`), а не ID из role таблиц!

---

## ✅ РЕШЕНИЕ

### Проверить: Откуда берется неправильный ID?

**Вариант 1: CREATE endpoint возвращает неправильный ID**

**File:** `app/api/directory/create/route.ts` (строка 267-273)

```typescript
return NextResponse.json({
  ok: true,
  record: {
    id: partyId,  // ← Это должно быть ID из party, не из partner_party!
    display_name: displayName,
  },
});
```

**Проверить:** `partyId` - это ID из таблицы `party`?

**Вариант 2: Frontend получает ID из списка записей**

**File:** `app/directory/page.tsx` или `app/api/directory/route.ts`

**Проверить:** Как формируется список записей? Возвращает ли он правильные ID?

**Вариант 3: URL формируется неправильно**

**File:** `app/directory/new/page.tsx` (строка 58)

```typescript
router.push(`/directory/${newRecord.id}`);
```

**Проверить:** Что содержит `newRecord.id`? Это ID из `party` или из `partner_party`?

---

## 🔧 ДИАГНОСТИКА

**SQL скрипт:** `migrations/check_record_b0eb268e.sql`

**Проверить:**
1. Существует ли `party` с ID `11293ddb-6ac7-465b-bc18-ded62ce784f4`? ✅ ДА (из данных)
2. Правильный ли `company_id`? ✅ ДА (`ca0143be-0696-4422-b949-4f4119adef36`)
3. Какие роли есть у этого `party_id`? ✅ Supplier (partner_party)
4. Почему GET получает ID `b0eb268e...` вместо `11293ddb...`? ❓ НУЖНО ПРОВЕРИТЬ

---

## 📝 РЕКОМЕНДАЦИИ

1. **Проверить CREATE endpoint:** Что именно возвращает `partyId`?
2. **Проверить frontend:** Откуда берется ID для навигации?
3. **Проверить список записей:** Какой ID возвращает `/api/directory`?
4. **Проверить RLS:** Могут ли политики блокировать доступ к `partner_party`?

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** ID mismatch, Record not found, CREATE vs GET endpoint

