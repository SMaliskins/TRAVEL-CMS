# QA / REGRESSION REPORT

---

## [2026-01-05] PartySelect Review — FAIL

### SCORE: 4/10

### Defect List

**[BUG 1] HIGH — Create не работает**
- **Expected:** При нажатии "+ Create" создаётся новый клиент
- **Actual:** Ошибка "firstName and lastName are required for person type"
- **Trace:** `components/PartySelect.tsx:141-147`
  - Отправляет: `{ display_name, name, party_type, roles }`
  - API требует: `{ firstName, lastName, type, roles }`

**[BUG 2] MEDIUM — Поиск не находит существующих клиентов**
- **Expected:** "Mališkins" находится в результатах
- **Actual:** "No results found"
- **Trace:** Возможно API не возвращает данные или проблема с фильтром role=client

### Root Cause Analysis

1. **Create:** PartySelect отправляет неправильные поля (snake_case вместо camelCase)
2. **Search:** Нужно проверить:
   - Есть ли записи в `client_party` для этого party
   - Работает ли фильтр `role=client`

### Рекомендации для CODE WRITER

**Fix 1:** В `handleCreateNew` изменить payload:
```typescript
body: JSON.stringify({
  type: "person",
  firstName: inputValue.split(" ")[0] || inputValue,
  lastName: inputValue.split(" ").slice(1).join(" ") || "",
  roles: [roleFilter],
})
```

**Fix 2:** Убрать фильтр `role=client` из поиска или проверить что клиенты есть в `client_party`

---
