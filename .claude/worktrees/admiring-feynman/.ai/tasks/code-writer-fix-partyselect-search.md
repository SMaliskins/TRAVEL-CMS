# Task: Fix PartySelect Search - Not Finding Existing Clients

**Agent:** CODE WRITER
**Priority:** MEDIUM
**Status:** TODO
**Created:** 2026-01-05

---

## Problem

QA Report выявил проблему: PartySelect не находит существующих клиентов при поиске.

**QA Report:** `.ai/logs/QA_REPORT.md` (PartySelect Review — FAIL, SCORE: 4/10)

**BUG 2 (MEDIUM):** Поиск не находит существующих клиентов
- **Expected:** "Mališkins" находится в результатах
- **Actual:** "No results found"
- **Trace:** Возможно API не возвращает данные или проблема с фильтром role=client

---

## Root Cause Analysis

**Возможные причины:**

1. **API не возвращает данные:**
   - API endpoint `/api/directory?search=...` не работает правильно
   - Проблема с tenant isolation (company_id фильтр)
   - Проблема с поиском (не включает нужные поля)

2. **Фильтр role=client:**
   - PartySelect не передает `role=client` в запрос (строка 54)
   - Но API может фильтровать по ролям
   - Нужно проверить, есть ли записи в `client_party` для этого party

3. **Трансформация данных:**
   - API возвращает данные в одном формате, но PartySelect ожидает другой
   - Проблема с маппингом полей (строки 67-76)

---

## Solution

### Шаг 1: Проверить API запрос

В `components/PartySelect.tsx` (строка 54):
```typescript
const response = await fetch(`/api/directory?search=${encodeURIComponent(query)}&limit=10`, {
```

**Проблема:** Не передается `role=client` фильтр, хотя `roleFilter = "client"` по умолчанию.

**Решение:** Добавить фильтр роли в запрос:
```typescript
const response = await fetch(`/api/directory?search=${encodeURIComponent(query)}&role=${roleFilter}&limit=10`, {
```

### Шаг 2: Проверить трансформацию данных

В `components/PartySelect.tsx` (строки 67-76):
```typescript
const transformedResults: Party[] = results.map((r: Record<string, unknown>) => ({
  id: r.id as string,
  display_name: (r.displayName as string) || (r.display_name as string) || 
               [r.firstName || r.first_name, r.lastName || r.last_name].filter(Boolean).join(" ") ||
               (r.companyName as string) || (r.company_name as string) || 
               (r.name as string) || "",
  // ...
}));
```

**Проблема:** API возвращает `DirectoryRecord` с полями в camelCase, но может быть несоответствие.

**Решение:** Проверить формат ответа API и убедиться, что маппинг правильный.

### Шаг 3: Добавить логирование для отладки

Добавить console.log для проверки:
- Что возвращает API
- Как трансформируются данные
- Почему результаты пустые

---

## Implementation Details

1. **Добавить role фильтр в запрос:**
   ```typescript
   // Строка 54
   const response = await fetch(`/api/directory?search=${encodeURIComponent(query)}&role=${roleFilter}&limit=10`, {
   ```

2. **Проверить формат ответа API:**
   - Добавить логирование ответа API
   - Убедиться, что данные в правильном формате

3. **Улучшить обработку ошибок:**
   - Показывать более детальные ошибки
   - Логировать проблемы с поиском

---

## Files to Modify

- `components/PartySelect.tsx` (строки 42-97, функция `searchParties`)

---

## Testing

1. Создать клиента через Directory
2. Открыть Orders → New
3. Ввести имя клиента в PartySelect
4. Проверить, что клиент появляется в результатах поиска
5. Проверить с разными именами (с акцентами, кириллицей)
6. Проверить поиск по части имени

---

## Acceptance Criteria

- [ ] Поиск находит существующих клиентов
- [ ] Поиск работает с фильтром role=client
- [ ] Поиск работает с частичным совпадением
- [ ] Поиск работает с именами с акцентами/кириллицей

---

## Related Issues

- QA Report: `.ai/logs/QA_REPORT.md` (BUG 2: Поиск не находит существующих клиентов)
- Возможно связана с проблемой создания (BUG 1: Create не работает)

---
