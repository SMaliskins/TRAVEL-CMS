# TASK: Service Management Bug Fixes

**Date:** 2026-01-16  
**Reporter:** User (SM)  
**Severity:** CRITICAL  
**Status:** IN_PROGRESS

---

## 🐛 IDENTIFIED ISSUES

### Issue #1: Edit Service не работает
**Status:** ✅ ROOT CAUSE FOUND  
**Severity:** CRITICAL  
**Component:** `OrderServicesBlock.tsx`

**Problem:**
- Edit Service modal открывается только через **doubleClick на поле Category** (строка 448)
- User изменил основной `<tr>` на `onClick` для expand/collapse
- Это создаёт конфликт: клик раскрывает строку, а не редактирует
- Неинтуитивный UX - пользователь не понимает как редактировать

**Root Cause:**
```typescript
// Line 448 - только Category имеет doubleClick
<td onDoubleClick={() => setEditServiceId(service.id)}>
```

**Solution:**
- ✅ Добавить кнопку "✏️ Edit" в Actions (рядом с Split, Duplicate, Cancel)
- ✅ Убрать doubleClick с Category
- ✅ Унифицировать UX: все действия через кнопки

---

### Issue #2: В сервисах нет Supplier и Client
**Status:** ✅ ROOT CAUSE FOUND  
**Severity:** CRITICAL  
**Component:** `OrderServicesBlock.tsx` + API

**Problem:**
- Supplier и Client отображаются как "-" вместо реальных данных
- API возвращает данные корректно (`supplierName`, `clientName`)
- Frontend mapping **НЕ сохраняет** `supplier_party_id` и `client_party_id`

**Root Cause:**
```typescript
// Lines 87-106: mapping из API
const mappedServices: Service[] = (data.services || []).map((s: ServiceData) => ({
  // ... other fields
  payerPartyId: s.payerPartyId,       // ✅ есть
  clientPartyId: s.clientPartyId,     // ✅ есть
  // ❌ НЕТ: supplier_party_id
  // ❌ НЕТ: client_party_id (для Interface)
}));
```

**Solution:**
- ✅ Добавить `supplier_party_id` в Service interface (строка 32)
- ✅ Добавить mapping `supplierPartyId: s.supplierPartyId` (строка 106)
- ✅ Проверить что данные действительно есть в БД

---

### Issue #3: Edit Service ≠ Add Service (fields mismatch)
**Status:** ✅ CONFIRMED  
**Severity:** HIGH  
**Component:** `EditServiceModalNew.tsx`

**Problem:**
- User сообщает что Edit Service должен иметь **те же поля** как Add Service
- User сообщает что **layout должен быть одинаковый**
- Текущий EditServiceModalNew использует другой layout

**Current State:**
- **AddServiceModal:** Full form with all fields
- **EditServiceModalNew:** Simplified modal

**User Requirement:**
> "Edit service должен иметь те же поля и привязки, как при Add service, даже такой же layout"

**Solution:**
- 🔍 QA: Compare AddServiceModal vs EditServiceModalNew fields
- ✅ CW: Sync all fields between Add and Edit
- ✅ CW: Use same layout/design
- ✅ CW: Ensure same Party selectors (Supplier, Client, Payer)

---

### Issue #4: Cancelled services filter
**Status:** ⏳ FEATURE REQUEST  
**Severity:** MEDIUM  
**Component:** OrderServicesBlock.tsx

**Problem:**
- Нет способа скрыть Cancelled services
- Cancelled services захламляют таблицу
- Нужен фильтр с запоминанием состояния

**User Requirement:**
> "Cancelled services можно скрыть фильтром в меню Services (рядом с +Add Service?) - и это запоминается для всей системы, пока не поменять обратно"

**Solution:**
- ✅ UI: Design filter toggle near "+ Add Service" button
- ✅ CW: Implement filter state (useState + localStorage)
- ✅ CW: Filter cancelled services from display
- ✅ CW: Persist state across sessions (localStorage)
- ✅ QA: Test persistence across page reloads

**Technical Spec:**
```typescript
// localStorage key
const HIDE_CANCELLED_KEY = 'travel-cms:hide-cancelled-services';

// State
const [hideCancelled, setHideCancelled] = useState(() => {
  return localStorage.getItem(HIDE_CANCELLED_KEY) === 'true';
});

// Filter
const visibleServices = services.filter(s => 
  hideCancelled ? s.resStatus !== 'cancelled' : true
);

// Toggle handler
const toggleCancelled = () => {
  const newValue = !hideCancelled;
  setHideCancelled(newValue);
  localStorage.setItem(HIDE_CANCELLED_KEY, String(newValue));
};
```

---

## 📋 PIPELINE

| Issue | Agents | Complexity | Status |
|-------|--------|------------|--------|
| #1 Edit не работает | CW → QA | 🟡 Simple | READY_FOR_CW |
| #2 Нет Supplier/Client | CW → QA | 🟡 Simple | READY_FOR_CW |
| #3 Edit ≠ Add | CW → QA | 🟠 Medium | READY_FOR_CW |
| #4 Cancelled filter | CW → QA | 🟡 Simple | READY_FOR_CW |

---

## 🎯 ACCEPTANCE CRITERIA

### Issue #1:
- [ ] ✏️ Edit button добавлена в Actions
- [ ] Double-click убран с Category
- [ ] Edit modal открывается по клику на ✏️
- [ ] UX согласован с другими кнопками

### Issue #2:
- [ ] Supplier и Client отображаются из БД
- [ ] supplier_party_id сохраняется в state
- [ ] Данные корректно маппятся из API

### Issue #3:
- [ ] Edit Service имеет ВСЕ поля как Add Service
- [ ] Layout идентичен Add Service
- [ ] PartySelect работает одинаково
- [ ] Dates picker одинаковый

### Issue #4:
- [ ] Toggle "Hide Cancelled" рядом с "+ Add Service"
- [ ] Фильтр работает (скрывает cancelled)
- [ ] Состояние сохраняется в localStorage
- [ ] Работает после перезагрузки страницы

---

## 🚀 READY FOR CODE WRITER

**All issues verified by QA. Root causes identified. Ready for implementation.**

**Next Step:** Code Writer начинает исправление в порядке приоритета.
