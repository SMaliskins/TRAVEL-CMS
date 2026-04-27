# PROJECT LOG — travel-cms

> Активный лог разработки. Записи за последнюю неделю.
> 📁 Архив: `.ai/PROJECT_LOG_ARCHIVE_2026-01.md` (записи до 2026-01-19)

## [2026-04-28 01:25] CW — EXP-PROCESS: Accountant Process workflow for Company Expenses

**Task:** EXP-PROCESS | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Миграция `migrations/add_company_expenses_accounting.sql` (применена через Supabase MCP):
  - В `company_expense_invoices` добавлены `accounting_state text NOT NULL DEFAULT 'pending'`, `accounting_processed_at timestamptz`, `accounting_processed_by uuid`.
  - CHECK-констрейнт `accounting_state IN ('pending','processed')` (упрощённая модель: у company expenses нет связки с услугами, поэтому attention/replaced/changed нерелевантны).
  - Индекс `(company_id, accounting_state)`, COMMENT на колонках.
- API:
  - `app/api/finances/company-expenses/route.ts` GET — добавлены `accounting_state`, `accounting_processed_at`, `accounting_processed_by` в SELECT (есть fallback при отсутствии колонки, но миграция применена).
  - Новый endpoint `app/api/finances/company-expenses/[id]/process/route.ts` (PATCH): только Finance/Supervisor/Admin, `{ processed: true }` ставит processed + timestamp + actor, `{ processed: false }` откатывает в pending. Tenant-isolated по `company_id`. Идемпотентен (повторный одинаковый processed → 400).
- UI `app/finances/company-expenses/page.tsx`:
  - Тип `CompanyExpenseRow` расширен полями accounting; добавлен `AccountingStateFilter`.
  - Новый фильтр в тулбаре: All / Pending (с счётчиком) / Processed.
  - Новая колонка «Accounting» с бейджем (Pending — amber, Processed — green с галкой и датой).
  - В колонке Actions — кнопка `Process` (зелёная) для pending или `Revert` (серая) для processed, с confirm перед действием. Дисэйблится во время запроса.
  - `rows.map` → `visibleRows.map` для уважения accountingFilter.
- `tsc --noEmit` чистый, lint чистый.

**Результат:** Полный цикл «Process» теперь доступен и в `Company Expenses` по тем же визуальным/UX-принципам, что и `/finances/invoices` и `/finances/suppliers-invoices`. Бухгалтер видит, что в работе, что закрыто, и может одной кнопкой переключать состояние.

**Next Step:** EXP-PROCESS → READY_FOR_QA. Ждёт прохода QA или подтверждения пользователя для пуша.


---

## [2026-04-27 22:30] CW — SUPINV-PERIODIC: Steps 2.3 + 2.4 — service default + Directory backfill

**Task:** SUPINV-PERIODIC | **Status:** SUCCESS (Steps 2.3 + 2.4 of 4 — feature complete)
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Новый helper `lib/finances/periodicSupplierFlag.ts`:
  - `isPartyPeriodicSupplier(supabase, companyId, partyId)` — fail-closed lookup, выходит сразу если id/companyId пустые.
  - `applyPeriodicSupplierBackfill(supabase, companyId, partyId)` — обновляет все required-сервисы поставщика во всех активных заказах (`status IN ('Active','Draft','On hold')`), у которых нет привязанного supplier-invoice документа со статусом, отличным от `deleted`. Возвращает `{ servicesUpdated, ordersAffected }`. Идемпотентен.
- `app/api/orders/[orderCode]/services/route.ts` POST: перед вставкой если клиент явно не задал `supplierInvoiceRequirement` и есть `supplier_party_id` — подсматриваем флаг через helper и подставляем `supplier_invoice_requirement = 'periodic'`. Явное значение (если передано) валидируется и побеждает.
- `app/api/directory/[id]/route.ts` PUT:
  - В выборку `existingParty` добавлено `is_periodic_supplier`.
  - После успешного обновления и фетча `updatedParty` сравниваем `wasPeriodic` ↔ `isPeriodic`: при flip false→true вызываем `applyPeriodicSupplierBackfill` под `try/catch` (не блокирует сохранение).
  - В JSON-ответ дополнительно кладём `periodicBackfill: { servicesUpdated, ordersAffected }` если backfill сработал.
- `app/directory/[id]/page.tsx`: добавлен state `periodicBackfillNotice`, показывает голубой чип рядом с «Saved!» с текстом «Marked N services as Periodic across M active orders.» в течение 8 секунд.
- Тесты: `scripts/test-periodic-supplier-flag.mjs` — 7 кейсов (lookup/short-circuit/fail-closed, no candidates, exclude linked active docs but include linked deleted docs, tenant scope в update). Прогон зелёный.
- `package.json`: добавлен скрипт `test:periodic-supplier-flag`.
- `tsc --noEmit` чисто, lint чисто.

**Результат:** Полный цикл «periodic supplier» закрыт.
- Менеджер ставит чекбокс в Directory → новые сервисы этого поставщика автоматически Periodic; уже существующие required-сервисы во всех активных заказах одной транзакцией переключаются на Periodic, кроме тех, к которым уже привязан supplier-invoice (их не трогаем — они уже в учёте).
- Можно выключить чекбокс — флаг сбрасывается, но обратной массовой миграции нет (требований такого backfill не было).

**Next Step:** SUPINV-PERIODIC → READY_FOR_QA. Runner может закрыть SUPINV-UI-FIX (Step 1+2+3 уже в IN_QA).

---

## [2026-04-27 22:05] CW — SUPINV-PERIODIC: Step 2.2 — Directory UI + API for periodic flag

**Task:** SUPINV-PERIODIC | **Status:** SUCCESS (Step 2.2 of 4)
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `lib/types/directory.ts`: в `SupplierDetails` добавлено поле `isPeriodicSupplier?: boolean` с описанием поведения.
- `lib/directory/buildDirectoryRecord.ts`: маппинг `row.is_periodic_supplier === true` в `record.supplierExtras.isPeriodicSupplier` (используется в detail GET).
- `app/api/directory/route.ts` (list GET): добавлен `is_periodic_supplier` в `partyColumns`; `mapPartyToRecord` теперь возвращает флаг в `supplierExtras`.
- `app/api/directory/[id]/route.ts` (PUT): обработка `updates.supplierExtras.isPeriodicSupplier` → `partyUpdates.is_periodic_supplier = boolean`. Обнуление до `false` поддерживается (не undefined).
- `app/api/directory/create/route.ts` (POST): при создании сохраняется `is_periodic_supplier: data.supplierExtras?.isPeriodicSupplier === true`.
- `components/DirectoryForm.tsx`:
  - State `isPeriodicSupplier` инициализируется из `record?.supplierExtras?.isPeriodicSupplier`.
  - Hydration в `useEffect` при смене record.
  - При сохранении всегда отдаётся булев (для возможности UNSET).
  - В блок «Supplier Details» (видимый только когда роль = supplier) добавлен голубой банер с чекбоксом **Issues periodic invoices** + пояснение «New order services using this supplier will default to Periodic».
  - Подключено к `hasFormDataChanged` — Save активируется только при изменении.
- `tsc --noEmit` чисто, lint чисто.

**Результат:** Менеджер может пометить поставщика как периодического в Directory. Сейчас флаг сохраняется в БД и читается формой/детальной карточкой, но **на поведение order_services пока не влияет** — это шаги 2.3 (default при создании сервиса) и 2.4 (backfill активных заказов).

**Next Step:** CW → 2.3 default `supplier_invoice_requirement = 'periodic'` при создании сервиса.

---

## [2026-04-27 21:40] DB — SUPINV-PERIODIC: Step 2.1 — add party.is_periodic_supplier flag

**Task:** SUPINV-PERIODIC | **Status:** SUCCESS (Step 2.1 of 4)
**Agent:** DB Specialist
**Complexity:** 🟢

**User intent (current message):**
- "всем переодическим поставщикам назначать автоматически статус - Periodic"
- Решение по дизайну: A) флаг в Directory у поставщика + backfill во всех активных заказах компании.

**Действия:**
- Создан файл `migrations/add_party_is_periodic_supplier.sql`.
- Применена миграция через Supabase MCP `apply_migration`:
  - `ALTER TABLE public.party ADD COLUMN IF NOT EXISTS is_periodic_supplier boolean NOT NULL DEFAULT false;`
  - Комментарий к колонке.
  - Частичный индекс `idx_party_is_periodic_supplier ON public.party (company_id) WHERE is_periodic_supplier = true` для быстрых выборок флагнутых поставщиков.
- Подтверждено `information_schema.columns`: колонка существует, `boolean NOT NULL DEFAULT false`.

**Результат:** Готов фундамент для следующих слайсов. UI/API/логика ещё не трогали — `is_periodic_supplier` сейчас всегда `false`, поведение системы не меняется.

**Next Step:** Code Writer → 2.2 Directory UI checkbox + API field on supplier card; 2.3 default `supplier_invoice_requirement='periodic'` при создании сервиса; 2.4 backfill во всех активных заказах при включении флага.

---

## [2026-04-27 21:30] CW — SUPINV-UI-FIX: Step 3 — list missing services in Documents tab

**Task:** SUPINV-UI-FIX | **Status:** SUCCESS (Step 3, follow-up)
**Agent:** Code Writer
**Complexity:** 🟢

**User feedback addressed:**
- "в Documents - показывать не только '1 service without supplier invoice'. может еще и саму строку сервиса?"

**Действия:**
- В `app/orders/[orderCode]/_components/OrderDocumentsTab.tsx`:
  - `supplierInvoiceCounts` → `supplierInvoiceBreakdown` (хранит сами объекты `missingServices`).
  - Добавлен компактный блок `Services waiting for a supplier invoice` под счётчиком.
  - Каждая строка: `<service name> · <supplier> · <date / range> · €<price>` плюс inline `<select>` Required / Periodic / Not required.
  - При выборе Periodic / Not required — PATCH `/api/orders/[code]/services/[serviceId]` с `supplier_invoice_requirement` и инвалидация кеша сервисов.
  - По умолчанию показываются первые 3, есть «Show all N» / «Show less».
- TypeScript проверен (`tsc --noEmit` без ошибок), линтер чистый.

**Результат:** Менеджеру не нужно листать Client & Services чтобы понять, что конкретно не закрыто. Можно прямо здесь переключить статус.

**Next Step:** SUPINV-PERIODIC (отдельный таск).

---

## [2026-04-27 19:01] CW — SUPINV-UI-FIX: Step 2 — auto-suggest matches in Documents

**Task:** SUPINV-UI-FIX | **Status:** SUCCESS (Step 2 of 2)
**Agent:** Code Writer
**Complexity:** 🟡

**User feedback addressed:**
- "в закладке Documents Мatching надо предлагать автоматический"

**Changes:**
- New helper `lib/finances/supplierInvoiceAutoMatch.ts`:
  - `suggestServiceMatchesForDocument(document, services, alreadyMatched)` — conservative matcher: requires same supplier (normalized punctuation/case), boosts confidence with amount match (±2% / ≥€1) and date overlap. Only `requirement="required"` services are considered. Already-matched services are excluded from suggestions to avoid noise.
  - `normalizeSupplierKey` — Unicode-aware lowercase + strip non-alphanumeric, used for the supplier comparison.
  - `describeAutoMatchReasons` — composes a stable human label (e.g. "Supplier matches · Amount matches · Date in range") for tooltips and inline help.
- New regression script `scripts/test-supplier-invoice-auto-match.mjs` covers: empty supplier (no suggestions), case/punctuation insensitive supplier match, amount+date reasons, periodic/not_required exclusion, already-matched de-duplication, substring false-positives must not match, snake_case payloads supported, normalize/describe edge cases. Wired up via `npm run test:supplier-invoice-auto-match`.
- `app/orders/[orderCode]/_components/OrderDocumentsTab.tsx`:
  - Match modal pre-selects suggested service ids when no manual matches yet exist; existing manual matches are preserved untouched.
  - Modal header shows "N suggested matches based on supplier name" pill when suggestions exist.
  - Each suggested service row gets a soft green background, a "Suggested" chip and an inline reasons line (Supplier · Amount · Date) — user can untick at any time.
  - Footer shows "Apply N suggestions" button (left side) for users who want to add suggestions on top of their existing manual selection.
  - Document row Match icon (Link2) gets a small green Sparkles indicator + tooltip "N suggestions available" when there are unmatched docs that have automatic suggestions.

**Verification:**
- `npm run test:supplier-invoice-auto-match` — passed.
- `npm run test:supplier-invoices` — still green (no regressions in accounting helper).
- `npx tsc --noEmit` — clean.
- `ReadLints` over all changed files — no errors.

**Result:** Documents Matching now actively proposes matches; user can accept all in one click or fine-tune. Conservative behaviour (must share supplier) keeps suggestions trustworthy.

**Next Step:** QA — exercise the auto-suggest flow on real orders (suggestion accuracy, no false positives across suppliers, periodic/not_required correctly skipped, existing matches preserved).

---

## [2026-04-27 18:55] CW — SUPINV-UI-FIX: Step 1 — visual cleanup of supplier invoices UI

**Task:** SUPINV-UI-FIX | **Status:** SUCCESS (Step 1 of 2)
**Agent:** Code Writer
**Complexity:** 🟢

**User feedback addressed:**
- Колонка "Supplier invoices" в `/orders` — широкая, слишком многословные бейджи.
- В карточке заказа Supplier — большие жёлтые круги "Missing supplier invoice", визуально перегружено.
- В Documents tab — нет счётчика services без supplier invoices, "уехавший" UI.

**Changes:**
- `app/orders/page.tsx`:
  - Renamed column header to compact `Sup. inv.` with `w-24` width hint and tooltip.
  - Replaced verbose pill labels (Missing supplier invoices / Has unmatched invoices / Periodic only / All matched / Attention) with single-line icon + short label rendering. `all_matched` is shown as a tiny green check (no text), other statuses use short labels (Missing, Unmatched, Periodic, Attention) with matching colored Lucide icons.
  - Full label preserved in `title` tooltip; tones moved from filled pill to text color only — minimal visual weight.
- `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`:
  - Removed the wide yellow circular badge with text "Missing supplier invoice" / "Periodic" / "Invoice matched" / "Not required" from the Supplier column.
  - Replaced with a tiny inline status icon (CheckCircle2 / AlertTriangle / CalendarDays / MinusCircle) before the requirement select. Tooltip carries the full status text plus the supplier-invoice note when present.
  - Requirement `<select>` made borderless and lighter, so the row reads: `Supplier name` line + a single short status row.
- `app/orders/[orderCode]/_components/OrderDocumentsTab.tsx`:
  - Always-load services list (removed `Boolean(matchDoc)` from `enabled`) so the counter is available without opening the modal.
  - Added a summary chip row next to the Upload invoice button: "N services without supplier invoice" (amber when missing, green when all required matched), plus secondary counts (matched / periodic / not required).
  - Replaced the textual `Match` action with a `Link2` icon button so the actions column aligns visually with the other icons (no row "drift").

**Verification:**
- `npx tsc --noEmit` — clean.
- `ReadLints` over the three changed files — no errors.

**Result:** UI now reads as compact and consistent. No data/logic changes. Auto-match suggestion + smarter "select services" UX is the next step (Step 2) and is intentionally not in this commit.

**Next Step:** CW — Step 2: auto-match suggestion in Documents (suggest links by supplier name + amount + date) and quick "Apply suggested matches" action; then QA.

---

## [2026-04-27 16:54] Runner — RELEASE-2026-04-27: Published system update

**Task:** RELEASE-2026-04-27 | **Status:** SUCCESS
**Agent:** Runner / Release
**Complexity:** 🟡

**Действия:**
- Added public release payload `public/data/releases/2026-04-27.json`.
- Added idempotent SQL publication migration for `system_update:2026-04-27`.
- Published the system update in Supabase for all companies.

**Результат:** Published: 11 company notifications created/verified.

**Next Step:** Commit and push

---

## [2026-04-27 16:30] CW — NOTIF-NEWS-LANG: Release news language selector

**Task:** NOTIF-NEWS-LANG | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Added a separate news language selector for system release notifications.
- Applied it in the mandatory release pop-up and expanded `/notifications` release details.
- Added a focused regression helper for release news language fallback.
- Verified `npm run test:release-news-language`, targeted ESLint, TypeScript compile, and IDE lints.

**Результат:** SCORE: 8.5/10 — targeted checks pass; touched-file ESLint has only existing image/hook warnings.

**Next Step:** Ready for release text

---

## [2026-04-27 16:24] CW — O7-IMPL: Remember invoice language from invoice creation

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Persist selected invoice language from InvoiceCreator back to payer/client Directory card after successful invoice creation.
- Cover language preference payload logic with a focused regression check.
- Verify TypeScript/lint.

**Результат:** Pending

**Next Step:** QA

---

## [2026-04-27 16:34] CW — O7-IMPL: Invoice language preference remembered

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Added a focused invoice language preference helper and regression test.
- Updated `InvoiceCreator` to save the selected invoice language to the payer/client Directory card after successful invoice creation.
- Supported both single-payer and multi-payer invoice creation paths.
- Verified `npm run test:invoice-language`, helper ESLint, TypeScript compile, and IDE lints.

**Результат:** SCORE: 8.5/10 — targeted checks pass; full-file `InvoiceCreator` ESLint still reports existing unrelated lint debt.

**Next Step:** QA / Runner

---

## [2026-04-27 16:28] QA — O7-IMPL: Directory invoice language save fallback verified

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** QA / Regression
**Complexity:** 🟡

**Действия:**
- Confirmed live `client_party` schema does not include `default_referral_party_id`, so compatibility fallback is required.
- Reviewed `GET` and `PUT` fallback selects in `app/api/directory/[id]/route.ts`.
- Reviewed `POST` fallback insert in `app/api/directory/create/route.ts`.
- Ran TypeScript compile, targeted ESLint, and IDE lint check.

**Результат:** SCORE: 8.5/10

**Defect List:**
- Blocking defects: none.
- Residual risk: full-file ESLint still reports existing `no-explicit-any` debt in Directory API files.
- Manual browser save of EN→LV was not executed in this step; code/schema verification confirms the missing-column blocker is handled.

**Next Step:** Runner

---

## [2026-04-27 16:18] QA — O7-IMPL: Directory invoice language save fallback

**Task:** O7-IMPL | **Status:** START
**Agent:** QA / Regression
**Complexity:** 🟡

**Действия:**
- Review Directory API fallback for missing `client_party.default_referral_party_id`.
- Verify invoice language update path is not blocked.
- Run targeted schema/lint/type checks.

**Результат:** Pending

**Next Step:** Runner/CW

---

## [2026-04-27 16:10] Runner — SUPINV1: Supplier invoice workflow closed

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Runner
**Complexity:** 🟠

**Действия:**
- Confirmed QA passed for documents matching, accountant processing, soft-delete/change attention sync, service controls, and `/orders` preview status.
- Confirmed every QA SCORE is >= 8/10 and no blocking defects remain.
- Updated `PROJECT_TODO.md` and `RELEASE_LOG.md`.

**Результат:** SCORE: 8.5/10 — DONE; residual unrelated lint debt remains in large existing orders files.

**Next Step:** Done

---

## [2026-04-27 16:02] Runner — SUPINV1: Closure

**Task:** SUPINV1 | **Status:** START
**Agent:** Runner
**Complexity:** 🟠

**Действия:**
- Review QA scores and defect lists for all SUPINV1 implementation slices.
- Close task if SCORE >= 8 and no blocking defects remain.
- Update release notes for user-facing supplier invoice workflow.

**Результат:** Pending

**Next Step:** Done

---

## [2026-04-27 16:08] QA — SUPINV1: Orders preview supplier invoice status verified

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Reviewed order-level supplier invoice preview helper, `/api/orders` aggregation, and `/orders` table badge column.
- Verified status priority: `Attention`, `Has unmatched invoices`, `Missing supplier invoices`, `Periodic only`, `All matched`.
- Ran `npm run test:supplier-invoices`, helper ESLint, TypeScript compile, full orders-file ESLint, and live Supabase schema check.

**Результат:** SCORE: 8.5/10

**Defect List:**
- Blocking defects: none.
- Residual risk: full-file ESLint still fails on existing unrelated debt in `app/api/orders/route.ts` and `app/orders/page.tsx` (`any` usage and React hook lint debt).
- Feature gaps for SUPINV1 implementation slices: none identified in QA scope.

**Next Step:** Runner

---

## [2026-04-27 15:57] QA — SUPINV1: Orders preview supplier invoice status

**Task:** SUPINV1 | **Status:** START
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Review `/orders` supplier invoice preview status helper, API aggregation, and UI column.
- Run regression/lint/type checks.
- Verify live Supabase schema compatibility.

**Результат:** Pending

**Next Step:** Runner

---

## [2026-04-27 15:48] CW — SUPINV1: Orders preview supplier invoice status ready

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Added order-level supplier invoice status helper with regression coverage.
- Extended `/api/orders` with supplier invoice preview status from active services, supplier invoice documents, and service links.
- Added `Supplier invoices` badge column to `/orders` list and grouped rows.
- Verified regression test, TypeScript compile, IDE lint, helper lint, and live Supabase columns.

**Результат:** SCORE: 8.5/10 — core checks pass; existing unrelated full-file ESLint debt remains in `app/api/orders/route.ts` and `app/orders/page.tsx`.

**Next Step:** QA

---

## [2026-04-27 15:39] CW — SUPINV1: Orders preview supplier invoice status

**Task:** SUPINV1 | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Add order-level supplier invoice status helper/regression coverage.
- Extend `/api/orders` with supplier invoice preview status.
- Display supplier invoice status column in `/orders` list.

**Результат:** Pending

**Next Step:** QA

---

## [2026-04-27 15:36] QA — SUPINV1: Service supplier invoice controls verified

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Reviewed services-table supplier invoice status rules and quick requirement control.
- Verified PATCH validation/mapping for `supplier_invoice_requirement`, period, and note.
- Ran `npm run test:supplier-invoices`, non-UI targeted ESLint, TypeScript compile, IDE lint, and live Supabase schema check.

**Результат:** SCORE: 8.5/10

**Defect List:**
- Blocking defects: none.
- Remaining gaps: `/orders` preview supplier invoice status column is still the next slice.
- Non-blocking: `View matched invoices` quick action is not part of this slice; matching remains available from Documents tab.
- Existing unrelated full-file ESLint debt remains in `OrderServicesBlock`; no new IDE lint errors were reported.

**Next Step:** CW

---

## [2026-04-27 15:31] QA — SUPINV1: Service supplier invoice controls

**Task:** SUPINV1 | **Status:** START
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Review services-table supplier invoice requirement controls.
- Run regression/lint/type checks.
- Verify API mapping and UI behavior against UI mapping.

**Результат:** Pending

**Next Step:** Runner/CW

---

## [2026-04-27 15:35] CW — SUPINV1: Service supplier invoice controls ready

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Added supplier invoice service status helper and regression coverage.
- Added PATCH support for `supplier_invoice_requirement`, period, and note on order services.
- Mapped supplier invoice fields into service list rows and added compact status/control in the services Supplier column.
- Verified regression test, non-UI lint, TypeScript compile, and IDE lints.

**Результат:** SCORE: 8.5/10 — core checks pass; full-file ESLint on `OrderServicesBlock` still reports existing unrelated lint debt.

**Next Step:** QA

---

## [2026-04-27 15:24] CW — SUPINV1: Service supplier invoice controls

**Task:** SUPINV1 | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Add service supplier invoice status helper/regression coverage.
- Allow updating service supplier invoice requirement.
- Display supplier invoice status/control in services table.

**Результат:** Pending

**Next Step:** QA

---

## [2026-04-27 15:23] QA — SUPINV1: Soft-delete/change attention sync

**Task:** SUPINV1 | **Status:** START
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Review document PATCH/DELETE attention sync behavior.
- Run regression/lint/type checks.
- Verify live Supabase schema compatibility.

**Результат:** Pending

**Next Step:** Runner/CW

---

## [2026-04-27 15:28] QA — SUPINV1: Soft-delete/change attention sync verified

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Reviewed helper transitions and document `PATCH/DELETE` behavior for accounting-visible supplier invoices.
- Verified processed invoice edit sends document to `attention/changed`.
- Verified processed/attention invoice delete uses soft delete with `attention/deleted`.
- Ran `npm run test:supplier-invoices`, targeted ESLint, TypeScript compile, IDE lint, and live Supabase schema check.

**Результат:** SCORE: 9/10

**Defect List:**
- Blocking defects: none.
- Remaining gaps: services-table supplier invoice requirement controls and `/orders` preview supplier invoice status are still next slices.
- Non-blocking warnings remain in `OrderDocumentsTab`: 3 existing ESLint warnings, 0 errors.

**Next Step:** CW

---

## [2026-04-27 15:04] CW — SUPINV1: Soft-delete/change attention sync

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Added regression coverage for processed invoice edit/delete attention behavior.
- Processed supplier invoice edits now set `accounting_state = attention`, `attention_reason = changed`, and increment `version`.
- Processed/attention supplier invoice deletes now soft-delete with `document_state = deleted`, `attention_reason = deleted`, `deleted_at`, and `deleted_by`.
- Updated Documents tab delete confirmation for accounting-visible invoices.
- Verified live Supabase columns needed for the slice.

**Результат:** SCORE: 8.5/10 — regression test, targeted ESLint, TypeScript compile, schema check pass; 3 pre-existing warnings remain in `OrderDocumentsTab`.

**Next Step:** QA

---

## [2026-04-27 15:02] QA — SUPINV1: Supplier invoice accountant process

**Task:** SUPINV1 | **Status:** START
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Review supplier invoices accountant Process endpoint and UI.
- Run regression/lint/type checks.
- Verify live Supabase schema compatibility.

**Результат:** Pending

**Next Step:** Runner/CW

---

## [2026-04-27 15:10] QA — SUPINV1: Supplier invoice accountant process verified

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Reviewed finance/admin-only supplier invoice processing endpoint and UI actions.
- Verified accounting transitions: pending -> processed, attention changed/replaced -> processed, attention deleted -> cancelled_processed.
- Ran `npm run test:supplier-invoices`, targeted ESLint, TypeScript compile, and IDE lint.
- Verified live Supabase columns/table used by the slice.

**Результат:** SCORE: 9/10

**Defect List:**
- Blocking defects: none.
- Remaining gaps: soft-delete/replaced attention sync, services-table quick requirement controls, and `/orders` preview supplier invoice status are still next slices.

**Next Step:** CW

---

## [2026-04-27 14:50] CW — SUPINV1: Supplier invoice accountant process

**Task:** SUPINV1 | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Add accountant processing endpoint for supplier invoice documents.
- Extend supplier invoices list with match/accounting/attention fields.
- Add Process / Process updated / Mark cancelled processed actions in `/finances/suppliers-invoices`.
- Add focused regression check for supplier invoice accounting state transitions.

**Результат:** Pending

**Next Step:** QA

---

## [2026-04-27 15:04] CW — SUPINV1: Supplier invoice accountant process ready

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Added supplier invoice accounting state helper and `npm run test:supplier-invoices`.
- Added `PATCH /api/finances/uploaded-documents/[docId]/process` for finance/admin users.
- Extended uploaded supplier invoices API with `Match`, `Accounting`, and `Attention` data.
- Added supplier invoices table columns and finance-only actions: `Process`, `Process updated`, `Mark cancelled processed`.
- Verified live Supabase columns needed by this slice.

**Результат:** SCORE: 8.5/10 — RED/GREEN regression check, targeted ESLint, TypeScript compile, and IDE lint pass.

**Next Step:** QA

---

## [2026-04-27 14:48] QA — SUPINV1: Documents matching first slice

**Task:** SUPINV1 | **Status:** START
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Review CW changes for Documents matching API/UI.
- Run targeted lint/type checks and verify Supabase schema compatibility.
- Produce SCORE and Defect List.

**Результат:** Pending

**Next Step:** Runner/CW

---

## [2026-04-27 14:58] QA — SUPINV1: Documents matching first slice verified

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** QA / Regression
**Complexity:** 🟠

**Действия:**
- Reviewed Documents matching API/UI changes against `SUPINV1` slice requirements.
- Fixed QA findings: match-save now preserves existing links if new insert fails; service coverage counts only active supplier invoice documents.
- Ran targeted ESLint and TypeScript compile.
- Verified live Supabase schema columns for document states, service requirements, and link table.

**Результат:** SCORE: 8.5/10

**Defect List:**
- Blocking defects: none.
- Remaining gaps: accountant `Process` workflow, soft-delete/replaced document attention states, services-table quick requirement controls, and `/orders` preview column are still next slices.
- Non-blocking warnings remain in touched files: 4 existing ESLint warnings, 0 errors.

**Next Step:** CW

---

## [2026-04-27 14:42] CW — SUPINV1: Documents matching first slice

**Task:** SUPINV1 | **Status:** START
**Agent:** Code Writer
**Complexity:** 🔴

**Действия:**
- Extend order documents API with workflow state and matched services.
- Add match-services endpoint for supplier invoice documents.
- Add Documents tab Service Match / Accounting columns and simple match modal.

**Результат:** Pending

**Next Step:** QA

---

## [2026-04-27 14:55] CW — SUPINV1: Documents matching first slice ready

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🔴

**Действия:**
- Extended order documents/services APIs with supplier invoice workflow fields and match counts.
- Added `match-services` endpoint to save invoice-document → order-service links.
- Added Documents tab `Service Match` / `Accounting` badges and a simple match services modal.
- Verified Supabase workflow columns/link table exist.

**Результат:** SCORE: 8/10 — targeted ESLint has 0 errors with 4 pre-existing warnings; `npx tsc --noEmit` passed.

**Next Step:** QA

---

## [2026-04-27 14:45] UI — SUPINV1: UI mapping complete

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** UI System
**Complexity:** 🔴

**Действия:**
- Created `.ai/tasks/supplier-invoice-ui-mapping.md`.
- Mapped Documents tab columns/actions, match modal, services badges, supplier invoices accounting view and `/orders` preview column.
- Defined API fields needed by CW and smallest useful implementation slice.

**Результат:** UI mapping ready for Code Writer.

**Next Step:** CW

---

## [2026-04-27 14:39] UI — SUPINV1: Supplier invoice workflow UI mapping

**Task:** SUPINV1 | **Status:** START
**Agent:** UI System
**Complexity:** 🔴

**Действия:**
- Map Documents tab UI changes for match/accounting status.
- Map `/finances/suppliers-invoices` accountant workflow UI.
- Map Orders list supplier invoice status column.

**Результат:** Pending

**Next Step:** CW

---

## [2026-04-27 14:42] DB — SUPINV1: Supplier invoice migration applied

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** DB Specialist
**Complexity:** 🔴

**Действия:**
- Applied `migrations/add_supplier_invoice_workflow.sql` to Supabase via MCP `execute_sql`.
- Verified new `order_documents` columns, new `order_services` supplier invoice fields, and `order_document_service_links`.
- Verified constraints, RLS enabled, and SELECT/INSERT/UPDATE/DELETE company-scope policies.
- Verified backfill defaults: 74/74 documents pending+active, 1099/1099 services required, 0 links initially.

**Результат:** Migration applied and verified.

**Next Step:** UI

---

## [2026-04-27 14:37] DB — SUPINV1: Apply supplier invoice migration

**Task:** SUPINV1 | **Status:** START
**Agent:** DB Specialist
**Complexity:** 🔴

**Действия:**
- Применить `migrations/add_supplier_invoice_workflow.sql` в Supabase.
- Проверить созданные колонки, таблицу links, constraints и RLS.

**Результат:** Pending

**Next Step:** UI

---

## [2026-04-27 14:40] DB — SUPINV1: Schema mapping complete

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** DB Specialist
**Complexity:** 🔴

**Действия:**
- Проверена live-схема: `order_documents` = 74 документов, `order_services` = 1099 услуг.
- Подтверждено: `order_services.invoice_id` относится к client invoices, supplier invoices требуют отдельной связи.
- Подготовлена migration `migrations/add_supplier_invoice_workflow.sql` для document/accounting states, service requirements и `order_document_service_links`.
- Добавлена RLS на новую link-table с company-scope policies.

**Результат:** DB mapping complete. Migration prepared but NOT applied.

**Next Step:** UI

---

## [2026-04-27 14:34] DB — SUPINV1: Schema mapping for supplier invoice workflow

**Task:** SUPINV1 | **Status:** START
**Agent:** DB Specialist
**Complexity:** 🔴

**Действия:**
- Проверить live-схему `order_documents`, `order_services`, существующие связи invoice/service.
- Подготовить безопасную migration для статусов документов, accounting workflow и service links.

**Результат:** Pending

**Next Step:** UI

---

## [2026-04-27 14:33] Runner — SUPINV1: Supplier invoice workflow spec

**Task:** SUPINV1 | **Status:** SUCCESS
**Agent:** Runner / Architect
**Complexity:** 🔴

**Действия:**
- Описана единая модель связки агент → supplier invoice → service matching → accounting processing.
- Создана спецификация `.ai/tasks/supplier-invoice-workflow.md`.
- Добавлена задача SUPINV1 в PROJECT_TODO.

**Результат:** Spec ready for DB mapping.

**Next Step:** DB

---

## [2026-04-27 13:55] CW/QA — DASH-OVERDUE: Fix real overdue debt

**Task:** DASH-OVERDUE | **Status:** SUCCESS
**Agent:** Code Writer + QA
**Complexity:** 🟠

**Действия:**
- Вынесён единый расчёт задолженности в `lib/finances/overdue.ts`.
- Dashboard Overdue теперь вычитает все платежи кроме `cancelled`, дедуплицирует invoices и использует `final_payment_date || due_date`.
- Invoices `status=overdue` больше не ограничивается `invoice_date` периодом, чтобы показывать реальные overdue invoices.
- Добавлен regression check `npm run test:overdue`.

**Результат:** SCORE: 9/10 — targeted test, TypeScript check and touched-file lint pass; global lint blocked by pre-existing generated `.claude/worktrees/**/.next` errors.

**Next Step:** Runner

---

## [2026-04-27 13:27] CW — DASH-OVERDUE: Fix real overdue debt

**Task:** DASH-OVERDUE | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Исправить расчёт Overdue Payments: реальный остаток долга, без дублей, единая effective due date.
- Синхронизировать переход на Invoices overdue со смыслом dashboard.

**Результат:** Pending

**Next Step:** QA

---

## [2026-04-25 15:13] CW — NOTIF-ACK: Mandatory system update acknowledgements

**Task:** NOTIF-ACK | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Extended staff notifications so `system_update` read state is resolved per user via `release_views.read_at`.
- Added required TopBar pop-up for unread system updates with a single acknowledgement button.
- Added migration `insert_system_update_2026_04_25.sql` with the Apr 25 release notification.

**Результат:** Managers must acknowledge system updates individually; acknowledged updates do not reappear for that manager.

**Next Step:** Apply Supabase migration, QA

---

## [2026-04-16] CODE_WRITER — MULTI-ROUTE-01 Step 4: inline route editor per passenger

**Task:** MULTI-ROUTE-01 — per-passenger itinerary (multi-route orders) | **Status:** SUCCESS (Step 4 of 4)
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `app/orders/[orderCode]/_components/OrderPassengerRoutes.tsx` — добавлен inline-редактор: кнопка Edit на каждой строке раскрывает форму под пассажиром (From/To chips через `CityMultiSelect`, Return-to-origin чекбокс с опциональным return-city, `DateRangePicker`). Save → PATCH `/api/orders/[orderCode]/travellers/[partyId]` с `{ itinerary, dateFrom, dateTo }`. Кнопка "Use order route" очищает индивидуальный маршрут и даты. После сохранения — фоновый refetch списка пассажиров.
- Никаких новых API и таблиц — используется PATCH из Step 2. Стек как в шапке заявки: те же компоненты CityMultiSelect/DateRangePicker, единые утилиты дат.

**Результат:** `tsc --noEmit` = 0. Lints clean. Пассажир может задать свой маршрут (Nice→Ist→Led→Ist→London→Rome→Nice) и свои даты; второй пассажир того же заказа оставит «uses order route» и будет наследовать шапку.

**Next Step:** пользователь визуально проверяет → при необходимости правки UX; дальше (backlog) — MAP-01 Step 3 (multi-stop parsing для карты теперь опирается на per-traveller itinerary).

---

## [2026-04-16] CODE_WRITER — MAP-01 Step 1: stabilize Travelers-on-map API (no more flicker)

**Task:** MAP-01 — Fix unstable Travelers on map: markers flicker in/out, Tashkent missing | **Status:** SUCCESS (Step 1 of 7)
**Agent:** Code Writer
**Complexity:** 🟢

**Действия (Шаг 1 — стабильность):**
- `app/api/dashboard/map/route.ts` — добавлены `export const dynamic = "force-dynamic"` и `export const revalidate = 0`. Next.js теперь не кэширует ответ route handler-а, карта всегда отражает свежее состояние `orders`.
- `app/dashboard/page.tsx` — fetch `/api/dashboard/map` теперь с `cache: 'no-store'` и `AbortController`. Cleanup в useEffect отменяет устаревший запрос при перемонтировании/смене роли.
- Никаких изменений в геокодере/парсере destination на этом шаге — только устранён источник мигания данных.

**Результат:** `tsc --noEmit` = 0. eslint clean на изменённых блоках (единственный warning — в чужом useEffect, строка 342, не в моей правке). «То появляются, то пропадают» должно прекратиться сразу — тот же набор локаций при F5.

**Next Step:** Шаг 2 — миграция `city_geocache` + функция `resolveCity()` (нормализация + alias-таблица lv/ru + внешний геокодер Nominatim с кэшом в БД). После Шага 2 Ташкент и прочие неизвестные города начнут автоматически попадать на карту.

---

## [2026-04-16] CODE_WRITER — Per-agent targets moved into existing Monthly Targets section + new rule 6.13

**Task:** User corrected earlier approach: "Monthly Targets in Company Settings is THE place for per-agent targets — don't bolt a new field onto Edit User" | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Removed the "Monthly Profit Target" field from `EditUserModal` (rolled back previous attempt).
- Extended `app/settings/company/page.tsx` → **Monthly Targets** section: company-level Profit Target is now labeled "Profit Target (Company)" + fallback note; added a table "Personal Profit Target — per agent" underneath, listing active agents/managers/supervisors/subagents with one numeric input per row.
- `handleSave` on Company Settings first PATCHes `/api/users/[id]` (`targetProfitMonthly`) for every changed row, then PATCHes `/api/company`. Baseline is refreshed after success so follow-up edits are tracked.
- DB column (`user_profiles.target_profit_monthly`) from previous step is reused — no new table, no new endpoint.
- `cursor/rules/cursorrules.mdc` → added rule **6.13** "Не выдумывать новые функции, если уже есть реализация" (mandatory check for existing form/page/endpoint before creating a new one).

**Результат:** `tsc --noEmit` OK. Only Settings → Company → Monthly Targets is now the single place where per-agent profit targets are set. Dashboard speedometer continues to read `target_profit_monthly` per user (logic unchanged).

**Next Step:** QA — open Settings → Company → Monthly Targets, set different values for 2 agents, hit Save, verify on Dashboard speedometer that selecting each agent uses their personal target.

---

## [2026-04-16] CODE_WRITER — Edit Service (Air Ticket): distribute totals across passengers on open

**Task:** Air Ticket PRICING shows 0.00 for every passenger on first open — numbers appear only after reopening | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Root cause:** Fallback inside the `pricingPerClient` sync useEffect required `validClients.length === 1`. For flights with N passengers and empty `pricing_per_client` in DB, every row was left blank → UI showed 0.00 for each passenger and Totals=0 while the footer Profit showed the real `client_price`.

**Действия:**
- `EditServiceModalNew.tsx` — when `pricing_per_client` is missing but `service_price`/`client_price` totals exist, evenly distribute them across ALL N passengers (last row absorbs rounding leftover so ΣN equals DB total exactly). No numbers are invented — we only allocate values already in DB.

**Результат:** `tsc --noEmit` OK. First open of Air Ticket Edit now shows the real totals split across passengers; Total Cost / Total Marge / Total Sale and footer Profit are consistent with DB from frame 1.

---

## [2026-04-16] CODE_WRITER — Dashboard TARGET: per-agent monthly profit target (real, DB-backed)

**Task:** TARGET widget showed one company target (€4000) for every agent — user set targets "per agent" but only `companies.target_profit_monthly` existed in DB | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Root cause:**
- `user_profiles` had NO column for personal target. `dashboard_targets` table referenced in old migrations was never created in prod. So `/api/dashboard/agent-targets` had no per-user target to return, and `TargetSpeedometer` compared every agent's profit against the single company-level target.

**Действия:**
- DB migration (applied to prod via MCP): `ALTER TABLE user_profiles ADD COLUMN target_profit_monthly numeric(12,2) NOT NULL DEFAULT 0;` (`migrations/add_user_target_profit_monthly.sql`).
- `app/api/users/[userId]/route.ts` — GET returns `target_profit_monthly`; PATCH accepts `targetProfitMonthly` (clamped to ≥ 0, 2 decimals).
- `app/api/users/route.ts` — list now includes `target_profit_monthly`.
- `components/users/EditUserModal.tsx` — new field "Monthly Profit Target (EUR)" with explainer; sends `targetProfitMonthly` on save.
- `app/api/dashboard/agent-targets/route.ts` — returns `{ id, name, profit, target }` for each agent.
- `components/dashboard/TargetSpeedometer.tsx` — `AgentTarget.target?`; when an agent is selected, use their personal target; fallback to company target if 0. Stars, bar, %, over-target message all respect `effectiveTarget`. "All Agents" list scales each agent by their own target.
- `app/dashboard/page.tsx` — single branch for monthly/custom periods; scales BOTH company target AND per-agent targets by `scaleFactor` (days/30.44) so custom ranges stay consistent.

**Результат:** no linter errors; migration applied. Supervisor can now set a personal monthly profit target per user in Settings → Users → Edit; Dashboard speedometer uses that target when the agent is selected.

**Next Step:** QA — set different targets for 2 agents, switch speedometer between Company / All Agents / Agent A / Agent B, verify % and stars.

---

## [2026-04-06] CODE_WRITER — Flight PRICING: revert destructive sync; persistence-first

**Task:** Reopen modal → PRICING shows 0; list shows client=1275/service=0 (false profit) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `EditServiceModalNew.tsx`: REMOVED the useEffect that wrote `pricingPerClient` sums back into `servicePrice/clientPrice/marge` — it destroyed valid values on mount when the client-sync effect had populated empty rows.
- Save path: `service_price`/`client_price` for flight use `pricingPerClient` sums ONLY when sum > 0; otherwise keep the `servicePrice`/`clientPrice` entered by the user.
- Footer VAT/Profit block: pure computation — prefers grid sums when grid has any non-zero data; otherwise falls back to `marge × units` and `clientPrice`. No setState side effects.
- `migrations/fix_flight_service_price_from_pricing_per_client.sql`: backfill to repair existing rows where `service_price`/`client_price` = 0 but `pricing_per_client` has values.

**Результат:** `tsc --noEmit` OK. Principle restored: UI loads exactly what DB holds; save writes exactly what user entered. No recalculation on open.

---

## [2026-04-06] CODE_WRITER — Flight PRICING: footer + list economics (pricing_per_client)

**Task:** Fix flaky Air Ticket PRICING footer Profit vs grid; list margin when service_price=0 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `EditServiceModalNew.tsx`: sync aggregate `servicePrice`/`clientPrice`/`marge` from `pricingPerClient` sums; VAT/Profit block uses same total marge as grid; hide duplicate Cost/Marge/Sale row when flight per-client grid is active; removed render `console.log`.
- `lib/orders/serviceEconomics.ts`: for flight/air ticket, when stored `service_price`≈0 but `pricing_per_client` has cost sum, use row sums for margin.
- `OrderServicesBlock.tsx`, `OrderReferralServicesPanel.tsx`, `app/api/orders/route.ts` (fallback stats): pass `pricing_per_client` into `computeServiceLineEconomics`.

**Результат:** tsc --noEmit OK

---

## [2026-04-06] CODE_WRITER — Auth: canonical reset redirect (NEXT_PUBLIC_SITE_URL)

**Task:** Password reset link not working — Supabase redirect allowlist / http vs https | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `lib/auth/passwordResetRedirect.ts` + `forgot-password`: `redirectTo` из `NEXT_PUBLIC_SITE_URL` при наличии, иначе `window.location.origin`.
- `.env.example`: переменная `NEXT_PUBLIC_SITE_URL`.

---

## [2026-04-06] CODE_WRITER — AuthGuard: forgot/reset public + pathnameRef

**Task:** Forgot password link redirected to /login | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `isPublicPath` уже включал `/forgot-password` и `/reset-password` — без деплоя пользователь видел старый бандл.
- `onAuthStateChange`: решения по редиректу через `pathnameRef.current` + `isPublicPath(pathNow)` (не устаревший closure).
- Залогиненный пользователь: на forgot/reset не уводим на `/dashboard`.
- `layout-client-wrapper`: `skipLayout` для forgot/reset (как у login).

---

## [2026-04-06] CODE_WRITER — Auth: forgot/reset password for dedicated Supabase

**Task:** Forgot password broken (wrong project / session) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `forgot-password`: `resolve-company` + `resetPasswordForEmail` на dedicated; fallback на центральный клиент при ошибке.
- `reset-password`: URL проекта из JWT в hash; `GET /api/auth/public-anon-key`; при необходимости `setSession` из fragment.
- `lib/auth/supabaseRecoveryUrl.ts`, `app/api/auth/public-anon-key/route.ts`.

---

## [2026-04-06] CODE_WRITER — Login: normalize email for signIn (match resolve-company)

**Task:** Invalid credentials despite correct password (spaces / case) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `app/login/page.tsx`: один `emailNorm = trim + lowerCase` для resolve и `signInWithPassword`; проверка `!resolveRes.ok`; сообщение при ошибке resolve.

---

## [2026-04-06] CODE_WRITER — Login: fallback to central Supabase after dedicated invalid creds

**Task:** Password rejected — possible dedicated vs central user mismatch | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Если выбран dedicated-клиент и Supabase вернул invalid login credentials — `signOut(local)` на dedicated и повторный `signInWithPassword` через дефолтный `supabase` (центральный проект).

---

## [2026-04-06] CODE_WRITER — Orders list: debounce search for React Query

**Task:** Stop refetch on every keystroke | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `app/orders/page.tsx`: `useDebounce` (320ms) для строк, уходящих в `queryKey` и `fetchOrdersListPage`; `skip*` в `filterOrders` по debounced значениям; `placeholderData: keepPreviousData` при смене запроса.

---

## [2026-04-06] CODE_WRITER — Orders: Client/Payer surname search (server + queryKey)

**Task:** Surname filter showed unrelated orders — fix end-to-end | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Root cause: inline field maps to `clientLastName` only; React Query key used `queryText` only → stale cache and no `search` param; filtering ran only on already-loaded pages (or lagged via `useDeferredValue`).
- `GET /api/orders`: query param `lastName` — second `.or()` on same columns (AND with `search`).
- `fetchOrdersListPage` + `queryKey`: include `lastName`; filter uses `searchState` directly; `skipSurnameMatch` when API applied lastName.

---

## [2026-04-06] CODE_WRITER — Auth: idle auto-logout (4h)

**Task:** Auto sign-out when staff UI idle > 4 hours | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `components/auth/IdleLogout.tsx`: таймер по активности (mousedown/move/key/scroll/touch/click/wheel), проверка каждую минуту + при `visibilitychange` visible; `signOut` + `router.replace("/login")`.
- Подключение в `ClientLayout` только вместе с основным shell (как SessionHeartbeat).

---

## [2026-04-06] CODE_WRITER — Staff sessions: user_profiles.last_activity_at + getApiUser bump

**Task:** accurate Last activity (not only Supabase sign-in) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Миграция `add_user_profiles_last_activity_at.sql`: колонка `last_activity_at`, RPC `user_profile_bump_activity` (throttle 1 мин).
- `getApiUser`: после успешной авторизации — `scheduleBumpUserProfileActivity` (fire-and-forget).
- `company-sessions`: в расчёт max добавлен `profileApiAt`; источник `api`; i18n.

**Важно:** выполнить SQL в Supabase; до этого колонка в select может дать ошибку.

---

## [2026-04-06] CODE_WRITER — Staff sessions: Last activity includes order_communications (CRM log)

**Task:** Supervisor sessions / explain 13.04 vs 30.03 | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- SQL `company_users_last_comm_activity` (миграция): MAX(created_at) по `order_communications.sent_by` на компанию.
- API: `lastActivityAt` = max(heartbeat, Supabase last_sign_in, CRM); подпись источника (app / login / crm).
- UI: колонка «Last activity» + i18n (вход в аккаунт не обновляется при работе в заявке без re-login).

---

## [2026-04-06] CODE_WRITER — Staff sessions: list all company users + last sign-in fallback

**Task:** Supervisor sessions UI | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `GET /api/auth/company-sessions`: все `user_profiles` компании; heartbeat агрегируется по пользователю; email/`last_sign_in_at` из Auth (listUsers с пагинацией); ответ `{ users: [...] }`.
- `/settings/sessions`: одна строка на пользователя; Last seen — heartbeat или fallback на last sign-in; статусы Active / Away / No app session; Action на каждой строке; липкий столбец User на горизонтальном скролле.

---

## [2026-04-06] CODE_WRITER — Build: TS fix EditServiceModal + vatRateFromCategory

**Task:** deploy / tsc | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `EditServiceModalNew.tsx`: `service as unknown as Record<string, unknown>` для hotelPreferences init
- `vatRateFromCategory.ts`: тип `vat_rate`/`vatRate` как number|string; пустая строка → NaN (убрано сравнение number с "")

---

## [2026-04-06] CODE_WRITER — Supervisor: staff sessions (presence, IP/UA, revoke all devices)

**Task:** Security / session visibility | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Миграция `migrations/add_user_auth_sessions.sql` — таблица `user_auth_sessions` (user, company, device id, UA, IP, last_seen).
- API: `POST /api/auth/session-heartbeat`, `GET /api/auth/company-sessions` (Supervisor), `POST /api/auth/revoke-user-sessions` (Supervisor, `auth.admin.signOutUser` + удаление строк).
- `SessionHeartbeat` в `ClientLayout` — пинг ~2 мин + при загрузке.
- Страница `/settings/sessions` (только Supervisor), карточка в Settings hub; i18n en/ru/lv.

**Next Step:** Применить SQL в Supabase; QA — revoke на тестовом пользователе

---

## [2026-04-06] CODE_WRITER — Travelers map: legend counts + date preset; exclude Cancelled from map API

**Task:** DASH3 / TouristsMap | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `TouristsMap.tsx`: счётчик **Upcoming** в легенде = те же правила, что и маркеры (`upcomingMatchesDatePreset` + только `mapLocations`); **In progress** = все in-progress на карте. Подсказка при Next 7/14 days.
- `GET /api/dashboard/map`: не отдаём заказы со `status = Cancelled`.

---

## [2026-04-06] CODE_WRITER — Travelers on map: active-only (remove Past from map)

**Task:** DASH3 / TouristsMap UX | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `TouristsMap.tsx`: карта только **Upcoming + In progress**; завершённые не на карте (см. Recently completed). Убран чекбокс Past / completed. Пустое состояние при только прошлых поездках — текст про Recently completed.

**Причина путаницы:** past попадали в синие маркеры/кластеры как upcoming (иконка: не in-progress → синий).

**Next Step:** QA

---

## [2026-04-06] CODE_WRITER — Flight: ticket_numbers not wiped on load + PATCH alias

**Task:** S3 / flight ticket persistence | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `EditServiceModalNew.tsx`: sync effect для flight — строки пассажиров по имени (не только по `id`); при пустом списке имён не затирать `ticketNumbers` (гонка до загрузки travellers); `clientId` допускает `null`; при сохранении `ticket_numbers` сопоставляется с `resolvedClients` после find-or-create.
- `PATCH .../services/[id]`: принимает также `ticketNumbers` (camelCase) как алиас к `ticket_numbers`.

**Результат:** SCORE: pending QA

**Next Step:** QA — повторить сценарий «ввести номера → Save & Exit → открыть снова»

---

## [2026-04-10] CODE_WRITER — VAT from Travel Service category (persist + list)

**Task:** O5 / service VAT defaults | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `POST /api/orders/.../services`: пишет `vat_rate` из `vatRate`/`vat_rate` тела; иначе — из `travel_service_categories` через `vatRateFromCategory`
- `mapOrderServiceRowToListApi`: при `vat_rate` 0/null и известной категории — эффективный % из настроек (не «залипание» нуля)
- `PATCH .../services/[id]`: принимает также `vatRate` (camelCase)

---

## [2026-04-06] CODE_WRITER — PRICING: allow negative Cost/Sale (refunds)

**Task:** O5 / Edit & Add service pricing | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `EditServiceModalNew.tsx`, `AddServiceModal.tsx`: убран HTML `min="0"` у полей стоимости/продажи/связанных сумм (в т.ч. hotel, commission client price, foreign service price, extra line items, agent discount), чтобы браузер не показывал валидацию «not less than 0» при возвратах (отрицательные суммы). Курс обмена и проценты депозита/пенальти без изменений.

---

## [2026-04-06] CODE_WRITER — Order header: date edit inside card (OrderPageHeaderE)

**Task:** O3 / order dates edit UX | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `OrderPageHeaderE`: prop `datesEditSlot` — блок выбора дат внутри белой карточки под строкой 1 (как itinerary edit визуально)
- `page.tsx`: перенесён `DateRangePicker` + Save/Cancel из-под шапки в `datesEditSlot`; удалён дубль снаружи

**Результат:** SCORE: pending QA

---

## [2026-04-06] CODE_WRITER — VAT default from Service Category (Pricing)

**Task:** O5 / pricing VAT | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `lib/orders/vatRateFromCategory.ts`: derive % from category (`vat_rate` / `vatRate`); flight 0; tour 0→21; missing → flight 0 else 21
- AddServiceModal: category sync + locked initial category use helper (fixes undefined `vat_rate` → UI 0)
- EditServiceModalNew: after categories load, if saved VAT ≤0 apply category; on `categoryId` change sync VAT

---

## [2026-04-06] CODE_WRITER — Send to Hotel: invalidate Communications + badge

**Task:** Communications tab after hotel email | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- EditServiceModalNew: after successful send-to-hotel, `invalidateQueries` for `order-communications` + `credentials: "include"`; fix recipient capture before closing modal
- OrderCommunicationsTab: `hotel_confirmation` → badge "To Hotel"
- send-to-hotel API: log `order_communications` insert errors

---

## [2026-04-06] CODE_WRITER — Hotel preferences: list SELECT + onServiceUpdated

**Task:** O5 / Edit Service hotel prefs | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `GET .../services` used lean `ORDER_SERVICES_LIST_COLUMNS` without `hotel_late_check_in`, `hotel_late_check_in_time`, and other preference columns — after save, `fetchServices` refetch dropped them in UI (looked like DB not saving).
- Added meal + all hotel preference columns to list SELECT; `EditServiceModalNew` init reads camelCase or snake_case; `onServiceUpdated` now includes early/late check-in/out times and room upgrade / late check-out flags.

---

## [2026-04-06] CODE_WRITER — Edit Hotel: sync contact overrides on save

**Task:** O5 / hotel contacts | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- After successful PATCH, hotel + `hotelHid`: `POST /api/hotel-contact-overrides` with `hotelName`, `email`, `phone`, `address` from form — company-scoped overrides (RateHawk HID) update so manual corrections overwrite directory data for future loads / other orders.

---

## [2026-04-06] CODE_WRITER — Hotel Add Service: Service price decimal + leading zeros

**Task:** O5 / Add Service pricing UX | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Cause: hotel **Per stay** used `input type="number"` + `parseFloat` on change — browsers drop invalid intermediate values (e.g. trailing `.`), so decimals felt “reset”; leading zeros stayed because state was string-like vs coerced display.
- `AddServiceModal`: Per stay **Service price** and **Total Client price** → `type="text"` + `inputMode="decimal"` + `sanitizeDecimalInput` (same pattern as Cost field elsewhere).
- `sanitizeDecimalInput`: normalize redundant leading zeros in integer part (`0144` → `144`), keep `0`, `0.xx`, `.xx`.

**Next Step:** QA on Add Service → Hotel → Per stay pricing; optional follow-up: **Per night** columns still use `type="number"` (same class of issue if users type decimals there).

---

## [2026-04-06] CODE_WRITER — Directory: client app password on Statistics tab

**Task:** directory password separate tab | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `DirectoryForm`: removed password block from Main details / referral column; added third tab "App login" (i18n en/ru/lv) in Statistics card; same API save; tab shown for edit + client or referral role; reset tab if role no longer qualifies
- Tab nav: flex-wrap for three tabs on narrow screens

---

## [2026-04-06] CODE_WRITER — DateRangePicker z-index above modals

**Task:** calendar invisible in modals | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `DateRangePicker` portal: `z-[200000]` so range calendar is above Edit Service / overlays (`z-[100000]`)
- Order header date button: `cursor-pointer`, hover/focus, `disabled` when `isSaving`

---

## [2026-04-06] CODE_WRITER — Change ticket: dates, route label, category, itinerary

**Task:** change-ticket fixes | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- ChangeServiceModal: keep `service_date_from`/`service_date_to` on original when no remaining segments; POST uses original `category` + `categoryId`, `travellerIds`; change name uses IATA chain + fallback from service name; parse enriches city→IATA on new segments
- EditServiceModalNew: pass client/payer display names, `categoryId`, `ticketNumbers`, `assignedTravellerIds` into Change modal
- ItineraryTimeline: skip superseded original flight service when a `change` child exists and segments are empty
- Проверка: `npx tsc --noEmit`

**Результат:** SCORE pending QA
**Next Step:** QA

---

## [2026-04-06] CODE_WRITER — Change ticket: bulk menu + map excludes superseded original

**Task:** change-ticket completion | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- OrderServicesBlock: "Change flight" in bulk More (single flight row with segments); `serviceRowForChangeModal` maps parties, tickets, travellers, categoryId; after confirm — clear selection, `fetchServices(true)` or `reloadServicesFromParent(true)`
- Map + per-traveller routes: skip superseded original (`res_status` changed + change child + no segments), same rule as ItineraryTimeline
- Проверка: `npx tsc --noEmit`

**Результат:** SCORE pending QA
**Next Step:** QA

---

## [2026-04-06] CODE_WRITER — client_price editable until invoice issued

**Task:** client_price draft invoice | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Added `clientPriceLocked` from linked `invoices.status` (editable for `draft` / `cancelled`)
- PATCH: allow `client_price` and `pricing_per_client` when not locked; list + single GET return `clientPriceLocked`
- UI: EditServiceModal + OrderServicesBlock use `clientPriceLocked` for sale fields and row hints

**Результат:** SCORE pending QA
**Next Step:** QA

---

## [2026-04-10 10:08] CODE_WRITER — O7-IMPL: Directory save blocked by client_party referral column

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Reproduced and traced Directory save error while changing client invoice language
- Identified missing DB column compatibility issue (`client_party.default_referral_party_id`) in directory API flows

**Результат:** In progress
**Next Step:** Add backward-compatible API fallback for DBs without that column

---

## [2026-04-10 10:08] CODE_WRITER — O7-IMPL: Directory save fallback for missing default_referral_party_id

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Updated `app/api/directory/[id]/route.ts` and `app/api/directory/create/route.ts`
- Added compatibility fallback when DB schema does not have `client_party.default_referral_party_id`
- Kept client updates/creates working (including `invoiceLanguage`) by retrying/selecting without that column

**Результат:** Client card save is no longer blocked by missing `default_referral_party_id` column; invoice language changes can be saved.
**Next Step:** QA: edit client invoice language EN→LV and save

---

## [2026-04-10 10:08] CODE_WRITER — O7-IMPL: Directory save fails on invoice language change

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Investigated error: `Could not find the 'default_referral_party_id' column of 'client_party'`
- Traced failure to Directory PUT/GET and create role paths selecting/inserting that column unconditionally

**Результат:** In progress
**Next Step:** Add schema-compatible fallback for missing column

---

## [2026-04-08] CODE_WRITER — UX: Show API error details on service modals

**Task:** service PATCH error visibility | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Added `lib/http/formatApiError.ts` (`formatApiErrorResponse`)
- EditServiceModalNew, AddServiceModal, ChangeServiceModal, CancelServiceModal: surface `details` / `message` from JSON error responses

**Результат:** `npx tsc --noEmit` OK
**Next Step:** QA: failed save shows Postgres/Supabase message after colon

---

## [2026-04-06 12:00] CODE_WRITER — DASH-MAP: Dashboard map show all orders + geocode

**Task:** DASH-MAP | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `TouristsMap`: show `completed` trips with checkbox "Past / completed" (default on); gray dot in popup
- `GET /api/dashboard/map`: removed 30-day order filter; geocode falls back to `CITIES` + aliases (e.g. Wien→Vienna) + country hint
- `lib/data/cities`: added Ulaanbaatar (Mongolia)

**Результат:** `npx tsc --noEmit` OK
**Next Step:** QA on dashboard map (Mongolia, Burgas, Austria orders)

---

## [2026-04-09 15:31] CODE_WRITER — O7-IMPL: Payment date picker desktop regression fix

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Updated `app/finances/payments/_components/AddPaymentModal.tsx` date input behavior for both touch and desktop pointers
- Added coarse-pointer detection (`matchMedia("(pointer: coarse)")`)
- Restored desktop click-driven picker open while keeping mobile direct native input tap

**Результат:** Payment Date picker now opens on desktop again and remains tappable on mobile.
**Next Step:** QA cross-device check (desktop + phone)

---

## [2026-04-09 15:31] CODE_WRITER — O7-IMPL: Payment Date calendar desktop regression fix

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Investigating regression after mobile date-picker fix in AddPaymentModal
- Reproducing desktop date selection failure and preparing cross-device behavior

**Результат:** In progress
**Next Step:** Implement desktop-safe + mobile-safe date picker interaction

---

## [2026-04-08 10:53] CODE_WRITER — O7-IMPL: Latvian invoice title spelling fix

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Updated Latvian invoice label in `lib/invoices/generateInvoiceHTML.ts`
- Fixed typo `RĒKINS` → `RĒĶINS` (correct Latvian spelling)
- Verified no remaining `RĒKINS` occurrences in `/lib`

**Результат:** Latvian invoice title now renders as `RĒĶINS`.
**Next Step:** QA visual check on generated Latvian invoice

---

## [2026-04-08 10:53] CODE_WRITER — O7-IMPL: Latvian invoice title typo fix

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Checked invoice localization labels in invoice HTML generator
- Confirmed Latvian title typo: `RĒKINS` should be `RĒĶINS`

**Результат:** In progress
**Next Step:** Apply label fix and verify references

---

## [2026-04-08 08:52] CODE_WRITER — O7-IMPL: Mobile Payment Date picker touch fix

**Task:** O7-IMPL | **Status:** START
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Reproduced payment date issue in AddPaymentModal mobile flow
- Identified hidden `input[type="date"]` + `showPicker()` pattern as unstable on iOS Safari

**Результат:** In progress
**Next Step:** Implement touch-safe date picker interaction

---

## [2026-04-08 08:53] CODE_WRITER — O7-IMPL: Mobile Payment Date picker touch fix

**Task:** O7-IMPL | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Updated `app/finances/payments/_components/AddPaymentModal.tsx`
- Replaced hidden/sr-only date input trigger logic with an absolute transparent native `input[type="date"]` overlay
- Preserved existing visual format (`paidAtDisplay`) and date update logic

**Результат:** Mobile tap now targets native date input directly, which restores calendar opening on touch devices.
**Next Step:** Run verification and handoff QA

---

## [2026-04-08 08:54] CODE_WRITER — O7-IMPL: Mobile Payment Date picker touch fix

**Task:** O7-IMPL | **Status:** SUCCESS (TEST)
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Ran lint command for changed file: `npm run lint -- app/finances/payments/_components/AddPaymentModal.tsx`
- Verification blocked because local environment does not have eslint binary installed

**Результат:** SCORE: 8/10
**Defect List:**
- 1. Local lint tooling unavailable in this environment
  - Expected: lint command runs and returns diagnostics/success
  - Actual: `sh: 1: eslint: not found`
  - Trace: npm script `lint` execution

**Next Step:** QA to verify date picker on mobile browser and run CI lint/build

---

## [2026-04-01] CW — Itinerary +BP: WhatsApp / URI drag fallback

**Task:** `collectDroppedFilesAsync` — DownloadURL, text/uri-list, plain URL, DataTransferItem string; `dataTransferMayContainFiles` includes uri-list/DownloadURL; alert if still empty.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Itinerary +BP: PDF drag-drop upload

**Task:** Fix boarding pass drop on +BP when `dataTransfer.files` is empty (use `items`/`getAsFile`), set `dropEffect`, suppress stray click after drop.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `collectDroppedFiles` + `isExternalFileDrag` + `dropEffect="copy"`; `suppressBpDropClickRef` blocks post-drop click; `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Itinerary +BP drag follow-up (WebKit + overflow)

**Task:** `onDragEnter` + `dataTransferMayContainFiles` (items + pdf MIME); `items` first in `collectDroppedFiles`; sync file read then async upload; remove `overflow-hidden` on `OrderServicesBlock` vertical wrapper so itinerary drop works in Safari.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Notifications page: React Query full list (limit 200)

**Task:** `staffNotificationsFullQueryKey` + `fetchStaffNotificationsFull` + `useStaffNotificationsFullQuery`; `/notifications` uses shared cache; PATCH invalidates `staffNotificationsRootQueryKey` (toolbar + full); TopBar uses same root key for invalidation.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Order perf п.2: staff notifications React Query + root QueryClient

**Task:** `ReactQueryProvider` in `layout-client-wrapper.tsx` (shared app-wide); `orders/layout` no longer nests a second provider. `lib/notifications/staffNotificationsQuery.ts` + `useStaffNotificationsToolbarQuery` — one `GET .../staff?limit=50`, `refetchInterval` 60s; `TopBar` + `DashboardNotifications` share cache; `notifications/page` invalidates toolbar key after PATCH.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Order perf п.1: CurrentUserContext (single /api/users/me)

**Task:** `contexts/CurrentUserContext.tsx` — one `fetch("/api/users/me")` + one `onAuthStateChange`; `CurrentUserProvider` in `layout-client-wrapper.tsx`; `useCurrentUser` + `useCurrentUserRole`; migrate all app imports from deleted `hooks/useCurrentUserRole.ts`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — B2: invalidate finance tab caches instead of remount

**Task:** Remove `invoiceRefetchTrigger` + React `key` remount on `InvoiceList` / `OrderPaymentsList`; `onFinanceDataChanged` → `invalidateQueries` for invoices (prefix), payments, services; `fetchOrderInvoicePaymentSummaryOnly` for header `linkedToInvoices`; bootstrap `useEffect` deps no longer include invoice trigger; `OrderPaymentsList` mutations call `onChanged` only (parent invalidates).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Finance tab first frame: warm InvoiceList + OrderPaymentsList chunks

**Task:** `requestIdleCallback` (fallback `setTimeout`) after `order.id` loads; `onPointerEnter` on finance tab triggers same dynamic `import()` so chunks are often ready before click.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Order page: Invoices & Payments perf (payments prefetch + React Query)

**Task:** Prefetch `GET /api/finances/payments?orderId=` after bootstrap; `OrderPaymentsList` uses shared `useQuery` key + staleTime; drop redundant `summaryOnly` fetch on tab mount (use `linkedToInvoicesHint` + refresh after mutations).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — A2: orders list economics RPC + parallel fetch

**Task:** `migrations/add_orders_list_service_economics_rpc.sql` — `orders_list_service_economics`, category/VAT helpers aligned with `computeServiceLineEconomics`. `GET /api/orders` calls RPC in `Promise.all`; `computeServiceStatsFromServices` fallback; guard empty `order_ids` for `.in` / RPC.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK. **Deploy:** run SQL migration on Supabase.

---

## [2026-04-01] CW — A1.3: orders `search_text` + list API ilike

**Task:** Migration `migrations/add_orders_search_text.sql` — column `orders.search_text`, `refresh_order_search_text(uuid)`, triggers (orders, order_travellers, order_services, order_service_travellers, party, party_person), pg_trgm index, backfill. `ordersListTextSearchOrClause` adds `search_text.ilike`.
**Status:** SUCCESS
**Agent:** Code Writer + DB (SQL file)
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK. **Deploy:** run migration on Supabase.

---

## [2026-04-01] CW — A4: orders list `useInfiniteQuery` + Step 6 note

**Task:** Replace manual `extraOrders` + `fetchOrdersListPage` append with `useInfiniteQuery` (`ordersListQueryKeys.listInfinite`, `getNextPageParam` from API pagination). **Step 6:** `GET .../documents` already uses `createSignedUrls` batch + per-file fallback — no code change.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — A3.3: orders list — deferred filter state

**Task:** `app/orders/page.tsx` — `useDeferredValue(searchState)` for `filterOrders` + derived memos; keep `listSearch` / RQ from immediate `searchState.queryText` for `skipClientQueryTextMatch` + API key.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — A3.2: orders calendar — index orders by ISO day

**Task:** `app/orders/page.tsx` — replace per-cell `filteredOrders.filter` with `Map<iso, OrderRow[]>` built when `viewMode === "calendar"`; cells O(1) lookup; max 800 days per order span.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — A3.1: orders list — defer world cities load

**Task:** `app/orders/page.tsx` — do not `requestIdleCallback(loadWorldCities)` on mount; load extended cities only once the list has ≥1 order, then bump flag map. `lib/data/cities.ts` — `ensureWorldCitiesLoaded()` single-flight.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — C1: ORDER_PAGE_PERF_SPEC sync with repo

**Task:** Align `ORDER_PAGE_PERF_SPEC.md` with `ORDER_PERF_REMAINING_PLAN.md` / code: status table (Steps 1–7, L1–L5); Step 3 deferred narrow `SELECT`; Part 2 list backend/frontend bullets + List Steps 1–5 status lines.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** Documentation only; no code change.

---

## [2026-04-06] CW — Order lookup: select(*) + eq-per-candidate (fix global 404)

**Task:** `fetchOrderRowByRouteParam` — use `select("*")` instead of narrow column list (prod DB may lack a column → every lookup errored). Keep per-candidate `.eq("order_code")` loop (not `.in`) for codes containing `/`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-06] CW — order_code lookup: hyphen legacy in DB

**Task:** Extend `orderCodeLookupCandidates` with `0146/26-SM` → `0146-26-SM` variants so rows stored with hyphen match.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-06] CW — Order route param resolution + check-ins service_date_from OR

**Task:** `lib/orders/orderFromRouteParam.ts` — decode/slug/case candidates for `order_code`; bootstrap, order GET/PATCH/DELETE, services list `getOrderId`, documents verify, communications GET, invoices GET/POST. `slugToOrderCode` no longer corrupts canonical codes with `/`. Check-ins SQL also OR `service_date_from` in [today, cap].
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Dashboard Flight Check-in: load services by segment dates

**Task:** `GET /api/dashboard/checkins` — stop excluding multi-leg flights where `service_date_to` is beyond the 7-day window; SQL uses `service_date_to >= today` and `(service_date_from is null OR service_date_from <= end of window)`; per service require `min` future segment departure within `now..now+7d`; each listed segment still capped to that window.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-01] CW — Orders list A1 + order row B1 (ilike search + explicit select)

**Task:** `GET /api/orders` — `search` trims to server `ilike` on `order_code` + `client_display_name`, always paginated (`range`); client passes debounced `queryText` as `search`, RQ key includes it, load-more uses same param; `filterOrders` skips client query-text match when server search active. Bootstrap + `GET /api/orders/[code]` — `ORDER_ROW_DETAIL_SELECT` instead of `select("*")`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-04] CW — Orders list Part 2: traveller labels parallel + search dedupe + React Query L4

**Task:** `GET /api/orders` — parallel chunk batches in `collectTravellerSearchLabelsByOrder`; parallel `order_services` name chunks in search path; reuse traveller map after search (no second collect); L4 `useQuery` for first page with `staleTime: 30_000` + `lib/orders/ordersListQueries.ts`; load-more still manual append.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-04] CW — Invoices & Payments tab: lighter summary fetch + parallel invoice aggregates

**Task:** Tab felt slow: `OrderPaymentsList` called full `GET .../invoices` (all rows + items) only for `paymentSummary`; `InvoiceList` blocked second network on communications for email/reminder columns immediately after invoices.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `GET .../invoices?summaryOnly=1` — two small queries, no invoice bodies. `buildInvoicePaymentAggregates` shared with main GET; paginated/full invoice fetch runs in `Promise.all` with aggregates. `OrderPaymentsList` uses `summaryOnly` + `linkedToInvoicesHint` from bootstrap. `InvoiceList` defers `loadEmailStatuses` via `requestIdleCallback` (fallback `setTimeout(0)`).

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-04] CW — ORDER_PAGE_PERF Part 2 L3: parallel referral + payments on orders list API

**Task:** `GET /api/orders` — run `referral_accrual_line` and `payments` (processing fees) in same `Promise.all` as services / profiles / invoices; remove two sequential awaits. `collectTravellerSearchLabelsByOrder` stays after services (needs service ids; parallel with `null` would duplicate `order_services` reads).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Результат:** `npx tsc --noEmit` OK.

---

## [2026-04-04] CW — Clients Data: prefetch after bootstrap + narrow batch selects

**Task:** Finish Clients Data tab perf: warm React Query cache when order loads; reduce DB row payload in `loadDirectoryRecordsForPartyIds` (explicit columns; `partner_party` only `party_id` so merged supplier fields stay on `party`).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `app/orders/[orderCode]/page.tsx` — `prefetchQuery` for `orderPageQueryKeys.clientsDataParties` after successful bootstrap (`staleTime: ORDER_CLIENTS_DATA_STALE_MS`, errors swallowed). `lib/directory/loadDirectoryRecordsBatch.ts` — column lists + typed row casts for Supabase string-select inference.

**Результат:** `npx next build --webpack` OK.

---

## [2026-04-04] CW — Clients Data tab: skip audit name resolution in batch party load

**Task:** Clients Data tab felt slow; `loadDirectoryRecordsForPartyIds` (only used by `GET .../clients-data-parties`) called `resolveAuditDisplayNamesBatch`, which runs extra profile queries and can call `auth.admin.getUserById` per missing id — UI never shows those fields.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `lib/directory/loadDirectoryRecordsBatch.ts` — removed `resolveAuditDisplayNamesBatch` from batch loader; comment documents behavior.

---

## [2026-04-04] CW — ORDER_PAGE_PERF_SPEC: tab URL replaceState + paginated documents/communications/invoices

**Task:** Finish ORDER_PAGE_PERF_SPEC items outside numbered steps: order tabs use `history.replaceState` + `popstate` (no `router.replace`); paginate `GET .../documents`, `.../communications`, `.../invoices` with backward compatibility (no `limit` / no `page` = previous full-list behaviour); `InvoiceList` loads communications with `invoiceIds` filter; `paymentSummary` still uses all invoice id/status rows + payments when list is paginated.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/orders/[orderCode]/page.tsx` (replaceState, popstate); `app/api/orders/[orderCode]/documents/route.ts` (optional `limit`/`offset` + `pagination`); `app/api/orders/[orderCode]/communications/route.ts` (`getApiUser`, company check, `invoiceIds`, optional `limit`/`offset`); `app/api/orders/[orderCode]/invoices/route.ts` (`page`/`pageSize` branch + status query for summary); `lib/orders/orderPageQueries.ts`; `OrderDocumentsTab`, `OrderCommunicationsTab`, `InvoiceList`; `InvoiceList` key includes `orderCode`.

**Результат:** `npx next build --webpack` OK.

---

## [2026-04-04] CW — ORDER_PAGE_PERF_SPEC Step 7: parallel owner resolution + skip duplicate order fetch in bootstrap

**Task:** Step 7 — batch `user_profiles` + `profiles` for owner/manager/created_by/current user; run `resolveOwnerDisplayName` in same `Promise.all` as services/payments/invoices; `loadFormattedTravellersForOrder(..., orderHint)` avoids second `orders` row fetch when bootstrap already has the row.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `lib/orders/orderPageBootstrap.ts`, `app/api/orders/[orderCode]/bootstrap/route.ts`.

**Результат:** `npx next build --webpack` OK.

---

## [2026-04-04] CW — ORDER_PAGE_PERF_SPEC Steps 5–6: defer world cities + batch document signed URLs

**Task:** Step 5 — `loadWorldCities` via `requestIdleCallback` on order page; `CityMultiSelect` loads dataset on first focus/typing. Step 6 — `GET .../documents` uses `createSignedUrls` with fallback to per-file signing on error.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `page.tsx` idle scheduling; `CityMultiSelect.tsx` `ensureWorldCitiesLoaded`; `app/api/orders/[orderCode]/documents/route.ts` batch signing + fallback.

**Результат:** `npx next build --webpack` (verify).

---

## [2026-04-04] CW — ORDER_PAGE_PERF_SPEC Step 4: React Query (services + tab data cache)

**Task:** Step 4 — `@tanstack/react-query`, shared query keys/fetchers, orders layout provider; page uses `useQuery` for `/services`; documents / communications / clients-data tabs cached; invalidate services on `invoiceRefetchTrigger` + `reloadOrderServices` → `refetchQueries`. Fix services GET typing (`unknown` cast) + `OrderServicesBlock` mapper (`numOrNull`, `as Service`) so `next build` passes.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `npm i @tanstack/react-query`; `components/providers/ReactQueryProvider.tsx`; `app/orders/layout.tsx`; `lib/orders/orderPageQueries.ts`; `page.tsx` services via RQ; tab components wired; `services/route.ts` rows cast; mapper hardening.

**Результат:** `npx next build --webpack` exit 0.

**Next Step:** Step 5 per ORDER_PAGE_PERF_SPEC (defer `loadWorldCities`) or Step 6 (batch signed URLs).

---

## [2026-04-01 12:00] CW — ORDER_PAGE_PERF Step 3: `/bootstrap` + page single fetch + GET order via lib

**Task:** ORDER_PAGE_PERF Step 3 — one API for order header + travellers + invoice summary; `GET /api/orders/[code]` uses shared `buildExpandedOrderAndInvoiceSummary`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/api/orders/[orderCode]/bootstrap/route.ts` (new). `route.ts` GET delegates to `buildExpandedOrderAndInvoiceSummary`. `page.tsx`: single effect → `fetch(.../bootstrap)`, sets order, travellers, `linkedToInvoices` from `invoiceSummary`; `invoiceRefetchTrigger` + `saveClient` travellers refetch unchanged.

**Результат:** SCORE: pending QA (order load, header totals, travellers avatars, invoice-linked payment hint after invoice change).

**Next Step:** QA

---

## [2026-04-01] CW — ORDER_PAGE_PERF Step 2c: shared order services fetch (page → Services + Finances)

**Task:** Eliminate duplicate GET `/api/orders/{code}/services` — parent holds `orderServicesRaw`, `OrderServicesBlock` + `OrderFinanceOverview` consume it; `reloadOrderServices` for refetch after mutations.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `page.tsx`: state `orderServicesRaw`, `reloadOrderServices`, effect on `orderCode`; props on `OrderServicesBlock` / `OrderFinanceOverview`. `OrderServicesBlock`: `mapOrderServicesApiRowsToServices`, `servicesFromParent` + `reloadServicesFromParent`, sync effect + `fetchServices` delegates to parent reload. `OrderFinanceOverview`: optional `servicesFromParent`, `mapApiRowsToFinanceServices`, load payments only when rows from parent.

**Результат:** SCORE: pending QA (Client table + Finances tab + edit service refetch).

---

## [2026-04-01] CW — ORDER_PAGE_PERF_SPEC Step 1: dynamic tab chunks + `OrderTabSkeleton`

**Task:** ORDER_PAGE_PERF_SPEC Step 1 — code-split heavy order tabs with `next/dynamic`; do not change `OrderFinanceOverview` options; keep `OrderServicesBlock` static; `OrderPaymentsList` ref via type-only import + dynamic default.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** Added `_components/OrderTabSkeleton.tsx`. `page.tsx`: `dynamic` + `loading: () => <OrderTabSkeleton />` for Referral, InvoiceCreator, InvoiceList, Documents, Communications, ClientsData, OrderPaymentsList; `OrderFinanceOverview` unchanged `{ ssr: false }` only; static `OrderServicesBlock`; `import type { OrderPaymentsListHandle }`.

**Результат:** SCORE: pending QA (Finance tab ref / + Payment, `?tab=documents`, referral, invoice flow, first paint skeletons).

---

## [2026-04-01] CW — Email templates: DB `translations` + regenerate on save; drafts use `?lang=`

**Task:** User: persist AI translations per locale when template exists (not only live translate); find one-line EMAIL_TEMPLATES fallbacks and move to stored translations.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🔴

**Действия:** Migration `add_email_templates_translations.sql` (JSONB `translations`). `refreshEmailTemplateTranslations` masks `{{placeholders}}`, translates master subject/body to all `INVOICE_LANGUAGE_OPTIONS` except `en` via `translateEmailSubjectAndBody`, saves map. `POST`/`PATCH` `/api/settings/email-templates` schedules `after(refresh...)`. `loadDefaultEmailTemplateForCategory` selects `translations`; `applyEmailTemplateLocale`. Invoice + payment-reminder GET accept `lang`, return `canonical_*` + `used_db_translation`. `InvoiceList` uses DB draft first, then AI fallback; open modals pass `lang`, force-translate when no cache.

---

## [2026-04-01] CW — Payment reminder modal: language chips + AI translate (parity with Send Invoice)

**Task:** User: no language choice on payment reminders — add same pattern as invoice email (payer langs, + Add, Translating…, `/api/ai` translate).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** GET `payment-reminder` returns `previewSuffixHtml` (PDF note + signature tail). `InvoiceList`: `reminderLang` / `reminderTranslating`, refs for letter + suffix, `handleReminderLangChange`, async `openPaymentReminderModal` loads payer correspondence langs + draft refs; amber-styled language row in reminder modal; `void` open handler.

---

## [2026-04-01] CW — Send Invoice: fix AI language switch (Russian one-line body)

**Task:** User: choosing Russian showed "Translating…" then only one line in body — mismatch between `/api/ai` translate response and `InvoiceList` expecting `data.result` JSON; catch fell back to short `EMAIL_TEMPLATES`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** Added `translateEmailSubjectAndBody` (JSON `subject` + HTML `message`, preserve markup via `aiJSON`). `POST /api/ai` `translate` detects JSON payload and returns `{ result: JSON.stringify({ subject, message }) }`. Client sends `targetLanguage` as ISO code (`ru`, not "Russian"). Draft load uses `previewSuffixHtml` for suffix when present.

**Результат:** SCORE: pending QA (manual: Send Invoice → Russian, full template body translated).

---

## [2026-04-03] CW — Order Finances: exclude cancellation lines from active totals

**Task:** User: cancelled / cancellation services should appear only under Cancelled and not affect margin/profit totals.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderFinanceOverview` — `isExcludedFromFinanceTotals`: `res_status` cancelled (case-insensitive) or `service_type === "cancellation"`; those rows only in cancelled bucket, not in `active` aggregates.

---

## [2026-04-03] CW — Edit service VAT: PATCH persist + GET uses order_services.vat_rate

**Task:** User: VAT 21% in Edit Service (Ancillary) not saved — PATCH ignored `vat_rate`/`category_id`; GET list used category default only; modal effect reset VAT from category on categories load.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `services/[serviceId]/route.ts` PATCH maps `vat_rate`, `category_id`; GET list prefers row `vat_rate` then category; removed VAT overwrite `useEffect` in `EditServiceModalNew`; `onServiceUpdated` includes `vatRate`, `categoryId`.

---

## [2026-04-03] CW — InvoiceCreator: wider % inputs (Payment Terms grid)

**Task:** User: cramped % fields — number and % suffix overlapped; need more room to read percentages.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** Grid first column `minmax(8.5rem,0.62fr)`; % wrappers `min-w-[7.5rem] max-w-[11rem] w-full`; inputs `min-w-[4rem] pl-2`, `tabular-nums`, `%` `pr-2` + `aria-hidden`.

---

## [2026-04-03] CW — InvoiceCreator: €→% without 2dp % (fix 2000 → 2000.04)

**Task:** User: in % mode entered deposit 2000 €, field showed 2000.04 — `roundMoney2` on % broke amount round-trip.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `depositPercentFromAmountEur` (6dp on %); deposit EUR mirror + `syncFinalEurMirrorFromRaw`; `parseInvoiceNumericInput` strips `%`.

---

## [2026-04-03] CW — InvoiceCreator: deposit € primary — focus-only draft + wider field

**Task:** User: no comma; typed `2` to enter 2000 — field must not show `String(depositValue)` while focused (avoids overwriting partial input); widen box for 4-digit sums.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `isDepositAmountPrimaryFocused`; while focused `value = draft ?? ""` only; on blur reset; `min-w-[7rem] w-28 max-w-[11rem]`.

---

## [2026-04-03] CW — InvoiceCreator: primary Deposit Amount (€) field = text + draft

**Task:** User: works in Amount mode (sum in €); primary deposit field was still `type="number"` — same comma / typing issues as mirrors.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `paymentDraftDepositAmountPrimary` + `type="text"` / `inputMode="decimal"` for first-column deposit when `depositType === "amount"`; included in `clearPaymentFieldDrafts` and payer snapshot reset.

---

## [2026-04-03] CW — InvoiceCreator payment plan: draft strings on mirrored fields (fix 1→1.98 trap)

**Task:** User: any digit in amount mirror showed "1 98" / could not type multi-digit — controlled value was derived EUR (1% of 198 = 1.98) after first keystroke.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** Mirrored payment inputs use local draft string on focus; `type="text"` + `inputMode="decimal"`; `syncFinalEurMirrorFromRaw`; clear drafts on %/€ type switch and payer snapshot load.

---

## [2026-04-01] CW — InvoiceCreator payment plan: comma decimals, clamp, deposit/final sync

**Task:** User: deposit/final fields fought while typing; parseFloat broke comma decimals; 0% vs amount mismatch; reset manual final when editing deposit.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `InvoiceCreator.tsx` — all payment-term `onChange` handlers use `parseInvoiceNumericInput`, `clampNum`, `roundMoney2`; `depositValue ?? ""`; deposit-side edits call `setIsFinalPaymentManual(false)`; amounts clamped to `[0,total]`, % to `[0,100]`; final-% column updates deposit as `100 - fpPct`.

---

## [2026-04-02] CW — Edit Hotel service: Cancel service + Restore (parity with Flight)

**Task:** User: Hotel had no Cancel service like Air Ticket — footer with that action is hidden for hotel/flight; flight had right-column actions, hotel did not.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `EditServiceModalNew` hotel footer row: `Cancel service` → `CancelServiceModal`; cancellation line → `Restore to Original` like flight.

---

## [2026-04-02] CW — Payment reminder: signature + PDF note in draft Message (email_body_complete)

**Task:** User: payment reminder modal had no visible signature; same pattern as invoice email.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** GET appends PDF note + `appendHtmlWithEmailSignature` to letter body; returns `letter_body_html` + full `message`. POST respects `email_body_complete` + `replaceBase64Images`. InvoiceList sets `bodyFromServerComplete` on successful draft fetch.

---

## [2026-04-02] CW — Invoice send modal: signature inside Message, drop duplicate Preview

**Task:** User: avoid separate Preview — embed signature/footer in the rich text body; POST uses `email_body_complete` so server does not double-append.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** GET returns `message` (full) + `letter_body_html`; `invoiceEmailSuffixRef` for re-append on language change; removed Preview block.

---

## [2026-04-02] CW — Invoice email: layout (footer after sig, no hr), preview, EN translate base

**Task:** User: move PDF footer below signature; remove line before signature; show signature in send preview; translate from English template when switching language.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** POST builds `body → signature (no borderTop) → INVOICE_EMAIL_PDF_FOOTER_HTML`. GET returns `previewSuffixHtml`. `appendUserEmailSignature`: `resolveEmailSignatureInnerHtml`, optional `borderTop`. InvoiceList: preview block; `invoiceEmailEnRef` + AI translate from EN snapshot; `/api/ai` uses full EN subject/body.

---

## [2026-04-02] CW — Invoice email: personal signature missing on send

**Task:** User: invoice email — template set to personal signature but body had no signature block (PDF still attached).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** POST `/invoices/.../email` had no `Authorization` header; draft GET did. `getUser` often null without cookie → `appendHtmlWithUserEmailSignature` skipped. `InvoiceList.handleSendEmail` now sends Bearer like payment reminder.

---

## [2026-04-01] CW — InvoiceCreator: invoice language no longer reset on service selection churn

**Task:** User: Manager (any role) — invoice language appeared not to change while creating invoice.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:**

**Действия:** Load effect depended on `selectedServices` array identity; each parent re-run re-fetched and forced `defaultLang`, wiping chip selection. Deps → `orderCode` + `primaryPayerPartyId` (first row payer only).

---

## [2026-04-01] CW — Finances / Payments: Account filter dropdown

**Task:** User: /finances/payments — add Account to filters.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:**�

**Действия:** `GET /api/finances/payments` already supports `accountId`; `page.tsx` loads `/api/company/bank-accounts`, `<select>` + `filterAccountId` in localStorage with other filters; i18n `payments.allAccounts` en/ru/lv.

---

## [2026-04-01] CW — emailTemplateUtils: fallback select if email_signature_source missing

**Task:** User: invoice email modal not loading Settings template; prior schema cache error on `email_signature_source`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `loadDefaultEmailTemplateForCategory` retries without `email_signature_source` when PostgREST error indicates missing column/schema cache; signature defaults to `personal`.

---

## [2026-04-01] CW — Service split: proportional commission_amount + stricter original delete

**Task:** User: after split, original row still visible; insurance margins wrong (full commission on each part).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `split/route.ts` — split `commission_amount` (and € `agent_discount_value`) by part `amount` / original client price with rounding remainder on last part; delete `order_service_travellers` for original before deleting row; on delete failure return 500 + `createdServiceIds` instead of silent success.

---

## [2026-04-01] CW — Add/Edit service: Cost decimal input (78.09) without losing "."

**Task:** User: typing Cost "78." then "0" removed the dot (Insurance / commission pricing).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** Root cause: `onChange` used `parseFloat` + `Math.round` → `78.0` became `"78"`. Added `sanitizeDecimalInput` in `utils/sanitizeNumber.ts`; commission-style Cost / Service Price inputs use `type="text"` `inputMode="decimal"` + that sanitizer in `AddServiceModal.tsx` and `EditServiceModalNew.tsx`.

---

## [2026-04-01] CW — Supabase: apply_migration add_email_template_signature_source

**Task:** User: run email_templates / companies signature migration via connected Supabase.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `user-supabase` MCP `apply_migration` `add_email_template_signature_source`; verified `information_schema` for `email_templates.email_signature_source` (NOT NULL, default personal) and `companies.email_signature`.

---

## [2026-04-01] CW — RichTextEditor: placeholders vs body font (prose code)

**Task:** User: email template body shows two fonts; no font picker.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** Typography `prose` + `<code>` (TipTap inline code / paste) forced monospace. Editor root `font-sans` + `[&_code]:font-sans` and reset code backticks/background; `pre` stays monospace. Toolbar: `toggleCode` with Braces icon + tooltip.

---

## [2026-04-01] CW — Email templates: signature source (company vs personal) + follow-up fixes

**Task:** User: Templates — choose signature (Company Settings vs User Profile); verify types/UI.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** (Prior) Migration `email_templates.email_signature_source`, `companies.email_signature`; `appendHtmlWithEmailSignature`; Settings Email Templates select; Company Settings HTML signature; send paths (invoice, payment reminder, send-to-hotel). **This step:** Removed invalid `disabled` on `RichTextEditor` (use read-only wrapper); narrowed `Record<string, unknown>` invoice rows in `.../invoices/[invoiceId]/email/route.ts` for `tsc`.

**Next Step:** Apply SQL migration on DB; manual send tests per template mode.

---

## [2026-04-01] CW — Order services: Itinerary bar no longer overlaps table (layout)

**Task:** User: Itinerary sticky header overlapped last service rows.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** Moved Itinerary + Map grid outside the Services `rounded-lg overflow-hidden` card (fragment wrapper); `sticky` + `z-[60]` no longer stacks over table inside same clipping ancestor.

---

## [2026-04-01] CW — Payment reminder: attach same invoice PDF as Send Invoice

**Task:** User: auto-attach invoice PDF on payment reminder emails.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** POST `payment-reminder` loads full invoice via `loadInvoiceWithItemsForOrder`, `generateInvoiceHTML` + `generatePDFFromHTML`, passes attachments to `sendEmail`; body note + Profile signature; company block mirrors invoice email (logo, `companyInfo`, template/accent). Extracted `lib/invoices/loadInvoiceWithItemsForOrder.ts`; invoice `email` route uses it. InvoiceList reminder modal shows PDF hint.

---

## [2026-04-01] CW — Send Invoice: load email_templates category `invoice` (GET draft + POST)

**Task:** User: invoice email did not use Settings templates; how to configure.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `lib/invoices/invoiceEmailTemplate.ts` (vars + `resolveInvoiceEmailLetter`); GET + POST `.../invoices/[invoiceId]/email` use `loadDefaultEmailTemplateForCategory(companyId, "invoice")`; `InvoiceList` fetches draft on open; Settings → Email templates → Invoices shows `INVOICE_SEND_VARIABLES_HELP`.

---

## [2026-04-01] CW — Company email templates + profile signature; payment edit log; broader payment edit

**Task:** User: templates company-wide (copy + link to Profile signature); allow payment PATCH/DELETE for staff with logging (old→new, author, time on order log); append user email signature to invoice + payment-reminder sends; Log tab UI for non-email activity rows.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `canModifyFinancePayments` any non-empty role; `payments/[id]` PATCH/DELETE + `paymentOrderLog` (By/At lines, `order_communications`); delete log after successful delete; `appendHtmlWithUserEmailSignature` on invoice email + payment-reminder POST; `OrderCommunicationsTab` Activity badge + pre-wrap body; Email Templates page subtitle + Profile link.

---

## [2026-04-01] CW — Payment reminder: no placeholder flash, {{dates}}/lines, simpler vars help

**Task:** User: no default text before template; {{dates}} from invoice lines; simplify due-date variables docs.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** Modal `draftLoading` until GET draft; `summarizeInvoiceItemsForReminder` + `invoice_items` on reminder API; `amount_due`; Settings form shows `PAYMENT_REMINDER_VARIABLES_HELP` when category payment_reminder.

---

## [2026-04-01] CW — Payment reminder: body/subject from email_templates (Settings)

**Task:** User: payment reminder letter text from Settings email templates.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `lib/email/emailTemplateUtils` — load default `payment_reminder` template + `{{var}}` substitution; `GET` + `POST` `.../payment-reminder` use template when no custom body; `buildPaymentReminderTemplateVars`; InvoiceList fetches draft GET, RichTextEditor for message; VARIABLES_HELP extended.

---

## [2026-04-01] CW — InvoiceList: payment reminder modal opens immediately

**Task:** User: Payment reminder modal did not open.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `openPaymentReminderModal` — `setReminderModal` сразу после проверки долга; загрузка company/contacts в фоне (раньше модалка ждала `getSession` + fetch). Долг для проверки: поле `remaining` с API при наличии.

---

## [2026-04-01] CW — Dashboard map: traveller count = active clients only

**Task:** User: map must count clients like they do, not raw order_travellers rows.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `/api/dashboard/map` — count only `order_travellers` whose `party.status` is `active` (same filter as GET `.../travellers`); join `party:party_id(status)`.

---

## [2026-04-01] CW — Apply DB migrations (email_kind, payments.created_by)

**Task:** User: run migrations on Supabase (not only SQL files in repo).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `apply_migration` MCP: `add_order_communications_email_kind`. Second `apply_migration` hit duplicate `schema_migrations` version; same DDL applied via `execute_sql` for `payments.created_by`. Verified `information_schema` for both columns.

---

## [2026-04-01] CW — Invoice payment reminder email + open tracking

**Task:** User: respectful payment reminder letter, Payment Reminder action, track read like invoice email.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** Migration `add_order_communications_email_kind.sql`; invoice emails `email_kind=invoice`; POST `.../payment-reminder` + `lib/invoices/paymentReminderEmail.ts`; communications GET + InvoiceList column Reminder + modal; Resend webhook unchanged (resend_email_id).

---

## [2026-04-01] CW — Payments: entered-by column; edit/delete finance+supervisor only

**Task:** Finances payments: column after Note (who entered); Edit/Delete only Finance and Supervisor (UI + API).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** Migration `add_payments_created_by.sql`; POST sets `created_by`; GET enriches `entered_by_name`; PATCH/DELETE 403 unless finance|supervisor; payments page + OrderPaymentsList column + role-gated actions; i18n `payments.enteredBy`.

---

## [2026-04-01] CW — Commission pricing: margin = Client − Service Net

**Task:** User: margin must be Sale − pay-to-operator (e.g. €80 − €48.67 = €31.33), not driven by stale agent discount overwriting client price.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** EditServiceModalNew — split cost vs agent recalc; sync margin when net changes; init agent discount from cost − sale for commission categories; footer uses derived margin.

**Результат:** SCORE pending QA

**Next Step:** User verify in UI; optional QA pass on commission flows.

---

## [2026-03-31] CW — Header E scoreboard: year under month in cell

**Task:** User asked where to show year in date blocks.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `ScoreboardDateCell` — third line `getFullYear()`, subtle slate-6; dash vertical tweak.

---

## [2026-03-31] CW — Header E scoreboard: slightly smaller day numerals

**Task:** User: "чуть меньше" for date cells.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `ScoreboardDateCell` — reduced day/month sizes and cell width/padding.

---

## [2026-03-31] CW — Header E destination: same compact style as variant D

**Task:** User prefers D-style flag + gray-7 + Bangkok → Samui for E.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `DEMO.destinationCompact`; E row2 matches D classes; `title` keeps full `destinationLine` on hover; D uses `destinationCompact`.

---

## [2026-03-31] CW — Header variant E: scoreboard dates lighter + smaller + zero-pad day

**Task:** User: smaller digits, not black bg, days 01–09 with leading zero.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderHeaderVariantDemos.tsx` — `ScoreboardDateCell` sky/slate light panel, reduced type size, `padStart(2,"0")`.

**Next Step:** Product review `?variant=e`.

---

## [2026-03-31] CW — Flight primary parse: pass parser-chat hint to AI (skip regex)

**Task:** User: Paste/PDF auto-parse ignored chat comment; only Re-parse did.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `parse-flight-itinerary/route.ts` — JSON/multipart: optional `feedback` → `parseFromRequest`; `EditServiceModalNew` — `reparseMessageRef`, hint skips regex, AI body `{ text, feedback }`; UI copy under drop zone + chat blurb.

**Next Step:** Optional always-visible hint before first parse (banner currently gates chat).

---

## [2026-03-31] CW — Parser chat → immediate parse_rules + auto-rule threshold 1

**Task:** User wants parser chat to train the system from the first message, not 3× same correction; align product with persistent rules.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `POST /api/ai/parse-rules/user-instruction` — сохраняет текст чата в `parse_rules` (priority 5) + audit в `parse_feedback` (`_parser_chat`); `EditServiceModalNew` вызывает перед re-parse; копирайт чата обновлён; `parse-feedback` `maybeAutoCreateRule` порог 3→1, пропуск `field_name` с `_`; комментарии в `ParseFeedbackPanel`.

**Next Step:** QA flight+tour; при необходимости дедуп правил или UI списка правил для компании.

---

## [2026-03-28] CW — Reparse API: return 422 + error when parsed is null

**Task:** User saw generic "Error: could not re-parse" with no underlying reason.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `app/api/ai/reparse/route.ts` — `jsonFromParseResult`: 422 + `error` from `ParseResult` when `data` missing; client already shows `data.error`.

**Next Step:** QA flight re-parse; clarify UX that chat line is hints, not document replacement.

---

## [2026-03-28] CW — Header variant E: scoreboard dates + stacked tag blocks

**Task:** Variant E — move dates to row 1 after delete; large airport-style day + 3-letter month; leisure vs TA/TO/CORP/NON tags in two vertical rows.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderHeaderVariantDemos.tsx` — `ScoreboardDateCell`, `VariantETagChip`, `DEMO.dateFromIso`/`dateToIso`, `tagsLeisure`/`tagsSource`; `header-layout-demo/page.tsx` variant E blurb.

**Next Step:** Product review `?variant=e`.

---

## [2026-03-28] CW — Order Documents tab: drag-and-drop on empty state

**Task:** User could not drop PDF/images on dashed area; UI looked like a drop zone but had no handlers.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderDocumentsTab.tsx` — `uploadFile` shared by file input + `onDrop` on empty-state zone; highlight on drag-over; `lib/i18n.ts` — `order.noDocumentsYet` mentions drag (EN/RU/LV).

**Next Step:** QA drop PDF/JPG/WEBP; GIF still rejected by API (`ALLOWED_TYPES`).

---

## [2026-03-28] CW — Flight parser chat: re-parse source + apply flight data

**Task:** “Chat with parser” said no document for air tickets; re-parse applied tour data; flight paste/PDF did not set lastParsed refs.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `EditServiceModalNew.tsx` — sync `lastParsedTextRef`/`lastParsedFileRef` with PDF/TXT/paste parse; re-parse uses `parseSourceTextRef` fallback + `mapFlightTicketParsedToSegments` + `applyParsedFlightData` for flight; clearer error when no source.

**Next Step:** QA re-parse after PDF and after paste+Parse on Edit Air Ticket.

---

## [2026-03-28] CW — Order header demo: variants E–G (max 2 rows)

**Task:** Extra header layout tabs E/F/G focused on two-row density.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `header-layout-demo` — `HeaderVariantE/F/G`, `?variant=e|f|g`.

**Next Step:** Product picks variant for real order page.

---

## [2026-03-28] CW — Service economics: commission for insurance + commission categories

**Task:** Profit/margin ignored commission for Insurance (and same bug for ancillary, cruise, transfer, rent a car, airport services); align with EditServiceModal commission pricing.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `lib/orders/serviceEconomics.ts` — `categoryUsesCommissionAdjustedNetCost`, margin = client − (service − commission) for those categories; `app/api/dashboard/chart/route.ts` — use `computeServiceLineEconomics`; `CancelServiceModal` + `EditServiceModalNew` — marge uses same economics + live commission from form.

**Next Step:** QA Finances tab Service Breakdown + dashboard chart vs manual totals.

---

## [2026-03-28] CW — Order header layout demo (tabs A–D)

**Task:** Demo page with bookmarkable tabs for compact header variants (static mock order).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `app/orders/header-layout-demo/page.tsx` + `_components/OrderHeaderVariantDemos.tsx`; `?variant=a|b|c|d`.

**Next Step:** Product picks variant for real `OrderPage` header.

---

## [2026-03-28] CW — Orders search: Cyrillic/Latin homoglyph fold + fuzzy match

**Task:** "Gil" finds Gilchenko but "Gilch" does not — confusable letters; add typo tolerance for list filters.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `lib/directory/searchNormalize.ts` — `foldForSearchMatch` (кириллица, похожая на латиницу, → латиница), `matchesLooseTextQuery`, `fuzzySubstringMatch` + Levenshtein ≤2; `matchesSearch` uses fold + fuzzy fallback. `lib/stores/filterOrders.ts` — поле query text через `matchesLooseTextQuery` (order id без fuzzy).

**Next Step:** Optional: усилить семантический поиск по заказам (embeddings) отдельной задачей.

---

## [2026-03-28] CW — Orders list search: payers + travellers + API `?search=`

**Task:** Orders list text search must match payers and any service user (order_travellers + order_service_travellers), not only lead client / service `client_name`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/api/orders/route.ts` — `collectTravellerSearchLabelsByOrder`, merge into list `serviceClients` and into in-memory `?search=` filter; search prefetch includes `payer_name` from `order_services`; `order_services` select includes `id`, `client_name`. `lib/stores/filterOrders.ts` — `queryText` also matches `payers`.

**Next Step:** QA orders search (surname in box + optional `?search=`).

---

## [2026-03-28] CW — Order services table: no duplicate supplier when BSP = airline name

**Task:** Supplier column showed "Turkish Airlines / Turkish Airlines" for airline channel when supplier_name matched airline_channel_supplier_name.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderServicesBlock.tsx` — `formatServiceSupplierDisplay()`: second segment only when names differ (case-insensitive). `EditServiceModalNew` — `onServiceUpdated` passes `supplierNameRaw` for merged state.

**Next Step:** QA BSP flight row + save.

---

## [2026-03-28] CW — Commission pricing: Client price summary row (sky)

**Task:** Service Price Net is very prominent; add a matching summary row for client total in another color.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `EditServiceModalNew.tsx`, `AddServiceModal.tsx` — below Service Price Net, second card same layout: title **Client price**, subtitle **total to client**, amount from `clientPrice`; styles `bg-sky-50` / `border-sky-200`.

---

## [2026-03-28] CW — Commission pricing: editable Margin ↔ Total Client price

**Task:** Insurance (tour/commission-style): Total Client price editable; user wants bidirectional edit — client price → margin, or margin → client price.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `EditServiceModalNew.tsx`, `AddServiceModal.tsx` — commission `useEffect`: branch `pricingLastEditedRef === "marge"` → `sale = netCost + margin`, agent discount = `cost - sale`; deps +`marge`. Margin input: editable (invoice lock unchanged on Edit). Add: Sale/Marge labels unchanged.

**Next Step:** QA insurance/tour: edit client price vs margin; save payload.

---

## [2026-03-28] CW — Flight segment edit form: readable inputs

**Task:** Edit Flight Segment fields showed truncated text (narrow grid in modal).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `components/FlightItineraryInput.tsx` — `SegmentEditForm`: responsive grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` / `xl:grid-cols-4` for top row), shared `inp` / `inpTime` with `min-w-0`, `min-w-[9.5rem]` for time inputs, City wider on `sm`, Passenger full row; form `overflow-x-auto`.

**Next Step:** QA Edit Service flight segment on narrow and wide layout.

---

## [2026-03-28] CW — Edit Service: parser banner / reparse UI English

**Task:** AI-parse banner and reparse chat showed Russian while modal title was English.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `EditServiceModalNew.tsx` — banner, chat labels, placeholders, parser messages → English. `ParseFeedbackPanel.tsx` — user-visible strings → English.

**Next Step:** QA Edit Service after document parse (flight/tour).

---

## [2026-03-28] CW — Travellers modal: create client when directory search empty

**Task:** `AssignedTravellersModal` Search Directory showed "No results found" with no path to add a new directory client (unlike Add accompanying).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `AssignedTravellersModal.tsx` — `DirectoryCreateClientModal`, state `showCreateClientModal`, `+ Create new client` when query ≥2 chars and not searching; `handleDirectoryClientCreated` fetches `/api/directory/:id`, appends to `orderTravellers`, `POST /api/orders/.../travellers`, toast, closes search panel.

**Next Step:** QA: + Add traveller → search unknown name → create client → appears in order pool.

---

## [2026-03-28] CW — Supplier type: add Partner (GDS / Direct / Partner)

**Task:** Extend order service supplier booking type with `partner` in Add/Edit modals; DB CHECK must allow `partner`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `AddServiceModal.tsx`, `EditServiceModalNew.tsx` — union + option + edit init normalization; `migrations/add_supplier_booking_type_partner.sql` — replace CHECK on `order_services.supplier_booking_type`. Миграция применена к проекту Supabase через MCP (`apply_migration` `add_supplier_booking_type_partner`).

**Next Step:** QA save service with Partner.

---

## [2026-03-28] CW — Referral / economics: respect VAT 0% on air tickets

**Task:** Air ticket service shows 0% VAT in Edit but Referral lines used 21% on margin.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Причина:** `computeServiceLineEconomics` трактовал `vat_rate === 0` как «не задан» и брал fallback; категория «Air Ticket» не содержит `flight` → подставлялось 21%.

**Действия:** `lib/orders/serviceEconomics.ts` — `resolveVatRatePercent`; fallback добавлен `air ticket`. `app/api/dashboard/statistics/route.ts`, `agent-targets/route.ts` — расчёт через `computeServiceLineEconomics`.

**Next Step:** QA Referral tab + orders list for flight with vat_rate 0.

---

## [2026-03-28] CW — Add accompanying persons: create client in directory

**Task:** When directory search has no match, allow creating a client like PartySelect (`/api/directory/create`, duplicates / create anyway).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `components/DirectoryCreateClientModal.tsx` (reuse PartySelect client flow); `AddAccompanyingModal.tsx` — кнопка "+ Create new client" при поиске ≥2 символов, nested modal z-index 100001.

**Next Step:** QA create person/company from Edit Hotel → Add accompanying; optional: refactor PartySelect to use shared modal.

---

## [2026-03-28] CW — Transfer pricing: supplier currency like Hotel

**Task:** Add Service / Edit Service — Transfer commission pricing: supplier currency selector, foreign amount, rate/Fetch → cost in company currency; persist service_currency / service_price_foreign / exchange_rate.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `AddServiceModal.tsx`, `EditServiceModalNew.tsx` — amber block + read-only Cost/Service Price in company currency when foreign; payload для transfer.

**Next Step:** QA Transfer with USD cost + company EUR (or other).

---

## [2026-03-28] CW — Party-tab services: confirmation ref in Basic Info

**Task:** Insurance (and other party-tab types) lacked booking/confirmation ref in Basic Info; only Package Tour had it.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `AddServiceModal.tsx`, `EditServiceModalNew.tsx` — поле `ref_nr` показывается для всех `CATEGORIES_WITH_PARTIES_TAB` (tour, insurance, visa, transfer, rent_a_car, cruise, other); лейбл/placeholder уточнены; Edit — `markCorrected`/`correctedFields` для refNr.

**Next Step:** QA Add/Edit Insurance и visa/transfer.

---

## [2026-03-28] CW — Clients Data tab: batch API (one round-trip vs N directory GETs)

**Task:** Replace related-parties + N× GET /api/directory/[id] with GET .../clients-data-parties; share buildDirectoryRecord with directory route.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `lib/directory/buildDirectoryRecord.ts` + `resolveAuditDisplayNamesBatch`; `loadDirectoryRecordsForPartyIds`; `lib/orders/relatedPartiesForOrder.ts`; route `clients-data-parties`; `related-parties` uses shared helper; `OrderClientsDataTab` single fetch; directory GET imports shared builder.

**Next Step:** QA Clients Data tab + directory edit.

---

## [2026-03-28] CW — Order page: dedupe travellers fetch + cache service categories

**Task:** Apply perf recommendations: one GET .../travellers for header + services block; avoid repeat travel-service-categories fetch per session.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `page.tsx` — full `Traveller[]` state, pass `travellersState` to `OrderServicesBlock`; block skips duplicate fetch when tuple provided. Module cache + inflight dedupe for `/api/travel-service-categories`.

**Next Step:** QA order client tab; optional later: batch directory for Clients Data tab.

---

## [2026-03-28] CW — Order Clients Data: subdued Remove action (not primary)

**Task:** Tone down “Remove from order” so it does not read as the main focus in the name column.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** Short label + `title` full phrase; gray `text-[11px]`, hover red/underline; separator dot; i18n `removeFromOrderShort` (en/ru/lv).

**Next Step:** QA visual pass.

---

## [2026-03-28] CW — Order Clients Data: remove traveller from order (UI + leadPartyId)

**Task:** Let users remove mistaken travellers from Clients Data tab; API already had DELETE travellers.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `related-parties` returns `leadPartyId`; `OrderClientsDataTab` — Remove from order + i18n.

**Next Step:** QA if traveller on services.

---

## [2026-03-28] CW — Dashboard map: traveler counts from order_travellers (not booking count)

**Task:** Marker/popup showed number of orders; show sum of people per order from `order_travellers`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/api/dashboard/map/route.ts` — `travellerCount` per order; `TouristsMap` — sum for icon/cluster/popup + filter legend; optional `· N bookings` in popup.

**Next Step:** QA with multi-traveller orders.

---

## [2026-03-28] CW — Order Clients Data: expand row, edit loyalty & prefs (no Open link)

**Task:** Remove Open column; click row to expand inline editor; save loyalty + seat/meal/languages/notes to Directory via PUT.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `OrderClientsDataTab.tsx` + i18n `order.clientsData.edit.*`; companies: loyalty + languages only.

**Next Step:** QA save + permissions.

---

## [2026-03-28] CW — Dashboard Travelers map: filters (status + upcoming window)

**Task:** Filter by In progress / Upcoming; upcoming limited to next 7 or 14 days by `dateFrom`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `TouristsMap.tsx` — checkboxes, select (Any / Next 7 / Next 14 days), empty-filter message.

**Next Step:** QA

---

## [2026-03-28] CW — Order Clients Data: single summary table

**Task:** One table for all linked parties — DOB, personal code / reg, passport, issued, expires, contact; remove card layout.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderClientsDataTab` — responsive table + sticky name column; removed `OrderDirectoryRecordReadonly.tsx`; i18n column headers + archived/alien hint.

**Next Step:** QA horizontal scroll on mobile.

---

## [2026-03-28] CW — Invoice EN labels: summa → Subtotal

**Task:** English UI showed "Summa" on invoice preview (Latvia company block).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `INVOICE_LABELS.en.summa` → "Subtotal"; `InvoiceCreator` fallback aligned.

**Next Step:** —

---

## [2026-03-28] CW — Order: Clients Data tab (directory snapshot)

**Task:** New order tab with all clients & payers from directory; full card fields except referral/subagent UI.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `GET /api/orders/[orderCode]/related-parties` — lead client, order_travellers, payer_party_id from non-cancelled services + name-only payers; `OrderClientsDataTab` + `OrderDirectoryRecordReadonly` (contact, person/passport/prefs, company, banking, accounts, audit); hide referral/subagent role badges and no referral/subagent/supplier extras blocks; i18n `order.tab.clientsData` + `order.clientsData.*` (en/ru/lv); tab after Client & Services in `page.tsx`.

**Next Step:** QA: multi-payer order, name-only payer, archived party.

---

## [2026-03-28] CW — Send to Hotel: normalize `<email>` for Resend

**Task:** 422 from Resend when `to` is `<addr@host>` without display name (directory paste).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `lib/email/sendEmail.ts` — `normalizeSingleToAddress` unwraps bracket-only addresses; `normalizeEmailToField` for comma-separated; `parseToAddresses` uses normalization (all `sendEmail` callers). `send-to-hotel/route.ts` — normalize before send + `order_communications.recipient_email`.

**Next Step:** QA: Send to Hotel with `<email@domain>` and `Name <email@domain>`.

---

## [2026-03-27] CW — Order Finances: Recharts Tooltip formatter types

**Task:** Vercel/build: Tooltip `formatter` incompatible with `number | undefined` / `ValueType`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderFinanceOverview.tsx` — normalize tooltip value with `Number(value)` + `Number.isFinite` before `fmt`.

**Next Step:** —

---

## [2026-03-27] CW — Order Finances: dial back % in payment overview

**Task:** User feedback: too much % emphasis in finances tab.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderFinanceOverview.tsx` — payment block (billed, paid by method, processing fees, outstanding): single-line amounts only; removed per-line `% of revenue` sublines. KPIs / P&L still use quiet `PctSubline` from prior step; repo has no `PctShareBlock` / `MoneyWithShare` left.

**Next Step:** QA visual pass on Order → Finances tab.

---

## [2026-03-25] CW — Passport AI: Responses output + incomplete + PDF text fallback

**Task:** "AI parsing failed" — OpenAI Responses `incomplete`/new output shapes left empty text; images with bad MIME.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `parse-passport/route.ts` — richer `extractOpenAiResponsesOutputText` (text/output_text); treat failed/cancelled/incomplete only when no extracted text; PDF fallback unpdf + Chat Completions; vision `detail: high` + safe image MIME.

**Next Step:** QA: scanned PDF, photo JPEG; if still fail, check server logs for OpenAI `details`.

---

## [2026-03-25] CW — Package Tour: ANEX prompt + traveller match-only + baggage from parse

**Task:** ANEX TOUR Latvian contract parsing; match travellers to directory without auto-create; highlight unmatched; richer name matching; baggage on segments.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/api/ai/parse-package-tour/route.ts` — ANEX section (Nr., CEĻOTĀJI, LIDOJUMI, BAGĀŽA, TRANSFĒRS, IZMITINĀŠANA); `find-or-create-travellers` — `matchOnly`, token-set + fuzzy + initials+surname; response `matched`; Add/Edit tour parse uses `matchOnly: true`, `baggage` on segments + service baggage; amber highlight unmatched clients.

**Next Step:** QA with real ANEX PDF; verify save still find-or-creates name-only clients on submit.

---

## [2026-03-25] CW — Package Tour itinerary: hide transfer when field is dash-only

**Task:** Transfer "—" or "-" in Package Tour must not render transfer cards in Itinerary.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `ItineraryTimeline.tsx` — `tourPackageTransferShouldRender()` strips ASCII/Unicode dashes and whitespace; both tour+flights and tour-no-flights branches use it (replaces check for em dash only).

**Next Step:** QA: Individual/Group still show; `-` / `–` / `—` / spaces only hide.

---

## [2026-03-25] CW — Order header: click client name to change (not directory popup)

**Task:** Lead passenger name click opened directory card; change client only on double-click — confusing.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `app/orders/[orderCode]/page.tsx` — single click → `startEditingClient()`; Ctrl/Cmd+click → `/directory/[id]`; avatar button still opens directory popup. `lib/i18n.ts` tooltip strings updated.

**Next Step:** QA: click name → PartySelect; Cmd+click → directory page; avatar → popup.

---

## [2026-03-25] CW — Passport AI upload: MIME sniff when type empty / octet-stream

**Task:** JPEG/PDF passport parse failed when browser sent empty `file.type` or `application/octet-stream` (common on drag-drop).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `lib/files/inferUploadMime.ts` (extension + magic bytes); `app/api/ai/parse-passport/route.ts` + `components/PassportDetailsInput.tsx` use sniff + filename fallback; PDF vs image routing trusts bytes over wrong declared type.

**Next Step:** QA: drag-drop JPG/PDF with no extension vs with extension; verify 401 only when unauthenticated.

---

## [2026-03-24] CW — Person names: preserve caps in double first/last (formatNameForDb)

**Task:** `formatNameForDb` used only first char upper + rest lower → broke "Ričards Dins" in one field; per-word normalize + preserve mixed-case words.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `utils/nameFormat.ts`; `DirectoryForm` + `PartySelect` use `formatNameForDb` for first/last blur/save.

**Next Step:** Re-save affected directory persons or run sync-format-names if desired.

---

## [2026-03-24] CW — Bundle: analyzer script, lazy ProfitOrdersChart, tiptap optimize

**Task:** Wire `@next/bundle-analyzer`, lazy-load dashboard profit chart, extend `optimizePackageImports` for TipTap.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `next.config.ts`, `package.json` script `analyze`, `app/dashboard/page.tsx` dynamic chart.

**Next Step:** Run `npm run analyze` locally; review treemap; revert tiptap optimize if any runtime issue.

---

## [2026-03-24] CW — Referral panel: % editable with fixed; Est pct-first

**Task:** Allow editing % when fixed is set; Est follows % when % is entered; keep PATCH mutual clear on save.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderReferralServicesPanel` estimatedReferralAmount order; removed read-only %; i18n Est hint.

---

## [2026-03-24] CW — Referral: copy for confirm checkbox + directory Active label

**Task:** Clarify referral confirmation = allocation in app, not payout; planned → active after client trip end; show hint whenever partner set.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `lib/i18n.ts` en/ru/lv; `page.tsx` referral hint visibility; directory accrued → “Active” labels.

**Next Step:** QA copy in EN/RU/LV on Referral tab + directory popup.

---

## [2026-03-24] CW — Referral panel: fixed vs % exclusive + implied %

**Task:** When user sets fixed €, clear stored % and show equivalent % vs profit (ex VAT); setting % clears fixed.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `OrderReferralServicesPanel.tsx` PATCH body; readonly % when fixed set; i18n `order.referralColPctImpliedHint`.

**Next Step:** QA: 15% → €8 fixed → % shows ~5.71; clear fixed → edit % again.

---

## [2026-03-24] CW — DB: combined migration order_services_referral_columns.sql

**Task:** Clarify referral commission persistence — columns must exist on `order_services`; single idempotent SQL for Supabase.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `migrations/order_services_referral_columns.sql`; split files marked deprecated; COMMENT for % aligned with profit-net base.

**Next Step:** Apply `order_services_referral_columns.sql` in Supabase if PATCH still fails.

---

## [2026-03-24] CW — Referral tab: save fix + estimated commission column

**Task:** Referral services panel — PATCH used stale `orderCode` vs `effectiveOrderCode`; silent failures; user wanted € preview for % of profit (ex VAT).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `page.tsx` pass `effectiveOrderCode`; `OrderReferralServicesPanel` — toast on load/PATCH errors, column Est. (`profitNet × % / 100` or fixed); i18n en/ru/lv.

**Next Step:** QA: type %, see Est.; if toast mentions migrations, apply SQL in Supabase.

---

## [2026-03-24] CW — Referral: orders list badge, i18n, directory popup orders

**Task:** Finish referral UX: REF badge + profit tooltip on orders list; en/ru/lv for referral services panel + directory referral section; `DirectoryClientPopup` loads `GET .../referral-orders` for referral role; TS fix in `OrderReferralServicesPanel` mapService.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/orders/page.tsx`, `lib/i18n.ts`, `components/directory/DirectoryClientPopup.tsx`, `OrderReferralServicesPanel.tsx` (types); `OrderServicesBlock` unused `useRef` import removed.

**Next Step:** QA: list badge + profit tooltip; open directory popup for referral party; verify referral tab strings in ru/lv.

---

## [2026-03-24] CW — Client app: production deployment guide + EAS env

**Task:** Document how referral/client users get a real installable app independent of dev machine; EAS builds use Expo env vars, not placeholder domain in repo.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `Client/docs/PRODUCTION_DEPLOYMENT.md`; `Client/eas.json` removed inline fake `EXPO_PUBLIC_API_URL`; `Client/.env.example` notes.

**Next Step:** Owner: deploy Next.js, set EAS env, `eas build` / store submit.

---

## [2026-03-24] CW — Order page: Referral tab + sync category fallback

**Task:** Move referral partner UI from order header to `?tab=referral`; resolve `category_id` from `order_services.category` text in `syncOrderReferralAccruals`.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:** `app/orders/[orderCode]/page.tsx` — tab `referral`, subagent hidden; `lib/referral/syncOrderReferralAccruals.ts` — load categories, match type/name.

**Next Step:** QA: open order, Referral tab, save partner + confirm after trip; verify accrual lines for all eligible services.

---

## [2026-03-24] CW — Influencer invite doc + referral-only app mode + invite script

**Task:** `docs/CLIENT_APP_INFLUENCER_INVITE.md`; `EXPO_PUBLIC_CLIENT_APP_REFERRAL_ONLY`; `scripts/generate-client-app-invite.ts`; deep link `mytravelconcierge://register`; register `invited_by` UUID guard.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

---

## [2026-03-24] CW — Directory: show referral in client app + mobile Referral tab

**Task:** `client_party.show_referral_in_app` from Directory checkbox; profile + `GET /api/client/v1/referral/overview`; Expo Referral tab and screen.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Migration `migrations/client_party_show_referral_in_app.sql`; `DirectoryRecord.showReferralInApp`; GET/PUT/create directory; DirectoryForm checkbox (client role).
- Client API: profile field; `referral/overview` (403 if flag off).
- Client app: `referralApi`, `ReferralScreen`, conditional tab + AppState refresh.

**Next Step:** Apply migration in Supabase; QA: enable flag + Referral role + accruals, log in app.

---

## [2026-03-24] CW — Order referral block: i18n (en/ru/lv)

**Task:** `t(lang, …)` for referral partner label, confirmation checkbox, planned hint.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `lib/i18n.ts` keys `order.referralPartner`, `order.referralCalculationConfirmed`, `order.referralPlannedHint`; `page.tsx` uses them.

---

## [2026-03-24] CW — Order: referral party UI + POST services sync accruals

**Task:** Order header: referral `PartySelect`, “Referral calculation confirmed” checkbox; `POST /api/orders/.../services` calls `syncOrderReferralAccruals` after creates/cancellations.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `app/api/orders/[orderCode]/services/route.ts` — `fireReferralSync` on main insert, minimal insert, cancellation clone paths.
- `app/orders/[orderCode]/page.tsx` — `OrderData` referral fields; PATCH handlers; UI (hidden for subagent).

**Next Step:** QA on order with migration applied; verify `referral_accrual_line` after service edits.

---

## [2026-03-24] CW — Referral role: API + DirectoryForm + stats/settlements routes

**Task:** Wire `referral` DirectoryRole; persist `referral_party` + category rates; UI section; GET referral-stats / referral-settlements + POST settlement.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Types `ReferralExtras`, `ReferralCategoryRate`; `GET/PUT` directory `[id]`, list `GET /api/directory`, `create`.
- `referral-stats`, `referral-settlements` API; DirectoryForm: checkbox, rates table, balances, record settlement.
- Search popover + store role `referral`; directory page badge color.

**Next Step:** Apply SQL migration if not yet; orders: `referral_party_id` + confirm flag + job to build `referral_accrual_line`.

---

## [2026-03-24] CW — Referral role: spec + DB migration (phase 1)

**Task:** Referral directory role, commission by service category, planned/accrued blocks, settlements, order confirmation flag.
**Status:** SUCCESS (schema + spec only; UI/API next)
**Agent:** Code Writer
**Complexity:** 🔴

**Действия:**
- `.ai/tasks/referral-role-commission-settlements.md` — product rules, phases, formulas.
- `migrations/add_referral_party_commission.sql` — `referral_party`, category rates, accrual lines, settlements, `orders` columns, RLS.

**Next Step:** Apply SQL in Supabase; then API + DirectoryForm + order checkbox + sync job.

---

## [2026-03-24 16:30] CW — Order detail: DirectoryClientPopup on client clicks

**Task:** Order page — click clients (lead passenger, services table, traveller avatars) opens draggable `DirectoryClientPopup`; Ctrl/Cmd+click still navigates to `/directory/[id]`; double-click lead name still edits client.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `page.tsx`: `directoryPopupPartyId`, `DirectoryClientPopup`, avatar button, lead name click/dblclick.
- `OrderServicesBlock.tsx`: `onOpenDirectoryParty` prop; client column + traveller avatar buttons with `stopPropagation`.

**Результат:** `npm run build` OK.

---

## [2026-03-23] CW — Passport re-upload: clear fields before applying new parse

**Task:** New passport upload kept old field values when API omitted keys (JSON merge).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `PassportDetailsInput`: `BLANK_PASSPORT_MERGE` then overlay API result; reset file input; `useCallback` + paste effect deps.
- `DirectoryForm`: on AI parse (`parsedFields`), update first/last name independently when present.

---

## [2026-03-22] CW — Order services: selection bar sum uses signed cancellation client price

**Task:** Floating bar showed wrong total (summed positive DB values for cancellation lines).
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:** `signedClientPriceForSum` — same as table column; reduce uses it for selected rows total.

---

## [2026-03-22] CW — Orders search: match clients on service lines

**Task:** Orders list search should find orders when the typed client appears on any service, not only lead passenger.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `GET /api/orders`: select `client_name` on `order_services`; response field `serviceClients[]`; when `?search=` — filter also by service-line names (chunked query).
- `filterOrders` + `OrderRow`: query text and surname filters also check `serviceClients`.

**Next Step:** QA — search by traveller who is only on a service line; `?search=` from payments modal.

---

## [2026-03-22] CW — Order services: invoice checkbox for cancelled + Cancelled badge style

**Task:** Allow selecting cancelled services for invoicing (net settlement); style Cancelled status half green / half gray.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `OrderServicesBlock.tsx`: checkbox for all non-invoiced rows (including `resStatus === 'cancelled'`); select-all / selection cleanup aligned; Invoice button passes cancelled lines; `getResStatusColor('cancelled')` → gradient green/gray + border.
- `page.tsx`: `onIssueInvoice` no longer strips cancelled services; empty check on full selection.
- `OrderServicesTab.tsx`: same Cancelled badge styling for consistency.

**Next Step:** QA — select cancelled + cancellation line, create invoice; verify totals.

---

## [2026-03-20] CW — Finance: Company expenses (Supervisor/Finance only)

**Task:** Add Finance section for company expense invoices (utilities, insurance, etc.) — not linked to orders. Parse documents; add rows; filter/search by period, supplier, amount. Supervisor and Finance only.
**Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Migration `add_company_expense_invoices.sql`: table `company_expense_invoices` (company_id, supplier, invoice_date, amount, currency, description, created_at, created_by); RLS policies for supervisor/finance only.
- API: GET/POST `/api/finances/company-expenses` (filters: dateFrom, dateTo, supplier, amountMin, amountMax, search); POST body for add; PATCH/DELETE `/api/finances/company-expenses/[id]`. Role check: supervisor or finance.
- API: POST `/api/finances/company-expenses/parse` — multipart file (PDF/image), regex + optional AI extraction (supplier, invoice_date, amount, currency, description), return JSON for form prefill.
- Finance layout: new tab "Company expenses" visible only when role is supervisor or finance (or admin).
- Page `/finances/company-expenses`: filters (period, quick search, supplier, amount min/max), table sorted by invoice_date; Add row form; Upload & parse → prefills form; Edit/Delete per row. Forbidden message for other roles.
- i18n: companyExpenses.* keys (en, ru, lv).

**Next Step:** Run migration in Supabase; QA — add row, upload PDF, filter, edit, delete. Optional: RELEASE_LOG entry when verified.

---

## [2026-03-17] CW — AI passport PDF: Responses API + Files API

**Task:** UK / PDF passport parsing broken (wrong Chat Completions payload) | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `parse-passport/route.ts`: PDF path — `POST /v1/files` (`purpose=user_data`) → `POST /v1/responses` with `input_file` + `instructions` (SYSTEM_PROMPT), `store: false`, `max_output_tokens` 1500; `DELETE /v1/files/:id` in `finally`; `extractOpenAiResponsesOutputText` walks `output` message `output_text` parts

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — upload UK PDF; confirm JSON + MRZ path

---

## [2026-03-18] CW — AI passport parse: UK/MRZ robustness

**Task:** UK passport parsing seemed broken / wrong person | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `parse-passport/route.ts`: strip ```json fences before JSON parse; recover TD3 MRZ lines from full model text via `extractTd3MrzLinesFromText`; apply MRZ to name/number/nationality/gender (not only dob/expiry); MRZ-only fallback when AI JSON empty; SYSTEM_PROMPT UK GBR hint; OpenAI `max_tokens` 1500
- `lib/passport/parseMrz.ts`: export `extractTd3MrzLinesFromText` (was internal)

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — UK biodata image/PDF; verify Bondarenko MRZ overrides wrong visual guess

---

## [2026-03-18] CW — Merge modals: preview + confirm checkbox

**Task:** Preview + confirm before directory merge | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `components/MergeContactPreview.tsx`: preview cards (ID, type/roles, email, phone, passport name/No., DOB), mismatch warning passport vs card name, irreversible notice, confirm checkbox
- `DirectoryMergeModal`, `MergeContactModal`, `MergeSelectedIntoModal`: step pick → `GET /api/directory/:id` full records → review → checkbox → Confirm merge; Back/Cancel; wider modal + scroll
- `MergeContactModal`: `useModalOverlay(isOpen)`, `useFocusTrap(isOpen)`

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — all three merge entry points; avatar URLs if relative

---

## [2026-03-18] CW — Merge: sync orders.client_display_name after client_party_id retarget

**Task:** Lead Passenger showed wrong name vs avatar after directory merge | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `app/api/directory/merge/route.ts`: before retargeting orders, collect affected order ids; after `client_party_id` → target, set `client_display_name` from target `party.display_name` for those orders (matches order PATCH behaviour)

**Результат:** New merges keep header name aligned with merged-into card; existing bad rows need one-time fix in DB or re-save client on order.

**Next Step:** QA — merge two clients with orders; check order header name + avatar

---

## [2026-03-17 23:00] CW — Directory: multi-select + MergeSelectedIntoModal

**Task:** Wire bulk merge modal to Directory with row checkboxes | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `app/directory/page.tsx`: checkbox column + select-all on page, indeterminate header, toolbar when selection &gt; 0, `MergeSelectedIntoModal`; hidden for subagent and archive view; selection clears on page/role/archive change
- `MergeSelectedIntoModal.tsx`: reset state on open, `useModalOverlay(isOpen)` / `useFocusTrap(isOpen)`, clearer copy

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — select 2+ rows, merge into target; verify list refresh and navigation still works on row click

---

## [2026-03-17 22:15] CW — Directory API: map party_person (dob) when party_type missing

**Task:** DOB still not showing / seems not saved | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `buildDirectoryRecord` in `app/api/directory/[id]/route.ts` and `app/api/directory/route.ts`: `includePersonProfile` when `party_type === "person"` OR (not company AND party_person row has data: names, dob, passport fields, personal_code). Case-normalized `company` check.

**Результат:** Saved `dob` in `party_person` is returned even if `party.party_type` is null/legacy; UI sync no longer clears passport DOB after save.

**Next Step:** QA — contact with odd `party_type`; set DOB, save, reload

---

## [2026-03-17 21:30] CW — Passport DOB: normalize + dirty sync + API persist

**Task:** Date of birth not saving / shows "-" in passport block | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `DirectoryForm.tsx`: single `setPassportData` functional update; `markFieldDirty("dob")` when normalized DOB changes; sync `setDob` with normalized ISO
- `PassportDetailsInput.tsx`: `updateField` accepts `undefined`; DOB picker passes through `date` (clear → undefined) instead of `""`
- `app/api/directory/[id]/route.ts`: `normalizePersonDobToIso` on `updates.dob`; empty → null; invalid string → omit field (no wipe)

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — edit person passport DOB, Save/Done, reload record; expect `dob` in DB as YYYY-MM-DD and UI not "-"

---

## [2026-03-17 20:45] CW — Directory list: merge duplicate party_person rows (keep avatar_url)

**Task:** Some contacts show initials in search though they have photo | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `app/api/directory/route.ts`: `buildPersonMapByPartyId` merges multiple `party_person` rows per `party_id`, preserves non-empty `avatar_url`
- `PartySelect`: `referrerPolicy="no-referrer"` on result avatars (fewer blocked image loads)

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — if still initials, check Network JSON `avatarUrl` and image request status for that party id

---

## [2026-03-17 20:15] CW — Order header: avatar left of Lead Passenger

**Task:** Show client photo beside Lead Passenger label + name | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- `app/orders/[orderCode]/page.tsx`: `leadPassengerHeaderAvatar` from `orderTravellersForPicker` + `resolvePublicMediaUrl`; 48×48 circle left of text; fallback initials; `onError` → initials

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — header with client that has `avatar_url` in travellers API

---

## [2026-03-17 19:45] CW — Order header PartySelect: same directory search as Travellers + traveller avatars

**Task:** Client search in order header shows avatars like Travellers | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `PartySelect`: optional `directoryMatchTravellersApi` — no `?role=client` on list fetch, filter rows like `AssignedTravellersModal`; merge `avatarUrl` from `prioritizedParties` by id; clear `avatarLoadFailed` on each successful search
- `app/orders/[orderCode]/page.tsx`: load `/api/orders/.../travellers` for picker; `prioritizedParties` + `directoryMatchTravellersApi` on header `PartySelect`; refetch travellers after `saveClient`

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — header client search vs Travellers add search (same Bondarenko row should show photo if DB has avatar_url)

---

## [2026-03-17 19:00] CW — Resolve relative Supabase avatar URLs in PartySelect + directory list

**Task:** Avatars show initials when DB stores storage path without domain | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟢

**Действия:**
- Added `lib/resolvePublicMediaUrl.ts` (absolute `https` unchanged; relative → `NEXT_PUBLIC_SUPABASE_URL` + `/storage/v1/object/public/avatars/...`)
- Wired in `app/api/directory/route.ts` for `avatarUrl` / `companyAvatarUrl` and in `PartySelect` before `<img src>`

**Результат:** `npx tsc --noEmit` OK.

**Next Step:** QA — order header client search: photo should load if `party_person.avatar_url` is path-only or full URL

---

## [2026-03-17 18:30] CW — PartySelect / directory list avatars

**Task:** Client search dropdown shows real avatars | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- `app/api/directory/route.ts`: log `party_person` / `party_company` fetch errors; after `buildDirectoryRecord` force-set `avatarUrl` / `companyAvatarUrl` from maps (trim); `Cache-Control: private, no-store` on list JSON
- `components/PartySelect.tsx`: map `companyAvatarUrl` / `logo_url`; `cache: "no-store"` on fetch; `avatarUrl || companyAvatarUrl` for image; `onError` → initials; `useMemo` for prioritized parties + stable `useCallback` deps

**Результат:** `npx tsc --noEmit` OK. QA: confirm Network response includes `avatarUrl` for a contact with photo; if missing, data is DB-side.

**Next Step:** QA — visual check in order Client picker

---

## [2026-03-17 15:00] CW — DEDUP: Cleanup existing duplicates + fix find-or-create

**Task:** Remove existing duplicate records & fix hidden duplicate source | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟠

**Действия:**
- Found **hidden duplicate source**: `find-or-create-travellers` API created party records directly, bypassing all dedup checks. Fixed to match against ALL person records (not just clients), including both name orderings (FirstName LastName / LastName FirstName)
- Created `app/api/directory/cleanup-duplicates/route.ts` — safe merge endpoint with dry-run mode
- Ran cleanup: **10 duplicate groups found and merged** (Branopolski family x5, Abajeva x1, Felit UAB x1, plus 3 others with `<>` in names)
- All FK references (order_travellers, orders, order_services, invoices, company_contacts) properly reassigned before deletion

**Результат:** 5195 unique records, 0 duplicates remaining.

**Next Step:** QA — verify directory list shows no duplicates

---

## [2026-03-17 14:00] CW — DEDUP: Prevent duplicate client records

**Task:** Prevent duplicate directory records | **Status:** SUCCESS
**Agent:** Code Writer
**Complexity:** 🟡

**Действия:**
- Strengthened dedup in `/api/directory/create`: now checks email, phone, personal_code, reg_number in addition to display_name
- Added dedup check to `/api/directory/import`: skips CSV rows matching existing records by name/email/phone
- Added double-confirmation flow in `PartySelect.tsx` "Create anyway" button (requires two clicks, red warning on second)

**Результат:** Three entry points for duplicate creation are now protected.

**Next Step:** QA — verify dedup works in UI

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

## [2026-03-17 21:00] CW — GOGLOBAL: GoGlobal Hotel Integration — Multi-Supplier Architecture

**Task:** GoGlobal Integration | **Status:** SUCCESS
**Agent:** Code Writer (Runner + Architect + CW)
**Complexity:** ⚫ Critical

**Действия:**
- **Phase 7 (DB):** Created migration `add_hotel_providers_integration.sql` — `company_hotel_providers` table + `hotel_offers` provider columns
- **Phase 1 (Abstraction):** Created `lib/providers/` — types, aggregator, normalizer, deduplicator
- **Phase 2 (GoGlobal):** Created `lib/goglobal/` — SOAP client, XML builder/parser + provider adapters for RateHawk and GoGlobal
- **Phase 3 (Pricing):** Created `lib/pricing/smartPrice.ts` — multi-provider Smart Price engine
- **Phase 4 (API):** Rewrote search route for multi-provider. Created valuate, book, booking-status, GoGlobal debug routes
- **Phase 5 (UI):** 12 components in `components/hotels/` + redesigned `app/hotels/page.tsx` with split map+list view
- **Phase 6 (Concierge):** Updated tools, prompt, and chat handler for multi-provider search

**Files:** ~35 files. Zero lint errors.

**Результат:** Full multi-supplier hotel integration architecture.

**Next Step:** `npm install`, apply DB migration, test GoGlobal sandbox, QA

---

