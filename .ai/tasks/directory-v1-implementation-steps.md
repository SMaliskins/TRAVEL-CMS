# Directory v1 - Step-by-Step Implementation Commands

**Purpose:** Exact commands to give to each agent in order  
**Reference:** `.ai/tasks/directory-v1-full-architecture.md`

---

## Pre-Flight Check

```bash
# Verify branch (MUST be feat/*, NOT main)
git branch --show-current
```

**Expected:** `feat/directory-create` ✅

---

## Step 1: DB/SCHEMA Agent

**Command to paste to DB/SCHEMA agent:**

```
TASK: Review and update Directory database schema per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 2: Data Structure Specification
- Phase 1: Database Schema & Migrations

Your tasks:
1. Verify current schema in Supabase:
   - Check party, party_person, party_company tables
   - Check role tables (client_party, partner_party, subagents)
   - Run verification queries from the spec

2. Create migration SQL for missing fields:
   - display_name in party table
   - rating (integer 1-10) in party table
   - status enum ('active', 'inactive', 'blocked') in party table
   - title in party_person (if missing)
   - email_marketing_consent, phone_marketing_consent in party table
   - bank_details in party_company
   - business_category enum in partner_party
   - commission_notes in partner_party

3. Verify/update RLS policies:
   - Check current RLS status
   - Propose proper tenant isolation (company_id)
   - Document RLS policies needed

4. Create indexes for performance:
   - display_name
   - email, phone
   - company_id (for tenant isolation)

5. Output:
   - Migration SQL file(s) (idempotent, use IF NOT EXISTS)
   - Schema verification report
   - RLS policy recommendations

All migrations must be idempotent (safe to run multiple times).
```

**Wait for:** Migration SQL files + schema report

---

## Step 2: CODE WRITER (TypeScript Types)

**Command to paste to CODE WRITER agent:**

```
TASK: Update TypeScript types for Directory per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 4.1: DirectoryRecord TypeScript Interface
- Phase 2: TypeScript Types Update

Update file: lib/types/directory.ts

Requirements:
1. Replace existing DirectoryRecord interface with the full specification from Section 4.1
2. Add all new fields:
   - display_name, status, rating, notes, company_id
   - email_marketing_consent, phone_marketing_consent
   - All person fields (title, first_name, last_name, dob, personal_code, citizenship, address)
   - All company fields (company_name, reg_number, legal_address, actual_address, bank_details)
   - Full supplier_details structure
   - Full subagent_details structure
   - Statistics fields (total_spent, last_trip_date, next_trip_date, debt)

3. Add helper types:
   - DirectoryStatus = 'active' | 'inactive' | 'blocked'
   - BusinessCategory = 'TO' | 'Hotel' | 'Rent a car' | 'Airline' | 'DMC' | 'Other'
   - CommissionType = 'percent' | 'fixed'
   - CommissionScheme = 'revenue' | 'profit'

4. Ensure types match database schema (from DB/SCHEMA agent output)

5. Verify:
   - TypeScript compiles: npm run build
   - ESLint passes: npm run lint

Output: Updated lib/types/directory.ts file
```

**Wait for:** Updated types file

---

## Step 3: UI SYSTEM Agent

**Command to paste to UI SYSTEM agent:**

```
TASK: Design Directory UI layout per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 3: UI/UX Specification
- Phase 3: UI System Design

Your tasks (NO CODE, only design proposals):

1. Directory List Page Design:
   - Table layout with 10 columns (Name, Phone, Email, Type, Rating, Last Trip, Next Trip, Total Spent, Debt, Updated)
   - Filter integration with TopBar search
   - Row actions (click to open, quick actions: call, email, edit)
   - Compact, enterprise-grade appearance

2. Directory Card/Detail Page Design:
   - Header section: Name (large) + role badges + status + phone/email (clickable) + rating
   - Sticky save bar: Save | Save & Close | Cancel (positioning, styling)
   - 2-column body layout:
     - Left: Identity + Contacts + Roles/Status sections
     - Right: Tabs (Overview, Orders, Documents, Commissions, Notes)
   - Compact field grouping

3. Component Designs:
   - Role badges component (visual design, colors, sizes)
   - Sticky save bar component (styling, positioning)
   - Statistics section component (layout, visual display)
   - Duplicate detection modal (layout, options)

4. Field Grouping Proposal:
   - Which fields go in same row
   - Which sections group together
   - Responsive layout (mobile/desktop)

5. Marketing Consent Checkboxes:
   - Placement next to email field
   - Placement next to phone field
   - Visual design (small checkbox + label)

Output: Text descriptions or ASCII mockups of all designs. NO code implementation.
```

**Wait for:** UI design proposals

---

## Step 4: CODE WRITER (API Implementation)

**Command to paste to CODE WRITER agent:**

```
TASK: Implement Directory API endpoints per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 4.2: API Endpoints
- Phase 4: API Implementation

Implement the following API routes:

1. GET /api/directory (list)
   - File: app/api/directory/route.ts
   - Query params: type, role, status, search, page, limit
   - Returns: { data: DirectoryRecord[], total, page, limit }
   - Include statistics in response (total_spent, last_trip_date, next_trip_date, debt)

2. GET /api/directory/[id] (detail)
   - File: app/api/directory/[id]/route.ts
   - Returns: DirectoryRecord with all details

3. POST /api/directory/create
   - File: app/api/directory/create/route.ts (update existing)
   - Body: Partial<DirectoryRecord>
   - Returns: { id, display_name }

4. PUT /api/directory/[id]
   - File: app/api/directory/[id]/route.ts
   - Body: Partial<DirectoryRecord>
   - Returns: Updated DirectoryRecord

5. DELETE /api/directory/[id]
   - File: app/api/directory/[id]/route.ts
   - Soft delete: set status = 'inactive'
   - Returns: { success: true }

6. POST /api/directory/check-duplicates
   - File: app/api/directory/check-duplicates/route.ts (new)
   - Body: { email?, phone?, personal_code?, reg_number?, first_name?, last_name?, dob? }
   - Returns: { duplicates: Array<{ id, display_name, similarity_score, match_fields }> }

7. GET /api/directory/[id]/statistics
   - File: app/api/directory/[id]/statistics/route.ts (new)
   - Returns: { total_spent, last_trip_date, next_trip_date, debt, order_count }

Requirements:
- Use supabaseAdmin for server-side queries
- Handle RLS properly (use admin client or verify policies)
- Proper error handling (try/catch, NextResponse.json with status codes)
- Input validation
- TypeScript types from lib/types/directory.ts

Verify:
- TypeScript compiles: npm run build
- ESLint passes: npm run lint
```

**Wait for:** All API route files implemented

---

## Step 5: CODE WRITER (Directory List Page)

**Command to paste to CODE WRITER agent:**

```
TASK: Implement Directory list page per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 3.1: Directory List Page
- Phase 5: Directory List Implementation

Update file: app/directory/page.tsx

Requirements:
1. Table with 10 columns:
   - Name: Title + First Name + Last Name (or Company Name) + role badges + status dot
   - Phone: Clickable (tel: link)
   - Email: Clickable (mailto: link)
   - Type: Icon (person/company)
   - Rating: Compact display (1-10)
   - Last Trip Date: From statistics
   - Next Trip Date: From statistics
   - Total Spent: From statistics
   - Debt: From statistics
   - Updated: Last update timestamp

2. Filters (integrate with TopBar search or add filter UI):
   - Name, personal_code, DOB, phone/email
   - Type: Person/Company
   - Role: Client/Supplier/Subagent (multi-select)
   - Status: active/inactive/blocked
   - Rating range
   - Debt only

3. Actions:
   - Click row → navigate to /directory/[id]
   - Quick actions: Call (tel:), Email (mailto:), Edit

4. Loading states
5. Error handling
6. Empty state

Use UI design from UI SYSTEM agent output.

Verify:
- TypeScript compiles
- ESLint passes
- No console errors
```

**Wait for:** Updated list page

---

## Step 6: CODE WRITER (Directory Detail Page)

**Command to paste to CODE WRITER agent:**

```
TASK: Implement Directory detail/card page per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 3.2: Directory Card/Detail View
- Phase 6: Directory Card/Detail Implementation

Create/Update file: app/directory/[id]/page.tsx

Requirements:

1. Header Section:
   - Name (large, prominent)
   - Role badges + Status (compact, near name)
   - Phone (clickable tel: link)
   - Email (clickable mailto: link)
   - Rating (visual display, editable)

2. Sticky Save Bar:
   - Position: Fixed at bottom
   - Buttons: Save | Save & Close | Cancel
   - "Save" does NOT close form
   - "Save & Close" closes form after save
   - Stays visible when scrolling

3. Body Layout (2 columns):
   - Left Column:
     * Identity Section (Title + Name or Company Name)
     * Contacts Section (Email + checkbox, Phone + checkbox)
     * Roles/Status Section (Role selection, Status selector, Rating input)
   - Right Column (Tabs):
     * Overview Tab (Statistics: total spent, last/next trip dates)
     * Orders & Statistics Tab (List of orders, charts)
     * Documents Tab (Future: placeholder)
     * Loyalty Tab (Future: placeholder)
     * Commissions Tab (if Supplier/Subagent role)
     * Notes / Timeline Tab

4. Form Features:
   - Citizenship autocomplete (use lib/data/countries.ts)
   - Marketing consent checkboxes next to email/phone
   - Form validation:
     * Person: first_name + last_name required
     * Company: company_name required
     * At least 1 role required
     * personal_code, dob, reg_number, legal_address NOT required

5. Anchor Logic:
   - If user adds Supplier/Subagent role → scroll to Commissions section

Use UI design from UI SYSTEM agent output.

Verify:
- TypeScript compiles
- ESLint passes
- No console errors
- Form validation works
```

**Wait for:** Updated detail page

---

## Step 7: CODE WRITER (Duplicate Detection)

**Command to paste to CODE WRITER agent:**

```
TASK: Implement duplicate detection feature per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 3.4: Duplicate Detection
- Phase 7: Duplicate Detection Implementation

Requirements:

1. API Logic (already implemented in Step 4, verify it works):
   - POST /api/directory/check-duplicates
   - Check by: personal_code/reg_number (exact), email/phone (exact), name+dob (fuzzy)

2. Create Component:
   - File: components/directory/DuplicateDetectionModal.tsx
   - Shows list of potential duplicates
   - For each duplicate: display name, similarity score, match fields
   - Actions:
     * "Open Existing" → navigate to /directory/[id]
     * "Continue Creating" → close modal, continue with confirmation

3. Integrate into Forms:
   - Call duplicate check API on create/edit
   - Show modal if duplicates found
   - Handle user choice (open existing vs continue)

4. Fuzzy Matching:
   - For name+dob: use similarity algorithm (Levenshtein or similar)
   - Calculate similarity score (0-100)

Verify:
- TypeScript compiles
- ESLint passes
- Duplicate detection works correctly
```

**Wait for:** Duplicate detection feature

---

## Step 8: CODE WRITER (Statistics Integration)

**Command to paste to CODE WRITER agent:**

```
TASK: Implement statistics display per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Section 3.1/3.2: Statistics
- Phase 8: Statistics Integration

Requirements:

1. Statistics Calculation:
   - Total Spent: SUM(orders.amount_total) WHERE orders.client_party_id = party.id
   - Last Trip Date: MAX(orders.date_from) WHERE orders.client_party_id = party.id
   - Next Trip Date: MIN(orders.date_from) WHERE orders.client_party_id = party.id AND orders.date_from > NOW()
   - Debt: SUM(orders.amount_total - orders.amount_paid) WHERE orders.client_party_id = party.id AND orders.amount_paid < orders.amount_total

2. Display in List Page:
   - Add statistics columns (Last Trip, Next Trip, Total Spent, Debt)
   - Use data from API response (already includes statistics)

3. Display in Detail Page:
   - Overview Tab: Show statistics
   - Create component: components/directory/StatisticsSection.tsx
   - Visual display (numbers, dates, charts if needed)

4. Optimize:
   - Use API endpoint /api/directory/[id]/statistics
   - Consider caching or materialized views if performance issues

Verify:
- Statistics calculate correctly
- Display in both list and detail views
- Performance is acceptable
```

**Wait for:** Statistics display implemented

---

## Step 9: SECURITY/CI Agent

**Command to paste to SECURITY/CI agent:**

```
TASK: Review Directory security and RLS per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Phase 9: Security & RLS Review

Your tasks:

1. Review RLS Policies:
   - Verify RLS is properly configured on party tables
   - Check tenant isolation (company_id filtering)
   - Verify policies allow authenticated users to read/write their company's parties
   - Document any security concerns

2. Verify Service Role Usage:
   - Check lib/supabaseAdmin.ts usage
   - Ensure service_role key is NEVER exposed to client
   - Verify API routes use admin client correctly
   - Check app/api/directory/* routes

3. Check for Secret Leakage:
   - Verify no hardcoded API keys
   - Check .env files are in .gitignore
   - Verify no secrets in code

4. Review API Security:
   - Input validation in all endpoints
   - Proper error handling (no sensitive info in errors)
   - SQL injection prevention (using Supabase query builder)

5. Tenant Isolation:
   - Verify company_id is always filtered
   - Check created_by is set correctly
   - Verify users can only access their company's data

Output: Security audit report with findings and recommendations
```

**Wait for:** Security audit report

---

## Step 10: QA/REVIEWER Agent

**Command to paste to QA/REVIEWER agent:**

```
TASK: Test Directory implementation per full architecture specification.

Read the full specification: .ai/tasks/directory-v1-full-architecture.md

Focus on:
- Phase 10: QA & Testing
- Section 7: Acceptance Criteria Summary

Test Checklist:

1. Database Schema:
   - [ ] All required fields exist
   - [ ] Migrations applied successfully
   - [ ] RLS policies work correctly

2. Directory List Page (/directory):
   - [ ] Table displays all 10 columns
   - [ ] Filters work (type, role, status, search)
   - [ ] Row click opens detail page
   - [ ] Quick actions work (call, email, edit)
   - [ ] Statistics display correctly
   - [ ] Loading states work
   - [ ] Empty state displays

3. Directory Detail Page (/directory/[id]):
   - [ ] Header displays correctly (name, roles, status, phone, email, rating)
   - [ ] Sticky save bar works (stays visible when scrolling)
   - [ ] "Save" doesn't close form
   - [ ] "Save & Close" closes form
   - [ ] 2-column layout displays correctly
   - [ ] Tabs work (Overview, Orders, Documents, Commissions, Notes)
   - [ ] Form validation works (required fields enforced)
   - [ ] Optional fields not required (personal_code, dob, reg_number, legal_address)
   - [ ] Marketing consent checkboxes work
   - [ ] Citizenship autocomplete works
   - [ ] Statistics display in Overview tab

4. Create New Record (/directory/new):
   - [ ] Form loads correctly
   - [ ] Validation works
   - [ ] Duplicate detection works
   - [ ] Save works
   - [ ] Save & Close works

5. Duplicate Detection:
   - [ ] Checks by personal_code/reg_number
   - [ ] Checks by email/phone
   - [ ] Checks by name+dob (fuzzy)
   - [ ] Modal displays correctly
   - [ ] "Open Existing" works
   - [ ] "Continue Creating" works

6. Statistics:
   - [ ] Total spent calculates correctly
   - [ ] Last trip date displays correctly
   - [ ] Next trip date displays correctly
   - [ ] Debt calculates correctly

7. Browser Compatibility:
   - [ ] Works in Chrome
   - [ ] Works in Firefox

8. Code Quality:
   - [ ] TypeScript compiles (npm run build)
   - [ ] ESLint passes (npm run lint)
   - [ ] No console errors
   - [ ] No TypeScript errors

9. Regressions:
   - [ ] No regressions in other features
   - [ ] Sidebar still works
   - [ ] TopBar still works
   - [ ] Other pages still work

Output: QA report with pass/fail for each test, list of issues (if any)
```

**Wait for:** QA report

---

## Summary

**Total Steps:** 10  
**Estimated Order:**
1. DB/SCHEMA (migrations)
2. CODE WRITER (types)
3. UI SYSTEM (design)
4. CODE WRITER (API)
5. CODE WRITER (list page)
6. CODE WRITER (detail page)
7. CODE WRITER (duplicate detection)
8. CODE WRITER (statistics)
9. SECURITY/CI (audit)
10. QA/REVIEWER (testing)

**Critical Path:** Steps 1-6 must be done in order. Steps 7-8 can be parallel. Steps 9-10 are final.

**Files Created:**
- `.ai/tasks/directory-v1-full-architecture.md` - Full specification
- `.ai/tasks/directory-v1-implementation-steps.md` - This file

**Next Action:** Start with Step 1 (DB/SCHEMA Agent)

