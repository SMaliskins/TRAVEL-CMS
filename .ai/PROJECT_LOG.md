# PROJECT LOG — travel-cms

> Активный лог разработки. Записи за последнюю неделю.
> 📁 Архив: `.ai/PROJECT_LOG_ARCHIVE_2026-01.md` (записи до 2026-01-19)

---

## [2026-03-16 11:20] CODE WRITER — O7-IMPL: Deposit receipt document

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Analyze current payments flow and invoice PDF style
- Implement printable deposit receipt document from payment record

**Результат:** In progress

**Next Step:** Implement API route + UI print action

---

## [2026-03-16 11:30] CODE WRITER — O7-IMPL: Deposit receipt document

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Added new receipt generator `lib/invoices/generateDepositReceiptHTML.ts` with invoice-like layout and payment metadata
- Added API route `GET /api/finances/payments/[id]/receipt` with auth + tenant check, PDF generation and HTML fallback
- Added "Print deposit receipt" action button in both `app/finances/payments/page.tsx` and `app/orders/[orderCode]/_components/OrderPaymentsList.tsx`

**Результат:** Deposit receipt document can be downloaded/printed directly from payment rows.

**Next Step:** Build verification and QA handoff

---

## [2026-03-16 11:31] CODE WRITER — O7-IMPL: Deposit receipt document

**Task:** O7-IMPL | **Status:** SUCCESS (TEST)
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Ran production build: `npm run build` (passed)
- Checked lints for modified files (no diagnostics)

**Результат:** SCORE: 9/10
**Defect List:**
- None found in build/lint verification scope

**Next Step:** QA validation in UI flow (create deposit -> print receipt)

---

### 📅 [2026-03-05] | Fix invoice number gaps — cross-order released pool reuse
**Agent:** Code Writer
**Task:** Fix sequential invoice numbering gaps
**Complexity:** 🟡

**Actions:**
- Fixed released pool query in `/api/orders/[orderCode]/invoices/route.ts`: removed order-prefix filter (`like prefix-%`), replaced with year-only filter (`___YY-%`) so released numbers can be reused across different orders
- When reusing released numbers, extract sequence and rebuild invoice_number with current order prefix + user initials + old sequence — prevents permanent gaps when user abandons invoice on one order and creates on another
- Added race condition protection: UPDATE on released pool now checks `status = 'released'` and verifies rows affected via `.select("id")` to prevent concurrent claims of same number
- Added ref guards (`singleNumberFetchedRef`, `bulkNumbersFetchedRef`) in `InvoiceCreator.tsx` to prevent duplicate API calls from useEffect re-fires when reactive dependencies change

**Result:** Invoice numbers should now be strictly sequential with no gaps from cross-order reservation abandonment

**Next Step:** QA verification

---

### 📅 [2026-03-04] | Invoice Finance workflow — Processed / Amended
**Agent:** Code Writer
**Task:** Invoice processing workflow between Finance and users
**Status:** SUCCESS

**Actions:**
- Migration `add_invoice_amended_workflow.sql`: `processed_total` column, `amended` status added to constraint, ensure `processed_by`/`processed_at` exist
- API `process/route.ts`: saves `processed_total` = current total when marking as processed
- API `items/[itemId]/route.ts`: `recalcInvoiceTotals()` auto-sets status to `amended` if total changes on a `processed` invoice (descriptions-only changes keep `processed`)
- API `invoices/[invoiceId]/route.ts`: locks `invoice_date` for `processed`/`amended` invoices; `amended` added to valid statuses
- Finances invoices page: `amended` filter, badge (amber), "Change" column showing old→new amount diff, re-process button
- Order InvoiceList: `amended` status in badges/labels/colors, locked invoice_date field, purple info banner for processed invoices

**Result:** Finance marks invoices as processed; if amount changes, auto-flags as "amended" with diff visible to Finance. Descriptions-only edits don't disturb Finance.

**Next Step:** Run migration `add_invoice_amended_workflow.sql` in Supabase.

---

### 📅 [2026-03-04] | Cash Flow Z-Report calendar
**Agent:** Code Writer
**Task:** Z-Report calendar for selected period (max 3 months), daily cash figures and green button
**Status:** SUCCESS

**Actions:**
- Z-Report (Cash) tab: calendar by month (Mon–Sun grid), max 3 months; each day: if total > 0 show amount + green button (scroll to day detail), else empty
- Period for Z-Report capped to 93 days in API request and calendar range
- "Daily details" section with id per day for scroll target; Bank Movements tab unchanged (list view)

**Result:** Calendar shows daily cash; green button scrolls to day details. Language: EN (labels).

**Next Step:** —

---

### 📅 [2026-03-01] | Air Baltic invoice parser
**Agent:** Code Writer
**Task:** Parse Air Baltic airline tickets from Latvian invoice PDFs
**Status:** SUCCESS

**Actions:**
- Added `isAirBalticInvoiceFormat()` — detect Latvian labels (Rezervācijas numurs, Biļetes numurs, etc.)
- Added `parseAirBalticInvoiceSegments()` — parse `S 09/05 15:30 Rīga 19:15 Antālija BT715 Economy FLEX` format
- Added `parseAirBalticInvoicePassengers()` — parse `K-dze LARISA GURARIJA 657-2423595985` format
- Extended `getIATAFromCity()` with `normalizeCityForLookup()` and Latvian city variants (rīga, antālija)
- Invoice branch in `parseAirBaltic()` returns `ParseResult` with segments, passengers, bookingRef, totalPrice
- Test script `scripts/test-airbaltic-invoice.mjs` — PASS with reference PDF text

**Result:** Air Baltic invoice text (pasted or from PDF) parses correctly; 2 segments RIX↔AYT, 2 passengers, booking 9YOOTU, total EUR 681.96.

**Next Step:** Manual QA in Add Service modal (paste invoice text into flight parser).

---

### 📅 [2026-02-19] | Invoice number reservation (Create Invoice)
**Агент:** Code Writer
**Задача:** Reserve invoice number on Create Invoice; release on abandon; cancelled ≠ pool
**Статус:** SUCCESS

**Действия:**
- Migration: `invoice_reservations` (company_id, order_id, invoice_number, status: reserved | used | released)
- GET nextNumber: reserve for order — return existing reserved for this order; else from released pool (same company/year) or RPC reserve_invoice_sequences; minSeq from issued + reserved only (cancelled excluded)
- POST create invoice: mark reservation as used after successful insert
- POST /api/orders/[orderCode]/invoices/release-reservation: set status=released for this order (return to pool)
- InvoiceCreator: release on unmount; bulk reserves N numbers when payer groups set

**Результат:** Номер резервируется при открытии Create Invoice и не меняется при переходах по вкладкам; при закрытии без сохранения — возврат в пул; аннулированные номера только для повторного использования в том же заказе, не в общий пул.

**Next Step:** Выполнить миграцию `migrations/add_invoice_reservations.sql` в Supabase.

---

### 📅 [2026-02-19] | [~16:00]
**Агент:** `Code Writer`
**Задача:** `Passport parsing + Person clients languages`
**Статус:** `SUCCESS`

**Действия:**
- Passport parse-passport API: formatDate — парсинг DD.MM.YYYY/DD/MM/YYYY (европейский формат), избежание swap месяц/день
- Passport API: gender — маппинг Mrs/Mr/Ms → female/male
- Passport AI prompt: явная инструкция по диакритике (Latvian ā, č, ē, ž и т.д.); формат дат YYYY-MM-DD, никогда не путать месяц и день
- DirectoryForm: onChange PassportDetailsInput — gender Mrs/Mr/Ms
- DirectoryForm: person clients — языки коммуникации и счета (correspondenceLanguages, invoiceLanguage); автоопределение языка из страны паспорта

**Результат:** Дата срока действия парсится корректно; пол Mrs/Mr сохраняется; диакритика — усилен prompt; персоны имеют языки; автоопределение языка по стране паспорта; mobile — добавление клиентов.

**Next Step:** QA, run migrations (person correspondence/invoice languages)

---

### 📅 [2026-02-19] | [14:15]
**Агент:** `Code Writer`
**Задача:** `Finance Payments Module`
**Статус:** `SUCCESS`
**Complexity:** 🟠

**Действия:**
- SQL migration: `company_bank_accounts` table + extend `payments` with `account_id`, `payer_name`, `payer_party_id`
- API: CRUD for company bank accounts (`/api/company/bank-accounts`)
- API: Payments CRUD (`/api/finances/payments`) with order sync (amount_paid/amount_debt)
- API: Cash flow / Z-report (`/api/finances/cashflow`) with daily grouping
- Finances layout with sub-navigation tabs (Invoices, Payments, Cash Flow, IATA, Reconciliation)
- Sidebar updated with Finances children menu items
- Payments page with table, filters (method, date range), and Add Payment modal
- Cash Flow page with Z-Report (cash) and Bank Movements tabs, daily grouping, grand totals
- IATA and Reconciliation placeholder pages
- Add Payment modal: order search, invoice selection, method toggle, bank account dropdown, payer input

**Файлы созданы:**
- `migrations/add_finance_payments.sql`
- `app/finances/layout.tsx`
- `app/api/company/bank-accounts/route.ts`, `[id]/route.ts`
- `app/api/finances/payments/route.ts`, `[id]/route.ts`
- `app/api/finances/cashflow/route.ts`
- `app/finances/payments/page.tsx`, `_components/AddPaymentModal.tsx`
- `app/finances/cashflow/page.tsx`
- `app/finances/iata/page.tsx`
- `app/finances/reconciliation/page.tsx`

**Файлы изменены:**
- `components/Sidebar.tsx` — Finances с children подменю
- `app/finances/invoices/page.tsx` — убран префикс "Finances -" из заголовка

**Результат:** Build проходит (pre-existing error в parse-flight-itinerary не связан с изменениями)

**Next Step:** QA, run migration в Supabase

---

### 📅 [2026-02-14] | [12:57]
**Агент:** `Code Writer`
**Задача:** `Fix Vercel + local build errors`
**Статус:** `SUCCESS`
**Действия:**
- InvoiceList: styles/labels для статусов processed, replaced, issued, issued_sent; payer_email в Invoice
- ItineraryTimeline + OrderServicesBlock: FlightSegment as unknown as Record
- OrderServicesBlock: API mapping с поддержкой snake_case; parentServiceId, amendment fields; EditServiceModalNew type cast; resStatus narrowed type fix
- InvoiceList.tsx: Invoice status badges extended
- Settings company: default_vat_rate в Company interface
- DirectoryForm: phone/email null → undefined
- ClientsByCitizenshipPie: formatter value?: number
- airlineParsers: cabinClass fallback "economy"
- extractPassportPhoto: type cast + channels
- parseMrz: ParseResult as unknown as Record
- npm install @sparticuz/chromium puppeteer-core

**Результат:** Build проходит успешно (feature/x). Vercel и локальная сборка должны работать.

**Next Step:** —

---

## [2026-01-30] Itinerary: цвета перелётов и отелей по карте маршрутов ✅

**Task:** Подсветка перелётов цветом маршрута клиента с карты; отели — цветами из не занятых маршрутами | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟢 Micro

**Действия:**
- ItineraryTimeline: пропсы `travellerIdToColor`, `routeColorsUsed`; `getHotelColors(routeColorsUsed)` для check-in/check-out; левая полоска перелёта — цвет по `ticketNumbers[0].clientId` или `assignedTravellerIds[0]`; отели — `borderLeftColor` из кандидатов, не занятых маршрутами.
- OrderServicesBlock уже передаёт `travellerIdToColor` и `routeColorsUsed` из `travellerRoutes`.
- В событие перелёта добавлено `assignedTravellerIds` для fallback цвета до появления билетов.

**Результат:** Перелёты в списке слева совпадают по цвету с маршрутами на карте; отели — двумя отдельными цветами.

**Next Step:** —

---

## [2026-01-30] Batch: Toast, модалки, языки счетов, миграции, directory, Ratehawk, reset-password ✅

**Task:** Консолидация фич (toast, modals, invoice language/PDF, migrations, directory, Ratehawk, reset-password) | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- **Toast:** ToastContext + ToastProvider + Toast component; подключение в layout, замена alert на toast где уместно
- **Модалки:** ConfirmModal, ContentModal, DirectoryMergeModal, MergeSelectedIntoModal, UrlModalProvider — единый стиль и использование по приложению
- **Счета (invoices):** язык счёта (миграция add_invoice_language_support), генерация PDF/HTML с учётом языка; статусы issued/issued_sent/processed; резервирование номера (add_invoice_sequence_reservation)
- **Миграции:** add_invoice_language_support, add_invoice_sequence_reservation, add_invoice_statuses_issued, add_company_directory_stats, add_hotel_contact_overrides, add_flight_booking_conditions, add_gender_to_party_person, add_hotel_repeat_guests, add_is_alien_passport_to_party_person, add_order_communications, add_split_columns_order_services, add_supplier_logo_url, add_updated_by_to_party, allow_hotel_board_free_text, fix_hotel_board_constraint и др.
- **Directory:** статистика компании (companyDirectoryStats), bulk-archive API, Merge/Archive/Import в Actions меню; семантический поиск (варианты + батч)
- **Final Payment:** пресеты дат (shortcutPresets), узкие поля, подсказки, %/€ в скобках (double-click)
- **Ratehawk:** API suggest + hotel-content, HotelSuggestInput, hotel contact overrides
- **Auth:** forgot-password / reset-password страницы, API dev/reset-password, SUPABASE_RESET_PASSWORD_SETUP.md
- **Прочее:** русские комментарии → английские; утилиты currency, phone, transliterateCyrillic; AvatarUpload, BackLink, PageHeader, FormattedPhoneDisplay, ClientMultiSelectDropdown, ClientSuggestedButton; ClientsByCitizenshipPie

**Результат:** Коммит b414d26 — 121 файл, +8338/−1822 строк.

**Next Step:** —

---

## [2026-01-30] QA — Bulk Invoice: индивидуальные условия, номера, даты ✅

**Task:** Bulk Invoice improvements (payment terms per payer, invoice sequence, SingleDatePicker) | **Status:** SUCCESS
**Agent:** QA | **Complexity:** 🟡 Medium

**Проверено:**
- Индивидуальные условия оплаты по плательщику при массовой выписке (paymentTermsByPayerIndex, handleSwitchPayer, termsOverride в API)
- Уникальные последовательные номера счетов: миграция invoice_sequence + reserve_invoice_sequences, API nextNumber&count, генерация номера перед каждым созданием в bulk
- SingleDatePicker для Deposit/Final Payment с shortcutPresets и relativeToDate
- Превью Payment Terms для текущего плательщика (previewTotalForPayer, previewTerms)

**Результат:** Пользователь подтвердил: «работает». SCORE: 9/10.

**Next Step:** —

---

## [2026-01-30] Invoices: аннулирование с переносом оплаты на депозит ✅

**Task:** invoices-system-improvement-plan §15 (Аннулирование) | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- API PATCH: уменьшение orders.amount_paid только если счёт был paid (wasPaid); возврат paymentMovedToDeposit в ответе
- UI: подтверждение при отмене — для paid счёта текст с суммой «Payment €X will be moved to order deposit»; после успеха — сообщение с фактической суммой переноса или «Services unlocked»
- InvoiceList: тип status расширен (issued, issued_sent, processed); метки и цвета для новых статусов

**Файлы:** `app/api/orders/[orderCode]/invoices/[invoiceId]/route.ts`, `app/orders/[orderCode]/_components/InvoiceList.tsx`, `.ai/tasks/invoices-system-improvement-plan.md`

---

## [2026-01-30] Invoices: Client — все клиенты сервиса ✅

**Task:** invoices-system-improvement-plan §5 | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟢 Micro

**Действия:**
- При создании счёта (Issue Invoice) для каждого выбранного сервиса client формируется из assignedTravellerIds: имена всех travellers заказа (orderTravellers) по ID, через запятую
- OrderServicesBlock: selectedServicesData.client = список имён из orderTravellers по s.assignedTravellerIds; fallback на s.client если нет travellers
- invoice_items.service_client по-прежнему одна строка (список имён через запятую); PDF/HTML без изменений

**Файлы:** `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`, `.ai/tasks/invoices-system-improvement-plan.md`

---

## [2026-01-30] Directory: архив, поиск, Merge, Actions меню ✅

**Task:** Directory UX + semantic search + merge fix | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- Карточка контакта: бейдж «Archived» и кнопка «Restore from archive» при `isActive === false`; после архивирования остаёмся на карточке (без редиректа)
- Список директории: в рабочем списке не показывать архивированных/merged — в fallback и semantic-extra запросах применён тот же фильтр по status (active / inactive, archived)
- Поиск: раскладка QWERTY↔JCUKEN (кириллица/латиница по клавишам), варианты опечаток по соседним клавишам (getKeyboardTypoVariants), диакритика для ILIKE (prīcīte); семантика: 2–3 варианта запроса (getSemanticQueryVariants), батч generateEmbeddings, объединение party_id, порог 0.25 для коротких запросов
- Directory: кнопки Merge, Archive, Import contacts объединены в одну «Actions» с выпадающим меню
- Merge API: при архивации источника ставим `status: "inactive"` (enum party_status не содержит `archived`) — исправлена ошибка «Failed to archive source contact»

**Файлы:** `app/directory/page.tsx`, `app/directory/[id]/page.tsx`, `app/api/directory/route.ts`, `app/api/directory/merge/route.ts`, `lib/directory/searchNormalize.ts`, `lib/embeddings.ts`, `app/api/search/semantic/party/route.ts`, `app/api/search/semantic/order-service/route.ts`

---

## [2026-01-30] Add Service — Package Tour: одна форма с первого кадра, парсинг, красная обводка ✅

**Task:** Add Service Package Tour UX | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- При выборе категории из «What service?» передаются initialCategoryId, initialCategoryType, initialCategoryName, initialVatRate; при categoryLocked loadCategories не вызывается — форма не перерисовывается вторым рендером
- OrderServicesBlock: категории с type и vat_rate, открытие Add Service через setTimeout(0) после выбора; AddServiceModal получает initialVatRate и задаёт vatRate из пропа при categoryLocked
- Парсинг дат: зелёная обводка только у поля дат (DateRangePicker triggerClassName), у Supplier — только у строки выбора поставщика; Supplier в parsedFields только при непустом operatorName
- Красная обводка везде, где парсер пытался заполнить поле, но значение пусто: serviceName, dates, hotel/room/meal, transfer, additionalServices, supplier, pricing, refNr, payment terms, flightSegments

**Результат:** Add Service — Package Tour открывается сразу правильной формой (без «первая → вторая»); даты и Supplier подсвечиваются точечно; не спарсенные поля — красной обводкой.

**Файлы:** `app/orders/[orderCode]/_components/AddServiceModal.tsx`, `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`, `components/DateRangePicker.tsx`

---

## [2026-01-30] Add Service — клиенты в Travellers ✅

**Task:** Travellers при создании сервиса | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟢 Micro

**Действия:**
- API POST /api/orders/[orderCode]/services: если `travellerIds` пустой, но передан `clientPartyId`, использовать основного клиента как единственного traveller (effectiveTravellerIds); в ответе возвращать effectiveTravellerIds
- AddServiceModal: при формировании payload, если в `clients` нет id, но есть primaryClient.id — добавить его в travellerIds

**Результат:** При создании сервиса клиент (из заказа или выбранный в форме) всегда попадает в колонку Travellers.

**Файлы:** `app/api/orders/[orderCode]/services/route.ts`, `app/orders/[orderCode]/_components/AddServiceModal.tsx`

---

## [2026-01-30] Audit: created_by/updated_by — auth fallback, "by —" when unknown ✅

**Task:** Audit display | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟢 Micro

**Действия:**
- API GET /api/directory/[id]: fallback для created_by/updated_by — если имени нет в user_profiles/profiles, резолв из auth (user_metadata или email) через supabaseAdmin.auth.admin.getUserById
- DirectoryForm: всегда показывать строку «by …» под датой (created/updated); при отсутствии имени — «by —»

**Результат:** Пользователь, создавший/обновивший контакт, отображается по имени или email; при неизвестном — явно «by —».

**Файлы:** `app/api/directory/[id]/route.ts`, `components/DirectoryForm.tsx`

---

## [2026-01-30] Add Service — Package Tour layout = Edit Service ✅

**Task:** PKG-TOUR-ADD-LAYOUT | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- Add Service для Package Tour: layout как в Edit Service
- Booking Terms перенесён внутрь Column 3 (Pricing → References → Booking Terms)
- Refund Policy скрыт для Tour (только Price Type)
- Cancellation/Refund details скрыты для Tour
- 2x2 grid: Deposit Due + Deposit %, Final Due + Final %
- Стиль: bg-gray-50, border-gray-300 (как Edit Service)

**Результат:** Add Service и Edit Service — одинаковый layout для Package Tour.

**Файл:** `app/orders/[orderCode]/_components/AddServiceModal.tsx`

---

## [2026-01-30] CODE WRITER — Avatar modal Edit/Delete UX ✅

**Task:** DIR-AVATAR-MODAL | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟢 Micro

**Действия:**
- Модальное окно аватара: кнопки Change photo и Delete в панели под фото
- Подтверждение удаления (Delete this photo? Cancel/Delete)
- Убран дублирующий hover-оверлей с кнопками
- Закрытие по Escape, клику по фону; блокировка скролла

**Результат:** Выполнено и принято. Одна панель действий, без дублирования.

**Файл:** `components/AvatarUpload.tsx`

---

## [2026-01-27] CODE WRITER — Package Tour logic in AddServiceModal ✅

**Task:** PKG-TOUR-ADD | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- Перенесена логика Package Tour из EditServiceModalNew в AddServiceModal
- Layout: Hotel, Stars, Room, Meal, Transfer, Additional — при выборе категории Package Tour
- Зелёная подсветка (parsedFields) полей после парсинга Coral Travel
- applyParsedTourData заполняет hotelName, starRating, roomType, mealPlan, transferType, additionalServices
- Payload при создании tour: hotelName, hotelStarRating, hotelRoom, hotelBoard, mealPlanText, transferType, additionalServices
- Зелёная подсветка для Deposit Due, Final Due, Payment Terms, Ref Nr

**Результат:** Add и Edit — одинаковая форма для Package Tour (правило 6.10)

**Файл:** `app/orders/[orderCode]/_components/AddServiceModal.tsx`

---

## [2026-01-26 18:00] CODE WRITER — Boarding Pass + Services Enhancements ✅

**Task:** BP-UX-FIXES + SVC-ENHANCEMENTS | **Status:** IN PROGRESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

### Изменения с момента последнего лога (2026-01-19):

---

### **1. Boarding Pass (BP) System** 🎫

**Создано:**
- `components/BoardingPassUpload.tsx` — полный компонент загрузки BP
- `app/api/services/[serviceId]/boarding-passes/route.ts` — API для BP
- `migrations/add_boarding_passes.sql` — миграция таблицы

**Функционал BP:**
- Загрузка PDF, PNG, JPG, GIF, Apple Wallet (.pkpass)
- Drag & drop
- Preview в модальном окне (PDF — iframe, изображения — img)
- Download
- Delete
- Share: WhatsApp / Email (через Web Share API или fallback)
- Dropdown меню с файлами при клике на "BP ✓"
- Кнопка "+" для добавления нового файла (без чекбоксов)
- Привязка к client + flightNumber

**UX Итерации:**
1. v1: Простые кнопки View/Download/Delete
2. v2: Добавлены чекбоксы для мульти-выбора при отправке
3. v3: **Убраны чекбоксы** — упрощенный UI без лишних элементов
4. v4: Убраны иконки emoji из кнопок (WhatsApp/Email)

---

### **2. Travellers System** 👥

**Коммит:** `a7276be` — feat(travellers): implement travellers system with real API data

**Реализовано:**
- Полная интеграция travellers с реальным API
- Привязка travellers к сервисам
- UI для назначения travellers на сервисы

---

### **3. TopBar & Sidebar Improvements** 🎨

**Коммиты:**
- `277af51` — fix(sidebar): position below TopBar, remove duplicate header
- `cdf5896` — style(topbar): increase height to h-16 and logo size
- `026b11f` — feat(topbar): move company logo to TopBar left side
- `056a02f` — fix(sidebar): add auth token to company logo fetch
- `15a494d` — feat(sidebar): display company logo in top-left corner

**Результат:**
- Логотип компании в TopBar слева
- Sidebar под TopBar (без перекрытия)
- Увеличена высота TopBar (h-16)

---

### **4. Company Settings** ⚙️

**Коммиты:**
- `4b000ad` — feat(company): add country autocomplete with dropdown
- `d7e0cea` — fix(api): case-insensitive Supervisor check in company API
- `5e686ee` — refactor(company): redesign Company Settings page
- `f8524d2` — refactor: move Settings to TopBar dropdown menu
- `6c5323c` — feat(settings): add Company Settings page

**Результат:**
- Страница Company Settings (только для Supervisor)
- Автокомплит выбора страны
- Settings доступны из TopBar dropdown

---

### **5. Services/Order Enhancements** 📝

**Незакоммиченные изменения:**
- `OrderServicesBlock.tsx` — +1573/-значительные изменения (BP интеграция, flight columns)
- `EditServiceModalNew.tsx` — +1328 lines (расширенные поля, flight data)
- `AddServiceModal.tsx` — интеграция flight itinerary
- `AssignedTravellersModal.tsx` — +582 lines рефакторинг
- `SplitModalMulti.tsx` — +815 lines улучшения

**Новые миграции (не применены):**
- `add_boarding_passes.sql`
- `add_all_flight_columns.sql`
- `add_flight_segments.sql`
- `add_notification_log.sql`
- `add_payment_deadlines.sql`
- `add_service_terms_fields.sql`
- `add_ticket_numbers_array.sql`
- `add_vat_rate.sql`
- `add_draft_status.sql`

---

### **6. Flight Itinerary Parsing** ✈️

**Новые файлы:**
- `lib/flights/airlineParsers.ts` — парсеры для разных авиакомпаний
- `lib/itinerary/` — логика маршрутов
- `components/FlightItineraryInput.tsx` — обновлённый ввод

---

### **7. Notifications System** 🔔

**Новые файлы:**
- `app/api/notifications/` — API endpoints
- `lib/notifications/` — notification logic
- `hooks/useCheckinNotifications.ts`
- `components/CheckinCountdown.tsx`

---

### **Статистика изменений:**
- **33 файлов изменено**
- **+6609 / -2041 строк**
- **~20 коммитов** с 2026-01-19

---

## [2026-01-19 16:30] CODE WRITER — Itinerary System Overhaul ✅

**Task:** Itinerary System Overhaul | **Status:** COMPLETED ✅
**Agent:** Code Writer | **Complexity:** 🟠 High

**Реализовано:**

1. **Переименование Route & Dates → Itinerary**
   - Обновлены все labels, комментарии, переменные в page.tsx и OrderClientSection.tsx
   - parsedRoute → parsedItinerary, saveRoute → saveItinerary

2. **Новый Layout с картой**
   - Grid layout: сервисы (2/3) + карта (1/3)
   - TripMap справа в sticky позиции
   - Карта получает itineraryDestinations из parsedItinerary

3. **Табы клиентов по Itinerary**
   - Компонент ItineraryTabs.tsx
   - Фильтрация сервисов по выбранному traveller
   - Счётчик сервисов на каждом табе

4. **Умные подсказки (Smart Hints)**
   - lib/itinerary/smartHints.ts - логика генерации
   - Типы подсказок: transfer, visa, insurance, connection, upgrade
   - Разные правила для TA/TO/CORP/NON
   - SmartHintRow.tsx - UI компонент
   - Интеграция в OrderServicesBlock между строками сервисов

**Новые файлы:**
- `lib/itinerary/smartHints.ts`
- `app/orders/[orderCode]/_components/ItineraryTabs.tsx`
- `app/orders/[orderCode]/_components/SmartHintRow.tsx`

**Изменённые файлы:**
- `app/orders/[orderCode]/page.tsx`
- `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`
- `app/orders/[orderCode]/_components/OrderClientSection.tsx`

**Next Step:** QA тестирование

---

## [2026-01-19 14:00] CODE WRITER — UX Improvements Session ✅

**Task:** UI/UX Improvements | **Status:** COMPLETED ✅
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Реализовано:**

1. **Tab System Enhancements**
   - Order preview при наведении на вкладку (с кэшированием)
   - Browser-style вкладки (активная сливается с контентом bg-gray-50)
   - Вертикальные разделители между вкладками
   - Кнопка "Close all tabs"
   - Вкладки гаснут при переходе на другие страницы

2. **Role Permissions**
   - Матрица разрешений ROLE_PERMISSIONS в lib/auth/permissions.ts
   - Поддержка scope: all/own/commission
   - UI: badge "Com" для commission в RolePermissionsModal

3. **User Management**
   - Загрузка аватаров для Supervisor (Supabase Storage)
   - Миграция create_avatars_bucket.sql

4. **New Order Page**
   - Owner/Agent загружается из user_profiles через API
   - "Service dates" вместо "Check-in / Return"
   - Формат дат dd.mm.yyyy
   - Исправлен layout (не залазит на sidebar)

**Коммиты:** 25+ в feature/x

**SCORE:** 8/10

---
## [2026-01-19 12:00] CODE WRITER — Tab System Implementation ✅

**Task:** TABS-IMPL | **Status:** COMPLETED ✅
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Реализовано:**
1. TabsContext — глобальный контекст, localStorage, синхронизация с URL
2. TabBar — browser-style вкладки, bg-gray-50 для активной
3. Order Preview — карточка при наведении с кэшированием
4. UX: z-index fixes, вкладки гаснут при уходе со страницы

**Коммиты:** 17 в feature/x | **SCORE:** 8/10

---

## [2026-01-19 00:30] CODE WRITER — Directory Stats: Complete Fix Session ✅

**Tasks:** SVC-CLIENT-PAYER-FIX + DIR-STATS-IMPL | **Status:** COMPLETED ✅

**Session Summary:**
Fixed multiple critical bugs with service duplication, client statistics, and debt calculation.

---

### 🔧 **1. Duplicate Service Button Not Working**

**Root Cause:** Browser confirm dialogs were disabled by user (checkbox in confirm)
- `confirm()` returned `false` automatically
- Code treated as "Cancelled by user"

**Solution:** Replaced browser `confirm()` with `ConfirmModal` component
- Added `duplicateConfirmService` state
- Created `handleDuplicateConfirm` function
- Modal always works (not affected by browser settings)

**Commits:** 154593f, ba7fd14

---

### 🐛 **2. Duplicated Services Have NULL party_ids**

**Root Cause:** **snake_case vs camelCase bug** in `handleDuplicateConfirm`
```javascript
// ❌ БЫЛО (undefined):
payerPartyId: service.payer_party_id

// ✅ СТАЛО (correct UUID):
payerPartyId: service.payerPartyId
```

**Evidence:**
- Frontend logs: `payerPartyId: undefined`
- Database: 4-5 services with NULL `payer_party_id`
- Lost from stats: €2244 (222+222+900+900)

**Solution:**
1. Fixed code to use camelCase: `service.payerPartyId`
2. Created migration to fix existing broken services
3. Added debug logging to API

**Investigation:** Used SQL queries to trace:
- Which services had NULL party_ids
- When they were created (timestamps)
- Whether they were duplicates or manual entries

**Commits:** ba7fd14, migrations for fixing data

---

### 🔧 **3. Cancel Service Button Not Working**

**Root Cause:** Same as duplicate - browser confirm disabled

**Solution:** Added second `ConfirmModal` for cancel
- Added `cancelConfirmService` state
- Created `handleCancelConfirm` function
- Red theme for destructive action

**Commit:** cee3e91

---

### 📊 **4. Statistics Not Updating After Duplicate/Cancel**

**Root Cause:** Stats only refreshed on component mount, not when returning from Order page

**Solution:** Enhanced auto-refresh logic
- Added dependency on `record` object (not just `record.id`)
- Now triggers on every card open (new object reference)
- Cache buster ensures fresh API data

**Commit:** c000962

---

### 💰 **5. Wrong payer_party_id for Existing Service**

**Issue:** Service with Leo Malik as client had wrong `payer_party_id`
- Current: `ce033ae3-94c8-483e-aa4a-75e884762b7c` ❌
- Correct: `8a2712aa-7702-4bff-b399-7977c30999a5` ✅

**Solution:** Created specific migration to fix this service
- Updated `payer_party_id` for service ID `2c75158c-c398-4a74-8975-3539202d9693`
- Verified Total Spent increased from €1111 to €1388.75

**Migration:** `fix_leo_malik_payer_id.sql`

---

### 🏷️ **6. Rename "Total Spent" → "Turnover"**

**User Request:** Change label to "Turnover" (Оборот)

**Changes:**
- Updated label in `DirectoryForm.tsx`
- Internal variable name kept as `totalSpent` (no breaking changes)

**Commit:** c3e951b

---

### 💸 **7. Debt Always Shows €0.00**

**Root Cause:** API used static `amount_debt` field from `orders` table
- `amount_debt` is never updated (always 0)
- Should be calculated dynamically

**Solution:** Changed Stats API to calculate debt as `Turnover - Amount Paid`
```javascript
// Before:
debt = SUM(orders.amount_debt) // Always 0

// After:
const amountPaid = SUM(orders.amount_paid);
const debt = totalSpent - amountPaid;
```

**Logic:**
- Turnover (totalSpent) = SUM(services.client_price where payer, not cancelled)
- Amount Paid = SUM(orders.amount_paid) for those orders
- Debt = Turnover - Amount Paid

**Example (Bogdans Ignatjevs):**
- Turnover: €2080.75 ✅
- Amount Paid: €0.00
- Debt: €2080.75 ✅ (was €0.00 before)

**Commit:** ec74e2f

---

### 📁 **Debug & Investigation Files Created:**

1. `debug_duplicated_services.sql` - Check services with NULL party_ids
2. `investigate_null_party_ids.sql` - Detailed investigation of NULL values
3. `fix_duplicated_services_party_ids.sql` - Migration to fix broken duplicates
4. `fix_leo_malik_payer_id.sql` - Fix specific service with wrong payer
5. `check_debt.sql` - Verify debt calculation
6. `check_amounts_detailed.sql` - Compare stored vs calculated amounts
7. `verify_turnover.sql` - Verify turnover calculation
8. `check_orders_schema.sql` - Inspect actual DB schema

---

### ✅ **Final State:**

**Directory Statistics Panel:**
- ✅ Turnover shows correct sum of services (excludes cancelled)
- ✅ Debt calculated dynamically (Turnover - Paid)
- ✅ Auto-refreshes on card open
- ✅ Interactive tooltip with order breakdown
- ✅ All party_ids correctly saved

**Service Management:**
- ✅ Duplicate button works (ConfirmModal)
- ✅ Cancel button works (ConfirmModal)
- ✅ Party IDs saved correctly (camelCase fix)
- ✅ Client/Payer display in list
- ✅ Stats update after actions

**Technical Improvements:**
- ✅ All browser confirm() replaced with ConfirmModal
- ✅ Consistent camelCase in service data flow
- ✅ Dynamic debt calculation (not static field)
- ✅ Comprehensive SQL debugging queries
- ✅ Data integrity migrations for existing records

**Next:** Tasks marked as COMPLETED in TODO

---

## [2026-02-19 00:00] CODE_WRITER — TASK 6: Client API bookings list endpoints

**Task:** Task 6 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠 Medium

**Действия:**
- Прочитал `app/api/orders/route.ts` и `[orderCode]/route.ts` — нашёл реальные имена полей
- Поле клиента: `client_party_id` (FK → party.id = crmClientId из JWT)
- Поля дат: `date_from`, `date_to` (не start_date/end_date)
- Создал `app/api/client/v1/bookings/route.ts` — все заказы клиента
- Создал `app/api/client/v1/bookings/upcoming/route.ts` — date_from >= today, ascending
- Создал `app/api/client/v1/bookings/history/route.ts` — date_to < today, descending
- TypeScript check: exit code 0 (чисто)

**Результат:** 3 файла созданы, TypeScript чист
**Commit:** d69a4e6

**Next:** QA verification

---

## [2026-02-19 10:00] CODE_WRITER — Task 8: Scaffold Expo project

**Task:** Task 8 (Mobile scaffold) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠 Medium

**Действия:**
- Создал `Client/package.json` — expo ~51, react-native 0.74, zustand, tanstack-query, axios, react-navigation
- Создал `Client/app.json` — scheme: "mytravelconcierge", bundleIdentifier, plugins
- Создал `Client/tsconfig.json` — strict: true, @/* path alias
- Создал `Client/babel.config.js`, `Client/.env`, `Client/.gitignore`
- Создал `Client/App.tsx` — placeholder screen
- Создал `Client/assets/.gitkeep` и 10 директорий `src/` через `.gitkeep`

**Результат:** 18 файлов добавлено, структура Expo проекта полностью создана
**Commit:** c83bdae

**Next:** Готово / QA

---

## [2026-02-19 09:00] CODE_WRITER — Task 9: Axios API client + Zustand auth store

**Task:** Task 9 (Mobile API client) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠 Medium

**Действия:**
- Создал `Client/src/api/client.ts` — Axios instance, baseURL `/api/client/v1`, request interceptor (Bearer token из SecureStore), response interceptor (401 → refresh → retry, queue pattern для concurrent 401)
- Создал `Client/src/store/authStore.ts` — Zustand store: login/logout/checkAuth; refreshToken хранится только в SecureStore, не в state
- Создал `Client/src/api/bookings.ts` — типизированные хелперы: getAll, getUpcoming, getHistory, getById, getItinerary, getDocuments, getProfile
- Создал `Client/src/api/concierge.ts` — sendMessage placeholder для AI concierge chat

**Результат:** 4 файла добавлено, 223 строк кода
**Commit:** 77939f0

**Next:** QA

---

## [2026-02-19 21:00] CW — Dynamic Date Format from Company Settings

**Task:** Date Format Centralization | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Обновил `utils/dateFormat.ts`: `formatDateDDMMYYYY` и `formatDateRange` теперь читают глобальный формат (dd.mm.yyyy / mm.dd.yyyy / yyyy-mm-dd)
- Экспортировал `formatDateShort` для коротких дат (DD.MM)
- Создал `contexts/CompanySettingsContext.tsx` с `CompanySettingsProvider` и хуком `useDateFormat()`
- Провайдер загружает `companies.date_format` при старте и устанавливает глобальный формат через `setGlobalDateFormat()`
- Подключил `CompanySettingsProvider` в `app/layout-client-wrapper.tsx`
- Обновил `handleSave` в Company Settings для немедленного применения нового формата
- Заменил inline-форматирование дат в: `OrderServicesBlock.tsx`, `orders/page.tsx`, `AddPaymentModal.tsx`, `AddServiceModal.tsx`, `EditServiceModalNew.tsx`
- Создал Cursor-правило `.cursor/rules/date-format.mdc` для обеспечения соблюдения в будущем

**Результат:** Все форматы дат в CMS теперь определяются настройкой в Company Settings > Regional Settings > Date Format

**Next Step:** Проверка остальных файлов на соответствие

---

## [2026-02-19 22:00] CW — Itinerary Deduplication + Client Names + Traveller Filter

**Task:** Itinerary Dedup | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Добавил `mergeDuplicateServices()` — группировка по контенту (splitGroupId ИЛИ category+name+dates), объединение assignedTravellerIds, ticketNumbers, boardingPasses
- Заменил все `splitGroupId`-проверки на content-based ключи (`seenHotelKeys`, `seenTransferKeys`, `seenOtherKeys`)
- Упростил `getTravellerSurnames` → `getTravellerSurnamesFromIds` (работает с уже объединёнными IDs)
- Добавил пост-обработку: все события получают `assignedTravellerIds` для фильтрации
- Сделал рабочий фильтр по клиенту: `selectedTravellerId` теперь реально фильтрует timeline events
- Имена клиентов (фамилии) уже отображаются на всех карточках через `travellerSurnames`

**Результат:** Сервисы не дублируются, имена клиентов показаны, фильтр работает

**Next Step:** APP задачи (itinerary sync, tab bar, documents, concierge UI)

---

## [2026-02-19 23:00] CW — APP: Tab bar + Itinerary dedup/names/filter + all services

**Task:** APP Itinerary & Nav | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- **Tab bar fix:** Создал `HomeNavigator` (HomeStack) с HomeList + TripDetailFromHome внутри tab. Tab bar теперь видим при навигации Home → Trip Details.
- **Backend:** В `/api/client/v1/bookings/[id]` добавил `split_group_id`, `traveller_ids`, `traveller_names` (из `order_service_travellers` + `party`).
- **APP BookingService:** Добавил поля `split_group_id`, `traveller_ids`, `traveller_names`.
- **Dedup:** Добавил `mergeDuplicateServices()` в APP TripDetailScreen — группировка по splitGroupId или content key, объединение имён и билетов.
- **Client names:** Компонент `TravellerBadges` — фамилии на всех карточках (Flight, Hotel, Transfer, Other).
- **Filter:** Горизонтальные chip-кнопки по фамилиям для фильтрации timeline.
- **All services:** Insurance, Visa, Other — все показываются как GenericServiceCard с цветовой маркировкой по категории.

**Результат:** APP Itinerary = CMS Itinerary. Tab bar виден. Фамилии на карточках. Фильтр работает.

**Next Step:** APP Documents + Concierge UI

---

## [2026-02-20 03:00] CW — Concierge Booking Flow (RateHawk + Stripe)

**Task:** Full booking pipeline | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🔴

**Действия:**
- **Concierge tools:** Добавлен `select_hotel_for_booking` — сохраняет выбор клиента в `concierge_booking_requests`, делает prebook через RateHawk, генерирует payment URL.
- **search_hotels:** Обновлён — теперь сохраняет `SearchResultEntry[]` с `hid`, `matchHash`, `bookHash`, ценами. Передаёт AI note о возможности бронирования.
- **Tool context:** Переделан `executeToolCall` — принимает `ToolContext` вместо отдельных параметров. Хранит `lastSearchResults` между вызовами в рамках одного запроса.
- **Stripe Checkout:** `/api/client/v1/booking/checkout` — создаёт Stripe Checkout Session с деталями отеля, привязывает к booking request.
- **Stripe Webhook:** `/api/client/v1/booking/webhook` — принимает `checkout.session.completed`, обновляет статус на `paid`, запускает RateHawk finalization в фоне.
- **RateHawk Finalization:** `createBookingForm` → `startBooking` → `checkBookingStatus` (поллинг до 30с). При успехе → `booking_confirmed`, создаёт `order_service` в CMS.
- **Order Service:** Автоматически создаёт запись в `order_services` с категорией `accommodation`, ценами покупки/продажи, ref_nr = confirmation number.
- **Success/Cancel pages:** HTML-страницы для redirect после оплаты.
- **ChatBubble:** Уже поддерживает markdown-ссылки (`[Pay Now](url)` → кликабельные).

**Результат:** Полный pipeline: Concierge search → select → prebook → Stripe payment → RateHawk booking → CMS order.

**Next Step:** QA — применить миграцию 004, протестировать flow end-to-end.

---

## [2026-02-20 02:00] CW — Concierge Expanded Hotel Data + Markdown Chat

**Task:** Expand Concierge hotel data + rich text | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- **RateHawk interface:** Расширил `RateHawkHotelContent` — добавлены `amenity_groups`, full `room_groups` (с `room_amenities`, `bedding_type`, `bathroom`, `room_class`, фото номеров), `kind`, `hotel_chain`, `year_built`, `year_renovated`, `rooms_number`, `floors_number`, `distance_center`, `images` (фото отеля).
- **getHotelContent:** Полностью переписана extraction — извлекаются amenity_groups, structured room_groups с фото и amenities, building facts, hotel images (с заменой `{size}` → `640x400`).
- **Concierge tool result:** Обновлён `search_hotels` — AI получает: `kind`, `hotelChain`, `yearBuilt/Renovated`, `floorsAndRooms`, `distanceToCenter`, `amenities` (по группам), `roomTypes` (с bed type, room class, per-room amenities), `images` (до 3 фото отеля), `roomImages` (до 4 фото номеров).
- **ChatBubble:** Заменён plain text на кастомный markdown-рендерер — поддержка **bold**, *italic*, заголовков (## / ###), списков (- • 1.), ссылок (`[text](url)` → Linking.openURL), изображений (`![alt](url)` → `<Image>`), автодетект URL в тексте.

**Результат:** Concierge получает полную информацию об отелях. Чат умеет показывать картинки и кликабельные ссылки.

**Next Step:** QA

---

## [2026-02-20 01:30] CW — Concierge Hotel Guest Ratings

**Task:** Concierge hotel reviews | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Добавил `review_score` и `number_of_reviews` в `RateHawkHotelContent` — извлекаются из B2B hotel/info raw response (поля `rating`, `review_score`, `number_of_reviews`, `reviews_count`).
- Создал `getHotelReviewsSummary()` — вызывает Content API `/api/content/v1/hotel_reviews_by_ids/`, вычисляет средний score из `detailed_review` sub-scores (cleanness, location, price, services, room, meal — шкала 0-10).
- В Concierge `search_hotels` tool: `getHotelContentsBatch` и `getHotelReviewsSummary` вызываются параллельно через `Promise.all`.
- В ответ AI добавлены поля `guestRating` (0-10 score) и `reviewCount` (количество отзывов).

**Результат:** Concierge теперь показывает рейтинг гостей и количество отзывов для каждого отеля при поиске.

**Next Step:** QA — проверить что Content API доступен с текущими ключами.

---

## [2026-02-20 00:00] CW — APP Documents + Concierge UI

**Task:** Documents & Concierge | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- **Documents Backend:** Обновил `/api/client/v1/bookings/[id]/documents` — теперь возвращает boarding passes + invoices (из таблицы `invoices`).
- **Documents Screen:** Переписал экран: при раскрытии поездки показываются секции "Invoices" (номер, дата, сумма, статус) и "Boarding Passes" (имя, рейс, скачивание).
- **Concierge UI:** Заменил "AI Concierge" → "Travel Concierge". Добавил зелёный "Live" badge справа. Заменил ActivityIndicator на анимированные "typing···" точки. Обновил welcome message.

**Результат:** Documents = boarding passes + invoices. Concierge = Travel Concierge + Live + typing dots.

**Next Step:** QA

---

## [2026-03-09 23:00] CW — Ancillary Sub-Services for Air Tickets

**Task:** Ancillary Sub-Services | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- DB: Added `ancillary_type` column to `order_services`, inserted "Ancillary" category, extended `service_type` constraint to accept "ancillary"
- API: Extended GET/POST/PATCH in services routes to handle `ancillary_type` field
- Add Form: Added ancillary layout to `AddServiceModal` — parent ticket selector, sub-type buttons (Extra Baggage / Seat Selection / Meal / Other), description, per-client pricing
- Edit Form: Mirrored ancillary layout in `EditServiceModalNew`
- Table: Nested ancillary rows under parent Air Ticket with indented badge display, "+ Add-on" shortcut button on flight rows
- Itinerary: Ancillary badges on flight cards (emoji + name), no separate timeline events for ancillaries

**Результат:** Full ancillary sub-service workflow: Add/Edit forms with parent linking, per-client pricing, nested table display, itinerary badges.

**Next Step:** QA

---

## [2026-03-09 23:00] CW — AIRLINE-CHANNEL: Airline Channel option for BSP supplier

**Task:** AIRLINE-CHANNEL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Added `airline_channel`, `airline_channel_supplier_id`, `airline_channel_supplier_name` columns to `order_services` (migration: `migrations/add_airline_channel.sql`)
- Updated POST API (`/api/orders/[orderCode]/services/route.ts`) to accept and save the new fields
- Updated PATCH API (`/api/orders/[orderCode]/services/[serviceId]/route.ts`) to handle the new fields
- Updated GET APIs to return the new fields in response
- AddServiceModal: when supplier name contains "BSP", shows "Airline Channel" checkbox; when checked, shows secondary PartySelect for airline
- EditServiceModalNew: same UI logic for Edit mode, loads existing values from service
- OrderServicesBlock: Service interface + mapping updated for the new fields

**Результат:** Airline Channel feature complete. Migration needs to be applied to Supabase.

**Next Step:** Apply migration, QA

---

## [2026-03-13 14:00] CW — PRICING-ADDONS: Pricing UI, Add-ons, Trial Implementation

**Task:** PRICING-ADDONS | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Created migration `update_tariff_plans_and_addons.sql`: updated tariff plans (Trial/Starter/Professional/Enterprise with EUR pricing), created `plan_addons` table (14 add-ons), `company_addons` table, added `trial_ends_at` to companies
- Redesigned `app/settings/database/page.tsx`: 4-tier plan grid with feature comparison, EUR currency, trial countdown, add-ons marketplace with toggle activation, grouped by category
- Created 3 new API routes: `GET /api/settings/database/addons` (list all + active), `POST .../activate` (Stripe subscription item or checkout), `POST .../deactivate` (remove from Stripe + DB)
- Updated `app/api/settings/database/provision/route.ts`: Trial activation (no payment, 7-day expiry), plan upgrades via Stripe subscription update, new checkout for first-time paid plans
- Updated `app/api/settings/database/status/route.ts`: returns `trial_ends_at`
- Updated `app/api/stripe/webhook/route.ts`: handles add-on checkout sessions (inserts into `company_addons`)

**Результат:** Full pricing system with 4 tiers, 14 add-ons, trial flow, Stripe integration. Migration needs to be applied.

**Next Step:** Apply migration `update_tariff_plans_and_addons.sql` in Supabase SQL Editor, QA

---

## [2026-03-14 12:00] CW — SUPERADMIN-DASHBOARD: Comprehensive Admin Dashboard

**Task:** SUPERADMIN-DASHBOARD | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🔴

**Действия:**
- Created comprehensive API at `app/api/superadmin/dashboard/route.ts`: aggregates companies, subscriptions, plans, add-ons, AI usage, storage, registrations, alerts into single endpoint with period filtering (week/month/year/custom)
- Redesigned `app/superadmin/page.tsx` into a full admin command center with 4 tabs: Overview, Companies, Subscriptions & Add-ons, Billing & Revenue
- Overview: 10 KPI cards (total/active/trial/MRR/storage/AI), plan distribution bars, recent registrations, alert banner
- Companies: full table with search, status/plan filters, sortable columns, expandable rows with add-ons/storage/Stripe/Supabase details
- Subscriptions: status distribution, plan breakdown table with revenue calc, add-ons marketplace popularity by category
- Billing: revenue by plan bars, key metrics (conversion rate, avg revenue, AI margin), storage by plan, top revenue companies

**Результат:** Complete superadmin dashboard — single page to monitor and manage all sub-agent companies, subscriptions, payments, usage, and alerts.

**Next Step:** QA

---

