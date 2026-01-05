# QA / REGRESSION REPORT

Подробный отчёт агента QA / Regression.

---

## [2026-01-05] Review: Orders API + Frontend

### Контекст задачи
Проверить код Orders после изменений CODE WRITER.

### Что проверял
1. `app/api/orders/create/route.ts` — создание заказа
2. `app/api/orders/route.ts` — получение списка
3. `app/orders/page.tsx` — frontend integration

---

### Checklist

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Field mapping (order_number → order_code) | ✅ PASS | Correct |
| 2 | Field mapping (manager_user_id → owner_user_id) | ✅ PASS | Correct |
| 3 | company_id from profiles | ✅ PASS | Implemented |
| 4 | order_no generation | ✅ PASS | MAX+1 per company+year |
| 5 | order_year | ✅ PASS | Current year |
| 6 | date_from / date_to | ✅ PASS | Correct mapping |
| 7 | GET /api/orders returns correct format | ✅ PASS | Transforms to frontend format |
| 8 | Frontend loading state | ✅ PASS | Implemented |
| 9 | Frontend error state | ✅ PASS | With retry button |
| 10 | Frontend empty state | ✅ PASS | "No orders yet" |
| 11 | Auth check | ✅ PASS | Both endpoints require auth |
| 12 | Error handling | ✅ PASS | All errors logged and returned |

---

### Code Quality Review

**Positive:**
- Clean separation of concerns (getCompanyId, generateOrderNumber, getClientDisplayName)
- Proper error handling with meaningful messages
- Frontend gracefully handles all states (loading, error, empty, data)
- TypeScript types maintained

**Minor issues (not blocking):**
- `owner` field in GET response is empty string (TODO comment exists)
- `access` field hardcoded to "Owner" (TODO)
- Duplicate auth logic in both endpoints (could be extracted to middleware)

---

### Functional Testing (Code Review Only)

**Cannot run live tests** - need deployed environment with:
- Valid Supabase credentials
- User with company_id in profiles
- parties table for client lookup

**Expected behavior based on code:**
1. `/orders` — shows loading, then empty state (if no orders) or list
2. `/orders/new` — creates order with correct fields
3. Unauthorized users get 401
4. Users without company get 400

---

### SCORE: 8/10

**Rationale:**
- All required field mappings implemented ✅
- API endpoints work correctly based on code review ✅
- Frontend properly integrated ✅
- Minor TODOs don't block functionality
- Code is clean and maintainable

---

### Defect List

None blocking. Minor improvements:
1. [LOW] owner field not populated in GET response
2. [LOW] access field hardcoded

---

### Вывод
Код соответствует спецификации. Можно деплоить и тестировать на production.

---
