# Directory v1 - Implementation Phases

**Created:** 2024-12-24  
**Status:** Planning Complete  
**Branch:** `feat/directory-create`

---

## Phase 1: Critical Fixes (Error Handling & Field Mapping)

**Goal:** Fix critical bugs preventing Directory record creation.

**Included:**
- Improved error logging in API endpoint
- Fix field mapping (isActive → status)
- Remove duplicate roles display from header

**Excluded:**
- All other enhancements

**Acceptance Criteria:**
- ✅ API returns detailed error messages when creation fails
- ✅ Status field correctly maps from form to API
- ✅ Roles display only in form, not in header
- ✅ TypeScript compiles successfully
- ✅ Creating Person or Company record works without errors

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Fix Directory creation errors - critical bug fixes

1. Improve error logging in API:
   File: app/api/directory/create/route.ts (lines 104-109)
   - Replace generic "Failed to create party" with detailed error
   - Include: partyError.message, partyError.code, partyError.details
   - Return: { error: `Failed to create party: ${errorMessage}${details ? ` (${details})` : ""}`, details: partyError }

2. Fix field mapping:
   File: app/directory/new/page.tsx (line 36-40)
   - Map isActive to status: const status = data.isActive === false ? 'inactive' : (data.status || 'active');
   - Pass status instead of isActive to createRecord

3. Remove duplicate roles display:
   File: app/directory/new/page.tsx (lines 192-223)
   - Remove entire roles/status checkbox section from header
   - Keep only error message display if rolesError exists
   - Ensure proper div structure closure

VERIFY:
- npm run build passes
- Test creation - errors show details
- Roles only in form section
```

**Expected Files:**
- `app/api/directory/create/route.ts`
- `app/directory/new/page.tsx`

**Smoke Test:**
1. Create new Person record → should succeed
2. Create new Company record → should succeed
3. Trigger API error → should show detailed message
4. Check header → no roles checkboxes visible
5. Check form → roles visible in "Roles & status" section

---

## Phase 2: Add Missing Person Fields (Title, Citizenship, Address)

**Goal:** Add Title, Citizenship, and Address fields to Person form (fields exist in schema but missing in UI).

**Included:**
- Title dropdown (Mr/Mrs/Ms/Miss/Dr)
- Citizenship autocomplete (from COUNTRIES list)
- Address text field for Person type

**Excluded:**
- Documents section
- Loyalty programs
- Other enhancements

**Acceptance Criteria:**
- ✅ Title dropdown appears in Person form
- ✅ Citizenship autocomplete works with COUNTRIES list
- ✅ Address field visible for Person (separate from Company address)
- ✅ All three fields save correctly to database
- ✅ Fields load correctly when editing existing Person record

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Add missing Person fields: Title, Citizenship, Address

File: components/DirectoryForm.tsx

1. Add state variables (after line 61):
   const [title, setTitle] = useState(record?.title || "");
   const [citizenship, setCitizenship] = useState(record?.citizenship || "");
   const [personAddress, setPersonAddress] = useState(record?.address || "");

2. Import COUNTRIES (add to imports):
   import { COUNTRIES } from "@/lib/data/countries";

3. Add Title dropdown in Person fields section (before First name):
   <div>
     <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
     <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black">
       <option value="">Select...</option>
       <option value="Mr">Mr</option>
       <option value="Mrs">Mrs</option>
       <option value="Ms">Ms</option>
       <option value="Miss">Miss</option>
       <option value="Dr">Dr</option>
     </select>
   </div>

4. Add Citizenship autocomplete (after Date of birth):
   <div>
     <label className="mb-1 block text-sm font-medium text-gray-700">Citizenship</label>
     <input type="text" value={citizenship} onChange={(e) => setCitizenship(e.target.value)} placeholder="Start typing country name..." list="countries-list" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black" />
     <datalist id="countries-list">
       {COUNTRIES.map((country) => (<option key={country} value={country} />))}
     </datalist>
   </div>

5. Add Address field for Person (after Citizenship):
   <div>
     <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
     <input type="text" value={personAddress} onChange={(e) => setPersonAddress(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black" />
   </div>

6. Update formData in handleSubmit (around line 360):
   if (actualType === "person") {
     formData.title = title || undefined;
     formData.first_name = firstName;
     formData.last_name = lastName;
     formData.personal_code = personalCode || undefined;
     formData.dob = dob || undefined;
     formData.citizenship = citizenship || undefined;
     formData.address = personAddress || undefined;
   }

7. Update getInitialValues (add title, citizenship):
   title: record.title,
   citizenship: record.citizenship,

8. Update checkDirty function (add new fields):
   title.trim() !== (initialValues.title || "").trim() ||
   citizenship.trim() !== (initialValues.citizenship || "").trim() ||
   personAddress.trim() !== (initialValues.address || "").trim() ||

VERIFY:
- npm run build passes
- Create Person with Title, Citizenship, Address → saves correctly
- Edit existing Person → fields load correctly
```

**Expected Files:**
- `components/DirectoryForm.tsx`

**Smoke Test:**
1. Create Person → Title dropdown appears
2. Type in Citizenship → autocomplete shows countries
3. Enter Address → field accepts input
4. Save → all fields persist to database
5. Edit saved Person → fields load with saved values

---

## Phase 3: Compact Layout Redesign

**Goal:** Make Directory forms more compact - reduce spacing, remove empty zones, modern design.

**Included:**
- Reduce padding/spacing between sections
- Optimize 2-column layout spacing
- Remove unnecessary whitespace
- Keep responsive behavior

**Excluded:**
- Visual feedback animations (separate phase)
- Date format changes (separate phase)
- New features

**Acceptance Criteria:**
- ✅ Spacing reduced by at least 20% compared to current
- ✅ No empty zones or wasted space
- ✅ Layout remains readable and usable
- ✅ Responsive design maintained
- ✅ All fields still accessible

**Agents:** UI SYSTEM (design proposal) → CODE WRITER (implementation)

**COPY-READY PROMPT FOR UI SYSTEM:**

```
TASK: Design compact layout for Directory forms

Analyze current layout:
- File: components/DirectoryForm.tsx
- File: app/directory/new/page.tsx
- File: app/directory/[id]/page.tsx

Requirements:
- Reduce spacing: p-6 → p-4, gap-6 → gap-4, space-y-6 → space-y-4
- Optimize 2-column grid: reduce gap between columns
- Remove empty zones
- Maintain readability
- Keep responsive (mobile/tablet/desktop)

Deliver:
- Specific spacing values for each section
- Before/after comparison
- No code implementation - design spec only
```

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Implement compact layout for Directory forms per UI System spec

Apply spacing reductions from UI System design spec to:
- components/DirectoryForm.tsx (section spacing, field spacing)
- app/directory/new/page.tsx (page padding, header spacing)
- app/directory/[id]/page.tsx (detail page spacing)

VERIFY:
- npm run build passes
- Layout is more compact
- No visual regressions
- Responsive still works
```

**Expected Files:**
- `components/DirectoryForm.tsx`
- `app/directory/new/page.tsx`
- `app/directory/[id]/page.tsx`

**Smoke Test:**
1. Open /directory/new → layout more compact
2. Open /directory/[id] → layout more compact
3. Test on mobile → responsive works
4. All fields accessible → no usability issues

---

## Phase 4: Date Format dd.mm.yyyy

**Goal:** Change all date inputs and displays to dd.mm.yyyy format.

**Included:**
- Date input formatting
- Date display formatting
- All Directory-related date fields

**Excluded:**
- Date fields in other modules (Orders, etc.)
- Time formatting

**Acceptance Criteria:**
- ✅ All date inputs accept/display dd.mm.yyyy format
- ✅ Dates save correctly to database (ISO format internally)
- ✅ Date displays show dd.mm.yyyy format
- ✅ Date parsing handles both formats correctly

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Change date format to dd.mm.yyyy in Directory forms

1. Create date formatter utility:
   File: lib/utils/dateFormatter.ts (new file)
   - formatDateToDDMMYYYY(date: Date | string): string
   - parseDDMMYYYYToDate(dateString: string): Date | null

2. Update DirectoryForm.tsx:
   - Replace type="date" inputs with text inputs
   - Add format/parse conversion
   - Display dates in dd.mm.yyyy format
   - Parse user input from dd.mm.yyyy to ISO for API

3. Update date displays:
   - app/directory/page.tsx (list view dates)
   - app/directory/[id]/page.tsx (detail view dates)
   - Use formatter utility

VERIFY:
- npm run build passes
- Enter date as dd.mm.yyyy → saves correctly
- Display shows dd.mm.yyyy format
- Existing dates display correctly
```

**Expected Files:**
- `lib/utils/dateFormatter.ts` (new)
- `components/DirectoryForm.tsx`
- `app/directory/page.tsx`
- `app/directory/[id]/page.tsx`

**Smoke Test:**
1. Enter date as 24.12.2024 → saves correctly
2. Display shows 24.12.2024 format
3. Edit existing record → date displays in dd.mm.yyyy
4. Invalid date → shows error

---

## Phase 5: Visual Feedback on Field Changes

**Goal:** Add green pulsing border animation to indicate unsaved changes in form fields.

**Included:**
- CSS animation for green pulsing border
- Track field-level dirty state
- Apply to changed fields only

**Excluded:**
- Save state indicators (separate)
- Form-level dirty indicators

**Acceptance Criteria:**
- ✅ Changed fields show green pulsing border
- ✅ Animation is subtle and non-intrusive
- ✅ Border disappears after save
- ✅ No performance issues

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Add green pulsing border to changed form fields

File: components/DirectoryForm.tsx

1. Add CSS animation to globals.css or component:
   @keyframes pulse-green {
     0%, 100% { border-color: rgb(34, 197, 94); }
     50% { border-color: rgb(74, 222, 128); }
   }
   .field-changed {
     animation: pulse-green 2s ease-in-out infinite;
     border-color: rgb(34, 197, 94);
   }

2. Track field-level dirty state:
   - Create fieldDirtyState object: { [fieldName]: boolean }
   - Update on field onChange
   - Clear on save

3. Apply className conditionally:
   - Add "field-changed" class when field is dirty
   - Remove after successful save

VERIFY:
- npm run build passes
- Change field → green pulsing border appears
- Save → border disappears
- Animation is smooth
```

**Expected Files:**
- `components/DirectoryForm.tsx`
- `app/globals.css` (if animation added globally)

**Smoke Test:**
1. Change First Name → green pulsing border appears
2. Change multiple fields → all show border
3. Save → borders disappear
4. Animation is smooth, not distracting

---

## Phase 6: Internal Client Number Generation

**Goal:** Generate sequential internal numbers (00001, 00002, etc.) for Directory records.

**Included:**
- Number generation logic in API
- Display in list and detail views
- Database field addition (requires migration)

**Excluded:**
- Number format customization
- Number reassignment

**Acceptance Criteria:**
- ✅ Sequential numbers generated: 00001, 00002, etc.
- ✅ Numbers unique per company_id (tenant isolation)
- ✅ Numbers display in list and detail views
- ✅ Existing records handled (null or generated retroactively)

**Agents:** DB/SCHEMA (migration) → CODE WRITER (implementation)

**COPY-READY PROMPT FOR DB/SCHEMA:**

```
TASK: Add internal_number field to party table

Requirement:
- Add column: internal_number TEXT (or VARCHAR)
- Unique per company_id (tenant isolation)
- Nullable (for existing records)
- Index on (company_id, internal_number) for performance

Create migration file:
- migrations/add_party_internal_number.sql
- Use IF NOT EXISTS for idempotency

Verify:
- Column exists in party table
- Index created
- No data loss
```

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Implement internal client number generation

1. Update API endpoint:
   File: app/api/directory/create/route.ts
   - Before creating party, get max internal_number for company_id
   - Generate next number: pad with zeros (00001, 00002, etc.)
   - Include in partyData: internal_number: generatedNumber

2. Update TypeScript types:
   File: lib/types/directory.ts
   - Add internal_number?: string to DirectoryRecord

3. Display in UI:
   File: app/directory/page.tsx
   - Add "Internal #" column to table (optional, can be hidden)
   
   File: app/directory/[id]/page.tsx
   - Display internal number in header or info section

VERIFY:
- npm run build passes
- Create new record → number generated (00001, etc.)
- Multiple companies → numbers independent per company
- Display shows number correctly
```

**Expected Files:**
- `migrations/add_party_internal_number.sql` (DB agent)
- `app/api/directory/create/route.ts`
- `lib/types/directory.ts`
- `app/directory/page.tsx`
- `app/directory/[id]/page.tsx`

**Smoke Test:**
1. Create first record → gets 00001
2. Create second record → gets 00002
3. Check database → numbers sequential
4. Display shows number correctly

---

## Phase 7: Commission Type Display for Supplier

**Goal:** Show commission type (% or Sum) next to commission value in Supplier section.

**Included:**
- Display commission type label next to value
- Update form display only

**Excluded:**
- Commission calculation logic
- Commission validation changes

**Acceptance Criteria:**
- ✅ Commission value displays with type label (e.g., "10 %" or "€100 Sum")
- ✅ Display is clear and readable
- ✅ Works for both percent and fixed types

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Display commission type next to value in Supplier section

File: components/DirectoryForm.tsx

Find Supplier commission value display (around supplier commission fields).

Update display to show:
- If commission_type === "percent": "commission_value %"
- If commission_type === "fixed": "€commission_value Sum" (or currency symbol)

Example:
- Current: [10] (input field)
- Updated: [10] % (with label next to input, or formatted display)

VERIFY:
- npm run build passes
- Select percent type → shows "%" next to value
- Select fixed type → shows "Sum" (or currency) next to value
- Display is clear
```

**Expected Files:**
- `components/DirectoryForm.tsx`

**Smoke Test:**
1. Select Supplier role → commission fields appear
2. Set type to "%" → shows "%" next to value
3. Set type to "fixed" → shows "Sum" next to value
4. Display is readable

---

## Phase 8: Documents Section (DB Schema First)

**Goal:** Add Documents section for storing party documents (passport/ID) with expiry tracking.

**Included:**
- Database schema for party_documents table
- Basic CRUD API endpoints
- Documents list component
- Add/edit document form

**Excluded:**
- File upload (future)
- OCR auto-fill (future)
- Expiry notifications (future - basic tracking only)

**Acceptance Criteria:**
- ✅ party_documents table exists with required fields
- ✅ Can add/edit/delete documents via API
- ✅ Documents display in Directory detail page
- ✅ Expiry date stored and displayed
- ✅ Multiple documents per party supported

**Agents:** DB/SCHEMA (schema) → CODE WRITER (API + UI)

**COPY-READY PROMPT FOR DB/SCHEMA:**

```
TASK: Create party_documents table schema

Requirements from spec (Section 2.4):
- id: UUID (primary key)
- party_id: UUID (FK to party.id, CASCADE DELETE)
- doc_type: enum ('passport', 'id', 'other')
- doc_number: TEXT (required)
- issued_at: DATE (nullable)
- valid_till: DATE (nullable)
- issued_by: TEXT (nullable)
- file_url: TEXT (nullable, for future file upload)

Create migration:
- migrations/add_party_documents_table.sql
- Include RLS policies for tenant isolation (company_id via party)
- Add indexes on party_id, valid_till (for expiry queries)

Verify:
- Table created
- RLS policies active
- Indexes exist
```

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Implement Documents section for Directory

1. Create API endpoints:
   File: app/api/directory/[id]/documents/route.ts (new)
   - GET: list documents for party
   - POST: create new document
   
   File: app/api/directory/[id]/documents/[docId]/route.ts (new)
   - PUT: update document
   - DELETE: delete document

2. Create Documents component:
   File: components/DirectoryDocuments.tsx (new)
   - List of documents
   - Add/edit form
   - Delete functionality
   - Expiry date display (highlight if expiring soon)

3. Integrate into Directory detail page:
   File: app/directory/[id]/page.tsx
   - Add "Documents" tab
   - Include DirectoryDocuments component

4. Update types:
   File: lib/types/directory.ts
   - Add Document interface
   - Add documents?: Document[] to DirectoryRecord (computed)

VERIFY:
- npm run build passes
- Can add document to party
- Documents list displays correctly
- Can edit/delete documents
- Expiry dates display correctly
```

**Expected Files:**
- `migrations/add_party_documents_table.sql` (DB agent)
- `app/api/directory/[id]/documents/route.ts` (new)
- `app/api/directory/[id]/documents/[docId]/route.ts` (new)
- `components/DirectoryDocuments.tsx` (new)
- `app/directory/[id]/page.tsx`
- `lib/types/directory.ts`

**Smoke Test:**
1. Open party detail → Documents tab exists
2. Add document → saves successfully
3. Edit document → updates correctly
4. Delete document → removes correctly
5. Multiple documents → all display

---

## Phase 9: Loyalty Programs Section

**Goal:** Add Loyalty Programs section for storing frequent flyer/hotel memberships.

**Included:**
- Database schema for party_loyalty_programs table
- CRUD API endpoints
- Loyalty programs component
- Multiple entries support

**Excluded:**
- Loyalty points tracking
- Auto-sync with external systems

**Acceptance Criteria:**
- ✅ party_loyalty_programs table exists
- ✅ Can add/edit/delete loyalty programs
- ✅ Multiple programs per party supported
- ✅ Program types: Airline, Hotel, Rent a Car, Company
- ✅ Programs display in Directory detail page

**Agents:** DB/SCHEMA (schema) → CODE WRITER (API + UI)

**COPY-READY PROMPT FOR DB/SCHEMA:**

```
TASK: Create party_loyalty_programs table schema

Requirements:
- id: UUID (primary key)
- party_id: UUID (FK to party.id, CASCADE DELETE)
- program_type: enum ('Airline', 'Hotel', 'Rent a Car', 'Company')
- member_number: TEXT (required)
- notes: TEXT (nullable)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

Create migration:
- migrations/add_party_loyalty_programs_table.sql
- Include RLS policies for tenant isolation
- Add index on party_id

Verify:
- Table created
- RLS policies active
```

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Implement Loyalty Programs section for Directory

1. Create API endpoints:
   File: app/api/directory/[id]/loyalty/route.ts (new)
   - GET: list loyalty programs
   - POST: create new program
   
   File: app/api/directory/[id]/loyalty/[programId]/route.ts (new)
   - PUT: update program
   - DELETE: delete program

2. Create Loyalty component:
   File: components/DirectoryLoyalty.tsx (new)
   - List of programs (can have multiple)
   - Add/edit form
   - Delete functionality
   - Program type selector

3. Integrate into Directory detail page:
   File: app/directory/[id]/page.tsx
   - Add "Loyalty" tab (or add to existing tab)
   - Include DirectoryLoyalty component

4. Update types:
   File: lib/types/directory.ts
   - Add LoyaltyProgram interface
   - Add loyalty_programs?: LoyaltyProgram[] to DirectoryRecord

VERIFY:
- npm run build passes
- Can add multiple loyalty programs
- Programs list displays correctly
- Can edit/delete programs
- Program types work correctly
```

**Expected Files:**
- `migrations/add_party_loyalty_programs_table.sql` (DB agent)
- `app/api/directory/[id]/loyalty/route.ts` (new)
- `app/api/directory/[id]/loyalty/[programId]/route.ts` (new)
- `components/DirectoryLoyalty.tsx` (new)
- `app/directory/[id]/page.tsx`
- `lib/types/directory.ts`

**Smoke Test:**
1. Open party detail → Loyalty tab/section exists
2. Add multiple programs → all save
3. Edit program → updates correctly
4. Delete program → removes correctly
5. Different program types → all work

---

## Phase 10: Marketing Consent History

**Goal:** Track history of marketing consent changes (date, source).

**Included:**
- Database schema for consent history table
- Track consent changes on update
- Display history in form

**Excluded:**
- Consent automation
- Email/SMS integration

**Acceptance Criteria:**
- ✅ Consent changes are logged with timestamp and source
- ✅ History displays in Directory form
- ✅ Can view consent change timeline

**Agents:** DB/SCHEMA (schema) → CODE WRITER (API + UI)

**COPY-READY PROMPT FOR DB/SCHEMA:**

```
TASK: Create party_marketing_consent_history table

Requirements:
- id: UUID (primary key)
- party_id: UUID (FK to party.id, CASCADE DELETE)
- consent_type: enum ('email', 'sms')
- consented: BOOLEAN
- changed_at: TIMESTAMP
- changed_by: UUID (FK to auth.users)
- source: TEXT (nullable, e.g., 'manual', 'api', 'import')

Create migration:
- migrations/add_party_marketing_consent_history.sql
- Include RLS policies
- Add index on party_id, changed_at

Verify:
- Table created
- RLS policies active
```

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Implement Marketing Consent History tracking

1. Update API endpoint:
   File: app/api/directory/[id]/route.ts (PUT handler)
   - When email_marketing_consent or phone_marketing_consent changes
   - Insert record into party_marketing_consent_history
   - Include: consent_type, consented value, changed_at, changed_by, source: 'manual'

2. Create API endpoint for history:
   File: app/api/directory/[id]/consent-history/route.ts (new)
   - GET: return consent history for party

3. Update DirectoryForm:
   File: components/DirectoryForm.tsx
   - Add consent history display section (collapsible or below checkboxes)
   - Show timeline of consent changes
   - Format: "Email consent changed to Yes on 24.12.2024 by User Name"

VERIFY:
- npm run build passes
- Change consent → history entry created
- History displays correctly
- Timeline is readable
```

**Expected Files:**
- `migrations/add_party_marketing_consent_history.sql` (DB agent)
- `app/api/directory/[id]/route.ts`
- `app/api/directory/[id]/consent-history/route.ts` (new)
- `components/DirectoryForm.tsx`

**Smoke Test:**
1. Change email consent → history entry created
2. Change SMS consent → history entry created
3. View history → timeline displays correctly
4. Multiple changes → all appear in timeline

---

## Phase 11: Improved Duplicate Detection

**Goal:** Enhance duplicate detection with typo tolerance (2-3 letter differences) and DOB comparison.

**Included:**
- Fuzzy name matching with Levenshtein distance
- DOB comparison
- Typo tolerance algorithm
- Suggest corrections

**Excluded:**
- Machine learning matching
- External duplicate detection services

**Acceptance Criteria:**
- ✅ Detects duplicates with 2-3 letter differences in name
- ✅ Compares DOB when available
- ✅ Suggests corrections for typos
- ✅ Similarity scores reflect match quality

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Improve duplicate detection with typo tolerance

File: app/api/directory/check-duplicates/route.ts

1. Add fuzzy matching function:
   - Calculate Levenshtein distance between names
   - If distance <= 3 for names of length > 5, consider as potential match
   - If distance <= 2 for shorter names, consider as match

2. Enhance name + DOB matching:
   - Current: exact name match + DOB match = 0.95 score
   - Add: fuzzy name match (2-3 chars diff) + DOB match = 0.90 score
   - Add: fuzzy name match only = 0.75 score

3. Add typo suggestion:
   - If fuzzy match found, include suggested_correction field
   - Show existing name as suggestion

4. Update duplicate result interface:
   - Add suggested_correction?: string field
   - Update similarity_score calculation

VERIFY:
- npm run build passes
- Test with "John Smith" vs "Jon Smith" → detected
- Test with DOB match → higher score
- Test with typos → suggestions appear
```

**Expected Files:**
- `app/api/directory/check-duplicates/route.ts`

**Smoke Test:**
1. Search "John Smith" → finds "Jon Smith" (1 char diff)
2. Search with DOB → higher similarity score
3. Check suggestions → typo corrections shown
4. Similarity scores → reflect match quality

---

## Phase 12: Quick Client Creation from New Order

**Goal:** Add popup in New Order page for quick client creation when client not found.

**Included:**
- Popup component for quick client creation
- Minimal form (name, phone, email only)
- Auto-select client after creation
- Performance optimization (debounced search)

**Excluded:**
- Full Directory form in popup
- Client editing from popup

**Acceptance Criteria:**
- ✅ Popup appears when "Add New Client" clicked in Order form
- ✅ Minimal form with essential fields only
- ✅ Creates client and auto-selects in order
- ✅ Does not slow down with large database
- ✅ Popup closes after successful creation

**Agents:** CODE WRITER

**COPY-READY PROMPT FOR CODE WRITER:**

```
TASK: Add quick client creation popup in New Order page

1. Create QuickClientCreate component:
   File: components/QuickClientCreate.tsx (new)
   - Modal/popup dialog
   - Form fields: first_name, last_name, phone, email (minimal)
   - Submit creates client via API
   - Closes and calls onSuccess callback with created client ID

2. Integrate into New Order page:
   File: app/orders/new/page.tsx
   - Add "Add New Client" button near client search/select
   - Opens QuickClientCreate popup
   - On success: auto-selects created client in order form

3. Optimize performance:
   - Use debounced search for existing clients (if implemented)
   - Popup does not load full Directory list
   - Quick creation uses minimal API call

VERIFY:
- npm run build passes
- Click "Add New Client" → popup opens
- Fill form → creates client
- Client auto-selected in order
- Performance acceptable
```

**Expected Files:**
- `components/QuickClientCreate.tsx` (new)
- `app/orders/new/page.tsx`

**Smoke Test:**
1. Open New Order → "Add New Client" button visible
2. Click button → popup opens
3. Fill minimal form → creates client
4. Client auto-selected in order form
5. Popup closes after creation

---

## Implementation Order Summary

1. **Phase 1:** Critical Fixes (Error Handling & Field Mapping)
2. **Phase 2:** Add Missing Person Fields (Title, Citizenship, Address)
3. **Phase 3:** Compact Layout Redesign
4. **Phase 4:** Date Format dd.mm.yyyy
5. **Phase 5:** Visual Feedback on Field Changes
6. **Phase 6:** Internal Client Number Generation
7. **Phase 7:** Commission Type Display for Supplier
8. **Phase 8:** Documents Section
9. **Phase 9:** Loyalty Programs Section
10. **Phase 10:** Marketing Consent History
11. **Phase 11:** Improved Duplicate Detection
12. **Phase 12:** Quick Client Creation from New Order

---

## Notes

- Each phase is independent and can be implemented separately
- Phases 1-2 should be completed first (critical fixes)
- DB/SCHEMA agent must verify schema before CODE WRITER implements DB-dependent features
- All phases maintain backward compatibility
- Test each phase independently before moving to next





