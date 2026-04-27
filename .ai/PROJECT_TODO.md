# PROJECT TODO — TRAVEL CMS

Current tasks and their status. Agents update relevant rows when starting, blocking, or completing tasks.

**Status values:** TODO / IN_PROGRESS / BLOCKED / DONE / REWORK

**When starting:** Set Status to IN_PROGRESS and set Owner to your role.
**When blocked:** Set Status to BLOCKED and add reason in Notes.
**When done:** Set Status to DONE and add commit hash or PR link in PR column.
**When rework:** Set Status to REWORK with link to rework spec.

---

## PHASE 1: Orders MVP (ACTIVE)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O1 | Orders | Date format dd.mm.yyyy globally | QA | DONE | - | ✅ Implemented and verified (SCORE 9/10) |
| O2 | Orders | Cities/Countries database with flags | DB/SCHEMA → CODE WRITER | TODO | - | Need DB schema for destinations table |
| O3 | Orders | Order Client Edit (client, dates, destinations editable) | DB → CODE WRITER → QA | TODO | - | Edit mode for order detail page |
| O4 | Orders | Order Status (Active default, Cancelled manual, Finished auto) | DB → CODE WRITER → QA | TODO | - | Traffic light style, auto-finish logic |

## PHASE 2: Services

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O5 | Orders | Add services to order (as per screenshot) | DB → CODE WRITER → QA | TODO | - | Supplier/Client/Payer from DB, rest manual input |
| O6 | Orders | Auto-expand order dates from services | CODE WRITER → QA | TODO | - | Depends on O5 |
| S1 | Orders | Fix PDF parsing in Flight Itinerary | CODE WRITER → QA | TODO | - | QA SCORE 5/10 - CRITICAL issue #1 |
| S2 | Orders | Implement Link to Flight dropdown | CODE WRITER → QA | TODO | - | QA SCORE 5/10 - CRITICAL issue #2 |
| S3 | Orders | Add missing fields to Edit Service Modal | CODE WRITER → QA | TODO | - | QA SCORE 5/10 - CRITICAL issue #3 |
| S4 | Orders | Add form validation (dates, prices, clients) | CODE WRITER → QA | TODO | - | QA SCORE 5/10 - HIGH issues #4-7 |
| S5 | Orders | Fix auto-generation and error messages | CODE WRITER → QA | TODO | - | QA SCORE 5/10 - MEDIUM issues #8-10 |
| S6 | Orders | Add tooltips and confirmations | CODE WRITER → QA | TODO | - | QA SCORE 5/10 - LOW issues #11-12 |
| S7 | Orders | Fix build error in OrderClientSection (JSX parse) | QA | DONE | - | ✅ Fixed by Code Writer, verified by QA (SCORE 9/10) |
| S8 | Orders | Fix duplicate closing div tags in OrderClientSection | CODE WRITER | DONE | feature/x | ✅ Fixed missing closing bracket for condition (line 505) |
| S9 | Orders | Add accessible name to Order Type select | CODE WRITER | DONE | feature/x | ✅ Added aria-label="Order Type" for WCAG compliance |
| S10 | Orders | Fix null/undefined handling in route display | CODE WRITER | DONE | feature/x | ✅ Added null checks for dateFrom/dateTo and parsedRoute.origin |
| S11 | Orders | Hotel Special Request — Tour Package + expand options | DB → CW → QA | TODO | - | Spec: `.ai/tasks/hotel-special-request-preferences-improvement.md` |

## PHASE 2.5: Order Detail Redesign (ACTIVE)

| ID | Area | Task | Pipeline | Current | Status | SCORE | Last Action |
|----|------|------|----------|---------|--------|-------|-------------|
| OD1 | Orders | Увеличить размер шрифтов на странице заказа | CW→QA | QA | DONE | 10/10 | [09.01 20:45] Fonts increased |
| OD2 | Orders | Карта на всю ширину внизу секции клиента | CW→QA | QA | DONE | 10/10 | [09.01 20:45] Map moved fullwidth |
| OD3 | Orders | Дни/ночи в скобках после дат | CW→QA | QA | DONE | 10/10 | [09.01 20:45] Days/nights added |
| OD4 | Orders | EditServiceModal = все поля AddServiceModal | CW→QA | QA | DONE | 10/10 | [12.01] ✅ Replaced by OD11 EditServiceModalNew |
| OD5 | Orders | Чекбоксы для выбора сервисов + UX improvements | CW→QA | QA | DONE | 10/10 | [09.01 23:35] Invoice Phase 1 complete ✅ |
| OD6 | Orders | Invoice Creator in Finance tab + live preview | CW→QA | QA | DONE | 10/10 | [09.01 22:25] User confirmed: works perfectly! ✅ |
| **OD6-FIX** | **Orders** | **Fix: Invoice list не обновляется** | **CW→QA** | **QA** | **DONE** | **10/10** | **[09.01 23:24] QA verified: all fixes work ✅** |
| OD7-BUG | Orders | REGRESSION: Service Edit modal не открывается | CW→QA | QA | DONE | 10/10 | [12.01] ✅ Fixed via OD11 EditServiceModalNew |
| OD8 | Remove Expanded Row | - | CW | ✅ DONE | 10/10 | [12.01 18:00] Removed expanded row |
| OD9 | Cancel on Hover | - | CW | ✅ DONE | 10/10 | [12.01 18:00] Added Cancel button |
| OD10 | Edit on Double-Click | - | CW | ✅ DONE | 10/10 | [12.01 18:00] Double-click opens EditServiceModalNew |
| OD11 | Edit Service Modal Redesign | - | CW | ✅ DONE | 10/10 | [12.01 18:00] New compact modal with cards |
| OD12 | DirectoryCombobox | - | CW | ✅ DONE | 10/10 | [12.01 18:00] Autocomplete component created |
| OD13 | Checklist Panel | - | CW | ✅ DONE | 10/10 | [12.01 18:00] Dynamic checklist with links |
| OD14 | Payment Section Empty State | - | CW | ✅ DONE | 10/10 | [12.01 18:00] Empty state with CTA |
| OD15 | Split Modal (Multi) | - | CW | ✅ DONE | 10/10 | [12.01 18:30] Dual Split system: single + multi |
| **SVC-FIX-1** | **Orders** | **Edit в Service не работает (doubleClick)** | **CW→QA** | **✅ DONE** | **9/10** | **[09.01 22:45] doubleClick на всю строку** |
| **SVC-FIX-2** | **Orders** | **В сервисах нет Supplier и Client** | **CW→QA** | **✅ DONE** | **9/10** | **[09.01 22:45] supplierPartyId mapped** |
| **SVC-FIX-3** | **Orders** | **Edit = Add (ВСЕ поля)** | **CW→QA** | **✅ DONE** | **9/10** | **[09.01 22:45] Full 640 lines sync** |
| **SVC-FIX-4** | **Orders** | **Cancelled filter с localStorage** | **CW→QA** | **✅ DONE** | **9/10** | **[09.01 22:45] Toggle + persistence** |

**Spec:** `.ai/tasks/order-detail-redesign.md`
**UI Audit:** `.ai/tasks/ui-order-detail-page-0002-26-sm-audit.md`
**Services Table Spec:** `.ai/tasks/code-writer-od2-services-table-redesign.md`

**OD6-FIX — COMPLETED ✅:**
- **Original Defect:** `handleSave()` doesn't call `onSuccess()` → list doesn't refresh
- **Fix Applied:** ✅ Added `onSuccess?.();` after alert and before `onClose()` (line 117)
- **Additional Fixes by Code Writer:**
  - ✅ URL Encoding: `encodeURIComponent(orderCode)` (commit `7be7a35`) — CRITICAL
  - ✅ Detailed error logging (commits `6edb78b`, `54d0b5a`)
  - ✅ API integration полностью работает
- **User Confirmation:** "✅ Invoice created successfully!" + "это уже работает"
- **QA Score:** 10/10 — PRODUCTION READY ✅

## PHASE 3: Finance

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O7 | Finance | Payment form in Finance tab | DB → CODE WRITER → QA | TODO | - | Amount, type (bank/cash/card), date, payer, invoice link |
| O8 | Finance | Invoice creation with service selection | DB → CODE WRITER → QA | DONE | feature/x | ✅ OD6 completed |
| **O7-IMPL** | **Finance** | **Payment System: DB + API + UI** | **DB→CW→QA** | **READY_FOR_RUNNER** | **feature/x** | **[27.04] CW follow-up: InvoiceCreator now remembers selected invoice language in payer/client Directory after invoice creation; targeted checks passed** |
| **O8-IMPL** | **Finance** | **Email System: Send Invoice + Track** | **CW→QA** | **TODO** | **-** | **🔴 HIGH: email service, template, API, delivery tracking** |
| FN1 | Finance | Edit Invoice button + handlers | CW→QA | DONE | feature/x | [11.01] ✅ Phase 1 complete |
| SUPINV1 | Finance | Supplier invoice matching + accounting workflow | Runner | DONE | feature/x | [27.04] ✅ Closed by Runner: supplier invoice matching + accounting workflow complete. SCORE 8.5/10. |
| SUPINV-UI-FIX | Finance | Supplier invoices UI cleanup (compact column, services indicator, Documents counter, auto-match) | CW→QA | IN_QA | feature/x | [27.04] Step 1+2 done: visual cleanup + auto-suggest matches + missing-services list under Documents banner. Helper `lib/finances/supplierInvoiceAutoMatch.ts` covered by `scripts/test-supplier-invoice-auto-match.mjs`. Modal pre-selects suggested services, shows green Suggested chip + reasons, has "Apply suggestions" button. Document row shows sparkle indicator on the Match icon when suggestions are available. Documents tab now lists missing services with inline Required/Periodic/Not required select. Awaiting QA. |
| SUPINV-PERIODIC | Finance | Auto-Periodic for periodic suppliers (Directory flag → default + backfill) | DB→CW→QA | READY_FOR_QA | feature/x | [27.04] Steps 2.1–2.4 done. New helper `lib/finances/periodicSupplierFlag.ts` (covered by `scripts/test-periodic-supplier-flag.mjs`). Service POST defaults to Periodic when supplier is flagged and the request didn't override. Directory PUT triggers an automatic backfill on flip false→true: switches all required services without supplier-invoice docs to Periodic across Active/Draft/On hold orders, returns `{ servicesUpdated, ordersAffected }`, UI shows a blue chip next to "Saved!". Awaiting QA. |
| EXP-PROCESS | Finance | Accountant "Process" workflow for Company Expenses (mirror of Invoices/Suppliers Invoices) | DB→CW→QA | READY_FOR_QA | feature/x | [28.04] Migration `add_company_expenses_accounting.sql` adds `accounting_state` (pending/processed) + `accounting_processed_at` + `accounting_processed_by` to `company_expense_invoices`. New endpoint `PATCH /api/finances/company-expenses/[id]/process` (Finance/Supervisor/Admin only) toggles state, sets/clears timestamp + actor. UI: new Accounting column with badge (Pending amber / Processed green + processed date), inline Process / Revert button with confirm, accounting filter (All / Pending(N) / Processed) in the toolbar. tsc clean. Awaiting QA. |

## PHASE 4: UI Enhancements

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O9 | Orders | Clickable phone/email next to client | QA | DONE | - | ✅ Implemented and verified (SCORE 9/10) |
| O10 | Orders | Client trip section (map, countdown, payment status) | UI → CODE WRITER → QA | TODO | - | Map with destinations, days countdown |
| O11 | Orders | Client Score section (1-10 rating) | DB → CODE WRITER → QA | TODO | - | Add rating to party table |
| O12 | Orders | Weather forecast for destination | CODE WRITER → QA | TODO | - | External API integration |
| **O14** | **Orders** | **Trip Details section: Map + Itinerary** | **UI → CODE WRITER → QA** | **TODO** | **-** | **New section: wide/high map showing route + daily itinerary with services** |

## PHASE 5: UI/UX Improvements (Directory Form)

### HIGH Priority (Quick Wins)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| UI1 | Directory | Ripple Effect on buttons (Material Design) | QA | DONE | - | ✅ QA SCORE 9/10 - All criteria met |
| UI2 | Directory | Inline Validation with icons | QA | DONE | - | ✅ QA SCORE 9/10 - All criteria met |
| UI3 | Directory | Smooth Section Transitions (fade-in + expand) | QA | DONE | - | ✅ QA SCORE 9/10 - All criteria met |
| UI4 | Directory | Mobile-first Layout improvements | QA | DONE | - | ✅ QA SCORE 9/10 - All criteria met |

### MEDIUM Priority (UX Enhancements)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| UI5 | Directory | Smooth field appearance on Type selection | UI → CODE WRITER → QA | TODO | - | UI Proposal #1 - fade-in + slide-up animation |
| UI6 | Directory | Form completion progress bar | UI → CODE WRITER → QA | TODO | - | UI Proposal #10 - "60% заполнено" indicator |
| UI7 | Directory | Accordion sections for Supplier/Subagent | UI → CODE WRITER → QA | TODO | - | UI Proposal #14 - collapsible sections |
| UI8 | Directory | Enhanced Focus Indicators (WCAG 2.1 AA) | UI → CODE WRITER → QA | TODO | - | UI Proposal #22 - better keyboard navigation |

### LOW Priority (Nice-to-Have)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| UI9 | Directory | Floating Labels (Material Design 3) | UI → CODE WRITER → QA | TODO | - | UI Proposal #2 - labels move up on focus |
| UI10 | Directory | Character Counter for limited fields | UI → CODE WRITER → QA | TODO | - | UI Proposal #3 - Phone/Email/Personal Code |
| UI11 | Directory | Smart Placeholders with format hints | UI → CODE WRITER → QA | TODO | - | UI Proposal #4 - dynamic placeholders |
| UI12 | Directory | Success Celebration animation | UI → CODE WRITER → QA | TODO | - | UI Proposal #19 - confetti or pulsing checkmark |
| UI13 | Directory | Glassmorphism for Statistics Panel | UI → CODE WRITER → QA | TODO | - | UI Proposal #25 - backdrop-blur effect |
| UI14 | Directory | Form State Persistence (localStorage draft) | UI → CODE WRITER → QA | TODO | - | UI Proposal #30 - save form state on close |

## PHASE 5.5: External Integrations (ACTIVE)

| ID | Area | Task | Pipeline | Current | Status | SCORE | Last Action |
|----|------|------|----------|---------|--------|-------|-------------|
| BOOK1 | Integrations | Booking.com API — Smart Pricing System | SEC→CW→QA | SEC | TODO | - | [12.01 21:30] Spec created |

**Spec:** `.ai/tasks/booking-api-integration.md`

**Scope:**
- `lib/booking/` — API Client (client.ts, types.ts, config.ts)
- `lib/pricing/smartPrice.ts` — Smart Price calculation
- `app/api/booking/` — API routes (search, hotel, compare)
- `components/HotelCompare/` — UI components

---

## PHASE 6: Roles & User Management

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O13 | System | Accountant role with financial reports | DB → SECURITY → CODE WRITER → QA | TODO | - | New role, report access |
| **USR2** | **System** | **Dynamic Roles (5 roles + permissions)** | **DB→CW→QA** | **DB** | **DONE** | **10/10** | **[17.01] ✅ Migration executed in Supabase** |
| **USR1** | **System** | **User Management: Supervisor adds users** | **CW→QA** | **DONE** | **10/10** | **[19.01] ✅ API + UI + Avatar + Role Permissions modal** |
| USR3 | System | User invite flow (email + temp password) | CW→QA | TODO | - | Email service integration |
| **USR4** | **System** | **User profile & password change** | **CW→QA** | **DONE** | **10/10** | **[19.01] ✅ Profile + Password + Avatar upload** |
| **USR5** | **System** | **Feature Modules (SaaS)** | **DB→CW→QA** | **TODO** | **-** | **🟠 Features table, company_features** |
| **USR6** | **System** | **Subscription Plans (SaaS)** | **DB→CW→QA** | **TODO** | **-** | **🟠 Plans, billing, Stripe ready** |
| **AUTH1** | **Auth** | **Logout functionality** | **CW→QA** | **DONE** | **10/10** | **[17.01] ✅ supabase.signOut() + redirect /login** |
| **AUTH2** | **Auth** | **Protected Routes (require login)** | **CW→QA** | **DONE** | **10/10** | **[17.01] ✅ AuthGuard + session check** |

**Spec:** `.ai/tasks/user-management-system.md`

**USR1-6 Scope (SaaS Ready):**
- **Roles:** Subagent (own), Agent (all), Finance (финансы), Manager (all+settings), Supervisor (admin)
- **DB:** `roles`, `user_profiles`, `features`, `subscription_plans`, `company_subscriptions`
- **UI:** `/settings/users`, `/settings/billing`
- **Security:** RLS policies per role, Supervisor-only access to user management
- **SaaS:** Feature modules with pricing, subscription plans (Free/Pro/Business/Enterprise)

---

## PHASE 6.5: Package Tour & Directory (ACTIVE)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| PT1 | Orders | Split: copy all fields (flight_segments, hotel, etc.) | CW | DONE | - | ✅ Implemented |
| PT2 | Orders | Split: copy order_service_travellers | CW | DONE | - | ✅ Implemented |
| PT3 | Orders | Itinerary: deduplicate flights for splitted | CW | DONE | - | Already via seenSegmentKeys |
| PT4 | Orders | Itinerary: deduplicate hotel check-in/check-out for splitted | CW | DONE | - | splitGroupId + seenSplitGroupHotelIds |
| PT5 | Orders | Itinerary: deduplicate Transfer for splitted | CW | DONE | - | seenSplitGroupTransferIds |
| PT6 | Orders | Itinerary: show traveller surnames per event | CW | DONE | - | assignedTravellerIds → travellerSurnames |
| PT7 | Orders | Itinerary: excursions/VIP — show once + surnames | CW | DONE | - | Same as PT4-6 |
| DIR1 | Directory | Parsing: fix firstName/lastName (AI + find-or-create) | CW | DONE | - | Passport MRZ, parse-package-tour, find-or-create |
| DIR2 | Directory | Merge contacts | CW | DONE | - | API /api/directory/merge + MergeContactModal |
| DIR3 | Directory | Search: diacritics, typos, layout, name variants | CW | DONE | - | lib/directory/searchNormalize.ts |

---

## PHASE 7: Directory Enhancements

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| D1 | Directory | Add Passport Details to Main Details (AI parsing) | CODE WRITER | DONE | feature/x | ✅ QA SCORE 9/10 - All parts completed |
| DIR-STATS | Directory | Client Statistics Panel (Orders/Total/Debt/Trips) | CODE WRITER | DONE | feature/x | ✅ [18.01 03:15] API + UI implemented |

## PHASE 8: Dashboard UI Improvements

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| DASH1 | Dashboard | Dashboard Redesign (Turion Style) | CODE WRITER | DONE | feature/x | ✅ UI components created (8 components) |
| DASH2 | Dashboard | Profit & Orders Chart: Future dates as forecast (dashed line) | CODE WRITER | DONE | feature/x | ✅ Currency formatting + forecast lines |
| DASH3 | Dashboard | Travelers Map: Rename + Recently Completed split | CODE WRITER | DONE | feature/x | ✅ Renamed + split implemented |
| DASH4 | Dashboard | Period Selector: Shopify-style dropdown | CODE WRITER | DONE  | **feature/x** | **⚠️ Custom не работает, нужен календарь. Spec: .ai/tasks/code-writer-dash4-5-rework.md** |
| DASH5 | Dashboard | Target Speedometer: Professional redesign | CODE WRITER | DONE  | **feature/x** | **⚠️ Зелёная зона должна быть на 80%, не 100%. Spec: .ai/tasks/code-writer-dash4-5-rework.md** |
| DASH4-FIX | Dashboard | Calendar: ограничить maxDate = сегодня | CW→QA | CW | TODO | - | [09.01 14:15] Spec created |
| MAP-01 | Dashboard | Travelers on map: stop flicker + auto-geocode unknown cities + per-stop markers | CW→QA | CW | IN_PROGRESS | feature/x | [16.04 Step 1/7 DONE] force-dynamic + no-store + AbortController |

## LEGACY TASKS (Directory)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| 2 | Directory | Implement directory list loading on /directory page | CODE WRITER | TODO | - | QA identified issue |
| 3 | Directory | Fix edit navigation, remove Status/View, instant search | CODE WRITER | TODO | - | 3 issues |
| 4 | Directory | Fix duplicate search, record not found, missing Save buttons | CODE WRITER | TODO | - | 3 issues |
| 5 | Directory | Fix inconsistent field labels | CODE WRITER | TODO | - | Labels consistency |
| 8 | Directory | Fix Supplier role mapping | CODE WRITER | TODO | - | business_category mapping |
| 10 | Directory | Check company_id for records | DB/SCHEMA | TODO | - | Records don't open |
| 12 | Directory | Fix clientType initialization | CODE WRITER | TODO | - | Type switching bug |
| 13 | Directory | Fix Directory search - company_name | CODE WRITER | TODO | - | Search doesn't find companies |

---

## 🧪 QA TEST TASK

| ID | Task | Pipeline | Current | Status | SCORE | Last Action |
|----|------|----------|---------|--------|-------|-------------|
| QA-TEST | Тестовая задача: проверить работу QA агента | QA | QA | DONE | 10/10 | [09.01 15:30] QA completed all steps successfully |
| ORDERS-LIST | Orders INV/PAY/Cities | CW→QA | QA | READY_FOR_QA | - | [10.01 12:30] Implemented |

**Выполнено:**
1. ✅ Прочитан NEW_PROJECT_RULES.md
2. ✅ Выполнены команды проверки директории (pwd, git branch, git worktree)
3. ✅ Добавлена запись в QA_LOG.md
4. ✅ Статус обновлён на DONE
5. ✅ SCORE: 10/10

