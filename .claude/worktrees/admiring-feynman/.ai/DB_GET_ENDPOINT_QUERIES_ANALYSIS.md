# GET Endpoint Database Queries Analysis

**Date:** 2026-01-03  
**Issue:** Records with supplier+subagent create but don't open (0 rows returned)

---

## 🔍 Запросы, которые выполняет GET endpoint

**File:** `app/api/directory/[id]/route.ts`

### Query 1: Fetch Party (строка 129-147)

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

**Проблема:** Если запись не найдена (0 rows), `.single()` выдает ошибку `PGRST116: Cannot coerce the result to a single JSON object`

---

### Query 2-6: Fetch Related Data (строки 208-234)

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

---

## 🎯 ПРОБЛЕМА: ID Mismatch!

**Из данных пользователя:**

### partner_party таблица:
- `id: 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'` (это ID записи в partner_party)
- `party_id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` (это ID записи в party)

### party таблица:
- `id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` ✅ Существует
- `company_id: 'ca0143be-0696-4422-b949-4f4119adef36'` ✅ Совпадает с userCompanyId

**НО!** GET endpoint получает ID `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` (ID из partner_party), а не `11293ddb-6ac7-465b-bc18-ded62ce784f4` (ID из party)!

---

## 🔍 ROOT CAUSE: Неправильный ID в URL

**Проблема:** 
- CREATE endpoint возвращает `id: partyId` (ID из таблицы `party`)
- Но пользователь пытается открыть запись по ID `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317`
- Этот ID - это ID из таблицы `partner_party`, а не из `party`!

**Проверка:**
- `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` существует в `partner_party`
- Но НЕ существует в `party`
- GET endpoint ищет в `party` по ID `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317`
- Не находит → 0 rows → ошибка

---

## ✅ РЕШЕНИЕ

### Вариант 1: CREATE endpoint возвращает неправильный ID

**Проверить:** Что возвращает CREATE endpoint?

**File:** `app/api/directory/create/route.ts` (строка 267-273)

```typescript
return NextResponse.json({
  ok: true,
  record: {
    id: partyId,  // ← Это ID из party?
    display_name: displayName,
  },
});
```

**Если `partyId` правильный** → Проблема в том, как frontend использует этот ID

### Вариант 2: Frontend использует неправильный ID

**Проверить:** Как frontend получает ID после создания?

**File:** `app/directory/new/page.tsx` или `lib/directory/directoryStore.tsx`

---

## 📊 Дополнительные причины (кроме фильтра)

### 1. RLS (Row Level Security) в Supabase

**Как проверить:**
- Открыть Supabase Dashboard
- Authentication → Policies
- Проверить политики для таблицы `party`
- Проверить политики для таблиц `partner_party`, `subagents`

**Если RLS блокирует:**
- Политика может разрешать только `client_party`, но не `partner_party`
- Или политика проверяет наличие записи в `client_party`

### 2. Разные таблицы (не наш случай)

В нашем случае все роли используют одну таблицу `party` с разными role таблицами.

### 3. Тип сущности (Party Type)

В нашем случае `party_type` может быть 'person' или 'company', но это не влияет на доступ.

---

## 🔧 ДИАГНОСТИКА

**SQL скрипт:** `migrations/check_record_b0eb268e.sql`

**Проверить:**
1. Существует ли `party` с ID `11293ddb-6ac7-465b-bc18-ded62ce784f4`?
2. Правильный ли `company_id`?
3. Какие роли есть у этого `party_id`?
4. Почему GET получает ID `b0eb268e...` вместо `11293ddb...`?

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** GET endpoint queries, ID mismatch, Record not found

