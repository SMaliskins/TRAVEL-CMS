# CODE WRITER TASK: Complete DASH4-5 Implementation (Rework)

**Date:** 2026-01-09  
**From:** RUNNER  
**Priority:** CRITICAL  
**Status:** REWORK REQUIRED  
**QA SCORE:** 5/10 ❌

---

## 📋 DEFECT LIST (QA Verification Results)

### DEFECT #1: [CRITICAL] Syntax Error in Dashboard Page

**Expected:** Dashboard page should compile and render without errors  
**Actual:** JSX syntax error prevents compilation - mismatched quotes in h1 element  
**Trace:** `app/dashboard/page.tsx:272`

```typescript
// BROKEN (current):
<h1 className="text-3xl font-bold text-gray-900">Hello, {username || email?.split('@')[0] || 'User'"}!</h1>

// CORRECT:
<h1 className="text-3xl font-bold text-gray-900">Hello, {username || email?.split('@')[0] || 'User'}!</h1>
```

**Root Cause:** Missing closing `}` before `"` - string interpolation not closed properly

**Severity:** CRITICAL - breaks build

---

### DEFECT #2: [HIGH] Period Selector не показывает текущий выбранный период при загрузке

**Expected:** При первой загрузке Dashboard должен показывать "Showing: 1 Jan - 9 Jan" (или текущий месяц)  
**Actual:** Показывает расчётные даты на основе `value` prop, но parent не передаёт `startDate` и `endDate` props  
**Trace:** `components/dashboard/PeriodSelector.tsx:102-140`, `app/dashboard/page.tsx:56-59`

**Root Cause:** 
1. `PeriodSelector` не получает `startDate`/`endDate` props от parent
2. `getDisplayDates()` вычисляет даты локально, но они могут не совпадать с реальными датами в parent state
3. Нужно передавать `periodStart`/`periodEnd` из `DashboardPage` в `PeriodSelector`

**Solution:**
- Добавить `startDate?: string` и `endDate?: string` в `PeriodSelectorProps`
- Parent должен передавать `periodStart` и `periodEnd`
- Использовать переданные даты вместо локального вычисления

---

### DEFECT #3: [HIGH] PeriodSelector dropdown отображается под другими элементами (z-index issue)

**Expected:** Dropdown должен быть поверх всех элементов на странице  
**Actual:** Dropdown может быть перекрыт другими элементами при скролле или в определённых layout'ах  
**Trace:** `components/dashboard/PeriodSelector.tsx:183` - `z-50` недостаточно

**Root Cause:** `z-50` (z-index: 50) может быть перекрыт другими элементами с выше z-index

**Solution:** Увеличить z-index до `z-[999]` или использовать portal для dropdown

---

### DEFECT #4: [MEDIUM] Target Speedometer - tick marks labels перекрываются на малых экранах

**Expected:** Labels (0%, 50%, 100%) должны быть читаемы на всех размерах экрана  
**Actual:** На экранах < 768px labels могут перекрываться или выходить за границы SVG  
**Trace:** `components/dashboard/TargetSpeedometer.tsx:66-76`

**Root Cause:** 
- Fixed `labelRadius = radius + 20` не учитывает размер SVG viewport
- SVG `width={size}` и `height={size * 0.65}` может обрезать labels

**Solution:** 
- Увеличить SVG viewport: `width={size + 40}` и `height={size * 0.65 + 20}`
- Offset centerX на +20 для компенсации
- Или использовать `viewBox` с большими границами

---

### DEFECT #5: [MEDIUM] Custom date range picker появляется под dropdown (UX issue)

**Expected:** При выборе "Custom" должен открыться date range picker В dropdown, а не под кнопкой  
**Actual:** Date range picker появляется под кнопкой dropdown после закрытия меню, что создаёт визуальный jump  
**Trace:** `components/dashboard/PeriodSelector.tsx:217-226`

**Current flow:**
1. Клик на button → dropdown открывается
2. Клик на "Custom" → dropdown закрывается
3. Date picker появляется под button (новый элемент)

**Expected flow:**
1. Клик на button → dropdown открывается
2. Клик на "Custom" → date picker показывается ВНУТРИ dropdown (без закрытия)
3. После выбора дат → dropdown закрывается

**Solution:**
- Убрать `!isOpen` condition из line 217
- Показывать date picker внутри dropdown menu после "Custom" option
- Добавить separator и date picker в dropdown

---

## 🎯 REWORK DIRECTIVE (от Runner)

**Приоритет исправлений:**

1. **DEFECT #1** (CRITICAL) - НЕМЕДЛЕННО исправить
2. **DEFECT #2** (HIGH) - Исправить до коммита
3. **DEFECT #3** (HIGH) - Исправить до коммита
4. **DEFECT #4** (MEDIUM) - Исправить, если не требует breaking changes
5. **DEFECT #5** (MEDIUM) - Исправить для UX consistency

---

## ✅ ACCEPTANCE CRITERIA (Rework)

После исправлений:

- [ ] Dashboard page компилируется без ошибок (DEFECT #1)
- [ ] Period Selector показывает правильные даты при загрузке (DEFECT #2)
- [ ] Dropdown всегда видим поверх других элементов (DEFECT #3)
- [ ] Speedometer labels читаемы на всех экранах (DEFECT #4)
- [ ] Custom date picker интегрирован в dropdown (DEFECT #5)
- [ ] 0 linter errors
- [ ] QA SCORE >= 8/10

---

## 📝 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

1. `app/dashboard/page.tsx` - исправить syntax error (line 272)
2. `components/dashboard/PeriodSelector.tsx` - исправить все 4 дефекта
3. `components/dashboard/TargetSpeedometer.tsx` - исправить SVG viewport issue

---

**CODE WRITER:** Прочитай этот Defect List, составь план исправлений и запиши в PROJECT_LOG перед началом работы.
