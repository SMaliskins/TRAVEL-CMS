# TASK: Order Detail Page Redesign (OD-REDESIGN)

**Created:** 2026-01-09
**Status:** SPECIFICATION
**Priority:** P1 - Critical
**URL:** http://localhost:3000/orders/{orderCode}

---

## 📋 ОБЗОР

Редизайн страницы заказа для улучшения UX и добавления функционала выписки счетов.

---

## 🎯 ЗАДАЧИ

### OD1: Увеличить размер шрифтов
**Файлы:** `app/orders/[orderCode]/page.tsx`, `OrderClientSection.tsx`, `OrderServicesBlock.tsx`
**Изменения:**
- Заголовок Order: `text-2xl` → `text-3xl`
- Client name: `text-base` → `text-lg`
- Route cities: `text-sm` → `text-base`
- Dates: `text-[12px]` → `text-sm`
- Services table headers: `text-xs` → `text-sm`
- Services table cells: `text-xs` → `text-sm`

---

### OD2: Карта на всю ширину внизу
**Файл:** `OrderClientSection.tsx`
**Текущее:** Карта справа в grid `lg:grid-cols-[1fr_280px]`, размер 280x280px
**Требуется:** 
- Убрать карту из grid справа
- Добавить карту в отдельный блок под client info
- Ширина: 100% (full width)
- Высота: 300px
- Убрать `aspect-square`, сделать `h-[300px] w-full`

---

### OD3: Дни и ночи в скобках после дат
**Файл:** `OrderClientSection.tsx`
**Текущее:** `01.02.2026 — 15.02.2026`
**Требуется:** `01.02.2026 — 15.02.2026 (14 дней / 13 ночей)`
**Логика:**
```typescript
const days = Math.ceil((dateTo - dateFrom) / (1000 * 60 * 60 * 24)) + 1;
const nights = days - 1;
// Display: `(${days} ${days === 1 ? 'день' : 'дней'} / ${nights} ${nights === 1 ? 'ночь' : 'ночей'})`
```

---

### OD4: EditServiceModal = AddServiceModal (все поля)
**Файл:** `OrderServicesBlock.tsx` (EditServiceModal component)
**Проблема:** EditServiceModal показывает только 7 полей, AddServiceModal — 25+ полей
**Требуется добавить в EditServiceModal:**

1. **DateRangePicker** для дат (dateFrom, dateTo)
2. **Supplier** (PartySelect с roleFilter="supplier")
3. **Client(s)** (PartySelect с roleFilter="client", multiple)
4. **Payer** (PartySelect с roleFilter="client")
5. **Hotel fields** (если category === "Hotel"):
   - hotelName, hotelAddress, hotelPhone, hotelEmail
6. **Transfer fields** (если category === "Transfer"):
   - pickupLocation, dropoffLocation, pickupTime, estimatedDuration, linkedFlightId
7. **Flight fields** (если category === "Flight"):
   - FlightItineraryInput component, flightSegments

**Подход:** 
- Переиспользовать логику из AddServiceModal
- Загружать текущие значения из API при открытии
- API endpoint: `GET /api/orders/{orderCode}/services/{serviceId}`

---

### OD5: Чекбоксы для выбора сервисов
**Файл:** `OrderServicesBlock.tsx`
**Требуется:**
1. Добавить колонку с чекбоксом слева в таблице сервисов
2. Чекбокс в header для "Select All"
3. State: `selectedServiceIds: string[]`
4. При выборе сервисов показывать floating action bar:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ ☑️ 3 сервиса выбрано  │  💰 €1,234  │  [Выписать счёт]  │
   └─────────────────────────────────────────────────────┘
   ```

---

### OD6: Кнопка "Выписать счёт" → Invoice Modal
**Файл:** Новый компонент `CreateInvoiceModal.tsx`
**Функционал:**
1. Показать выбранные сервисы с ценами
2. Автоматически рассчитать итоговую сумму
3. Поля:
   - Invoice Number (auto-generate: INV-0001-26-SM)
   - Due Date (default: +14 days)
   - Payer (auto-fill from services or order client)
   - Notes (optional)
4. Кнопки: [Скачать PDF] [Отправить по Email] [Сохранить]

**Для MVP:** Только UI, без реальной отправки email (Phase 2)

---

## 📁 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

1. `app/orders/[orderCode]/page.tsx` - шрифты
2. `app/orders/[orderCode]/_components/OrderClientSection.tsx` - карта, даты, шрифты
3. `app/orders/[orderCode]/_components/OrderServicesBlock.tsx` - чекбоксы, EditServiceModal, шрифты
4. `app/orders/[orderCode]/_components/CreateInvoiceModal.tsx` - NEW

---

## ✅ КРИТЕРИИ ПРИЁМКИ

- [ ] Шрифты увеличены, читаемость улучшена
- [ ] Карта отображается на всю ширину внизу секции клиента
- [ ] После дат показывается (X дней / Y ночей)
- [ ] EditServiceModal показывает все поля как AddServiceModal
- [ ] Можно выбрать сервисы чекбоксами
- [ ] Floating bar показывает количество и сумму выбранных
- [ ] Кнопка "Выписать счёт" открывает модальное окно
- [ ] Invoice modal показывает выбранные сервисы и итог

---

## 🔄 PIPELINE

```
Runner (this spec) → Code Writer → QA
```

**Estimated time:** 4-6 часов

---

## 📝 NOTES

- Телефон и email клиента уже реализованы (O9 DONE)
- Itinerary builder (OD7) — отдельная задача на Phase 2
- Email tracking (OD8) — требует DB schema, Phase 3
