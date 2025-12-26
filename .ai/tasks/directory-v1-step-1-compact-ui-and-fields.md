# Task: Directory v1 - Step 1: Compact UI and Correct Required Fields

## Context

Directory module manages clients, suppliers, and subagents. Current implementation needs:
- **Compact UI**: More efficient use of screen space, better field grouping
- **Correct required fields**: Some fields are incorrectly marked as required (personal_code, dob, reg_nr, legal_address)
- **Contact deduplication**: Contacts should not be duplicated; marketing consents should appear as checkboxes next to email/phone
- **Role/status display**: Roles and status should be displayed compactly near the name
- **Header information**: Name + Title (Mr/Mrs/Chd) + clickable phone/email
- **Statistics**: Total spent and last/next trip dates from orders
- **Citizenship autocomplete**: Should use countries list
- **Save bar behavior**: Sticky save bar; "Save" doesn't close form; "Save & Close" closes form

**Current State:**
- Directory form exists at `components/DirectoryForm.tsx`
- Directory types defined in `lib/types/directory.ts`
- Directory API route at `app/api/directory/create/route.ts`
- Directory pages at `app/directory/page.tsx` and `app/directory/new/page.tsx`

## Constraints

- [x] Do not touch `Sidebar.tsx` or `hooks/useSidebar.ts` (unless explicitly authorized)
- [x] Do not work on `main` branch (current branch: `feat/directory-create`)
- [x] Minimal diff - only necessary changes
- [x] Schema must match Supabase - verify before implementing
- [x] One change-set per step

## Acceptance Criteria

### Field Requirements
- [ ] `personal_code` is NOT required (optional field)
- [ ] `dob` (date of birth) is NOT required (optional field)
- [ ] `reg_nr` (registration number) is NOT required (optional field)
- [ ] `legal_address` is NOT required (optional field)

### Contact Management
- [ ] Contacts are NOT duplicated in the form
- [ ] Marketing consents appear as checkboxes next to email/phone fields
- [ ] Email field has checkbox for email marketing consent
- [ ] Phone field has checkbox for SMS/phone marketing consent

### UI Layout
- [ ] Roles and status displayed compactly near the name (e.g., badges or chips)
- [ ] At least 1 role is required (validation)
- [ ] Header shows: Name + Title (Mr/Mrs/Chd) + clickable phone/email
- [ ] Phone number is clickable (tel: link)
- [ ] Email is clickable (mailto: link)

### Statistics Section
- [ ] Statistics include "Total Spent" (calculated from orders)
- [ ] Statistics include "Last Trip Date" (from orders)
- [ ] Statistics include "Next Trip Date" (from orders)
- [ ] Statistics are displayed in a compact format

### Form Features
- [ ] Citizenship field has autocomplete from countries list (use `lib/data/countries.ts`)
- [ ] Save bar is sticky (stays visible when scrolling)
- [ ] "Save" button does NOT close the form
- [ ] "Save & Close" button closes the form after saving

### Data Integrity
- [ ] Form validation prevents saving without required fields
- [ ] At least one role must be selected
- [ ] TypeScript types match the implementation
- [ ] No console errors

## Smoke Test Steps

1. Navigate to `/directory` - verify list page loads
2. Click "New Record" - verify form opens at `/directory/new`
3. Open existing record - verify form loads with data
4. Fill required fields (name, at least one role) - verify validation passes
5. Test "Save" button - verify form stays open after save
6. Test "Save & Close" button - verify form closes after save
7. Verify list shows updated data after save
8. Test phone/email clickability in header
9. Test citizenship autocomplete
10. Test marketing consent checkboxes
11. Verify statistics display (if orders exist)

## What Each Agent Must Do

### DB/SCHEMA Agent

**Tasks:**
1. Confirm current schema tables/columns used by Directory UI
   - Query Supabase to verify table structure
   - Check for `directory` or `parties` table
   - List all columns and their types
   - Verify nullable vs required columns

2. Produce mapping table: code → database
   - Map TypeScript types (`lib/types/directory.ts`) to actual DB columns
   - Document any mismatches
   - Note which fields are optional in DB vs required in code

3. Propose minimal additive SQL if needed
   - If marketing consent fields don't exist, propose migration
   - If statistics fields need to be added, propose migration
   - Ensure all migrations are idempotent
   - Include RLS policy considerations

4. Verify RLS policies
   - Check if RLS is enabled on directory table
   - Verify policies allow read/write for authenticated users
   - Document any tenant scoping requirements

**Output:**
- Schema verification report (table name, columns, types, nullable status)
- Code-to-DB mapping table
- Proposed migration SQL (if any)
- RLS policy notes

**Files to check:**
- `supabase_schema.sql`
- `supabase_migration.sql`
- Any directory-related migration files
- Supabase dashboard or API for live schema

---

## DB Section - Schema Mapping and Migration

### Schema Structure (Inferred from RLS Files)

Based on RLS fix files, the directory system uses multiple related tables:
- `party` - Base party table
- `party_person` - Person-specific fields
- `party_company` - Company-specific fields  
- `client_party` - Links parties to client role
- `partner_party` - Links parties to supplier role
- `subagents` - Subagent-specific fields

**Note:** Actual schema DDL not found in repo. Verification needed in Supabase.

### Code-to-Database Column Mapping

| Code Field (TypeScript) | Database Column | Table | Required in Code | Required in DB | Notes |
|-------------------------|-----------------|-------|------------------|----------------|-------|
| `id` | `id` | `party` | Yes | Yes (PK) | UUID primary key |
| `type` | `type` | `party` | Yes | Yes | 'person' or 'company' |
| `roles` | N/A (junction tables) | `client_party`, `partner_party`, `subagents` | Yes (min 1) | Yes | Array stored via role tables |
| `isActive` | `is_active` | `party` | Yes | Yes | Boolean, defaults to true |
| `createdAt` | `created_at` | `party` | Yes | Yes | Timestamp |
| `updatedAt` | `updated_at` | `party` | Yes | Yes | Timestamp |
| `firstName` | `first_name` | `party_person` | Yes (if person) | Likely yes | Person-only field |
| `lastName` | `last_name` | `party_person` | Yes (if person) | Likely yes | Person-only field |
| `title` | `title` | `party_person` | No | ❓ Unknown | Mr/Mrs/Chd - needs verification |
| `dob` | `dob` or `date_of_birth` | `party_person` | ❌ **NOT required** | Likely nullable | Date of birth |
| `personalCode` | `personal_code` | `party_person` | ❌ **NOT required** | Likely nullable | Personal identification code |
| `citizenship` | `citizenship` | `party_person` | No | Likely nullable | Country code - needs autocomplete |
| `companyName` | `company_name` or `name` | `party_company` | Yes (if company) | Likely yes | Company-only field |
| `regNumber` | `reg_number` or `reg_nr` | `party_company` | ❌ **NOT required** | Likely nullable | Registration number |
| `legalAddress` | `legal_address` | `party_company` | ❌ **NOT required** | Likely nullable | Legal address |
| `actualAddress` | `actual_address` | `party_company` | No | Likely nullable | Actual/physical address |
| `phone` | `phone` | `party` | No | Likely nullable | Common contact field |
| `email` | `email` | `party` | No | Likely nullable | Common contact field |
| `emailMarketingConsent` | `email_marketing_consent` | `party` | ❌ **MISSING** | ❌ **MISSING** | **Needs migration** |
| `phoneMarketingConsent` | `phone_marketing_consent` | `party` | ❌ **MISSING** | ❌ **MISSING** | **Needs migration** |
| `supplierExtras.activityArea` | `activity_area` | `partner_party` | No | Likely nullable | Supplier-specific |
| `subagentExtras.commissionType` | `commission_type` | `subagents` | No | Likely nullable | Subagent-specific |
| `subagentExtras.commissionValue` | `commission_value` | `subagents` | No | Likely nullable | Subagent-specific |
| `subagentExtras.commissionCurrency` | `commission_currency` | `subagents` | No | Likely nullable | Subagent-specific |

### Statistics Fields (Derived from Orders)

Statistics are calculated via JOIN with orders table, no additional columns needed:
- `totalSpent` - Calculated: `SUM(orders.amount_total)` WHERE `orders.client_party_id = party.id`
- `lastTripDate` - Calculated: `MAX(orders.date_from)` WHERE `orders.client_party_id = party.id`
- `nextTripDate` - Calculated: `MIN(orders.date_from)` WHERE `orders.client_party_id = party.id` AND `orders.date_from > NOW()`

**No schema changes needed for statistics** - computed via views or queries.

### Required Migrations

#### 1. Add Marketing Consent Fields (REQUIRED)

```sql
-- ============================================
-- Add marketing consent fields to party table
-- ============================================
-- Purpose: Store email/phone marketing consent flags
-- Safe: All fields nullable, defaults to false

DO $$ 
BEGIN
    -- Add email_marketing_consent if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'email_marketing_consent'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN email_marketing_consent boolean DEFAULT false;
        
        COMMENT ON COLUMN public.party.email_marketing_consent IS 'Consent to receive marketing emails';
    END IF;

    -- Add phone_marketing_consent if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'phone_marketing_consent'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN phone_marketing_consent boolean DEFAULT false;
        
        COMMENT ON COLUMN public.party.phone_marketing_consent IS 'Consent to receive SMS/phone marketing';
    END IF;
END $$;

-- ============================================
-- Verification Query
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'party' 
--   AND column_name IN ('email_marketing_consent', 'phone_marketing_consent');
```

#### 2. Add Title Field to party_person (IF MISSING)

```sql
-- ============================================
-- Add title field to party_person table (if needed)
-- ============================================
-- Purpose: Store title (Mr/Mrs/Chd) for persons
-- Safe: Field is nullable

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN title text;
        
        COMMENT ON COLUMN public.party_person.title IS 'Title: Mr, Mrs, Chd, etc.';
    END IF;
END $$;
```

### RLS Policy Status

**Current Status:** ⚠️ UNKNOWN
- RLS fix files show RLS was **disabled** on party tables (`fix_rls_issue.sql`)
- Alternative policies file shows permissive policies (`fix_rls_issue_full_policies.sql`)
- **Verification needed:** Check actual RLS status in Supabase

**Recommended RLS Policy (for reference):**

```sql
-- Enable RLS (if not already enabled)
ALTER TABLE public.party ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write parties from their company
CREATE POLICY "Users can manage parties from their company"
ON public.party FOR ALL
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE user_id = auth.uid()
    )
);
```

**Note:** Apply similar policies to `party_person`, `party_company`, `client_party`, `partner_party`, `subagents` tables.

### Verification Queries

```sql
-- 1. Check party table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party'
ORDER BY ordinal_position;

-- 2. Check party_person table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_person'
ORDER BY ordinal_position;

-- 3. Check party_company table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_company'
ORDER BY ordinal_position;

-- 4. Check for marketing consent fields
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party'
  AND column_name IN ('email_marketing_consent', 'phone_marketing_consent');

-- 5. Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents');

-- 6. List RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents');
```

### Summary

**Required Actions:**
1. ✅ **Verify actual schema** - Run verification queries above
2. ✅ **Add marketing consent fields** - Run migration #1 (marketing consent)
3. ⚠️ **Add title field** - Run migration #2 if title column missing
4. ⚠️ **Verify RLS policies** - Check current RLS status and policies
5. ✅ **No changes needed for statistics** - Use calculated fields from orders table

**Fields Confirmed Optional (per task requirements):**
- `personalCode` / `personal_code` - NOT required
- `dob` / `date_of_birth` - NOT required  
- `regNumber` / `reg_nr` - NOT required
- `legalAddress` / `legal_address` - NOT required

All migrations use `IF NOT EXISTS` - safe to apply multiple times.

### Security/CI Agent

**Tasks:**
1. Check for secret leakage
   - Verify no hardcoded API keys
   - Check `.env` files are in `.gitignore`
   - Verify service_role key is only in server-side code

2. Verify service_role usage
   - Check `lib/supabaseAdmin.ts` usage
   - Ensure service_role is never exposed to client
   - Verify API routes use admin client correctly

3. RLS/tenant scope notes
   - Document RLS policies for directory table
   - Note any tenant isolation requirements
   - Verify user can only access their own data (if applicable)

**Output:**
- Security audit report
- RLS policy documentation
- Service role usage verification

**Files to check:**
- `lib/supabaseAdmin.ts`
- `app/api/directory/create/route.ts`
- `.gitignore`
- `docs/SECURITY.md`

### UI System Agent

**Tasks:**
1. Propose compact layout blocks
   - Design header section (Name + Title + phone/email)
   - Design role/status display (badges/chips near name)
   - Design statistics section layout
   - Design form field grouping

2. Propose field grouping
   - Group related fields together
   - Identify which fields can be in same row
   - Propose responsive layout (mobile/desktop)

3. Design sticky save bar
   - Propose positioning (bottom fixed?)
   - Design button layout (Save | Save & Close)
   - Ensure it doesn't overlap content

4. Design marketing consent checkboxes
   - Placement next to email field
   - Placement next to phone field
   - Visual design (small checkbox, label)

**Output:**
- Layout proposal (text description or ASCII mockup)
- Field grouping plan
- Sticky bar design
- Checkbox placement design

**Note:** NO code implementation - only design proposals

**Files to reference:**
- `components/DirectoryForm.tsx` (current structure)
- `components/TopBar.tsx` (for UI patterns)
- `docs/UI_SYSTEM_CONSISTENCY.md` (for design system)

### Code Writer Agent

**Tasks:**
1. Wait for DB/SCHEMA, Security/CI, and UI System agents to complete their sections
2. Review all agent outputs before starting
3. Implement changes based on:
   - DB schema mapping from DB/SCHEMA agent
   - Security requirements from Security/CI agent
   - UI design from UI System agent

4. Implementation checklist:
   - [ ] Remove required validation from `personal_code`, `dob`, `reg_nr`, `legal_address`
   - [ ] Add marketing consent checkboxes next to email/phone
   - [ ] Implement compact role/status display near name
   - [ ] Implement header with Name + Title + clickable phone/email
   - [ ] Add statistics section (total spent, last/next trip dates)
   - [ ] Implement citizenship autocomplete using countries list
   - [ ] Make save bar sticky
   - [ ] Implement "Save" (no close) vs "Save & Close" behavior
   - [ ] Ensure at least 1 role is required
   - [ ] Update TypeScript types if needed

5. Testing:
   - [ ] TypeScript compiles (`npm run build`)
   - [ ] ESLint passes (`npm run lint`)
   - [ ] No console errors
   - [ ] Form validation works correctly

**Output:**
- Modified files list
- Implementation notes
- Any blockers encountered

**Files expected to change:**
- `components/DirectoryForm.tsx` (main form)
- `lib/types/directory.ts` (if types need updating)
- `app/api/directory/create/route.ts` (if API needs changes)
- Possibly new components for statistics, role badges, etc.

### QA/Reviewer Agent

**Tasks:**
1. Run smoke test checklist (see "Smoke Test Steps" above)
2. Test in Chrome and Firefox
3. Check for regressions:
   - [ ] Directory list page still works
   - [ ] Creating new record works
   - [ ] Editing existing record works
   - [ ] Form validation works
   - [ ] No console errors
   - [ ] No TypeScript errors
   - [ ] No ESLint errors

4. Verify acceptance criteria:
   - [ ] All field requirements met
   - [ ] Contact management works correctly
   - [ ] UI layout is compact and correct
   - [ ] Statistics display correctly
   - [ ] Form features work as specified

5. Report:
   - Pass/Fail for each test
   - List of issues found (if any)
   - Browser compatibility notes

**Output:**
- QA report with pass/fail status
- List of issues (if any)
- Browser compatibility notes

## Files Expected to Change

- `components/DirectoryForm.tsx` - Main form component (UI changes, field validation, save bar)
- `lib/types/directory.ts` - TypeScript types (if marketing consent fields added)
- `app/api/directory/create/route.ts` - API route (if schema changes require API updates)
- Possibly new components:
  - `components/directory/RoleBadges.tsx` - For role/status display
  - `components/directory/StatisticsSection.tsx` - For statistics display
  - `components/directory/StickySaveBar.tsx` - For sticky save bar

## Suggested Commit Message

```
feat(directory): compact UI and correct required fields

- Remove required validation from personal_code, dob, reg_nr, legal_address
- Add marketing consent checkboxes next to email/phone
- Implement compact role/status display near name
- Add header with Name + Title + clickable phone/email
- Add statistics section (total spent, last/next trip dates)
- Implement citizenship autocomplete
- Make save bar sticky with Save vs Save & Close behavior
- Ensure at least 1 role is required
```

## Rollback Instructions

```bash
# If not committed yet:
git checkout components/DirectoryForm.tsx lib/types/directory.ts app/api/directory/create/route.ts

# If committed:
git revert HEAD
```

---

## Execution Order

1. **DB/SCHEMA Agent** - Verify schema and produce mapping
2. **Security/CI Agent** - Audit security and RLS
3. **UI System Agent** - Propose layout and design
4. **Code Writer Agent** - Implement based on all above
5. **QA/Reviewer Agent** - Test and verify

**Next Step:** Run DB/SCHEMA agent on this task file.

