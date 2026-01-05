# GET Endpoint Database Queries - Detailed Analysis

**Date:** 2026-01-03  
**Issue:** Records with supplier+subagent create but don't open (0 rows returned)

---

## 📊 Запросы, которые выполняет GET endpoint

**File:** `app/api/directory/[id]/route.ts`

### Query 1: Fetch Party (строки 124-142)

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

**Таблицы:** `party`

**Проблема:** Если запись не найдена (0 rows), `.single()` выдает ошибку `PGRST116: Cannot coerce the result to a single JSON object`

---

### Query 2: Fetch Person Data (строки 202-206)

```typescript
supabaseAdmin
  .from("party_person")
  .select("*")
  .eq("party_id", id)
  .maybeSingle()
```

**SQL эквивалент:**
```sql
SELECT * 
FROM party_person 
WHERE party_id = '<RECORD_ID>';
```

**Таблицы:** `party_person`

---

### Query 3: Fetch Company Data (строки 207-211)

```typescript
supabaseAdmin
  .from("party_company")
  .select("*")
  .eq("party_id", id)
  .maybeSingle()
```

**SQL эквивалент:**
```sql
SELECT * 
FROM party_company 
WHERE party_id = '<RECORD_ID>';
```

**Таблицы:** `party_company`

---

### Query 4: Fetch Client Role (строки 212-216)

```typescript
supabaseAdmin
  .from("client_party")
  .select("party_id")
  .eq("party_id", id)
  .maybeSingle()
```

**SQL эквивалент:**
```sql
SELECT party_id 
FROM client_party 
WHERE party_id = '<RECORD_ID>';
```

**Таблицы:** `client_party`

---

### Query 5: Fetch Supplier Role (строки 217-221)

```typescript
supabaseAdmin
  .from("partner_party")
  .select("*")
  .eq("party_id", id)
  .maybeSingle()
```

**SQL эквивалент:**
```sql
SELECT * 
FROM partner_party 
WHERE party_id = '<RECORD_ID>';
```

**Таблицы:** `partner_party`

**Важно:** Запрос ищет по `party_id` (ID из таблицы `party`), а не по `id` (ID из таблицы `partner_party`)!

---

### Query 6: Fetch Subagent Role (строки 222-226)

```typescript
supabaseAdmin
  .from("subagents")
  .select("*")
  .eq("party_id", id)
  .maybeSingle()
```

**SQL эквивалент:**
```sql
SELECT * 
FROM subagents 
WHERE party_id = '<RECORD_ID>';
```

**Таблицы:** `subagents`

**Важно:** Запрос ищет по `party_id` (ID из таблицы `party`), а не по `id` (ID из таблицы `subagents`)!

---

## 🎯 ПРОБЛЕМА: ID Mismatch!

**Из данных пользователя:**

### partner_party таблица:
- `id: 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317'` ← Это ID записи в partner_party
- `party_id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` ← Это ID записи в party

### party таблица:
- `id: '11293ddb-6ac7-465b-bc18-ded62ce784f4'` ✅ Существует
- `company_id: 'ca0143be-0696-4422-b949-4f4119adef36'` ✅ Совпадает с userCompanyId

**НО!** GET endpoint получает ID `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` (ID из partner_party), а не `11293ddb-6ac7-465b-bc18-ded62ce784f4` (ID из party)!

**Query 1 ищет:**
```sql
SELECT * FROM party WHERE id = 'b0eb268e-a72c-43a5-a0c9-2ad2d2edf317';
```

**Результат:** 0 rows → Ошибка `PGRST116`

---

## 🔍 ДОПОЛНИТЕЛЬНЫЕ ПРИЧИНЫ (кроме фильтра)

### 1. RLS (Row Level Security) в Supabase

**Как проверить:**
- Открыть Supabase Dashboard
- Authentication → Policies
- Проверить политики для таблицы `party`
- Проверить политики для таблиц `partner_party`, `subagents`

**Если RLS блокирует:**
- Политика может разрешать только `client_party`, но не `partner_party`
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
WHERE tablename IN ('party', 'partner_party', 'subagents');
```

### 2. Разные таблицы (не наш случай)

В нашем случае все роли используют одну таблицу `party` с разными role таблицами (`client_party`, `partner_party`, `subagents`).

### 3. Тип сущности (Party Type)

В нашем случае `party_type` может быть 'person' или 'company', но это не влияет на доступ - фильтрации по типу нет.

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

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** GET endpoint queries, ID mismatch, Record not found

