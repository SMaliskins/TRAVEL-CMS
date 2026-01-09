# Directory v1 - Full Architecture Specification & Implementation Plan

**Created:** 2024-12-19  
**Status:** 🚧 Planning Phase  
**Branch:** `feat/directory-create`

---

## Executive Summary

Directory = единый реестр "контрагентов" (Party), где одна запись может быть Person или Company и иметь несколько ролей (Client, Supplier, Subagent). Это ключевой подход лучших CRM: не плодить отдельные таблицы, а держать одну карточку с ролями.

---

## 1. Architecture Overview

### 1.1 Core Concept

**Directory = Party System**
- One record = one Party (Person OR Company)
- One Party can have multiple Roles (Client, Supplier, Subagent)
- Roles enable different UI sections and business logic
- Unified API: `DirectoryRecord` interface

### 1.2 Data Model Structure

```
party (core table)
├── party_person (if type = 'person')
├── party_company (if type = 'company')
├── client_party (if role includes 'client')
├── partner_party (if role includes 'supplier')
└── subagents (if role includes 'subagent')
```

### 1.3 Implementation Approach

**Option A (Preferred):** Universal model with role tables (better for future)  
**Option B (Temporary):** Use existing clients/suppliers/subagents tables with unified UI/API

**Decision:** Start with Option A (universal model) as it's already partially implemented.

---

## 2. Data Structure Specification

### 2.1 Core Fields (party table)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `display_name` | text | Yes | Main name for listing (computed or stored) |
| `party_type` | enum | Yes | 'person' or 'company' |
| `status` | enum | Yes | 'active', 'inactive', 'blocked' (default: 'active') |
| `rating` | integer | No | 1-10 (manual + future auto-scoring) |
| `notes` | text | No | Internal notes |
| `company_id` | UUID | Yes | Tenant/company isolation |
| `created_at` | timestamp | Yes | Auto |
| `updated_at` | timestamp | Yes | Auto |
| `created_by` | UUID | Yes | auth.uid() |
| `email` | text | No | Primary email |
| `phone` | text | No | Primary phone |
| `email_marketing_consent` | boolean | No | Default: false |
| `phone_marketing_consent` | boolean | No | Default: false |

**Roles:** Stored via junction tables (client_party, partner_party, subagents)

### 2.2 Person Fields (party_person table)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `party_id` | UUID | Yes | FK to party.id |
| `title` | text | No | 'Mr', 'Mrs', 'Chd', etc. |
| `first_name` | text | **Yes** | Required for person |
| `last_name` | text | **Yes** | Required for person |
| `dob` | date | **No** | Date of birth (NOT required) |
| `personal_code` | text | **No** | Personal ID code (NOT required) |
| `citizenship` | text | No | Country code (autocomplete from countries list) |
| `address` | text | No | Physical address |

### 2.3 Company Fields (party_company table)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `party_id` | UUID | Yes | FK to party.id |
| `company_name` | text | **Yes** | Required for company |
| `reg_number` | text | **No** | Registration number (NOT required) |
| `legal_address` | text | **No** | Legal address (NOT required) |
| `actual_address` | text | No | Physical address |
| `bank_details` | text | No | Bank account info |

### 2.4 Documents (party_documents table) - Future

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `party_id` | UUID | Yes | FK to party.id |
| `doc_type` | enum | Yes | 'passport', 'id', 'other' |
| `doc_number` | text | Yes | Document number |
| `issued_at` | date | No | Issue date |
| `valid_till` | date | No | Expiry date |
| `issued_by` | text | No | Issuing authority |
| `file_url` | text | No | Scanned document (future: OCR integration) |

**Future Feature:** Document expiry notifications (configurable threshold: 6m/3m/etc.)

### 2.5 Supplier Add-on (partner_party table)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `party_id` | UUID | Yes | FK to party.id |
| `business_category` | enum | No | 'TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other' |
| `commission_type` | enum | No | 'percent', 'fixed' |
| `commission_value` | numeric | No | Commission amount |
| `commission_currency` | text | No | Default: 'EUR' |
| `commission_valid_from` | date | No | Commission start date |
| `commission_valid_to` | date | No | Commission end date |
| `commission_notes` | text | No | Notes about commission terms |

**Future:** Auto-apply commission in services

### 2.6 Subagent Add-on (subagents table)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `party_id` | UUID | Yes | FK to party.id |
| `commission_scheme` | enum | No | 'revenue', 'profit' |
| `commission_tiers` | jsonb | No | Progressive tiers (default: yearly, optional period) |
| `payout_details` | text | No | Payment instructions |

**Future:** Payment history tracking

### 2.7 CRM Add-ons (Future - Architecture Only)

- **Tags/Segments:** `party_tags` table (VIP, corporate, risky, etc.)
- **Preferences:** `party_preferences` table (languages, room type, favorite destinations)
- **Timeline:** `party_timeline` table (calls, emails, WhatsApp, changes)
- **Merge duplicates:** Logic to merge duplicate parties
- **Portal access:** `portal_users` table (party_id ↔ auth.user_id)

---

## 3. UI/UX Specification

### 3.1 Directory List Page (`/directory`)

**Layout:**
- Single table with filters in TopBar search
- Compact, enterprise-grade design
- Maximum "quick decisions" information

**Filters (in TopBar search):**
- Name
- Personal code
- DOB
- Phone/Email
- Type: Person/Company
- Role: Client/Supplier/Subagent (multi-select)
- Status: active/inactive/blocked
- Rating range (optional)
- Debt only (optional)

**Table Columns:**
1. **Name** - Title + First Name + Last Name (or Company Name) + role badges + status dot
2. **Phone** - Clickable (tel: link)
3. **Email** - Clickable (mailto: link)
4. **Type** - Icon (person/company)
5. **Rating** - Compact display (1-10 stars/bars)
6. **Last Trip Date** - From orders (MAX date_from WHERE client_party_id = party.id)
7. **Next Trip Date** - From orders (MIN date_from WHERE client_party_id = party.id AND date_from > NOW())
8. **Total Spent** - From orders (SUM amount_total WHERE client_party_id = party.id)
9. **Debt** - From orders (SUM amount_total - amount_paid WHERE client_party_id = party.id AND amount_paid < amount_total)
10. **Updated** - Last update timestamp

**Actions:**
- Click row → open detail/card view
- Quick actions: Call, Email, Edit
- Bulk actions: Export, Tag, Change status

### 3.2 Directory Card/Detail View (`/directory/[id]`)

**Header Section (Sticky):**
- **Name** (large, prominent)
- **Role badges** + **Status** (compact, near name)
- **Phone** (clickable tel: link)
- **Email** (clickable mailto: link)
- **Rating** (visual display)
- **Sticky Save Bar:** Save | Save & Close | Cancel (stays visible when scrolling)

**Body Layout (2 columns, compact):**

**Left Column:**
- **Identity Section**
  - Person: Title + First Name + Last Name
  - Company: Company Name
  - Type indicator
- **Contacts Section**
  - Email + checkbox (email marketing consent)
  - Phone + checkbox (SMS/phone marketing consent)
  - Optional: Additional contacts (if implemented)
- **Roles/Status Section**
  - Role selection (Client, Supplier, Subagent) - at least 1 required
  - Status selector (active/inactive/blocked)
  - Rating input (1-10)

**Right Column (Tabs/Sections):**
1. **Overview Tab**
   - Statistics (total spent, last/next trip dates)
   - Loyalty info (if implemented)
2. **Orders & Statistics Tab**
   - List of orders linked to this party
   - Statistics charts/graphs
3. **Documents Tab** (Future)
   - List of documents
   - Upload new document
   - Expiry warnings
4. **Loyalty & Frequent Flyer Tab** (Future)
   - Loyalty program info
   - Points/status
5. **Commissions Tab** (if Supplier/Subagent role)
   - Commission terms
   - History
   - Payout details
6. **Notes / Timeline Tab**
   - Internal notes
   - Activity timeline (future)

**Anchor Logic:**
- If user adds Supplier/Subagent role → scroll to Commissions section

### 3.3 Form Validation Rules

**Required Fields:**
- Person: `first_name` + `last_name`
- Company: `company_name`
- At least 1 role must be selected
- `display_name` (computed or required)

**NOT Required (per requirements):**
- `personal_code`
- `dob`
- `reg_number`
- `legal_address`

**Validation Logic:**
- If `party_type = 'person'` → require `first_name` and `last_name`
- If `party_type = 'company'` → require `company_name`
- At least one role must be selected
- Email format validation (if provided)
- Phone format validation (if provided)

### 3.4 Duplicate Detection (Anti-Duplicate System)

**On Create/Edit:**
- Check for duplicates by:
  1. `personal_code` / `reg_number` (exact match if provided)
  2. `email` / `phone` (exact match)
  3. `name + dob` (fuzzy match for persons)

**UI Behavior:**
- Show "Possible duplicates" modal/list
- Options:
  - Open existing record
  - Continue creating new (with confirmation)

**Implementation:**
- API endpoint: `POST /api/directory/check-duplicates`
- Returns list of potential duplicates with similarity score
- Frontend shows modal with options

---

## 4. API Specification

### 4.1 DirectoryRecord TypeScript Interface

```typescript
export interface DirectoryRecord {
  // Core
  id: string;
  display_name: string;
  party_type: 'person' | 'company';
  roles: ('client' | 'supplier' | 'subagent')[];
  status: 'active' | 'inactive' | 'blocked';
  rating?: number; // 1-10
  notes?: string;
  company_id: string; // Tenant isolation
  
  // Contacts (not duplicated)
  email?: string;
  phone?: string;
  email_marketing_consent?: boolean;
  phone_marketing_consent?: boolean;
  
  // Person fields
  title?: string; // Mr/Mrs/Chd
  first_name?: string; // Required if person
  last_name?: string; // Required if person
  dob?: string; // NOT required
  personal_code?: string; // NOT required
  citizenship?: string;
  address?: string;
  
  // Company fields
  company_name?: string; // Required if company
  reg_number?: string; // NOT required
  legal_address?: string; // NOT required
  actual_address?: string;
  bank_details?: string;
  
  // Supplier add-on
  supplier_details?: {
    business_category?: 'TO' | 'Hotel' | 'Rent a car' | 'Airline' | 'DMC' | 'Other';
    commission_type?: 'percent' | 'fixed';
    commission_value?: number;
    commission_currency?: string;
    commission_valid_from?: string;
    commission_valid_to?: string;
    commission_notes?: string;
  };
  
  // Subagent add-on
  subagent_details?: {
    commission_scheme?: 'revenue' | 'profit';
    commission_tiers?: any; // JSON structure
    payout_details?: string;
  };
  
  // Statistics (computed, not stored)
  total_spent?: number;
  last_trip_date?: string;
  next_trip_date?: string;
  debt?: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}
```

### 4.2 API Endpoints

**List:**
- `GET /api/directory` - List all parties (with filters, pagination)
- Query params: `type`, `role`, `status`, `search`, `page`, `limit`

**Detail:**
- `GET /api/directory/[id]` - Get single party with all details

**Create:**
- `POST /api/directory/create` - Create new party
- Body: `DirectoryRecord` (partial)

**Update:**
- `PUT /api/directory/[id]` - Update party
- Body: `DirectoryRecord` (partial)

**Delete:**
- `DELETE /api/directory/[id]` - Soft delete (set status = 'inactive')

**Duplicate Check:**
- `POST /api/directory/check-duplicates` - Check for duplicates
- Body: `{ email?, phone?, personal_code?, reg_number?, first_name?, last_name?, dob? }`
- Returns: `{ duplicates: Array<{ id, display_name, similarity_score, match_fields }> }`

**Statistics:**
- `GET /api/directory/[id]/statistics` - Get party statistics
- Returns: `{ total_spent, last_trip_date, next_trip_date, debt, order_count }`

---

## 5. Implementation Phases

### Phase 1: Database Schema & Migrations
**Agent:** DB/SCHEMA  
**Tasks:**
1. Verify current schema (party, party_person, party_company, role tables)
2. Create migration for missing fields:
   - `display_name` in party table
   - `rating` in party table
   - `status` enum in party table
   - `title` in party_person (if missing)
   - `email_marketing_consent`, `phone_marketing_consent` in party table
   - `bank_details` in party_company
   - `business_category` in partner_party
   - `commission_notes` in partner_party
3. Create `party_documents` table (for future)
4. Verify/update RLS policies
5. Create indexes for performance

**Output:** Migration SQL files, schema verification report

### Phase 2: TypeScript Types Update
**Agent:** CODE WRITER  
**Tasks:**
1. Update `lib/types/directory.ts` with full `DirectoryRecord` interface
2. Add all new fields from specification
3. Ensure types match database schema
4. Add helper types (enums, etc.)

**Output:** Updated TypeScript types file

### Phase 3: UI System Design
**Agent:** UI SYSTEM  
**Tasks:**
1. Design Directory List layout (table structure, columns)
2. Design Directory Card/Detail layout (2-column, tabs)
3. Design sticky save bar component
4. Design role badges component
5. Design statistics display component
6. Design duplicate detection modal
7. Propose field grouping and compact layout

**Output:** UI design specification (text/ASCII mockups)

### Phase 4: API Implementation
**Agent:** CODE WRITER  
**Tasks:**
1. Update/create `app/api/directory/create/route.ts`
2. Create `app/api/directory/[id]/route.ts` (GET, PUT, DELETE)
3. Create `app/api/directory/check-duplicates/route.ts`
4. Create `app/api/directory/[id]/statistics/route.ts`
5. Implement proper error handling
6. Implement RLS-aware queries

**Output:** API route files

### Phase 5: Directory List Implementation
**Agent:** CODE WRITER  
**Tasks:**
1. Update `app/directory/page.tsx` with table
2. Implement filters (integrate with TopBar search)
3. Implement columns (name, phone, email, type, rating, statistics)
4. Implement row click → navigate to detail
5. Implement quick actions (call, email, edit)
6. Add loading states
7. Add error handling

**Output:** Directory list page

### Phase 6: Directory Card/Detail Implementation
**Agent:** CODE WRITER  
**Tasks:**
1. Create/update `app/directory/[id]/page.tsx`
2. Implement header section (name, roles, status, phone, email, rating)
3. Implement sticky save bar (Save, Save & Close, Cancel)
4. Implement left column (Identity, Contacts, Roles/Status)
5. Implement right column tabs (Overview, Orders, Documents, Commissions, Notes)
6. Implement form validation
7. Implement save logic (Save vs Save & Close)
8. Implement citizenship autocomplete
9. Implement marketing consent checkboxes

**Output:** Directory detail page

### Phase 7: Duplicate Detection Implementation
**Agent:** CODE WRITER  
**Tasks:**
1. Implement duplicate check API logic
2. Create duplicate detection modal component
3. Integrate into create/edit forms
4. Implement fuzzy matching for name+dob
5. Add "open existing" vs "continue creating" logic

**Output:** Duplicate detection feature

### Phase 8: Statistics Integration
**Agent:** CODE WRITER  
**Tasks:**
1. Implement statistics calculation (total spent, last/next trip dates, debt)
2. Add statistics to list view
3. Add statistics to detail view (Overview tab)
4. Optimize queries (use views or materialized views if needed)

**Output:** Statistics display

### Phase 9: Security & RLS Review
**Agent:** SECURITY/CI  
**Tasks:**
1. Review RLS policies
2. Verify tenant isolation (company_id)
3. Verify service_role usage (server-only)
4. Check for secret leakage
5. Review API security

**Output:** Security audit report

### Phase 10: QA & Testing
**Agent:** QA/REVIEWER  
**Tasks:**
1. Run smoke tests (list, create, edit, save, duplicate detection)
2. Test in Chrome and Firefox
3. Test form validation
4. Test statistics calculation
5. Test duplicate detection
6. Check for regressions
7. Performance testing

**Output:** QA report

---

## 6. Execution Order & Commands

### Step 1: DB/SCHEMA Agent
**Command to user:**
```
TASK: Review and update Directory database schema per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 2 (Data Structure) and Phase 1 (Database Schema & Migrations)

Tasks:
1. Verify current schema matches specification
2. Create migrations for missing fields
3. Verify RLS policies
4. Output: Migration SQL files + schema report
```

### Step 2: CODE WRITER (Types)
**Command to user:**
```
TASK: Update TypeScript types for Directory per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 4.1 (DirectoryRecord Interface) and Phase 2

Update: lib/types/directory.ts
Ensure: All fields from specification are included
```

### Step 3: UI SYSTEM Agent
**Command to user:**
```
TASK: Design Directory UI layout per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 3 (UI/UX Specification) and Phase 3

Output: UI design proposals (text/ASCII mockups) for:
- Directory List layout
- Directory Card/Detail layout
- Sticky save bar
- Role badges
- Statistics display
- Duplicate detection modal
```

### Step 4: CODE WRITER (API)
**Command to user:**
```
TASK: Implement Directory API endpoints per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 4.2 (API Endpoints) and Phase 4

Implement:
- GET /api/directory (list)
- GET /api/directory/[id] (detail)
- POST /api/directory/create
- PUT /api/directory/[id]
- DELETE /api/directory/[id]
- POST /api/directory/check-duplicates
- GET /api/directory/[id]/statistics
```

### Step 5: CODE WRITER (List Page)
**Command to user:**
```
TASK: Implement Directory list page per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 3.1 (Directory List) and Phase 5

Update: app/directory/page.tsx
Implement: Table with all specified columns, filters, actions
```

### Step 6: CODE WRITER (Detail Page)
**Command to user:**
```
TASK: Implement Directory detail/card page per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 3.2 (Directory Card/Detail) and Phase 6

Create/Update: app/directory/[id]/page.tsx
Implement: Header, 2-column layout, tabs, sticky save bar, form validation
```

### Step 7: CODE WRITER (Duplicate Detection)
**Command to user:**
```
TASK: Implement duplicate detection feature per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 3.4 (Duplicate Detection) and Phase 7

Implement: Duplicate check API logic + modal component
```

### Step 8: CODE WRITER (Statistics)
**Command to user:**
```
TASK: Implement statistics display per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Section 3.1/3.2 (Statistics) and Phase 8

Implement: Statistics calculation and display in list + detail views
```

### Step 9: SECURITY/CI Agent
**Command to user:**
```
TASK: Review Directory security and RLS per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Phase 9

Review: RLS policies, tenant isolation, API security, secret leakage
```

### Step 10: QA/REVIEWER Agent
**Command to user:**
```
TASK: Test Directory implementation per full architecture spec.

Read: .ai/tasks/directory-v1-full-architecture.md
Focus on: Phase 10

Test: All features, Chrome + Firefox, regressions, performance
```

---

## 7. Acceptance Criteria Summary

- [ ] Database schema matches specification
- [ ] TypeScript types match specification
- [ ] Directory list shows all required columns
- [ ] Directory detail shows header + 2-column layout + tabs
- [ ] Sticky save bar works (Save vs Save & Close)
- [ ] Form validation: required fields enforced, optional fields not required
- [ ] Marketing consent checkboxes next to email/phone
- [ ] Citizenship autocomplete works
- [ ] Statistics display correctly (total spent, last/next trip, debt)
- [ ] Duplicate detection works
- [ ] RLS policies secure
- [ ] No console errors
- [ ] TypeScript compiles
- [ ] ESLint passes
- [ ] Works in Chrome and Firefox

---

## 8. Files Expected to Change

**Database:**
- Migration files (new)
- RLS policy files (updated)

**TypeScript:**
- `lib/types/directory.ts` (updated)

**API:**
- `app/api/directory/create/route.ts` (updated)
- `app/api/directory/[id]/route.ts` (new)
- `app/api/directory/check-duplicates/route.ts` (new)
- `app/api/directory/[id]/statistics/route.ts` (new)

**Pages:**
- `app/directory/page.tsx` (updated)
- `app/directory/[id]/page.tsx` (new/updated)
- `app/directory/new/page.tsx` (updated)

**Components:**
- `components/DirectoryForm.tsx` (updated)
- `components/directory/RoleBadges.tsx` (new)
- `components/directory/StickySaveBar.tsx` (new)
- `components/directory/StatisticsSection.tsx` (new)
- `components/directory/DuplicateDetectionModal.tsx` (new)

---

## 9. Rollback Instructions

```bash
# If not committed:
git checkout lib/types/directory.ts
git checkout app/api/directory/
git checkout app/directory/
git checkout components/DirectoryForm.tsx
git checkout components/directory/

# If committed:
git revert HEAD
```

---

**Next Step:** Start with Phase 1 - DB/SCHEMA Agent





