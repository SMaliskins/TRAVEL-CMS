# TITLE: Create Directory Record

## 1. PURPOSE

Enable authenticated users to create new directory records (parties) through a structured form interface. The system must support creating both Person and Company entities with multiple roles (Client, Supplier, Subagent) and associated metadata. The feature must validate input, handle errors gracefully, and maintain data integrity across related data entities.

## 2. IN SCOPE

- Create new Person-type directory records
- Create new Company-type directory records
- Assign multiple roles (Client, Supplier, Subagent) to a single record
- Set status (Active/Inactive)
- Enter person-specific information (first name, last name, personal identifier, date of birth, citizenship, address)
- Enter company-specific information (company name, registration number, legal/actual address, bank details)
- Enter common contact information (phone, email, marketing consents)
- Enter supplier-specific details (business category, commission settings)
- Enter subagent-specific details (commission scheme, payout details)
- Form validation (client-side and server-side)
- Error handling and user feedback
- Unsaved changes detection
- Keyboard shortcuts (Ctrl+S to save, Ctrl+Enter to save & close, Esc to cancel)
- Redirect after successful creation (to edit page or directory list)

## 3. OUT OF SCOPE

- Edit existing records (separate feature)
- Delete records (separate feature)
- Bulk import
- Document upload/management
- Advanced duplicate merging
- Real-time collaboration
- Audit trail visualization (only metadata storage)
- Rating assignment during creation
- Notes field during creation
- Duplicate prevention enforcement (checking available but not mandatory)
- Email/SMS notifications on creation
- Activity feed integration

## 4. ACTORS & PERMISSIONS

**Actor: Authenticated User**
- Can create directory records (both Person and Company types)
- Must have valid authentication token
- Created records are associated with <user identifier> who created them
- Records are scoped to <company identifier> for tenant isolation (currently falls back to <user identifier> if company association not available)
- Sees full form with all fields
- Sees validation errors inline and in header
- Sees success/error notifications

**Permissions:**
- Authentication required: valid JWT token in Authorization header
- No role-based restrictions specified (all authenticated users can create)
- Cannot create records without authentication (returns 401 Unauthorized)

## 5. UX / SCREENS

**Page: New Directory Record Creation**

**Entry Point:**
- Navigation to new record creation page

**Main UI States:**

**Empty State:**
- Form starts empty (all fields blank)
- No roles selected initially
- Status: Active checked by default
- Save buttons disabled until form is valid

**View State (Form Fields):**

**Main Details Section:**
- Type selection (Person/Company) - radio buttons, required
  - Only shown when Client role is NOT selected
- Client type selection (Physical person/Legal entity) - radio buttons, required
  - Only shown when Client role IS selected
- Person fields (shown when type = Person):
  - First name (text input, required)
  - Last name (text input, required)
  - Personal identifier (text input, optional)
  - Date of birth (date picker, optional)
- Company fields (shown when type = Company):
  - Company name (text input, required)
  - Registration number (text input, optional)
  - Address (text input, optional)
  - Contact person (text input, optional) - NOTE: Field exists in form but persistence unclear
- Common fields:
  - Phone (tel input, optional)
  - Email (email input, optional)

**Roles & Status Section:**
- Roles (checkboxes, at least one required):
  - Client
  - Supplier
  - Subagent
- Status:
  - Active (checkbox, default: checked)

**Conditional Sections:**

**Supplier Details** (shown when Supplier role is checked):
- Activity area (text input)
- Commission type (dropdown: Percent / Fixed)
- Commission value (number input, optional)
- Currency (dropdown: EUR, USD, GBP, default: EUR)
- Commission valid from (date picker, optional)
- Commission valid to (date picker, optional)
- Section highlights when role is first enabled

**Subagent Details** (shown when Subagent role is checked):
- Commission type (dropdown: From revenue / From profit / Progressive ladder)
- Commission value (number input, optional) - NOTE: Persistence unclear
- Currency (dropdown: EUR, USD, GBP) - NOTE: Persistence unclear
- Period type (dropdown: Default (year) / Custom period) - NOTE: Persistence unclear
- Period from (date picker, shown when custom period) - NOTE: Persistence unclear
- Period to (date picker, shown when custom period) - NOTE: Persistence unclear
- Payment details (textarea, IBAN/bank info)

**Header Actions:**
- Title: "New record"
- Status badge: "Unsaved changes" when form is dirty
- Compact roles display: checkboxes for Client, Supplier, Subagent, Active
- Action buttons:
  - Cancel
  - Save (shows "Saving..." spinner when in progress, shows "Saved ✓" on success)
  - Save & Close (shows spinner when in progress)
- Error message display (dismissible)
- Success message (auto-dismisses after 2 seconds)

**Loading State:**
- Save buttons show spinner and "Saving..." text during API call
- Buttons are disabled during save operation
- Form fields remain editable during save

**Error State:**
- Client-side validation errors:
  - Roles error: "At least one role must be selected" (shown below roles section)
  - Field-level HTML5 validation (browser native)
  - Form-level: Save buttons disabled if validation fails
- Server-side errors:
  - Error banner at top of page (dismissible)
  - Error message text from API response
  - Common errors: Unauthorized, validation errors, database errors
- Error handling behavior:
  - If core record creation succeeds but extension record insert fails, core record is deleted (rollback)
  - Error messages are user-friendly (no stack traces)

**Success State:**
- Success message appears after save
- Redirect to edit page after "Save"
- Redirect to directory list after "Save & Close"
- Success message auto-dismisses after 2 seconds

**Edge Cases:**
- User closes browser/tab with unsaved changes: browser may warn (native behavior)
- Network timeout: error message shown, user can retry
- Concurrent creation: handled by duplicate check (if implemented) or database constraints
- Very long field values: handled by database constraints
- Invalid date formats: browser date picker prevents invalid input
- Special characters in names: accepted (stored as-is)

## 6. DATA MODEL (LOGICAL)

**Core Entity: Party**
- Unique identifier (auto-generated)
- Display name (computed from person name or company name)
- Party type (Person or Company)
- Status (Active, Inactive, or Blocked, default: Active)
- Rating (1-10, optional)
- Notes (optional)
- Company identifier (for tenant isolation, links to company entity)
- Email (optional)
- Phone (optional)
- Email marketing consent (boolean, default: false)
- Phone marketing consent (boolean, default: false)
- Created by (user identifier, required)
- Created timestamp (auto-generated)
- Updated timestamp (auto-generated)

**Extension Entity: Person Details** (1-to-1 with Party when party type = Person)
- Party identifier (foreign key to Party)
- Title (optional: Mr/Mrs/Chd)
- First name (required if party type = Person)
- Last name (required if party type = Person)
- Date of birth (optional)
- Personal identifier (optional)
- Citizenship (optional, country code)
- Address (optional)

**Extension Entity: Company Details** (1-to-1 with Party when party type = Company)
- Party identifier (foreign key to Party)
- Company name (required if party type = Company)
- Registration number (optional)
- Legal address (optional)
- Actual address (optional)
- Bank details (optional)

**Role Assignment Entities:**

**Client Role** (0-to-1 with Party when Client role assigned)
- Party identifier (foreign key to Party)
- No additional fields (role marker)

**Supplier Role** (0-to-1 with Party when Supplier role assigned)
- Party identifier (foreign key to Party)
- Business category (optional: TO, Hotel, Rent a car, Airline, DMC, Other)
- Commission type (optional: Percent or Fixed)
- Commission value (optional, numeric)
- Commission currency (optional, default: EUR)
- Commission valid from (optional, date)
- Commission valid to (optional, date)
- Commission notes (optional)

**Subagent Role** (0-to-1 with Party when Subagent role assigned)
- Party identifier (foreign key to Party)
- Commission scheme (optional: Revenue or Profit)
- Commission tiers (optional, JSON structure for progressive tiers)
- Payout details (optional, IBAN/bank info)

**Relationships:**
- One Party → One Person Details (if party type = Person)
- One Party → One Company Details (if party type = Company)
- One Party → Zero or One Client Role (if Client role assigned)
- One Party → Zero or One Supplier Role (if Supplier role assigned)
- One Party → Zero or One Subagent Role (if Subagent role assigned)
- Party → Company entity (many-to-one, tenant isolation)
- Party → User entity (many-to-one, creator)

## 7. BUSINESS RULES

**Validation Rules:**

**Required Fields:**
- Party type: Must be Person or Company
- At least one role: Client, Supplier, or Subagent
- If party type = Person: First name and last name required
- If party type = Company: Company name required

**Optional Fields:**
- All other fields are optional (personal identifier, date of birth, phone, email, etc.)

**Format Validations:**
- Email: Standard email format (browser HTML5 validation + optional server validation)
- Phone: Free-form text (no format enforcement)
- Date fields: ISO date format (YYYY-MM-DD) from date picker
- Personal identifier: Free-form text (no format enforcement)
- Registration number: Free-form text (no format enforcement)

**Automatic Behaviors:**
- Display name is auto-generated if not provided:
  - Person: "{first name} {last name}".trim()
  - Company: company name
- Status defaults to Active if not provided
- Company identifier is derived from user context (currently falls back to user identifier if company association not available)
- Created by is set to current user identifier from auth token
- Created timestamp and updated timestamp are auto-generated by database

**Role-Specific Rules:**
- Multiple roles can be assigned to one party
- Supplier role: Business category is optional, commission fields are optional
- Subagent role: Commission scheme is optional, payout details are optional
- Client role: No additional fields required

**Duplicate Prevention:**
- Duplicate checking is available via dedicated endpoint
- Checks: email (exact), phone (exact), personal identifier (exact), registration number (exact), name+date of birth (fuzzy)
- NOTE: Current implementation does not enforce duplicate prevention during creation (checking is available but not mandatory)
- Database may have unique constraints on email/phone/personal identifier/registration number (verify schema)

**Transaction Safety:**
- If party creation succeeds but person/company details insert fails, party record is deleted (manual rollback)
- If role inserts fail, error is returned (no automatic rollback of roles - may leave orphaned party)
- RECOMMENDATION: Wrap entire creation in database transaction for atomicity

## 8. FLOWS

**Happy Path: Create Person with Client Role**

1. User navigates to new record creation page
2. Form loads empty, "Active" checkbox checked by default
3. User selects "Client" role checkbox
4. "Client type" radio buttons appear (Physical person / Legal entity)
5. User selects "Physical person"
6. Person fields appear (First name, Last name, Personal identifier, Date of birth)
7. User fills:
   - First name: "John"
   - Last name: "Doe"
   - Personal identifier: (optional, left blank)
   - Date of birth: (optional, left blank)
   - Phone: "+1234567890"
   - Email: "john@example.com"
8. User clicks "Save & Close" button
9. Client-side validation runs:
   - Roles: Client selected ✓
   - First name: not empty ✓
   - Last name: not empty ✓
10. Form submits to creation endpoint
11. Server validates:
    - User authenticated ✓
    - Party type = Person ✓
    - Roles includes Client ✓
    - First name and last name present ✓
12. Server generates display name = "John Doe"
13. Server creates:
    - Party record with core information
    - Person details record with person-specific information
    - Client role assignment record
14. Server returns success response with record identifier and display name
15. Client receives response, shows "Saved ✓" message
16. After brief delay, redirect to edit page

**Happy Path: Create Company with Supplier Role**

1. User navigates to new record creation page
2. Form loads empty
3. User selects "Supplier" role checkbox
4. "Type" radio buttons appear (Person / Company)
5. User selects "Company"
6. Company fields appear (Company name, Registration number, Address)
7. Supplier Details section appears (highlighted)
8. User fills:
   - Company name: "Acme Hotels"
   - Registration number: "12345678"
   - Address: "123 Main St"
   - Phone: "+9876543210"
   - Activity area: "Hotel"
   - Commission type: "Percent"
   - Commission value: "10"
   - Currency: "EUR"
9. User clicks "Save" button
10. Client-side validation runs:
    - Roles: Supplier selected ✓
    - Company name: not empty ✓
11. Form submits to creation endpoint
12. Server validates and creates:
    - Party record
    - Company details record
    - Supplier role assignment record (with supplier details)
13. Server returns success
14. Client shows "Saved ✓" message
15. After brief delay, redirect to edit page

**Edge Case: Validation Failure**

1. User fills form but leaves "First name" empty
2. User clicks "Save"
3. HTML5 validation prevents submit (browser shows native error)
4. User fills "First name"
5. User clicks "Save" again
6. Form submits
7. If server validation fails (e.g., missing last name), server returns validation error
8. Client shows error banner with specific field requirements
9. User corrects and retries

**Edge Case: Database Failure**

1. User submits valid form
2. Server creates party record successfully
3. Server attempts to create person details record
4. Database error occurs (e.g., constraint violation)
5. Server deletes party record (rollback)
6. Server returns error: "Failed to create person record"
7. Client shows error banner with message
8. User can retry after fixing issue

**Cancel Flow**

1. User fills form (form becomes dirty)
2. User clicks "Cancel" button
3. If form is dirty, confirmation modal appears: "Discard changes? You have unsaved changes. Are you sure you want to cancel?"
4. User clicks "Discard" → navigates to directory list
5. User clicks "Keep editing" → modal closes, stays on page
6. If form is not dirty, cancel navigates immediately to directory list

**Keyboard Shortcuts Flow**

1. User fills form
2. User presses Ctrl+S (or Cmd+S on Mac)
3. If form is valid and roles selected, form submits (Save action)
4. User presses Ctrl+Enter (or Cmd+Enter)
5. If form is valid, form submits (Save & Close action)
6. User presses Esc
7. If cancel confirmation modal is open, modal closes
8. If form is dirty, cancel confirmation appears
9. If form is not dirty, navigates to directory list

## 9. AUDIT / LOGGING / HISTORY

**User-Facing Notifications:**
- Success: "Saved ✓" message in header, auto-dismisses after 2 seconds
- Error: Error banner at top of page, dismissible
- Validation: Inline error text below roles section if no roles selected

**Server Logs:**
- All errors logged to console with context:
  - "Error creating party: {error}"
  - "Error creating person: {error}"
  - "Error creating company: {error}"
  - "Directory creation error: {error message}"
- Logs include full error objects for debugging

**Audit Trail:**
- Created by field stores user identifier who created the record
- Created timestamp records creation time
- Updated timestamp records last modification (set to creation time on create)
- NOTE: No separate audit log table for creation events (only metadata in party record)

## 10. ACCEPTANCE CRITERIA

- Given user is authenticated, when user navigates to new record creation page, then form loads empty with Active status checked by default
- Given user selects Person type, when user fills first name and last name, then form is valid for submission
- Given user selects Company type, when user fills company name, then form is valid for submission
- Given user selects at least one role, when user fills required fields, then Save buttons are enabled
- Given user does not select any role, when user attempts to save, then validation error "At least one role must be selected" is shown and Save buttons remain disabled
- Given user selects Supplier role, when user enables Supplier role, then Supplier Details section appears and highlights
- Given user selects Subagent role, when user enables Subagent role, then Subagent Details section appears and highlights
- Given user fills valid form, when user clicks Save, then record is created and user is redirected to edit page
- Given user fills valid form, when user clicks Save & Close, then record is created and user is redirected to directory list
- Given user fills form, when user clicks Cancel with unsaved changes, then confirmation modal appears
- Given user fills form, when user clicks Cancel without changes, then immediate navigation to directory list occurs
- Given user presses Ctrl+S (or Cmd+S), when form is valid, then form submits (Save action)
- Given user presses Ctrl+Enter (or Cmd+Enter), when form is valid, then form submits (Save & Close action)
- Given user presses Esc, when cancel modal is open, then modal closes
- Given user presses Esc, when form is dirty, then cancel confirmation appears
- Given server creates party record successfully, when person/company details insert fails, then party record is deleted (rollback) and error is shown
- Given user is not authenticated, when user attempts to create record, then 401 Unauthorized error is returned
- Given user creates Person record, when display name is not provided, then display name is auto-generated as "{first name} {last name}"
- Given user creates Company record, when display name is not provided, then display name is auto-generated as company name
- Given user creates record with multiple roles, when record is saved, then all role assignment records are created

## 11. QA TEST PLAN

**Test Case 1: Create Person with Client Role**
- Navigate to new record creation page
- Select "Client" role checkbox
- Select "Physical person" radio button
- Enter first name: "Test"
- Enter last name: "User"
- Enter phone: "+1234567890"
- Click "Save & Close"
- Expected: Record created, redirect to directory list, new record appears in list

**Test Case 2: Create Company with Supplier Role**
- Navigate to new record creation page
- Select "Supplier" role checkbox
- Select "Company" type
- Enter company name: "Test Company"
- Enter activity area: "Hotel"
- Select commission type: "Percent"
- Enter commission value: "15"
- Click "Save"
- Expected: Record created, redirect to edit page, supplier details saved

**Test Case 3: Create Person with Multiple Roles**
- Navigate to new record creation page
- Select "Client" and "Supplier" roles
- Select "Physical person"
- Fill person fields (first name, last name)
- Fill supplier details (activity area, commission)
- Click "Save & Close"
- Expected: Record created with both roles, both Client and Supplier role assignment records exist

**Test Case 4: Validation - Missing Required Fields**
- Navigate to new record creation page
- Select "Client" role
- Select "Physical person"
- Leave first name empty
- Click "Save"
- Expected: Browser validation prevents submit, error shown

**Test Case 5: Validation - No Roles Selected**
- Navigate to new record creation page
- Fill first name and last name
- Do not select any roles
- Click "Save"
- Expected: "At least one role must be selected" error shown, save buttons disabled

**Test Case 6: Error Handling - Server Error**
- Navigate to new record creation page
- Fill form completely
- Simulate server error (e.g., database down, invalid data)
- Click "Save"
- Expected: Error banner appears with message, form remains editable, user can retry

**Test Case 7: Cancel with Unsaved Changes**
- Navigate to new record creation page
- Fill some fields (form becomes dirty)
- Click "Cancel"
- Expected: Confirmation modal appears, "Discard" navigates away, "Keep editing" stays on page

**Test Case 8: Cancel without Changes**
- Navigate to new record creation page
- Do not fill any fields
- Click "Cancel"
- Expected: Immediate navigation to directory list (no modal)

**Test Case 9: Keyboard Shortcuts**
- Navigate to new record creation page
- Fill form completely
- Press Ctrl+S (or Cmd+S)
- Expected: Form saves (Save action)
- Press Ctrl+Enter (or Cmd+Enter)
- Expected: Form saves and closes (Save & Close action)
- Press Esc
- Expected: Cancel flow triggered

**Test Case 10: Transaction Rollback**
- Navigate to new record creation page
- Fill person form completely
- Simulate person details insert failure (e.g., constraint violation)
- Click "Save"
- Expected: Error message shown, party record is deleted (no orphaned record)

**Test Case 11: Status Default**
- Navigate to new record creation page
- Observe status checkbox
- Expected: "Active" checkbox is checked by default

**Test Case 12: Display Name Generation**
- Create person record: first name="John", last name="Doe"
- Verify display name in database
- Expected: Display name = "John Doe"
- Create company record: company name="Acme Corp"
- Verify display name in database
- Expected: Display name = "Acme Corp"

**Test Case 13: Authentication Required**
- Clear authentication token
- Attempt to create record via API directly
- Expected: 401 Unauthorized response

**Test Case 14: Supplier Section Highlight**
- Navigate to new record creation page
- Select "Supplier" role
- Expected: Supplier Details section appears with highlight, scrolls into view if needed

**Test Case 15: Subagent Section Highlight**
- Navigate to new record creation page
- Select "Subagent" role
- Expected: Subagent Details section appears with highlight, scrolls into view if needed

## 12. OPEN QUESTIONS

**Schema Verification Required:**
1. Does company entity table exist? What is the primary key column name and type? What columns exist? Is there a relationship table between users and companies, or is company identifier derived differently?
2. Confirm user entity table structure (Supabase standard). Confirm identifier column exists and type.
3. Confirm enum types exist with correct values:
   - Party type enum: Person, Company
   - Party status enum: Active, Inactive, Blocked
   - Business category enum: TO, Hotel, Rent a car, Airline, DMC, Other
   - Commission type enum: Percent, Fixed
4. Are foreign key constraints defined with ON DELETE CASCADE? What happens if referenced company/user is deleted?
5. Are indexes present on email, phone, personal identifier, registration number fields? Are composite indexes for tenant isolation queries present?
6. What RLS policies exist on party, person details, company details, role assignment tables? Do policies allow INSERT for authenticated users? Is admin client required to bypass RLS, or can regular client insert?
7. What default values exist? Does status have DEFAULT Active? Do marketing consent fields have DEFAULT false? Does commission currency have DEFAULT EUR?
8. Which columns are NOT NULL vs nullable? Are display name, party type, status, created by required?
9. Does "Contact person" field in form need to be persisted? If yes, where should it be stored?
10. Do Subagent commission value, currency, period fields need to be persisted? If yes, where should they be stored?

**Business Logic Questions:**
11. Should duplicate prevention be enforced during creation, or remain optional?
12. Should entire creation flow be wrapped in database transaction for atomicity?
13. How should company identifier be resolved from user context? Is there a user-company relationship table?

## 13. FUTURE EXTENSIONS

**NOT PART OF CURRENT TASK - DO NOT IMPLEMENT:**

- Edit existing records (separate feature)
- Delete records (separate feature)
- Bulk import/export
- Document management
- Advanced duplicate merging
- Real-time collaboration
- Audit trail visualization UI
- Rating assignment during creation
- Notes field during creation
- Duplicate prevention enforcement (checking available but not mandatory)
- Email/SMS notifications on creation
- Activity feed integration
- Search/filter during creation
- Autocomplete for existing records
- Integration with external systems
- Multi-language support
- Accessibility audit enhancements

**Potential Future Phases (Not in Scope):**
- Phase 2: Duplicate Prevention - Integrate duplicate check API into creation flow, show duplicate warnings before save, allow user to view/merge duplicates, enforce unique constraints
- Phase 3: Enhanced Validation - Real-time validation as user types, format validation for personal identifiers (country-specific), phone number format validation, email domain validation
- Phase 4: Rich Metadata - Notes field in creation form, rating assignment during creation, tags/categories assignment, custom fields support
- Phase 5: Workflow Integration - Approval workflow for certain record types, notifications to managers on creation, integration with CRM systems
- Phase 6: Performance & Scale - Optimistic UI updates, background save with retry, offline support, bulk creation interface

---

SPEC COMPLETE — READY FOR ARCHITECT REVIEW
