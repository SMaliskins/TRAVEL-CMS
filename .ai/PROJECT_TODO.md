# PROJECT TODO — TRAVEL CMS

Current tasks and their status. Agents update relevant rows when starting, blocking, or completing tasks.

**Status values:** TODO / IN_PROGRESS / BLOCKED / DONE

**When starting:** Set Status to IN_PROGRESS and set Owner to your role.
**When blocked:** Set Status to BLOCKED and add reason in Notes.
**When done:** Set Status to DONE and add commit hash or PR link in PR column.

---

## PHASE 1: Orders MVP (ACTIVE)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O1 | Orders | Date format dd.mm.yyyy globally | CODE WRITER | TODO | - | Simple, no DB changes |
| O2 | Orders | Cities/Countries database with flags | DB/SCHEMA → CODE WRITER | TODO | - | Need DB schema for destinations table |
| O3 | Orders | Order Client Edit (client, dates, destinations editable) | DB → CODE WRITER → QA | TODO | - | Edit mode for order detail page |
| O4 | Orders | Order Status (Active default, Cancelled manual, Finished auto) | DB → CODE WRITER → QA | TODO | - | Traffic light style, auto-finish logic |

## PHASE 2: Services

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O5 | Orders | Add services to order (as per screenshot) | DB → CODE WRITER → QA | TODO | - | Supplier/Client/Payer from DB, rest manual input |
| O6 | Orders | Auto-expand order dates from services | CODE WRITER → QA | TODO | - | Depends on O5 |

## PHASE 3: Finance

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O7 | Finance | Payment form in Finance tab | DB → CODE WRITER → QA | TODO | - | Amount, type (bank/cash/card), date, payer, invoice link |
| O8 | Finance | Invoice creation with service selection | DB → CODE WRITER → QA | TODO | - | Select services, payer, email sending |

## PHASE 4: UI Enhancements

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O9 | Orders | Clickable phone/email next to client | CODE WRITER → QA | TODO | - | tel: and mailto: links |
| O10 | Orders | Client trip section (map, countdown, payment status) | UI → CODE WRITER → QA | TODO | - | Map with destinations, days countdown |
| O11 | Orders | Client Score section (1-10 rating) | DB → CODE WRITER → QA | TODO | - | Add rating to party table |
| O12 | Orders | Weather forecast for destination | CODE WRITER → QA | TODO | - | External API integration |

## PHASE 5: Roles

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| O13 | System | Accountant role with financial reports | DB → SECURITY → CODE WRITER → QA | TODO | - | New role, report access |

---

## LEGACY TASKS (Directory)

| ID | Area | Task | Owner | Status | Branch | Notes |
|----|------|------|-------|--------|--------|-------|
| 2 | Directory | Implement directory list loading on /directory page | CODE WRITER | TODO | - | QA identified issue |
| 3 | Directory | Fix edit navigation, remove Status/View, instant search | CODE WRITER | TODO | - | 3 issues |
| 4 | Directory | Fix duplicate search, record not found, missing Save buttons | CODE WRITER | TODO | - | 3 issues |
| 5 | Directory | Fix inconsistent field labels | CODE WRITER | TODO | - | Labels consistency |
| 6 | Directory | Fix Company details mapping | CODE WRITER | BLOCKED | - | Waiting for DB/SCHEMA |
| 8 | Directory | Fix Supplier role mapping | CODE WRITER | TODO | - | business_category mapping |
| 10 | Directory | Check company_id for records | DB/SCHEMA | TODO | - | Records don't open |
| 12 | Directory | Fix clientType initialization | CODE WRITER | TODO | - | Type switching bug |
| 13 | Directory | Fix Directory search - company_name | CODE WRITER | TODO | - | Search doesn't find companies |
