# PROJECT LOG — travel-cms

> Активный лог разработки. Записи за последнюю неделю.
> 📁 Архив: `.ai/PROJECT_LOG_ARCHIVE_2026-01.md` (записи до 2026-01-19)

---

## [2026-02-14] CODE WRITER — Orders page: fix "Something went wrong" / lexical 'tc' initialization ✅

**Task:** Fix /orders/0010-26-sm crash | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **AssignedTravellersModal** — удалён дублирующий `export default` (причина "default exported multiple times")
2. **HotelSuggestInput, ClientMultiSelectDropdown** — созданы отсутствующие компоненты (AddServiceModal)
3. **TypeScript** — исправлены касты FlightSegment→Record, airline в normalizeSegment, ServiceData/EditServiceModalNew типы, Company.default_vat_rate, airlineParsers cabinClass, extractPassportPhoto, parseMrz
4. **OrderServicesBlock** — добавлен Fragment import, исправлен resStatus type narrowing для invoice checkbox

**Файлы:** AssignedTravellersModal, AddServiceModal, OrderServicesBlock, EditServiceModalNew, ItineraryTimeline, HotelSuggestInput, ClientMultiSelectDropdown, company/page, airlineParsers, extractPassportPhoto, parseMrz

**Результат:** Build проходит TypeScript. Ошибка "can't access lexical declaration 'tc' before initialization" устранялась через исправление цепочки сборки (duplicate export, missing modules).

**Branch:** cursor/orders-tc-initialization-4913 | Commit: 82696db

---

## [2026-01-30] CODE WRITER — Invoices: PDF fix, номер счёта, логотип, processed ✅

**Task:** Invoices System Improvement (план) | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **Finances PDF** — handleExportPDF использует invoice.order_code в URL вместо [orderCode]; передача invoice в handler
2. **Номер счёта** — новый формат 001626-SM-0132 (6 цифр = seq+year, initials, 4 цифры seq); поддержка legacy INV-*
3. **PDF логотип** — убраны border, border-radius; INVOICE крупно в правом верхнем углу
4. **InvoiceList processed** — добавлен статус processed в getStatusLabel, getStatusColor, getStatusBadge, Invoice interface

**Файлы:** app/finances/invoices/page.tsx, app/api/orders/[orderCode]/invoices/route.ts, app/api/orders/[orderCode]/invoices/[invoiceId]/pdf/route.ts, app/orders/[orderCode]/_components/InvoiceList.tsx

**Результат:** Build OK. Готово к QA.

---

## [2026-01-30] CODE WRITER — TabBar, TabsContext, Lead Passenger avatar ✅

**Task:** Tab preview → tooltip, instant tab switch, Lead Passenger avatar | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **TabBar** — убрано превью заявок при hover; только title (tooltip) с tab.title + subtitle + dates
2. **TabsContext** — prefetch всех путей вкладок для мгновенного переключения; router.push(..., { scroll: false })
3. **Lead Passenger avatar** — рядом с именем клиента: аватар из party_person.avatar_url (32×32) или инициалы; API GET/PATCH возвращает client_avatar_url

**Файлы:** components/TabBar.tsx, contexts/TabsContext.tsx, app/orders/[orderCode]/page.tsx, app/api/orders/[orderCode]/route.ts

**Результат:** Принято. Закладки без превью, только tooltip; переключение моментальное; аватар клиента рядом с Lead Passenger.

---

## [2026-01-30] CODE WRITER — Order: Auto dates, Destination from flights, Itinerary filter ✅

**Task:** Dates from services, Destination from flights, Itinerary service filter | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **Auto dates (date_from, date_to)** — OrderServicesBlock вычисляет min/max дат из всех активных сервисов; onInferDates вызывает PATCH order; обновление только при изменении
2. **Destination from flights** — handleInferDestination расширен: из flight_segments извлекаются arrival IATA → getCityByIATA → city+country; объединение с hotel destinations
3. **Itinerary filter by services** — рядом с выбором клиентов добавлен select по типу сервиса (Flight, Hotel, Transfer и т.д.); показываются только категории, присутствующие в заявке (availableCategories из services)

**Файлы:** app/orders/[orderCode]/page.tsx, app/orders/[orderCode]/_components/OrderServicesBlock.tsx, app/orders/[orderCode]/_components/ItineraryTimeline.tsx

**Результат:** Принято. Даты заказа проставляются автоматически от первого до последнего сервиса; Destination определяется из полётов (куда летим); фильтр Itinerary показывает только категории из заявки.

---

## [2026-01-30] CODE WRITER — Search: Cyrillic as Latin (wrong layout) ✅

**Task:** Search understands Cyrillic as Latin | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **lib/directory/searchNormalize.ts** — CYRILLIC_TO_LATIN_LAYOUT (ЙЦУКЕН): Ф→A, Т→N, Е→T, Д→L, Н→Y и т.д.; getSearchPatterns добавляет вариант «неправильной раскладки» при вводе кириллицы
2. **lib/stores/filterOrders.ts** — queryText, clientLastName, country используют getSearchPatterns + matchesSearch; поиск заказов понимает кириллицу как латиницу

**Файлы:** lib/directory/searchNormalize.ts, lib/stores/filterOrders.ts

**Результат:** Принято. Поиск (Directory, Orders) понимает ввод кириллицей как латиницу — без конвертации поля, только при поиске/фильтрации.

---

## [2026-01-30] CODE WRITER — Passport + Address UI improvements ✅

**Task:** Passport parsing, country, address icons | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **Passport parsing** — SYSTEM_PROMPT: буква в букву, цифра в цифру; сохранение диакритики (ā, ē, š, ž); soft sign ь → apostrophe; Title Case (пропись + заглавные первые)
2. **transliterateCyrillic** — Ь, ь → apostrophe (')
3. **Country parsing** — BLR в ISO_ALPHA3_TO_COUNTRY; COUNTRY_NAME_ALIASES; resolveCountryCode для Belarus и вариантов названий
4. **Kadriye** — добавлена в cities.ts (Turkey)
5. **MapPin icon** — булавка для адреса в ItineraryTimeline, AddServiceModal, EditServiceModalNew, HotelSuggestInput
6. **Country flag** — флаг страны рядом с адресом; getCountryCodeFromName в countries.ts; ItineraryTimeline (извлечение страны из адреса), HotelSuggestInput

**Файлы:** app/api/ai/parse-passport/route.ts, utils/transliterateCyrillic.ts, lib/data/countries.ts, lib/data/cities.ts, components/PassportDetailsInput.tsx, ItineraryTimeline.tsx, AddServiceModal.tsx, EditServiceModalNew.tsx, HotelSuggestInput.tsx

**Результат:** Паспорт: точное копирование + диакритика; страны парсятся (Belarus и др.); адрес с иконкой булавки; флаг страны рядом с адресом.

---

## [2026-01-31] CODE WRITER — Hotel API: room categories + meal plans ✅

**Task:** Hotel API room/meal | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **lib/ratehawk/client.ts** — RateHawkHotelContent расширен: room_groups (name из name_struct.main_name), meal_types из metapolicy_struct.meal; getHotelContent парсит raw API response
2. **HotelSuggestInput** — HotelDetails: roomOptions, mealOptions; onHotelSelected передаёт их из hotel-content API
3. **AddServiceModal / EditServiceModalNew** — state hotelRoomOptions, hotelMealOptions; Room input с datalist (room-options); Board datalist дополнен mealOptions из API
4. Исправлены TypeScript: categoryType === "hotel" → "tour" в non-hotel Parties block (Add/Edit)

**Файлы:** lib/ratehawk/client.ts, components/HotelSuggestInput.tsx, AddServiceModal.tsx, EditServiceModalNew.tsx

**Результат:** При выборе отеля из RateHawk в Room и Board появляются подсказки из API (room_groups, meal types).

---

## [2026-01-30] CODE WRITER — Send to Hotel + Order Log (START)

**Task:** SEND-TO-HOTEL | **Status:** START
**Agent:** Code Writer | **Complexity:** 🟠 Medium

**План:**
1. Migration order_communications — таблица для лога коммуникаций
2. API POST send-to-hotel — отправка email + запись в Log
3. API GET communications — для вкладки Log
4. Send to Hotel modal — форма с To, Subject, Message
5. Log tab — отображение записей (дата, тип to Supplier, текст)

---

## [2026-01-30] CODE WRITER — order_communications migration ✅

**Task:** SEND-TO-HOTEL | **Status:** SUCCESS (step 1)
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. Создана миграция `migrations/add_order_communications.sql`
2. Таблица: order_id, service_id (nullable), company_id, type (to_supplier/from_supplier/to_client/from_client/other), recipient_email, subject, body, sent_at, sent_by, email_sent, created_at
3. Индексы: order_id, service_id, company_id, sent_at, type
4. RLS: SELECT/INSERT по company_id через profiles

**Файл:** `migrations/add_order_communications.sql`

**Next:** API POST send-to-hotel

---

## [2026-01-30] CODE WRITER — Order page: sticky tabs + Itinerary + Map ✅

**Task:** ORDER-STICKY-UI | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟢 Low

**Действия:**
1. **Sticky tabs (Services, Finance, Documents, etc.)** — горизонтальные вкладки заказа липкие (sticky top-24); всегда видны при прокрутке; убрано вертикальное меню (перекрывало таблицу)
2. **Sticky Itinerary** — плашка Itinerary (заголовок + выбор клиентов) липкая (top-36, ниже вкладок); весь блок Itinerary + Map sticky при прокрутке
3. **Sticky Map** — карта липкая (top-36); выравнивание по верху с Itinerary (items-start)

**Файлы:** `app/orders/[orderCode]/page.tsx`, `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`, `app/orders/[orderCode]/_components/ItineraryTimeline.tsx`

**Результат:** Принято. Вкладки, Itinerary и Map остаются на виду при прокрутке; таблица не двигается.

---

## [2026-01-30] CODE WRITER — Merge Contact: подтверждение + восстановление архивных ✅

**Task:** MERGE-CONTACT-FIX | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **MergeContactModal:** добавлен шаг подтверждения перед merge; явный текст «Выбранный контакт будет архивирован; [текущий] останется»; блок «Confirm merge» с кнопками Cancel / Yes, merge
2. **Directory:** кнопка «Show archived» — показывает только inactive контакты; кнопка «Restore» для каждого архивного контакта (PUT isActive: true)
3. **Восстановление Pricite Irina:** через UI — Show archived → найти контакт → Restore

**Файлы:** `components/MergeContactModal.tsx`, `app/directory/page.tsx`

**Результат:** Принято. Подтверждение перед merge снижает риск ошибки; архивные контакты можно просмотреть и восстановить.

---

## [2026-01-31] CODE WRITER — Clients by Citizenship: Pie chart + Other ✅

**Task:** DIRECTORY-PIE-CHART | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟢 Low

**Действия:**
1. **Clients by Nationality → Clients by Citizenship** — переименован заголовок
2. **Pie diagram** — список заменён на круговую диаграмму (recharts PieChart); donut-стиль, Tooltip, Legend
3. **Много стран** — топ-7 стран + срез «Other (N more)» для остальных; максимум 8 сегментов

**Файлы:** `app/directory/page.tsx`, `package.json` (recharts)

**Результат:** Принято. Pie chart для Clients by Citizenship; при большом числе стран — группировка в Other.

---

## [2026-01-31] CODE WRITER — Boarding Pass: hover + Ctrl+V без клика ✅

**Task:** BP-PASTE-HOVER | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟢 Low

**Действия:**
1. **Paste по hover** — навести курсор на поле +BP и нажать Ctrl+V; клик не нужен
2. **Реализация** — document-level paste listener; mousemove отслеживает позицию; при paste проверяем elementFromPoint — если курсор над зоной BP, обрабатываем вставку (image/PDF)

**Файлы:** `components/BoardingPassUpload.tsx`

**Результат:** Принято. Hover + Ctrl+V для вставки boarding pass; click — выбор файла; drag — drop.

---

## [2026-01-31] CODE WRITER — Passport parse UX + phone/email clear fix ✅

**Task:** PASSPORT-UX-PHONE-FIX | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **Паспорт: зелёная подсветка сразу после парсинга** — `setIsEditing(true)` в PassportDetailsInput после успешного parse; форма раскрывается и показывает зелёные поля (как Package Tour)
2. **Паспорт: "Unsaved" после парсинга** — checkDirty в DirectoryForm теперь учитывает passportData (passportNumber, dates, passportFullName, nationality); бейдж "Unsaved" появляется сразу после парсинга
3. **Phone/email не очищались** — при удалении телефона/email и Save форма отправляла `undefined` (ключ опускался из JSON) → API не обновлял поле. Теперь всегда отправляем `phone` и `email` ("" при пустом) → API ставит null в БД

**Файлы:** `components/PassportDetailsInput.tsx`, `components/DirectoryForm.tsx`

**Результат:** Принято. Зелёные поля после парсинга; "Unsaved" напоминает сохранить; phone/email корректно очищаются в БД.

---

## [2026-01-31] CODE WRITER — Формат дат dd.mm.yyyy + правило в проект ✅

**Task:** DATE-FORMAT-RULE | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **Замена `input type="date"` на SingleDatePicker** — все поля даты теперь показывают dd.mm.yyyy (точка вместо /)
2. **Файлы:** PassportDetailsInput, DirectoryForm, DirectorySearchPopover, AddServiceModal, EditServiceModalNew, InvoiceCreator, FlightItineraryInput
3. **Правило в проект:** добавлено 6.11 / 11 «Формат дат — dd.mm.yyyy» и запрет №13 в cursorrules.mdc и NEW_PROJECT_RULES.md

**Принцип:** НЕ использовать `input type="date"` (браузер показывает dd/mm/yyyy по локали). Использовать SingleDatePicker и formatDateDDMMYYYY.

**Файлы:** `components/PassportDetailsInput.tsx`, `components/DirectoryForm.tsx`, `components/DirectorySearchPopover.tsx`, `components/FlightItineraryInput.tsx`, `app/orders/[orderCode]/_components/AddServiceModal.tsx`, `app/orders/[orderCode]/_components/EditServiceModalNew.tsx`, `app/orders/[orderCode]/_components/InvoiceCreator.tsx`, `.cursor/rules/cursorrules.mdc`, `.ai/NEW_PROJECT_RULES.md`

**Результат:** Все даты в формате dd.mm.yyyy; правило зафиксировано в проекте.

---

## [2026-01-31] CODE WRITER — Cabin class, passport highlight, LV/EE, dates, build fixes ✅

**Task:** CABIN-PASSPORT-LVEE-DATES | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. **Cabin class:** при нераспознанном классе — Economy по умолчанию; `cabinClassGuessed` в ParsedBooking; красная подсветка (guessed), зелёная (parsed) в AddServiceModal/EditServiceModalNew
2. **Паспорт:** подсветка распознанных полей зелёным (parsedFields) в PassportDetailsInput
3. **LV/EE паспорта:** SYSTEM_PROMPT — поддержка š, č, ā (LV), ä, ö, ü (EE), ą, č (LT); Issuing Country/Citizenship/Personal Code для LV/EE; без кириллицы
4. **Даты:** dd.mm.yyyy (точка) — finances/invoices, ItineraryTimeline, orders/page
5. **extractPassportPhoto:** unpdf 1.4.0 использует `data: Uint8ClampedArray`, не `buffer` — исправлено
6. **parseMrz:** type cast `as unknown as Record<string, unknown>` для ParseResult

**Файлы:** `lib/flights/airlineParsers.ts`, `AddServiceModal.tsx`, `EditServiceModalNew.tsx`, `PassportDetailsInput.tsx`, `app/api/ai/parse-passport/route.ts`, `utils/dateFormat.ts`, `app/finances/invoices/page.tsx`, `ItineraryTimeline.tsx`, `app/orders/[orderCode]/page.tsx`, `lib/passport/extractPassportPhoto.ts`, `lib/passport/parseMrz.ts`

**Результат:** Build проходит успешно.

---

## [2026-01-31] CODE WRITER — Add Service: category picker + fixed category in header ✅

**Task:** ADD-SVC-CATEGORY-PICKER | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
1. OrderServicesBlock: кнопка "Add Service" открывает dropdown с категориями; выбор категории → AddServiceModal с preselectedCategoryId
2. AddServiceModal: prop preselectedCategoryId, loadCategories использует его; убран select категории; заголовок "Add Service — Flight"
3. EditServiceModalNew: убран select категории; заголовок "Edit Service — Flight"

**Принципы:** ADD_EDIT_SERVICE_SYNC соблюдён; payload, парсинг, useEffects без изменений.

**Файлы:** OrderServicesBlock.tsx, AddServiceModal.tsx, EditServiceModalNew.tsx

**Next:** QA verification

---

## [2026-01-30] CODE WRITER — Passport: Latin only + AI-only parsing ✅

**Task:** PASSPORT-LATIN-AI | **Status:** SUCCESS
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- Паспорт: использовать латиницу из формата «Кириллица / Latin» (extractLatinFromPassportFormat), не транслитерировать
- AI prompt: явно указано брать Latin после /
- Отключён `/api/parse-passport-mrz` (410 Gone) — только AI для картинок и PDF
- PassportDetailsInput, API, utils — ensureLatin через extractLatinFromPassportFormat

**Результат:** Парсинг паспортов только через AI; имена — латиница из паспорта (часть после /).

**Файлы:** `utils/transliterateCyrillic.ts`, `app/api/ai/parse-passport/route.ts`, `app/api/parse-passport-mrz/route.ts`, `components/PassportDetailsInput.tsx`, `lib/passport/parsePassportText.ts`

---

## [2026-01-31] CODE WRITER — Split services fix ✅

**Task:** SPLIT-SVC-FIX | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Simple

**Действия:**
- Fix "Failed to create split services": company_id fallback из order, safe defaults для vat_rate, cabin_class, price_type, refund_policy, JSONB
- Улучшены сообщения об ошибках (details, hint, code) в API и UI
- Миграция `add_split_columns_order_services.sql` — split_group_id, split_index, split_total

**Результат:** Выполнено и принято. Split services работает после применения миграции.

**Файлы:** `app/api/orders/[orderCode]/services/[serviceId]/split/route.ts`, `SplitServiceModal.tsx`, `SplitModalMulti.tsx`, `migrations/add_split_columns_order_services.sql`

---

## [2026-01-31] Add Service — Hotel fields = Edit Service ✅

**Task:** HOTEL-ADD-FIELDS | **Status:** SUCCESS — принято
**Agent:** Code Writer | **Complexity:** 🟡 Medium

**Действия:**
- Add Service для Hotel: те же поля что в Edit Service
- Room, Board, Bed Type (King/Queen, Twin, Not guaranteed)
- Preferences: Early/Late check-in, Higher floor, King size bed, Honeymooners, Silent room, Parking
- Rooms next to, Additional preferences (free text), Send to Hotel button
- Supplier: Booking Type (GDS/Direct) для Hotel
- Payload: hotelRoom, hotelBoard, hotelBedType, hotelEarlyCheckIn, hotelHigherFloor и т.д.

**Результат:** Add Service и Edit Service — одинаковые поля для Hotel.

**Файл:** `app/orders/[orderCode]/_components/AddServiceModal.tsx`

---

## [2026-01-31] Add Service — Package Tour layout = Edit Service ✅

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

### 📅 [2026-01-08] | [18:30]
**Агент:** `Code Writer`
**Задача:** `Merge feature/x into main`
**Статус:** `SUCCESS`
**Действия:**
- Выполнен merge ветки `feature/x` в `main`
- Разрешены конфликты (10 файлов):
  - `.ai/PROJECT_LOG.md` - использована версия из feature/x
  - `.ai/PROJECT_PROGRESS.md` - использована версия из feature/x
  - `.ai/PROJECT_RULES.md` - использована версия из feature/x
  - `.ai/PROJECT_TODO.md` - использована версия из feature/x
  - `app/api/orders/create/route.ts` - использована версия из feature/x
  - `app/directory/new/page.tsx` - использована версия из feature/x
  - `components/DirectoryForm.tsx` - использована версия из feature/x
  - `components/DirectorySearchPopover.tsx` - использована версия из feature/x
  - `lib/supabaseClient.ts` - использована версия из feature/x
  - `lib/types/directory.ts` - использована версия из feature/x
- Создан merge commit: `6acf9e2`
- Локальная ветка `main` обновлена
**Результат:**
- ✅ Merge успешно выполнен
- ✅ Все конфликты разрешены (использована актуальная версия из feature/x)
- ✅ Merge commit создан с описанием всех изменений
- ⚠️ Push в `origin/main` требует авторизации GitHub (выполнить вручную)
**Merged Features:**
- Dashboard Redesign (Turion Style) - DASH1
- Dashboard fixes: Currency $ → € (DASH2-3)
- Orders UI improvements: 15 fixes (ORD-UI1-15)
- Passport Details with AI parsing (D1)
- Directory fixes and enhancements
- UI/UX improvements (ripple effect, validation icons, transitions)
- 30 commits from feature/x merged into main
**Next Step:**
- User must manually execute: `git push origin main` (requires GitHub authentication)
- Or use: `gh auth login && git push origin main`
Files touched:
- 100+ files merged from feature/x to main
- `.ai/PROJECT_LOG.md` (this entry)
Commit:
- Merge commit: `6acf9e2` - "merge: feature/x into main - Dashboard redesign and Orders UI improvements"
Smoke test:
- [x] Merge completed successfully
- [x] All conflicts resolved
- [x] Merge commit created
- [x] Local main branch updated
- [ ] Push to origin/main (requires user authentication)
---

### 📅 [2026-02-13] | [20:30]
**Агент:** `Code Writer`
**Задача:** `Fix OrderServicesBlock "Element type is invalid: got: object"`
**Статус:** `SUCCESS`
**Действия:**
- Root cause: ESM/CJS interop — default imports (AssignedTravellersModal, AddServiceModal) could resolve to namespace object instead of component function
- Added defensive extraction: use function when typeof is "function", else use `.default`
- Added null guard for EditServiceModal when `services.find()` returns undefined
**Результат:**
- OrderServicesBlock.tsx updated with interop-safe imports and service existence check
**Next Step:** `QA — verify order page and Services block render without "Element type invalid" error`

---

### 📅 [2026-02-13] | [20:22]
**Агент:** `Code Writer`
**Задача:** `Fix runtime crash: invalid element type in OrderServicesBlock`
**Статус:** `START`
**Действия:**
- Прочитал `.ai/PROJECT_RULES.md`, `.ai/PROJECT_TODO.md`, `.ai/PROJECT_PROGRESS.md`, последние записи `.ai/PROJECT_LOG.md`
- Начал диагностику ошибки `Element type is invalid` в `OrderServicesBlock`
- План: проверить экспорты/импорты, JSX-вставки и типы компонентов в блоке услуг заказа
**Результат:**
- **Next Step:** `Найти и исправить неверный импорт/экспорт, который ломает рендер`

---

### 📅 [2026-02-13] | [20:26]
**Агент:** `Code Writer`
**Задача:** `Fix runtime crash: invalid element type in OrderServicesBlock`
**Статус:** `SUCCESS`
**Действия:**
- В `OrderServicesBlock` заменил default-импорты модалок на named-импорты и type-only импорт для `ServiceData`
- Заменил `React.Fragment` на `Fragment` через named import из `react`
- В `AddServiceModal` и `AssignedTravellersModal` добавил named export с сохранением default export для совместимости
**Результат:**
- Снижена вероятность runtime-ошибки из-за default/named import interop в модальных компонентах
- **Next Step:** `Проверить линтером и зафиксировать SCORE`

---

### 📅 [2026-02-13] | [20:26]
**Агент:** `QA / REGRESSION`
**Задача:** `Regression check for OrderServicesBlock invalid element type fix`
**Статус:** `SUCCESS`
**Действия:**
- Запущен lint: `npm run lint -- app/orders/[orderCode]/_components/OrderServicesBlock.tsx app/orders/[orderCode]/_components/AddServiceModal.tsx app/orders/[orderCode]/_components/AssignedTravellersModal.tsx app/orders/[orderCode]/page.tsx`
- Проверены измененные файлы: ошибок lint нет, только предупреждения
**Результат:**
- **SCORE: 9/10**
- **Defect List:**
  - [LOW] `app/orders/[orderCode]/_components/AssignedTravellersModal.tsx:321` — `travellerExists` не используется (pre-existing warning, non-blocking)
  - [LOW] `app/orders/[orderCode]/_components/OrderServicesBlock.tsx:202` — missing dependency warning для `useEffect` (pre-existing warning, non-blocking)
- **Next Step:** `Обновить PROJECT_PROGRESS.md и PROJECT_TODO.md, затем закоммитить и отправить`

---

### 📅 [2026-02-13] | [20:35]
**Агент:** `Code Writer`
**Задача:** `HOTEL Add/Edit modal redesign (6 variants)`
**Статус:** `START`
**Действия:**
- Подготовка редизайна HOTEL-модалок Add/Edit
- Цель: 6 существенно разных UI-версий с выбором в интерфейсе
**Результат:**
- **Next Step:** `Реализовать 6 вариантов и подключить их в AddService/EditService`

---

### 📅 [2026-02-13] | [20:39]
**Агент:** `Code Writer`
**Задача:** `HOTEL Add/Edit modal redesign (6 variants)`
**Статус:** `SUCCESS`
**Действия:**
- Добавлен общий компонент `HotelModalDesigns.tsx` с 6 существенно разными UI-вариантами (V1-V6) и selector
- В `AddServiceModal` подключен выбор дизайна и рендер выбранной HOTEL-версии
- В `EditServiceModal` сделан редизайн: полноэкранный формат, snapshot блока, даты, и 6 HOTEL-вариантов
- API обновлен для hotel-полей и корректных `service_date_from/service_date_to` в PATCH
**Результат:**
- **Next Step:** `QA: lint + SCORE`

---

### 📅 [2026-02-13] | [20:39]
**Агент:** `QA / REGRESSION`
**Задача:** `QA check: HOTEL Add/Edit redesign (6 variants)`
**Статус:** `SUCCESS`
**Действия:**
- Запущен lint по измененным файлам модалок и API
- Проверка прошла без ошибок, 1 warning (pre-existing)
**Результат:**
- **SCORE: 9/10**
- **Defect List:**
  - [LOW] `app/orders/[orderCode]/_components/OrderServicesBlock.tsx:219` — warning `react-hooks/exhaustive-deps` (pre-existing, non-blocking)
- **Next Step:** `Обновить TODO/PROGRESS, коммит и push`

---

### 📅 [2026-02-13] | [20:43]
**Агент:** `Code Writer`
**Задача:** `Make HOTEL variants always visible in Add/Edit`
**Статус:** `START`
**Действия:**
- Исправляю видимость блока 6 вариантов, чтобы его было видно всегда
**Результат:**
- **Next Step:** `Patch AddServiceModal/EditServiceModal + quick QA`

---

### 📅 [2026-02-13] | [20:45]
**Агент:** `Code Writer`
**Задача:** `Make HOTEL variants always visible in Add/Edit`
**Статус:** `SUCCESS`
**Действия:**
- Секция 6 вариантов отображается всегда в Add/Edit
- Для не-Hotel добавлена явная подсказка переключить Category на Hotel
- Добавлена нормализация category (case-insensitive) для надежной активации
**Результат:**
- **Next Step:** `QA lint + SCORE`

---

### 📅 [2026-02-13] | [20:45]
**Агент:** `QA / REGRESSION`
**Задача:** `QA: visibility fix for HOTEL variants`
**Статус:** `SUCCESS`
**Действия:**
- Проверен lint для `AddServiceModal` и `OrderServicesBlock`
**Результат:**
- **SCORE: 9/10**
- **Defect List:**
  - [LOW] `app/orders/[orderCode]/_components/OrderServicesBlock.tsx:219` — pre-existing hook warning
- **Next Step:** `Commit + push`
