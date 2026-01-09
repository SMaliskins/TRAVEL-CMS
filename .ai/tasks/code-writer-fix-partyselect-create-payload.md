# Task: Fix PartySelect Create Payload - Wrong Field Names

**Agent:** CODE WRITER
**Priority:** HIGH
**Status:** TODO
**Created:** 2026-01-05

---

## Problem

QA Report выявил критическую ошибку: PartySelect отправляет неправильные поля при создании нового клиента.

**QA Report:** `.ai/logs/QA_REPORT.md` (PartySelect Review — FAIL, SCORE: 4/10)

**BUG 1 (HIGH):** Create не работает
- **Expected:** При нажатии "+ Create" создаётся новый клиент
- **Actual:** Ошибка "firstName and lastName are required for person type"
- **Trace:** `components/PartySelect.tsx:141-147`

---

## Root Cause

PartySelect отправляет правильные поля (`firstName`, `lastName`), но API может требовать дополнительные поля или валидация не проходит.

**Current code (lines 146-152):**
```typescript
body: JSON.stringify({
  type: "person",
  firstName,
  lastName,
  roles: [roleFilter],
  isActive: true,
}),
```

**API expects:** Согласно Directory API, поля должны быть:
- `type` (OK)
- `firstName` (OK)
- `lastName` (OK)
- `roles` (OK)
- `isActive` (OK)

Но возможно API требует оба поля `firstName` и `lastName` не пустыми, а при создании из одного слова `lastName` может быть пустым или равным `firstName`.

---

## Solution

1. **Проверить валидацию в API:**
   - Убедиться, что API принимает `lastName` как опциональное или пустое
   - Или изменить логику парсинга имени в PartySelect

2. **Улучшить парсинг имени:**
   - Если только одно слово, использовать его как `firstName`, `lastName` оставить пустым или использовать дефолтное значение
   - Или требовать минимум два слова для создания

3. **Добавить обработку ошибок:**
   - Показывать понятное сообщение пользователю
   - Логировать детали ошибки

---

## Implementation Details

### Вариант 1: Исправить парсинг имени (рекомендуется)

```typescript
// В handleCreateNew (строка 135-137)
const nameParts = inputValue.trim().split(/\s+/);
const firstName = nameParts[0] || inputValue.trim();
// Если только одно слово, использовать его как firstName, lastName оставить пустым
const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
```

**Проблема:** API может требовать `lastName` не пустым.

### Вариант 2: Использовать дефолтное значение для lastName

```typescript
const nameParts = inputValue.trim().split(/\s+/);
const firstName = nameParts[0] || inputValue.trim();
// Если только одно слово, использовать его как lastName тоже
const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;
```

**Проблема:** Может создать дубликаты в базе.

### Вариант 3: Проверить API валидацию и исправить там

Если API требует оба поля, нужно либо:
- Сделать `lastName` опциональным в API
- Или изменить логику в PartySelect чтобы требовать минимум два слова

**Рекомендация:** Проверить API валидацию в `app/api/directory/create/route.ts` и убедиться, что `lastName` может быть пустым для person type.

---

## Files to Modify

- `components/PartySelect.tsx` (строки 135-152, функция `handleCreateNew`)

---

## Testing

1. Ввести одно слово (например, "John") и нажать "+ Create"
2. Проверить, что клиент создается без ошибки
3. Ввести два слова (например, "John Doe") и нажать "+ Create"
4. Проверить, что клиент создается правильно
5. Проверить, что созданный клиент появляется в списке поиска

---

## Acceptance Criteria

- [ ] Можно создать клиента из одного слова без ошибки
- [ ] Можно создать клиента из нескольких слов
- [ ] Созданный клиент появляется в результатах поиска
- [ ] Ошибки обрабатываются и показываются пользователю

---

## Related Issues

- QA Report: `.ai/logs/QA_REPORT.md` (BUG 1: Create не работает)
- Возможно связана с проблемой поиска (BUG 2: Поиск не находит существующих клиентов)

---
