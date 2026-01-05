# Task: Fix Directory Search - Include company_name

**Agent:** CODE WRITER
**Priority:** MEDIUM
**Status:** TODO
**Created:** 2026-01-05

---

## Problem

Поиск в Directory не находит записи по названию компании. Например, поиск "tez" не находит "TEZ TOUR".

**User Report:**
- `http://localhost:3000/directory` - поиск "tez" в названии ничего не находит

---

## Root Cause

В `app/api/directory/route.ts` (строки 128-136), поиск выполняется только по полям из таблицы `party`:
- `party.display_name`
- `party.email`
- `party.phone`

Но название компании хранится в таблице `party_company` в поле `company_name`, которое не включено в поиск.

```typescript:128:136:app/api/directory/route.ts
// Search filter (name, email, phone) - case-insensitive
if (search) {
  // Use ilike for case-insensitive search (ilike is case-insensitive in PostgreSQL)
  // The .or() method accepts a string with format: "column.ilike.%value%,column2.ilike.%value%"
  // ilike operator is case-insensitive by default in PostgreSQL
  query = query.or(
    `display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
  );
}
```

---

## Solution

Необходимо включить поиск по `company_name` из таблицы `party_company`.

**Вариант 1 (Рекомендуемый):** Использовать JOIN в Supabase запросе для поиска по связанной таблице.

**Вариант 2:** Фильтровать результаты после загрузки всех данных (менее эффективно, но проще в реализации).

---

## Implementation Details

### Вариант 1: JOIN в Supabase запросе

1. Изменить запрос `party` чтобы включить JOIN с `party_company`:
   ```typescript
   let query = supabaseAdmin
     .from("party")
     .select(`
       *,
       party_company!left(company_name)
     `, { count: "exact" });
   ```

2. Обновить поисковый запрос, чтобы включить `company_name`:
   ```typescript
   if (search) {
     // Поиск по party и связанной party_company
     query = query.or(
       `display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,party_company.company_name.ilike.%${search}%`
     );
   }
   ```

**Проблема:** Supabase `.or()` может не поддерживать поиск по связанным таблицам напрямую.

### Вариант 2: Фильтрация после загрузки данных (Более надежный)

1. Загрузить данные как обычно (уже делается в строках 163-192).
2. После построения `companyMap` (строка 196), фильтровать результаты:
   ```typescript
   // После строки 209, перед строкой 211, добавить фильтрацию по company_name:
   if (search) {
     const searchLower = search.toLowerCase();
     filteredParties = filteredParties.filter((p: any) => {
       // Проверка по party полям (уже сделано в строке 133-135, но нужно повторить для фильтрации)
       const matchesDisplayName = p.display_name?.toLowerCase().includes(searchLower);
       const matchesEmail = p.email?.toLowerCase().includes(searchLower);
       const matchesPhone = p.phone?.toLowerCase().includes(searchLower);
       
       // Проверка по company_name из party_company
       const company = companyMap.get(p.id);
       const matchesCompanyName = company?.company_name?.toLowerCase().includes(searchLower);
       
       return matchesDisplayName || matchesEmail || matchesPhone || matchesCompanyName;
     });
   }
   ```

**Однако:** Поиск уже применен к `query` в строке 133-135, поэтому `filteredParties` уже отфильтрован по `display_name`, `email`, `phone`. Нужно либо:
- Убрать поиск из строк 133-135 и делать фильтрацию после загрузки всех данных
- Или сначала загрузить все данные без поиска, затем фильтровать включая `company_name`

### Вариант 3: Использовать подзапрос для поиска по company_name

Можно использовать `.in()` с подзапросом для поиска `party_id` по `company_name`:
```typescript
if (search) {
  // Сначала найти party_id по company_name
  const { data: matchingCompanies } = await supabaseAdmin
    .from("party_company")
    .select("party_id")
    .ilike("company_name", `%${search}%`);
  
  const companyPartyIds = matchingCompanies?.map(c => c.party_id) || [];
  
  // Затем добавить поиск по party и включить найденные company_id
  query = query.or(
    `display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
  );
  
  if (companyPartyIds.length > 0) {
    query = query.in("id", companyPartyIds);
  }
}
```

**Проблема:** Это может создать конфликт между `.or()` и `.in()`. Нужно использовать `.or()` с объединением условий.

### Рекомендуемое решение: Вариант 2 (упрощенный)

Убрать поиск из основного запроса и фильтровать после загрузки всех данных:

1. **Убрать поиск из строк 133-135:**
   ```typescript
   // Удалить или закомментировать:
   // if (search) {
   //   query = query.or(...);
   // }
   ```

2. **Добавить фильтрацию после строки 209 (после применения role filter):**
   ```typescript
   // Apply search filter (including company_name) after loading all data
   if (search) {
     const searchLower = search.toLowerCase();
     filteredParties = filteredParties.filter((p: any) => {
       const matchesDisplayName = p.display_name?.toLowerCase().includes(searchLower);
       const matchesEmail = p.email?.toLowerCase().includes(searchLower);
       const matchesPhone = p.phone?.toLowerCase().includes(searchLower);
       
       // Check company_name from party_company
       const company = companyMap.get(p.id);
       const matchesCompanyName = company?.company_name?.toLowerCase().includes(searchLower);
       
       return matchesDisplayName || matchesEmail || matchesPhone || matchesCompanyName;
     });
   }
   ```

---

## Files to Modify

- `app/api/directory/route.ts` (строки 128-136 и после строки 209)

---

## Testing

1. Создать или найти запись компании с названием "TEZ TOUR"
2. Выполнить поиск "tez" в Directory
3. Проверить, что запись найдена
4. Проверить, что поиск работает также по `display_name`, `email`, `phone`
5. Проверить, что поиск работает по частичному совпадению (например, "tez" находит "TEZ TOUR")

---

## Acceptance Criteria

- [ ] Поиск "tez" находит "TEZ TOUR"
- [ ] Поиск работает по `company_name` из `party_company`
- [ ] Поиск продолжает работать по `display_name`, `email`, `phone`
- [ ] Поиск работает case-insensitive
- [ ] Поиск работает по частичному совпадению

---
