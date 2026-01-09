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

## PHASE 2.5: Order Detail Redesign (ACTIVE)

| ID | Area | Task | Pipeline | Current | Status | SCORE | Last Action |
|----|------|------|----------|---------|--------|-------|-------------|
| OD1 | Orders | Увеличить размер шрифтов на странице заказа | CW→QA | CW | DONE | 10/10 | [09.01 20:45] Fonts increased |
| OD2 | Orders | Карта на всю ширину внизу секции клиента | CW→QA | CW | DONE | 10/10 | [09.01 20:45] Map moved fullwidth |
| OD3 | Orders | Дни/ночи в скобках после дат | CW→QA | CW | DONE | 10/10 | [09.01 20:45] Days/nights added |
| OD4 | Orders | EditServiceModal = все поля AddServiceModal | CW→QA | CW | TODO | - | [09.01 20:45] CW started (complex task) |
| OD5 | Orders | Чекбоксы для выбора сервисов | CW→QA | CW | TODO | - | [09.01] Spec created |
| OD6 | Orders | Кнопка "Выписать счёт" → Invoice Modal | CW→QA | CW | TODO | - | [09.01] Spec created |

**Spec:** `.ai/tasks/order-detail-redesign.md`

## PHASE 3: Finance

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O7 | Finance | Payment form in Finance tab | DB → CODE WRITER → QA | TODO | - | Amount, type (bank/cash/card), date, payer, invoice link |
| O8 | Finance | Invoice creation with service selection | DB → CODE WRITER → QA | TODO | - | Select services, payer, email sending |

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

## PHASE 6: Roles

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O13 | System | Accountant role with financial reports | DB → SECURITY → CODE WRITER → QA | TODO | - | New role, report access |

---

## PHASE 7: Directory Enhancements

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| D1 | Directory | Add Passport Details to Main Details (AI parsing) | CODE WRITER | DONE | feature/x | ✅ QA SCORE 9/10 - All parts completed |

## PHASE 8: Dashboard UI Improvements

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| DASH1 | Dashboard | Dashboard Redesign (Turion Style) | CODE WRITER | DONE | feature/x | ✅ UI components created (8 components) |
| DASH2 | Dashboard | Profit & Orders Chart: Future dates as forecast (dashed line) | CODE WRITER | DONE | feature/x | ✅ Currency formatting + forecast lines |
| DASH3 | Dashboard | Travelers Map: Rename + Recently Completed split | CODE WRITER | DONE | feature/x | ✅ Renamed + split implemented |
| DASH4 | Dashboard | Period Selector: Shopify-style dropdown | CODE WRITER | DONE  | **feature/x** | **⚠️ Custom не работает, нужен календарь. Spec: .ai/tasks/code-writer-dash4-5-rework.md** |
| DASH5 | Dashboard | Target Speedometer: Professional redesign | CODE WRITER | DONE  | **feature/x** | **⚠️ Зелёная зона должна быть на 80%, не 100%. Spec: .ai/tasks/code-writer-dash4-5-rework.md** |
| DASH4-FIX | Dashboard | Calendar: ограничить maxDate = сегодня | CW→QA | CW | TODO | - | [09.01 14:15] Spec created |

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

**Выполнено:**
1. ✅ Прочитан NEW_PROJECT_RULES.md
2. ✅ Выполнены команды проверки директории (pwd, git branch, git worktree)
3. ✅ Добавлена запись в QA_LOG.md
4. ✅ Статус обновлён на DONE
5. ✅ SCORE: 10/10

