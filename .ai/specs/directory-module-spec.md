# TITLE: Directory Module

## 1. FEATURE NAME

Directory Module — Comprehensive management of Clients (physical persons), Legal entities, Suppliers, and Subagents

## 2. GOAL

Provide a complete directory management system for travel CMS that enables users to create, view, edit, and manage parties (clients, legal entities, suppliers, subagents) with full support for roles, status management, marketing consents, document storage, loyalty tracking, and statistics. The system must support multi-tenant isolation, data integrity, and provide comprehensive search and filtering capabilities.

## 3. IN SCOPE

**Core Entities:**
- Physical persons (clients)
- Legal entities (companies)
- Supplier role assignment and management
- Subagent role assignment and management
- Multiple roles per party (Client, Supplier, Subagent combinations)

**CRUD Operations:**
- Create new directory records (Person or Company)
- View directory records (list view and detail view)
- Edit existing directory records
- Deactivate directory records (soft delete, no hard deletion)

**Person-Specific Features:**
- First name, last name (required)
- Personal identifier (optional)
- Date of birth (optional)
- Citizenship (optional)
- Address (optional)
- Title (Mr/Mrs/Chd, optional)

**Company-Specific Features:**
- Company name (required)
- Registration number (optional)
- Legal address (optional)
- Actual address (optional)
- Bank details (optional)

**Common Features:**
- Phone number (optional)
- Email address (optional)
- Email marketing consent (boolean)
- Phone marketing consent (boolean)
- Display name (auto-generated or manual)

**Role Management:**
- Assign Client role
- Assign Supplier role with business category and commission settings
- Assign Subagent role with commission scheme and payout details
- Multiple roles per party
- Role-specific data fields

**Status Management:**
- Active status
- Inactive status
- Blocked status
- Status change tracking

**Marketing Consents:**
- Email marketing consent checkbox
- Phone marketing consent checkbox
- Consent tracking and management

**Documents:**
- Document upload and storage
- Document types: passport, ID, other
- Document metadata: document number, issued date, valid till, issued by
- Document file storage

**Statistics & Loyalty:**
- Total spent (calculated from orders)
- Last trip date
- Next trip date
- Debt calculation
- Order count
- Loyalty metrics (if applicable)

**Search & Filtering:**
- Search by name
- Search by personal identifier
- Search by phone
- Search by email
- Filter by role (Client, Supplier, Subagent)
- Filter by type (Person, Company)
- Filter by status (Active, Inactive, Blocked)
- Combined search and filter

**List View:**
- Directory records listing
- Sortable columns
- Pagination
- Quick actions (view, edit, deactivate)

**Detail View:**
- Full record information display
- Statistics display
- Documents list
- Related orders (if applicable)
- Edit action

**Edit View:**
- Full form with all fields
- Role management
- Status management
- Document management
- Save and Save & Close actions

**Duplicate Detection:**
- Check for duplicates by email
- Check for duplicates by phone
- Check for duplicates by personal identifier
- Check for duplicates by registration number
- Fuzzy matching by name and date of birth

**Tenant Isolation:**
- Records scoped to company identifier
- User-company relationship management
- Data isolation between tenants

## 4. OUT OF SCOPE

- Hard deletion of records (only deactivation supported)
- Bulk import/export
- Advanced duplicate merging workflow
- Real-time collaboration
- Audit trail visualization UI (only metadata storage)
- Rating assignment UI (field exists but not in UI)
- Notes field UI (field exists but not in UI)
- Email/SMS notifications on changes
- Activity feed integration
- Integration with external CRM systems
- Client portal (future extension, note only)
- Supplier portal (future extension, note only)
- Advanced document processing (OCR, validation)
- Document expiration alerts
- Automated loyalty program calculations
- Commission calculation engine
- Payment processing
- Multi-language support for UI
- Accessibility audit enhancements
- Mobile app support

## 5. USER ROLES & PERMISSIONS

**Actor: Authenticated User**
- Can create directory records (both Person and Company types)
- Can view directory records (list and detail views)
- Can edit directory records
- Can deactivate directory records
- Can search and filter directory records
- Can upload and manage documents
- Can view statistics for records
- Must have valid authentication token
- Created records are associated with user identifier who created them
- Records are scoped to company identifier for tenant isolation

**Permissions:**
- Authentication required: valid JWT token in Authorization header
- No role-based restrictions specified (all authenticated users have full access)
- Cannot access records without authentication (returns 401 Unauthorized)
- Cannot access records from other tenants (enforced by company identifier)

**What Users Can See:**
- All directory records within their tenant (company identifier)
- Full form with all fields
- Validation errors inline and in header
- Success/error notifications
- Statistics for records they can access
- Documents for records they can access

**What Users Cannot Do:**
- Access records from other tenants
- Hard delete records (only deactivate)
- Modify created_by or created_at timestamps
- Bypass tenant isolation

## 6. UX / SCREENS

**Screen 1: Directory List View**

**Purpose:** Display all directory records in a searchable, filterable, sortable list

**Entry Point:** Navigation to directory list page

**Main UI States:**

**Empty State:**
- Message: "No directory records found"
- Action: "Create new record" button

**Populated State:**
- Table/grid view with directory records
- Columns: Display name, Type, Roles, Status, Phone, Email, Last updated
- Each row has actions: View, Edit, Deactivate
- Search bar at top
- Filter panel (Role, Type, Status)
- Pagination controls
- "Create new record" button

**Loading State:**
- Skeleton loader or spinner
- Table structure visible but content loading

**Error State:**
- Error message banner
- Retry button
- Fallback to empty state if needed

**Search & Filter State:**
- Active filters displayed as chips/badges
- Clear all filters button
- Results count displayed

**Screen 2: Directory Detail View**

**Purpose:** Display full information about a single directory record

**Entry Point:** Click "View" from list, or navigate directly via URL with record identifier

**Main UI States:**

**View State:**
- Header with display name and status badge
- Main details section:
  - Type (Person/Company)
  - Person details (if Person): First name, Last name, Personal identifier, Date of birth, Citizenship, Address, Title
  - Company details (if Company): Company name, Registration number, Legal address, Actual address, Bank details
  - Contact information: Phone, Email
  - Marketing consents: Email consent, Phone consent
- Roles section:
  - Assigned roles (Client, Supplier, Subagent)
  - Role-specific details (Supplier commission info, Subagent payout info)
- Status section:
  - Current status (Active/Inactive/Blocked)
  - Status change history (if tracked)
- Statistics section:
  - Total spent
  - Last trip date
  - Next trip date
  - Debt
  - Order count
- Documents section:
  - List of uploaded documents
  - Document type, number, issued date, valid till
  - Download/view document action
  - Upload new document action
- Related orders section (if applicable):
  - List of orders linked to this party
  - Order code, date, amount
- Actions:
  - Edit button
  - Deactivate button (if active)
  - Activate button (if inactive)
  - Back to list button

**Loading State:**
- Skeleton loader for sections
- Spinner overlay

**Error State:**
- Error message banner
- "Record not found" message if identifier invalid
- Back to list button

**Empty Statistics State:**
- "No statistics available" message
- Applies when no orders exist for this party

**Empty Documents State:**
- "No documents uploaded" message
- Upload document button

**Screen 3: Directory Create View**

**Purpose:** Create a new directory record

**Entry Point:** Click "Create new record" from list view

**Main UI States:**

**Empty State:**
- Form starts empty (all fields blank)
- No roles selected initially
- Status: Active checked by default
- Save buttons disabled until form is valid

**Form Sections:**
- Main details section (left column):
  - Type selection (Person/Company) - radio buttons, required
  - Client type selection (if Client role selected): Physical person / Legal entity
  - Person fields (if Person type): First name*, Last name*, Personal identifier, Date of birth, Citizenship, Address, Title
  - Company fields (if Company type): Company name*, Registration number, Legal address, Actual address, Bank details, Contact person
  - Common fields: Phone, Email
- Roles & status section (right column):
  - Roles checkboxes: Client, Supplier, Subagent (at least one required)
  - Status checkbox: Active (default checked)
- Conditional sections:
  - Supplier Details (if Supplier role): Activity area, Commission type, Commission value, Currency, Commission valid from/to, Commission notes
  - Subagent Details (if Subagent role): Commission scheme, Commission tiers, Payout details

**Header Actions:**
- Title: "New record"
- Status badge: "Unsaved changes" when form is dirty
- Compact roles display
- Action buttons: Cancel, Save, Save & Close
- Error message display (dismissible)
- Success message (auto-dismisses)

**Loading State:**
- Save buttons show spinner during API call
- Buttons disabled during save

**Error State:**
- Error banner with specific error message
- Form remains editable
- User can retry

**Success State:**
- Success message appears
- Redirect to edit page (after Save) or list (after Save & Close)

**Screen 4: Directory Edit View**

**Purpose:** Edit an existing directory record

**Entry Point:** Click "Edit" from list or detail view

**Main UI States:**

**Populated State:**
- Same form structure as Create view
- All fields pre-filled with existing data
- Roles pre-selected
- Status pre-selected
- Documents section visible (if documents exist)

**Form Sections:**
- Same as Create view
- Additional: Documents management section
- Additional: Audit information (created by, created at, updated at) - read-only

**Header Actions:**
- Title: "Edit record: {display name}"
- Status badge: "Unsaved changes" when form is dirty
- Action buttons: Cancel, Save, Save & Close
- Error/success messages

**Loading State:**
- Form loads with existing data
- Spinner during initial load
- Spinner during save

**Error State:**
- Error banner
- Form remains editable with existing data

**Success State:**
- Success message
- Redirect to detail view (after Save) or list (after Save & Close)

**Screen 5: Search & Filter Panel**

**Purpose:** Search and filter directory records

**Entry Point:** Integrated into list view, or as popover/modal

**Main UI States:**

**Search State:**
- Search input field
- Search by: Name, Personal identifier, Phone, Email
- Search button or real-time search
- Clear search button

**Filter State:**
- Filter by Role: All, Client, Supplier, Subagent
- Filter by Type: All, Person, Company
- Filter by Status: All, Active, Inactive, Blocked
- Apply filters button
- Clear all filters button
- Active filters displayed as chips

**Results State:**
- Results count displayed
- Filtered/sorted list of records

## 7. DATA MODEL (LOGICAL)

**Core Entity: Party**
- Unique identifier (auto-generated)
- Display name (computed from person name or company name, or manual override)
- Party type (Person or Company)
- Status (Active, Inactive, or Blocked, default: Active)
- Rating (1-10, optional, for future use)
- Notes (optional, for future use)
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
- Title (optional: Mr, Mrs, Chd)
- First name (required if party type = Person)
- Last name (required if party type = Person)
- Date of birth (optional)
- Personal identifier (optional, country-specific format)
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

**Document Entity** (many-to-1 with Party)
- Unique identifier (auto-generated)
- Party identifier (foreign key to Party)
- Document type (Passport, ID, Other)
- Document number (required)
- Issued date (optional)
- Valid till (optional)
- Issued by (optional)
- File URL (optional, link to stored file)
- Created timestamp (auto-generated)
- Updated timestamp (auto-generated)

**Statistics Entity** (computed, not stored)
- Party identifier
- Total spent (calculated from orders)
- Last trip date (from orders)
- Next trip date (from orders)
- Debt (calculated: total spent - total paid)
- Order count (count of orders)

**Relationships:**
- One Party → One Person Details (if party type = Person)
- One Party → One Company Details (if party type = Company)
- One Party → Zero or One Client Role (if Client role assigned)
- One Party → Zero or One Supplier Role (if Supplier role assigned)
- One Party → Zero or One Subagent Role (if Subagent role assigned)
- One Party → Many Documents
- Party → Company entity (many-to-one, tenant isolation)
- Party → User entity (many-to-one, creator)
- Party → Orders (one-to-many, for statistics calculation)

**OPEN INPUT REQUIRED:**
- Company entity table structure and columns
- User entity table structure and identifier column
- Enum types: Party type, Party status, Business category, Commission type, Document type
- Foreign key constraint behaviors (ON DELETE CASCADE, etc.)
- Index structure for performance
- RLS policies for all tables
- Default values for all columns
- Column nullability constraints
- File storage mechanism and URL structure for documents
- Orders table structure and relationship to Party

## 8. BUSINESS RULES

**Validation Rules:**

**Required Fields:**
- Party type: Must be Person or Company
- At least one role: Client, Supplier, or Subagent
- If party type = Person: First name and last name required
- If party type = Company: Company name required
- Document: Document type and document number required (if document uploaded)

**Optional Fields:**
- All other fields are optional (personal identifier, date of birth, phone, email, etc.)

**Format Validations:**
- Email: Standard email format (browser HTML5 validation + server validation)
- Phone: Free-form text (no format enforcement)
- Date fields: ISO date format (YYYY-MM-DD) from date picker
- Personal identifier: Free-form text (no format enforcement)
- Registration number: Free-form text (no format enforcement)
- Document number: Free-form text (no format enforcement)

**Automatic Behaviors:**
- Display name is auto-generated if not provided:
  - Person: "{first name} {last name}".trim()
  - Company: company name
- Status defaults to Active if not provided
- Company identifier is derived from user context (falls back to user identifier if company association not available)
- Created by is set to current user identifier from auth token
- Created timestamp and updated timestamp are auto-generated by database
- Updated timestamp is updated on every record modification

**Role-Specific Rules:**
- Multiple roles can be assigned to one party
- Supplier role: Business category is optional, commission fields are optional
- Subagent role: Commission scheme is optional, payout details are optional
- Client role: No additional fields required
- Roles can be added or removed during edit
- Removing a role removes the role assignment record (but preserves party record)

**Status Management Rules:**
- Status can be changed between Active, Inactive, and Blocked
- Deactivation sets status to Inactive (soft delete, no hard deletion)
- Blocked status prevents certain operations (define in future)
- Status change should be tracked (if audit trail implemented)

**Marketing Consent Rules:**
- Email marketing consent defaults to false
- Phone marketing consent defaults to false
- Consents can be updated during edit
- Consents are boolean flags (no expiration dates)

**Document Rules:**
- Documents are linked to party identifier
- Multiple documents can be uploaded per party
- Document types: Passport, ID, Other
- Document metadata is stored (number, dates, issued by)
- File storage location and mechanism: OPEN INPUT REQUIRED
- Documents can be deleted (define behavior: soft delete or hard delete)

**Statistics Calculation Rules:**
- Total spent: Sum of all order amounts where party is client
- Last trip date: Most recent order date_from where party is client
- Next trip date: Earliest future order date_from where party is client
- Debt: Total spent minus total paid (only positive values shown)
- Order count: Count of orders where party is client
- Statistics are computed on-demand (not stored)
- Statistics only calculated for parties with Client role

**Duplicate Detection Rules:**
- Duplicate checking available via dedicated endpoint
- Checks: email (exact), phone (exact), personal identifier (exact), registration number (exact), name+date of birth (fuzzy)
- Duplicate prevention not enforced during creation (checking available but not mandatory)
- Database may have unique constraints (verify schema)

**Transaction Safety:**
- If party creation succeeds but person/company details insert fails, party record is deleted (rollback)
- If role inserts fail, error is returned (no automatic rollback of roles - may leave orphaned party)
- RECOMMENDATION: Wrap entire creation in database transaction for atomicity
- Edit operations should use transactions for data consistency

**Tenant Isolation Rules:**
- All queries must filter by company identifier
- Users can only see records within their tenant
- Created records are automatically assigned to user's company identifier
- Cross-tenant access is prevented

**Deactivation Rules:**
- Deactivation sets status to Inactive (soft delete)
- Deactivated records remain in database
- Deactivated records are hidden from default list view (filter by status to see)
- Deactivated records can be reactivated
- No hard deletion of records

## 9. FLOWS

**Flow 1: Create Person with Client Role**

1. User navigates to directory list view
2. User clicks "Create new record" button
3. Create form loads empty
4. User selects "Client" role checkbox
5. "Client type" radio buttons appear (Physical person / Legal entity)
6. User selects "Physical person"
7. Person fields appear
8. User fills: First name, Last name, Phone, Email
9. User clicks "Save & Close"
10. Client-side validation runs (roles selected, required fields filled)
11. Form submits to creation endpoint
12. Server validates and creates: Party record, Person details record, Client role assignment
13. Server returns success with record identifier
14. Client shows success message
15. Redirect to directory list view
16. New record appears in list

**Flow 2: Create Company with Supplier Role**

1. User navigates to create form
2. User selects "Supplier" role checkbox
3. "Type" radio buttons appear (Person / Company)
4. User selects "Company"
5. Company fields appear
6. Supplier Details section appears (highlighted)
7. User fills: Company name, Registration number, Activity area, Commission settings
8. User clicks "Save"
9. Form submits
10. Server creates: Party record, Company details record, Supplier role assignment with details
11. Server returns success
12. Redirect to edit view (detail view)
13. Record is displayed with all information

**Flow 3: View Directory Record**

1. User navigates to directory list view
2. User sees list of records
3. User clicks "View" on a record
4. Detail view loads
5. User sees: Main details, Roles, Status, Statistics, Documents, Related orders
6. User can click "Edit" to modify
7. User can click "Deactivate" if record is active
8. User can click "Back to list" to return

**Flow 4: Edit Directory Record**

1. User navigates to detail view
2. User clicks "Edit" button
3. Edit form loads with existing data
4. User modifies fields (e.g., phone number, email)
5. User adds Supplier role
6. Supplier Details section appears
7. User fills supplier information
8. User clicks "Save"
9. Form submits to update endpoint
10. Server validates and updates: Party record, Person/Company details, Role assignments
11. Server returns success
12. Redirect to detail view
13. Updated information is displayed

**Flow 5: Search and Filter**

1. User navigates to directory list view
2. User enters search term in search bar (e.g., "John")
3. Results filter in real-time or on search button click
4. User applies filter: Role = Client
5. User applies filter: Status = Active
6. Active filters displayed as chips
7. Filtered results shown
8. User clicks "Clear all filters"
9. All filters removed, full list shown

**Flow 6: Deactivate Record**

1. User navigates to detail view of active record
2. User clicks "Deactivate" button
3. Confirmation modal appears: "Are you sure you want to deactivate this record?"
4. User clicks "Confirm"
5. Status update request sent to server
6. Server updates status to Inactive
7. Success message shown
8. Record status badge updates to "Inactive"
9. "Deactivate" button replaced with "Activate" button
10. Record hidden from default list view (unless filter shows Inactive)

**Flow 7: Upload Document**

1. User navigates to detail view
2. User scrolls to Documents section
3. User clicks "Upload document" button
4. File picker opens
5. User selects document file
6. User fills: Document type, Document number, Issued date, Valid till, Issued by
7. User clicks "Upload"
8. File uploads to storage
9. Document record created with file URL
10. Document appears in Documents list
11. Success message shown

**Flow 8: View Statistics**

1. User navigates to detail view of party with Client role
2. User scrolls to Statistics section
3. Statistics are calculated on-demand:
   - Total spent: Sum of order amounts
   - Last trip date: Most recent order date
   - Next trip date: Earliest future order date
   - Debt: Total spent - total paid
   - Order count: Number of orders
4. Statistics displayed in section
5. If no orders exist, "No statistics available" message shown

**Flow 9: Duplicate Detection**

1. User fills create form with email: "john@example.com"
2. User clicks "Check duplicates" button (if implemented)
3. Duplicate check request sent to server
4. Server checks for existing records with same email
5. Server returns list of potential duplicates with similarity scores
6. User sees duplicate warning with list of matches
7. User can choose to proceed with creation or cancel
8. If user proceeds, record is created

**Flow 10: Multi-Role Assignment**

1. User creates Person record
2. User selects both "Client" and "Supplier" roles
3. User fills person fields
4. Supplier Details section appears
5. User fills supplier information
6. User saves
7. Server creates: Party record, Person details, Client role assignment, Supplier role assignment
8. Record has both roles assigned
9. In detail view, both roles are displayed
10. Role-specific information shown for each role

## 10. NOTIFICATIONS / ALERTS

**User-Facing Notifications:**

**Success Notifications:**
- Record created: "Record created successfully" (auto-dismisses after 2 seconds)
- Record updated: "Record updated successfully" (auto-dismisses after 2 seconds)
- Record deactivated: "Record deactivated successfully" (auto-dismisses after 2 seconds)
- Record activated: "Record activated successfully" (auto-dismisses after 2 seconds)
- Document uploaded: "Document uploaded successfully" (auto-dismisses after 2 seconds)

**Error Notifications:**
- Validation error: Specific field requirements (e.g., "First name is required")
- Server error: "An error occurred. Please try again." (dismissible)
- Network error: "Network error. Please check your connection." (dismissible)
- Unauthorized: "You are not authorized to perform this action." (dismissible)
- Record not found: "Record not found." (dismissible)

**Warning Notifications:**
- Duplicate detected: "Potential duplicate records found" with list (if duplicate check implemented)
- Unsaved changes: "You have unsaved changes" badge in header
- Deactivation confirmation: "Are you sure you want to deactivate this record?" modal

**Server Logs:**
- All errors logged to console with context
- Log entries include: timestamp, user identifier, action, error details
- Logs used for debugging and audit purposes

**Future Alerts (Not in Scope):**
- Email notifications on record creation/update
- SMS notifications
- Document expiration alerts
- Low loyalty score alerts

## 11. STATISTICS & CALCULATIONS

**Statistics for Client Role:**

**Total Spent:**
- Calculation: Sum of all order amounts where party is client
- Source: Orders table, amount_total field
- Filter: client_party_id matches party identifier
- Display: Currency formatted (e.g., "€1,234.56")
- Default: 0 if no orders

**Last Trip Date:**
- Calculation: Most recent order date_from where party is client
- Source: Orders table, date_from field
- Filter: client_party_id matches party identifier, date_from is not null
- Display: Date formatted (e.g., "2024-12-15")
- Default: "No trips" if no orders

**Next Trip Date:**
- Calculation: Earliest future order date_from where party is client
- Source: Orders table, date_from field
- Filter: client_party_id matches party identifier, date_from > current date
- Display: Date formatted (e.g., "2025-01-20")
- Default: "No upcoming trips" if no future orders

**Debt:**
- Calculation: Total spent minus total paid (only positive values)
- Source: Orders table, amount_total and amount_paid fields
- Filter: client_party_id matches party identifier
- Formula: MAX(0, SUM(amount_total) - SUM(amount_paid))
- Display: Currency formatted (e.g., "€500.00")
- Default: 0 if no debt

**Order Count:**
- Calculation: Count of orders where party is client
- Source: Orders table
- Filter: client_party_id matches party identifier
- Display: Integer (e.g., "15")
- Default: 0 if no orders

**Statistics Display Rules:**
- Statistics are computed on-demand (not stored in database)
- Statistics only calculated for parties with Client role
- Statistics section hidden if party does not have Client role
- Statistics update when orders are created/modified
- Statistics calculation performance: OPEN INPUT REQUIRED (may need caching)

**Loyalty Metrics (Future Extension, Note Only):**
- Loyalty points calculation
- Loyalty tier assignment
- Reward eligibility
- Not in current scope

## 12. API CONTRACTS (LOGICAL)

**Endpoint 1: Create Directory Record**

**Method:** POST
**Path:** /api/directory/create
**Authentication:** Required (Bearer token)

**Request Body:**
- Party type (Person or Company, required)
- Roles array (at least one required: Client, Supplier, Subagent)
- Status (optional, defaults to Active)
- Display name (optional, auto-generated if not provided)
- Person fields (if Person type): First name*, Last name*, Personal identifier, Date of birth, Citizenship, Address, Title
- Company fields (if Company type): Company name*, Registration number, Legal address, Actual address, Bank details
- Common fields: Phone, Email, Email marketing consent, Phone marketing consent
- Supplier details (if Supplier role): Business category, Commission type, Commission value, Commission currency, Commission valid from/to, Commission notes
- Subagent details (if Subagent role): Commission scheme, Commission tiers, Payout details

**Success Response (200):**
- ok: true
- record: { identifier, display_name }

**Error Responses:**
- 401 Unauthorized: Authentication required
- 400 Bad Request: Validation errors (specific field requirements)
- 500 Internal Server Error: Server errors (database errors, etc.)

**Endpoint 2: Get Directory Record**

**Method:** GET
**Path:** /api/directory/{identifier}
**Authentication:** Required

**Request Parameters:**
- identifier (path parameter, required)

**Success Response (200):**
- record: Full party record with all details, roles, statistics, documents

**Error Responses:**
- 401 Unauthorized
- 404 Not Found: Record not found or not accessible

**Endpoint 3: Update Directory Record**

**Method:** PUT or PATCH
**Path:** /api/directory/{identifier}
**Authentication:** Required

**Request Body:**
- Same structure as Create, all fields optional (only provided fields updated)

**Success Response (200):**
- ok: true
- record: Updated record

**Error Responses:**
- 401 Unauthorized
- 400 Bad Request: Validation errors
- 404 Not Found
- 500 Internal Server Error

**Endpoint 4: List Directory Records**

**Method:** GET
**Path:** /api/directory
**Authentication:** Required

**Query Parameters:**
- search (optional): Search term (name, personal identifier, phone, email)
- role (optional): Filter by role (Client, Supplier, Subagent)
- type (optional): Filter by type (Person, Company)
- status (optional): Filter by status (Active, Inactive, Blocked)
- page (optional): Page number for pagination
- limit (optional): Records per page

**Success Response (200):**
- records: Array of directory records (summary view)
- pagination: { total, page, limit, total_pages }

**Error Responses:**
- 401 Unauthorized
- 500 Internal Server Error

**Endpoint 5: Deactivate Directory Record**

**Method:** PATCH or PUT
**Path:** /api/directory/{identifier}/deactivate
**Authentication:** Required

**Request Parameters:**
- identifier (path parameter, required)

**Success Response (200):**
- ok: true
- record: Updated record with status = Inactive

**Error Responses:**
- 401 Unauthorized
- 404 Not Found
- 500 Internal Server Error

**Endpoint 6: Activate Directory Record**

**Method:** PATCH or PUT
**Path:** /api/directory/{identifier}/activate
**Authentication:** Required

**Request Parameters:**
- identifier (path parameter, required)

**Success Response (200):**
- ok: true
- record: Updated record with status = Active

**Error Responses:**
- 401 Unauthorized
- 404 Not Found
- 500 Internal Server Error

**Endpoint 7: Get Statistics**

**Method:** GET
**Path:** /api/directory/{identifier}/statistics
**Authentication:** Required

**Request Parameters:**
- identifier (path parameter, required)

**Success Response (200):**
- total_spent: number
- last_trip_date: date or null
- next_trip_date: date or null
- debt: number (only positive)
- order_count: number

**Error Responses:**
- 401 Unauthorized
- 404 Not Found
- 500 Internal Server Error

**Endpoint 8: Upload Document**

**Method:** POST
**Path:** /api/directory/{identifier}/documents
**Authentication:** Required

**Request Body (multipart/form-data):**
- file (required): Document file
- document_type (required): Passport, ID, Other
- document_number (required)
- issued_date (optional)
- valid_till (optional)
- issued_by (optional)

**Success Response (200):**
- ok: true
- document: { identifier, document_type, document_number, file_url, etc. }

**Error Responses:**
- 401 Unauthorized
- 400 Bad Request: Validation errors
- 404 Not Found
- 500 Internal Server Error

**Endpoint 9: Delete Document**

**Method:** DELETE
**Path:** /api/directory/{identifier}/documents/{document_identifier}
**Authentication:** Required

**Success Response (200):**
- ok: true

**Error Responses:**
- 401 Unauthorized
- 404 Not Found
- 500 Internal Server Error

**Endpoint 10: Check Duplicates**

**Method:** POST
**Path:** /api/directory/check-duplicates
**Authentication:** Required

**Request Body:**
- email (optional)
- phone (optional)
- personal_identifier (optional)
- registration_number (optional)
- first_name (optional)
- last_name (optional)
- date_of_birth (optional)

**Success Response (200):**
- duplicates: Array of { identifier, display_name, similarity_score, match_fields }

**Error Responses:**
- 401 Unauthorized
- 400 Bad Request: At least one search field required
- 500 Internal Server Error

## 13. ACCEPTANCE CRITERIA

**AC1: Create Person Record**
- Given user is authenticated, when user creates Person record with required fields, then record is created with Person type and person details stored
- Given user creates Person record, when display name is not provided, then display name is auto-generated as "{first name} {last name}"

**AC2: Create Company Record**
- Given user is authenticated, when user creates Company record with required fields, then record is created with Company type and company details stored
- Given user creates Company record, when display name is not provided, then display name is auto-generated as company name

**AC3: Role Assignment**
- Given user creates record, when user assigns Client role, then Client role assignment record is created
- Given user creates record, when user assigns Supplier role, then Supplier role assignment record is created with supplier details
- Given user creates record, when user assigns Subagent role, then Subagent role assignment record is created with subagent details
- Given user creates record, when user assigns multiple roles, then all role assignment records are created

**AC4: View Directory Record**
- Given directory record exists, when user views record, then all information is displayed (main details, roles, status, statistics, documents)
- Given directory record has Client role, when user views record, then statistics are displayed (total spent, last trip date, next trip date, debt, order count)
- Given directory record has no Client role, when user views record, then statistics section is hidden

**AC5: Edit Directory Record**
- Given directory record exists, when user edits record, then form loads with existing data
- Given user edits record, when user modifies fields and saves, then record is updated with new values
- Given user edits record, when user adds new role, then role assignment record is created
- Given user edits record, when user removes role, then role assignment record is deleted

**AC6: Deactivate Record**
- Given active directory record exists, when user deactivates record, then status is set to Inactive
- Given inactive directory record exists, when user activates record, then status is set to Active
- Given deactivated record, when user views list with default filters, then record is hidden from list
- Given deactivated record, when user filters by Inactive status, then record appears in list

**AC7: Search and Filter**
- Given directory records exist, when user searches by name, then matching records are displayed
- Given directory records exist, when user filters by role, then only records with that role are displayed
- Given directory records exist, when user filters by type, then only records of that type are displayed
- Given directory records exist, when user filters by status, then only records with that status are displayed
- Given user applies multiple filters, when filters are active, then only records matching all filters are displayed

**AC8: Marketing Consents**
- Given user creates record, when user sets email marketing consent to true, then consent is stored
- Given user edits record, when user updates marketing consents, then consents are updated

**AC9: Document Management**
- Given directory record exists, when user uploads document, then document record is created and file is stored
- Given directory record has documents, when user views record, then documents are listed in Documents section
- Given document exists, when user deletes document, then document record is deleted and file is removed

**AC10: Statistics Calculation**
- Given party has Client role and orders exist, when user views statistics, then total spent, last trip date, next trip date, debt, and order count are calculated and displayed
- Given party has Client role but no orders, when user views statistics, then "No statistics available" message is displayed
- Given party has no Client role, when user views record, then statistics section is not displayed

**AC11: Tenant Isolation**
- Given user from Company A, when user views directory list, then only records from Company A are displayed
- Given user from Company A, when user attempts to access record from Company B, then access is denied (404 or 403)

**AC12: Validation**
- Given user creates record, when required fields are missing, then validation errors are shown and record is not created
- Given user creates Person record, when first name or last name is missing, then validation error is shown
- Given user creates Company record, when company name is missing, then validation error is shown
- Given user creates record, when no roles are selected, then validation error "At least one role must be selected" is shown

**AC13: Error Handling**
- Given network error occurs, when user attempts to save, then error message is shown and user can retry
- Given server error occurs, when user attempts to save, then user-friendly error message is shown
- Given validation error occurs, when user attempts to save, then specific field requirements are shown

**AC14: Duplicate Detection**
- Given duplicate check endpoint exists, when user checks for duplicates, then potential duplicates are returned with similarity scores
- Given duplicate records exist, when user creates record with duplicate email, then duplicate warning is shown (if duplicate check is implemented)

**AC15: Data Integrity**
- Given user creates record, when person/company details insert fails, then party record is deleted (rollback) and error is shown
- Given user edits record, when update fails, then original data is preserved and error is shown

## 14. QA TEST PLAN

**Test Case 1: Create Person with Client Role**
- Navigate to create form
- Select "Client" role
- Select "Physical person"
- Fill: First name, Last name, Phone, Email
- Click "Save & Close"
- Expected: Record created, redirect to list, record appears in list

**Test Case 2: Create Company with Supplier Role**
- Navigate to create form
- Select "Supplier" role
- Select "Company" type
- Fill: Company name, Activity area, Commission settings
- Click "Save"
- Expected: Record created, redirect to detail view, supplier details saved

**Test Case 3: View Directory Record**
- Navigate to list view
- Click "View" on a record
- Expected: Detail view shows all information (main details, roles, status, statistics if Client, documents)

**Test Case 4: Edit Directory Record**
- Navigate to detail view
- Click "Edit"
- Modify phone number
- Add Supplier role
- Fill supplier details
- Click "Save"
- Expected: Record updated, redirect to detail view, changes visible

**Test Case 5: Deactivate Record**
- Navigate to detail view of active record
- Click "Deactivate"
- Confirm in modal
- Expected: Status changes to Inactive, record hidden from default list view

**Test Case 6: Activate Record**
- Navigate to detail view of inactive record
- Click "Activate"
- Expected: Status changes to Active, record appears in default list view

**Test Case 7: Search by Name**
- Navigate to list view
- Enter search term in search bar
- Expected: Matching records are displayed

**Test Case 8: Filter by Role**
- Navigate to list view
- Apply filter: Role = Client
- Expected: Only records with Client role are displayed

**Test Case 9: Filter by Status**
- Navigate to list view
- Apply filter: Status = Active
- Expected: Only active records are displayed

**Test Case 10: Multiple Filters**
- Navigate to list view
- Apply filter: Role = Client, Status = Active
- Expected: Only active Client records are displayed

**Test Case 11: Upload Document**
- Navigate to detail view
- Scroll to Documents section
- Click "Upload document"
- Select file and fill document details
- Click "Upload"
- Expected: Document appears in Documents list, file is stored

**Test Case 12: Delete Document**
- Navigate to detail view with documents
- Click "Delete" on a document
- Confirm deletion
- Expected: Document removed from list, file deleted from storage

**Test Case 13: View Statistics (With Orders)**
- Navigate to detail view of party with Client role and orders
- Scroll to Statistics section
- Expected: Total spent, last trip date, next trip date, debt, order count are displayed

**Test Case 14: View Statistics (No Orders)**
- Navigate to detail view of party with Client role but no orders
- Scroll to Statistics section
- Expected: "No statistics available" message is displayed

**Test Case 15: Statistics Not Shown (No Client Role)**
- Navigate to detail view of party without Client role
- Expected: Statistics section is not displayed

**Test Case 16: Marketing Consents**
- Create record with email marketing consent = true
- Edit record and change consents
- Expected: Consents are saved and updated correctly

**Test Case 17: Validation - Missing Required Fields**
- Navigate to create form
- Select "Client" role
- Leave first name empty
- Click "Save"
- Expected: Validation error shown, record not created

**Test Case 18: Validation - No Roles**
- Navigate to create form
- Fill first name and last name
- Do not select any roles
- Click "Save"
- Expected: "At least one role must be selected" error shown

**Test Case 19: Tenant Isolation**
- Login as user from Company A
- View directory list
- Expected: Only records from Company A are displayed
- Attempt to access record from Company B via direct URL
- Expected: Access denied (404 or 403)

**Test Case 20: Duplicate Detection**
- Create record with email: "test@example.com"
- Create another record with same email
- Check for duplicates (if implemented)
- Expected: Duplicate warning shown with matching record

**Test Case 21: Error Handling - Network Error**
- Disconnect network
- Attempt to save record
- Expected: Network error message shown, user can retry

**Test Case 22: Error Handling - Server Error**
- Simulate server error
- Attempt to save record
- Expected: User-friendly error message shown

**Test Case 23: Multi-Role Assignment**
- Create record with both Client and Supplier roles
- Fill person fields and supplier details
- Save
- Expected: Record created with both roles, both role assignments exist

**Test Case 24: Remove Role**
- Edit record with Client and Supplier roles
- Remove Supplier role
- Save
- Expected: Supplier role assignment deleted, Client role remains

**Test Case 25: Display Name Generation**
- Create Person record: First name="John", Last name="Doe"
- Verify display name
- Expected: Display name = "John Doe"
- Create Company record: Company name="Acme Corp"
- Verify display name
- Expected: Display name = "Acme Corp"

## 15. RISKS & OPEN QUESTIONS

**High Risk Items:**

1. **Transaction Atomicity**
   - Risk: Current implementation may not use database transactions. If role inserts fail after party insert, orphaned party records may be created.
   - Mitigation: Wrap entire creation/update in database transaction for atomicity
   - Impact: Data integrity issues, orphaned records

2. **Tenant Isolation**
   - Risk: Company identifier resolution may be incorrect if proper user-company relationship not implemented
   - Mitigation: Verify user-company relationship table/structure, implement proper company identifier resolution
   - Impact: Data leakage between tenants, incorrect data isolation

3. **Performance - Statistics Calculation**
   - Risk: Statistics calculated on-demand may be slow for parties with many orders
   - Mitigation: Implement caching or pre-calculate statistics, add database indexes
   - Impact: Slow page loads, poor user experience

**Medium Risk Items:**

4. **Duplicate Prevention**
   - Risk: No enforced duplicate prevention. Users can create multiple records with same email/phone/personal identifier
   - Mitigation: Add unique constraints on database columns, or implement duplicate check before creation
   - Impact: Data quality issues, confusion in directory

5. **Document Storage**
   - Risk: File storage mechanism and URL structure not defined
   - Mitigation: Define file storage solution (Supabase Storage, S3, etc.) and URL structure
   - Impact: Cannot implement document upload feature

6. **Error Message Clarity**
   - Risk: Generic error messages may not help users understand issues
   - Mitigation: Return more specific error messages from database errors
   - Impact: Poor user experience, support burden

**Low Risk Items:**

7. **Form Field Mismatch**
   - Risk: "Contact person" field exists in form but persistence unclear
   - Mitigation: Remove field from form or add to data model
   - Impact: User confusion, potential data loss

8. **Subagent Fields Not Persisted**
   - Risk: Some Subagent form fields (commission value, currency, period) may not be persisted
   - Mitigation: Remove unused fields or implement persistence
   - Impact: User confusion, data loss

**OPEN QUESTIONS:**

1. **Schema Verification Required:**
   - Does company entity table exist? What is the structure?
   - What is the user-company relationship structure?
   - Confirm all enum types exist with correct values
   - Are foreign key constraints defined with ON DELETE CASCADE?
   - What indexes exist for performance?
   - What RLS policies exist on all tables?
   - What default values exist for all columns?
   - Which columns are NOT NULL vs nullable?

2. **Document Storage:**
   - What file storage mechanism should be used? (Supabase Storage, S3, etc.)
   - What is the URL structure for stored files?
   - What are file size limits?
   - What file types are allowed?
   - How are files organized (by party identifier, by document type)?

3. **Statistics Performance:**
   - Should statistics be cached? If yes, when are they invalidated?
   - Should statistics be pre-calculated and stored?
   - What is the expected maximum number of orders per party?

4. **Duplicate Prevention:**
   - Should duplicate prevention be enforced during creation, or remain optional?
   - Should unique constraints be added to database columns?
   - What is the duplicate matching algorithm? (exact match, fuzzy match thresholds)

5. **Status Management:**
   - What operations are blocked for "Blocked" status?
   - Should status change history be tracked?
   - Can users with Inactive status be reactivated automatically or require approval?

6. **Business Logic:**
   - How should company identifier be resolved from user context?
   - Should there be a user-company relationship table?
   - What happens if referenced company/user is deleted?

7. **Future Extensions:**
   - Client portal requirements (note only, not in scope)
   - Supplier portal requirements (note only, not in scope)
   - Integration with external systems (not in scope)

## 16. FUTURE EXTENSIONS

**NOT PART OF CURRENT TASK - DO NOT IMPLEMENT:**

**Phase 2: Client Portal (Note Only)**
- Client self-service portal
- Client login and authentication
- Client can view own information
- Client can update own information
- Client can view own orders and statistics
- Client can upload documents
- Not in current scope

**Phase 3: Supplier Portal (Note Only)**
- Supplier self-service portal
- Supplier login and authentication
- Supplier can view own information
- Supplier can update commission settings
- Supplier can view orders and commissions
- Not in current scope

**Phase 4: Advanced Features**
- Bulk import/export
- Advanced duplicate merging workflow
- Real-time collaboration
- Audit trail visualization UI
- Rating assignment UI
- Notes field UI
- Email/SMS notifications
- Activity feed integration
- Integration with external CRM systems
- Multi-language support
- Mobile app support

**Phase 5: Document Enhancements**
- OCR for document processing
- Document validation
- Document expiration alerts
- Document templates
- Bulk document upload

**Phase 6: Loyalty Program**
- Loyalty points calculation
- Loyalty tier assignment
- Reward eligibility
- Loyalty program management

**Phase 7: Commission Engine**
- Automated commission calculation
- Commission payment tracking
- Commission reports
- Commission dispute management

---

SPEC COMPLETE — READY FOR ARCHITECT REVIEW





