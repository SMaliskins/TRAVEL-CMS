# Отчёт: жёстко заданная валюта (€ / EUR)

Чтобы при выборе валюты программы (например USD) не было сюрпризов — ниже список мест, где валюта зашита в коде.

---

## 1. Уже учитывают/будут учитывать валюту компании

| Файл | Что сделано / план |
|------|--------------------|
| `app/api/company/info/route.ts` | Возвращает `defaultCurrency` (из `companies.default_currency`, по умолчанию EUR). |
| `app/orders/.../InvoiceCreator.tsx` | Использует `companyInfo.defaultCurrency` для `formatCurrency` и подписей "Amount (€)" / символа в скобках. Нужно проверить, что везде внутри компонента используется одна и та же валюта. |
| `app/settings/company/page.tsx` | Пользователь задаёт `default_currency` (EUR, USD, GBP, …). |

---

## 2. Инвойсы — нужно перевести на валюту компании

| Файл | Где жёстко | Рекомендация |
|------|------------|--------------|
| `app/orders/.../InvoiceList.tsx` | `formatCurrency` → €; текст отмены "Payment €..."; колонка "EUR". | Брать валюту из компании (API или контекст) и использовать `formatCurrency(amount, currency)` и подпись колонки по коду валюты. |
| `lib/invoices/generateInvoiceHTML.ts` | `formatCurrency` → €. | Принимать `currencyCode` в параметрах генерации HTML (из заказа/компании) и форматировать через него. |
| `app/finances/invoices/page.tsx` | `formatCurrency` → €. | Загрузить валюту компании (или из первого инвойса) и форматировать суммы в ней. |

---

## 3. Заказы и сервисы — желательно перевести на валюту компании

| Файл | Где жёстко | Рекомендация |
|------|------------|--------------|
| `app/orders/[orderCode]/page.tsx` | Суммы "€...", "Debt: €...". | Использовать валюту компании (или заказа, если будет поле currency). |
| `app/orders/.../OrderServicesBlock.tsx` | `formatCurrency` → €; tooltip "Penalty: €...". | То же: валюту из компании/контекста. |
| `app/orders/.../OrderServicesTab.tsx` | `formatCurrency` → €. | То же. |
| `app/orders/.../OrderClientSection.tsx` | `currency="€"`. | Проброс валюты из настроек компании. |
| `app/orders/.../AddServiceModal.tsx` | Метки "Cost (€)", "Sale (€)", "Change Fee €", "Penalty EUR"; суммы "€..."; опция "€". | Либо общий контекст валюты, либо проп/контекст компании. |
| `app/orders/.../EditServiceModalNew.tsx` | Аналогично AddServiceModal. | То же. |
| `app/orders/.../CancelServiceModal.tsx` | "Original Cost: ... EUR", "Client Price: ... EUR", суффикс "EUR". | То же. |
| `app/orders/.../ChangeServiceModal.tsx` | Суффикс "EUR", "Profit: €...". | То же. |
| `app/orders/.../SplitServiceModal.tsx` | Сообщения и подписи "€...", "Client Price (€)", "Service Price (€)". | То же. |
| `app/orders/.../SplitModalMulti.tsx` | "€...", "Client: €... \| Service: €...". | То же. |
| `app/orders/.../MergeServicesModal.tsx` | "€..." для client/service price. | То же. |
| `app/orders/page.tsx` | `formatCurrency` → €. | Валюту компании для списка заказов. |

---

## 4. Дашборд и аналитика

| Файл | Где жёстко | Рекомендация |
|------|------------|--------------|
| `app/dashboard/page.tsx` | Revenue, overdue "€...". | Валюту из настроек пользователя/компании (уже есть useUserPreferences с currency). |
| `app/analytics/orders/page.tsx` | `formatCurrency` → €. | То же. |
| `components/dashboard/TargetSpeedometer.tsx` | "€... / €...". | То же. |
| `components/TabBar.tsx` | `formatCurrency` → €. | То же. |
| `hooks/useUserPreferences.ts` | Уже есть `currency` (по умолчанию EUR). | Использовать в дашборде/аналитике вместо хардкода €. |

---

## 5. Справочники и биллинг (частично фиксированная валюта)

| Файл | Где жёстко | Примечание |
|------|------------|------------|
| `components/DirectoryForm.tsx` | "€..." для сумм; комиссия "EUR" в опциях. | Commission currency — отдельное поле (уже не обязательно EUR). Суммы можно форматировать по валюте компании или по commission_currency. |
| `app/settings/billing/page.tsx` | "€{plan.monthlyPrice}". | Часто биллинг в одной валюте (Stripe). Уточнить, нужно ли подставлять валюту из настроек. |
| `app/superadmin/companies/page.tsx` | "€.../mo". | Админка подписок — может остаться в одной валюте или брать из плана. |
| `app/(public)/page.tsx`, `app/(public)/register/page.tsx` | "€{price}". | Публичные тарифы — если мультивалютность не нужна, можно оставить как есть. |
| `app/page.tsx` | "€{price}". | То же. |
| `app/superadmin/page.tsx` | "€{totalRevenue}". | Можно показывать в валюте по умолчанию или добавить настройку. |

---

## 6. API и парсеры (источник данных, не UI)

| Файл | Примечание |
|------|------------|
| `lib/flights/airlineParsers.ts` | Регэкспы и "currency": "EUR" — разбор текста авиабилетов (валюта в документе), не настройка отображения. Оставить как есть. |
| `app/api/ai/parse-package-tour/route.ts` | "currency": "EUR" в ответе парсера. При желании можно передавать default_currency компании в запрос. |
| `app/api/ai/parse-flight-itinerary/route.ts` | currency из бронирования или "EUR". Аналогично. |
| `lib/ai/tasks/*.ts` | Примеры "EUR" в промптах. Не влияют на отображение в UI. |

---

## 7. Общая рекомендация

1. **Утилита**  
   Использовать `utils/currency.ts`: `getCurrencySymbol(code)`, `formatCurrency(amount, currencyCode)`.

2. **Источник валюты в UI**  
   - Для инвойсов и заказов: `companies.default_currency` (уже в `/api/company/info` как `defaultCurrency`).  
   - Для дашборда/аналитики: при необходимости — `useUserPreferences().currency` или тот же `default_currency`.

3. **Приоритет правок**  
   - Сначала: инвойсы (InvoiceList, generateInvoiceHTML, finances/invoices) и главная страница заказа (суммы, долг).  
   - Затем: модалки сервисов и список заказов.  
   - Дашборд/аналитика — по желанию, с опорой на уже существующий `currency` в useUserPreferences.

После этого при установке валюты программы (например USD) в настройках компании не будет сюрпризов в виде отображения сумм в Euro в этих местах.
