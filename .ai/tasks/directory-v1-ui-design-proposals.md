# Directory v1 - UI Design Proposals

**Created:** 2024-12-19  
**Status:** Design Phase  
**Branch:** `feat/directory-create`

**Note:** This document contains design proposals only. NO code implementation.

---

## 1. Directory List Page Design (`/directory`)

### 1.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TopBar (fixed)                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Directory                                    [+ New Record]       │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ DataTable (compact, enterprise-grade)                             │ │
│ ├───────────┬──────┬─────────┬────┬───────┬─────────┬───────────────┤ │
│ │ Name      │Phone │ Email   │Type│Rating │Last Trip│ Next Trip    │ │
│ │ + badges  │      │         │    │       │         │              │ │
│ ├───────────┼──────┼─────────┼────┼───────┼─────────┼───────────────┤ │
│ │ Total     │ Debt │ Updated │    │ Quick │ Actions │              │ │
│ │ Spent     │      │         │    │       │         │              │ │
│ ├───────────┴──────┴─────────┴────┴───────┴─────────┴───────────────┤ │
│ │ Row 1: John Smith [Client] [Active]                                │ │
│ │ Row 2: ABC Corp [Supplier] [Active]                                │ │
│ │ ...                                                                 │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Page Container

- **Container Width:** `max-w-[1800px]` (wide page for data tables per UI standards)
- **Page Padding:** `p-4` (compact density for tables)
- **Background:** `bg-gray-50`

### 1.3 PageHeader

- **Layout:** Flex row, space between
- **Left:** `<h1>Directory</h1>` - `text-3xl font-bold text-gray-900`
- **Right:** `<button>New Record</button>` - `rounded-lg bg-black px-6 py-2 text-white hover:bg-gray-800`

### 1.4 Table Design

**Container:**
- `overflow-x-auto rounded-lg bg-white shadow-sm`

**Table Headers:**
- `border-b border-gray-200 bg-gray-50`
- `px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700`
- Compact column widths for efficiency

**Table Rows:**
- `divide-y divide-gray-200 bg-white`
- `hover:bg-gray-50` (subtle hover effect)
- `cursor-pointer` (click to open detail)

**Column Specifications:**

| Column | Width | Alignment | Format |
|--------|-------|-----------|--------|
| **Name** | Flexible (min 200px) | Left | `Title FirstName LastName` or `CompanyName` + role badges + status dot |
| **Phone** | 140px | Left | Clickable tel: link, gray-700 |
| **Email** | 180px | Left | Clickable mailto: link, gray-700 |
| **Type** | 80px | Center | Icon: 👤 (person) or 🏢 (company) |
| **Rating** | 100px | Center | Visual bar (1-10), compact display |
| **Last Trip** | 110px | Left | Date format: `DD.MM.YYYY` or "-" |
| **Next Trip** | 110px | Left | Date format: `DD.MM.YYYY` or "-" |
| **Total Spent** | 120px | Right | Currency: `€1,234` |
| **Debt** | 120px | Right | Currency: `€1,234` (red if > 0) |
| **Updated** | 120px | Left | Date format: `DD.MM.YYYY` |

**Row Actions (Quick Actions):**
- Icon buttons in last column: 📞 (call), ✉️ (email), ✏️ (edit)
- Visible on hover or always visible for accessibility
- Tooltips on hover

### 1.5 Filter Integration

- Filters are in TopBar search (DirectorySearchPopover)
- Table automatically filters based on search store state
- Filter indicators: Show active filter count badge in TopBar

---

## 2. Directory Card/Detail Page Design (`/directory/[id]`)

### 2.1 Overall Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TopBar (fixed)                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ STICKY HEADER (sticky-top, z-20, bg-white, border-b)              │ │
│ │                                                                     │ │
│ │ ┌─────────────────────────────────────────────────────────────┐   │ │
│ │ │ John Smith                           [Client][Supplier]     │   │ │
│ │ │ 📞 +371 12345678  ✉️ john@example.com  ⭐ Rating: 8/10      │   │ │
│ │ └─────────────────────────────────────────────────────────────┘   │ │
│ │                                                                     │ │
│ │ ┌─────────────────────────────────────────────────────────────┐   │ │
│ │ │ [Save] [Save & Close] [Cancel]                               │   │ │
│ │ └─────────────────────────────────────────────────────────────┘   │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ ┌─────────────────────────┐  ┌──────────────────────────────┐    │ │
│ │ │ LEFT COLUMN (40%)        │  │ RIGHT COLUMN (60%)           │    │ │
│ │ │                          │  │                              │    │ │
│ │ │ ┌─────────────────────┐ │  │ [Overview] [Orders] [Docs]   │    │ │
│ │ │ │ Identity Section    │ │  │ [Commissions] [Notes]         │    │ │
│ │ │ │                     │ │  │                              │    │ │
│ │ │ │ Title: Mr           │ │  │ ┌──────────────────────────┐ │    │ │
│ │ │ │ First: John         │ │  │ │ Tab Content Area         │ │    │ │
│ │ │ │ Last: Smith         │ │  │ │                          │ │    │ │
│ │ │ └─────────────────────┘ │  │ │ Statistics, Orders, etc. │ │    │ │
│ │ │                          │  │ │                          │ │    │ │
│ │ │ ┌─────────────────────┐ │  │ └──────────────────────────┘ │    │ │
│ │ │ │ Contacts Section    │ │  │                              │    │ │
│ │ │ │                     │ │  │                              │    │ │
│ │ │ │ Email: [input]      │ │  │                              │    │ │
│ │ │ │ ☑ Marketing consent │ │  │                              │    │ │
│ │ │ │                     │ │  │                              │    │ │
│ │ │ │ Phone: [input]      │ │  │                              │    │ │
│ │ │ │ ☑ SMS consent       │ │  │                              │    │ │
│ │ │ └─────────────────────┘ │  │                              │    │ │
│ │ │                          │  │                              │    │ │
│ │ │ ┌─────────────────────┐ │  │                              │    │ │
│ │ │ │ Roles/Status        │ │  │                              │    │ │
│ │ │ │                     │ │  │                              │    │ │
│ │ │ │ ☑ Client            │ │  │                              │    │ │
│ │ │ │ ☑ Supplier          │ │  │                              │    │ │
│ │ │ │ ☐ Subagent          │ │  │                              │    │ │
│ │ │ │                     │ │  │                              │    │ │
│ │ │ │ Status: [Active ▼]  │ │  │                              │    │ │
│ │ │ │ Rating: [8/10]      │ │  │                              │    │ │
│ │ │ └─────────────────────┘ │  │                              │    │ │
│ │ │                          │  │                              │    │ │
│ │ │ (Additional sections)    │  │                              │    │ │
│ │ └─────────────────────────┘  └──────────────────────────────┘    │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Container Specifications

- **Container Width:** `max-w-7xl` (standard page width)
- **Page Padding:** `p-6` (standard density)
- **Background:** `bg-gray-50`
- **Layout:** 2-column grid: `grid grid-cols-1 lg:grid-cols-[40%_60%] gap-6`

### 2.3 Sticky Header Section

**Position:** `sticky top-14 z-20` (below TopBar which is `top-0 z-40`)

**Styling:**
- Background: `bg-white`
- Border: `border-b border-gray-200`
- Padding: `px-6 py-4`
- Shadow: `shadow-sm` (subtle)

**Content Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ Name (large): text-2xl font-bold text-gray-900                 │
│ Role badges + Status dot (inline, next to name)                │
│                                                                 │
│ Contact info (inline):                                         │
│ 📞 +371 12345678 (clickable tel:)  ✉️ email@example.com        │
│ (clickable mailto:)  ⭐ Rating: 8/10 (visual display)          │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Sticky Save Bar:                                               │
│ [Save] [Save & Close] [Cancel]                                 │
│ (buttons: standard primary/secondary styling)                  │
└────────────────────────────────────────────────────────────────┘
```

**Name Display:**
- Person: `Title FirstName LastName` (e.g., "Mr John Smith")
- Company: `CompanyName` (e.g., "ABC Corporation")
- Size: `text-2xl font-bold text-gray-900`

**Role Badges:**
- Inline with name, small badges
- See Component Design section for details

**Status Dot:**
- Small colored dot: 🟢 (active), ⚪ (inactive), 🔴 (blocked)
- Position: Next to role badges

**Contact Info:**
- Phone: Clickable `tel:` link, icon 📞
- Email: Clickable `mailto:` link, icon ✉️
- Rating: Visual display (see Statistics Component design)

**Sticky Save Bar:**
- Position: Within sticky header, below contact info
- Border-top: `border-t border-gray-200 mt-4 pt-4`
- Buttons: `Save` (primary, black), `Save & Close` (secondary, gray), `Cancel` (text button)
- Layout: `flex gap-3 justify-end`

### 2.4 Left Column Layout

**Section Spacing:** `space-y-6` (between sections)

**Section Cards:**
- Each section in a card: `rounded-lg bg-white p-6 shadow-sm`
- Section title: `text-lg font-semibold text-gray-900 mb-4`

#### Identity Section

**For Person:**
```
┌──────────────────────────────────┐
│ Identity                         │
├──────────────────────────────────┤
│ Title:        [Mr ▼]             │
│ First Name:   [John        *]    │
│ Last Name:    [Smith       *]    │
│ Personal Code:[123456-78901]     │
│ DOB:          [DD.MM.YYYY]       │
│ Citizenship:  [LV ▼]             │
│ Address:      [Street, City]     │
└──────────────────────────────────┘
```

**For Company:**
```
┌──────────────────────────────────┐
│ Identity                         │
├──────────────────────────────────┤
│ Company Name: [ABC Corp    *]    │
│ Reg Number:   [12345678]         │
│ Legal Address:[Street, City]     │
│ Actual Address:[Street, City]    │
│ Bank Details: [IBAN, Bank]       │
└──────────────────────────────────┘
```

**Field Layout:**
- 2-column grid: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Required fields marked with `*` (red asterisk)
- Labels: `text-sm font-medium text-gray-700 mb-1`
- Inputs: Standard form field styling per UI standards

#### Contacts Section

```
┌──────────────────────────────────┐
│ Contacts                         │
├──────────────────────────────────┤
│ Email:        [john@example.com] │
│               ☑ Email marketing consent │
│                                  │
│ Phone:        [+371 12345678]    │
│               ☑ SMS/Phone marketing consent │
└──────────────────────────────────┘
```

**Field Layout:**
- Email field + inline checkbox (same row)
- Phone field + inline checkbox (same row)
- Checkbox styling: Small, with label next to it
- See Marketing Consent Checkboxes section for details

#### Roles/Status Section

```
┌──────────────────────────────────┐
│ Roles & Status                   │
├──────────────────────────────────┤
│ Roles (*):                       │
│   ☑ Client                       │
│   ☑ Supplier                     │
│   ☐ Subagent                     │
│                                  │
│ Status:      [Active ▼]          │
│ Rating:      [8] / 10            │
└──────────────────────────────────┘
```

**Field Layout:**
- Roles: Checkboxes, vertical list
- Status: Dropdown select
- Rating: Number input (1-10) or slider

### 2.5 Right Column Layout (Tabs)

**Tab Navigation:**
- Tab bar: `border-b border-gray-200`
- Tabs: `px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900`
- Active tab: `border-b-2 border-black text-gray-900`
- Layout: `flex space-x-4`

**Tab Content Area:**
- Padding: `p-6`
- Background: `bg-white` (within card container)

**Available Tabs:**
1. **Overview** - Statistics display (see Statistics Component)
2. **Orders** - List of linked orders (table view)
3. **Documents** - Document list (future)
4. **Commissions** - Commission details (if Supplier/Subagent role)
5. **Notes** - Internal notes (textarea)

**Tab Switching:**
- Client-side state management
- URL hash for deep linking (optional): `#overview`, `#orders`, etc.

---

## 3. Component Designs

### 3.1 Role Badges Component

**Design:**
- Small, pill-shaped badges
- Inline display (horizontally aligned)
- Compact size for list and detail views

**Visual Design:**
```
[Client] [Supplier] [Subagent]
```

**Styling:**
- Size: `px-2 py-0.5 text-xs font-medium rounded-full`
- Colors:
  - Client: `bg-blue-100 text-blue-800`
  - Supplier: `bg-green-100 text-green-800`
  - Subagent: `bg-purple-100 text-purple-800`
- Spacing: `gap-1` between badges

**Usage:**
- In list view: Next to name in Name column
- In detail header: Inline with name
- Compact, non-intrusive

### 3.2 Status Indicator Component

**Design:**
- Small colored dot or badge
- Three states: active, inactive, blocked

**Visual Design:**
```
🟢 Active    ⚪ Inactive    🔴 Blocked
```

**Styling:**
- Option A (Dot): `w-2 h-2 rounded-full`
  - Active: `bg-green-500`
  - Inactive: `bg-gray-400`
  - Blocked: `bg-red-500`
- Option B (Badge): Small badge with text
  - `px-2 py-0.5 text-xs font-medium rounded`
  - Active: `bg-green-100 text-green-800`
  - Inactive: `bg-gray-100 text-gray-800`
  - Blocked: `bg-red-100 text-red-800`

**Usage:**
- In list view: Small dot next to name
- In detail header: Badge format (more visible)

### 3.3 Sticky Save Bar Component

**Design:**
- Horizontal bar with action buttons
- Sticky positioning (scrolls with content until header is sticky)
- Positioned within sticky header section

**Layout:**
```
┌────────────────────────────────────────────┐
│                                    [Save]  │
│                              [Save & Close]│
│                                    [Cancel]│
└────────────────────────────────────────────┘
```

**Styling:**
- Container: `border-t border-gray-200 mt-4 pt-4`
- Button layout: `flex gap-3 justify-end`
- Button styles:
  - Save: `bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800`
  - Save & Close: `bg-gray-200 text-gray-900 px-6 py-2 rounded-lg hover:bg-gray-300`
  - Cancel: `text-gray-700 px-6 py-2 hover:text-gray-900` (text button)

**Positioning:**
- Within sticky header (which is `sticky top-14`)
- Stays visible when scrolling through form content
- Z-index: Inherits from sticky header (`z-20`)

**States:**
- Disabled state for Save buttons if form invalid
- Loading state during save operation
- Success/Error feedback (toast or inline message)

### 3.4 Statistics Section Component

**Design:**
- Compact card displaying key statistics
- Used in Overview tab of detail page
- Can also appear in list view (as table columns)

**Layout:**
```
┌──────────────────────────────────┐
│ Statistics                       │
├──────────────────────────────────┤
│ Total Spent:      €12,345        │
│ Last Trip:        15.03.2024     │
│ Next Trip:        20.06.2024     │
│ Debt:             €0             │
│ Order Count:      5              │
└──────────────────────────────────┘
```

**Styling:**
- Grid layout: `grid grid-cols-2 gap-4`
- Label: `text-sm text-gray-500`
- Value: `text-base font-semibold text-gray-900`
- Debt: `text-red-600` if > 0

**Data Display:**
- Total Spent: Currency format (`€1,234`)
- Dates: `DD.MM.YYYY` format
- Debt: Currency format, red if positive
- Order Count: Integer

**Visual Enhancements:**
- Optional: Progress bar for loyalty/status
- Optional: Mini charts for spending trends (future)

### 3.5 Rating Display Component

**Design:**
- Visual representation of rating (1-10 scale)
- Compact for list view, larger for detail view

**Visual Design Options:**

**Option A (Bar):**
```
Rating: 8/10  [████████░░]
```

**Option B (Stars):**
```
Rating: 8/10  ⭐⭐⭐⭐⭐⭐⭐⭐☆☆
```

**Option C (Badge):**
```
Rating: [8/10]
```

**Styling:**
- List view: Option C (badge) - `px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded`
- Detail view: Option A (bar) - Progress bar with filled portion
- Bar color: `bg-blue-600` for filled, `bg-gray-200` for unfilled

**Implementation:**
- Bar width calculation: `width: ${(rating / 10) * 100}%`
- Color coding: 1-3 (red), 4-6 (yellow), 7-10 (green) - optional

### 3.6 Duplicate Detection Modal Component

**Design:**
- Modal overlay with list of potential duplicates
- Options to open existing or continue creating

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Possible Duplicates                                       │
│                                                           │
│ We found similar records that might be duplicates:       │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✓ John Smith                                        │ │
│ │   📞 +371 12345678  ✉️ john@example.com             │ │
│ │   [Client] [Active]                                 │ │
│ │   Match: Email + Phone (100% similarity)            │ │
│ │   [Open Existing]                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✓ John R. Smith                                    │ │
│ │   📞 +371 12345679  ✉️ john.r@example.com          │ │
│ │   [Client] [Active]                                 │ │
│ │   Match: Name + DOB (85% similarity)               │ │
│ │   [Open Existing]                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ [Continue Creating New Record] [Cancel]                  │
└──────────────────────────────────────────────────────────┘
```

**Styling:**
- Modal: `rounded-lg bg-white shadow-xl max-w-2xl`
- Overlay: `fixed inset-0 bg-black bg-opacity-50 z-50`
- Title: `text-xl font-bold text-gray-900 mb-4`
- Duplicate item card: `border border-gray-200 rounded-lg p-4 mb-3`
- Match info: `text-sm text-gray-600`
- Buttons: Standard button styling

**Interaction:**
- Click "Open Existing" → Navigate to that record's detail page
- Click "Continue Creating New Record" → Close modal, continue with current form
- Click "Cancel" → Close modal, cancel creation

**Data Display:**
- Display name
- Contact info (phone, email)
- Role badges and status
- Similarity score and match fields
- Action button per duplicate

---

## 4. Field Grouping Proposal

### 4.1 Left Column - Identity Section

**Person Fields (2-column grid):**
```
Row 1: Title | (empty - full width for Title if needed)
Row 2: First Name | Last Name
Row 3: Personal Code | DOB
Row 4: Citizenship | (empty)
Row 5: Address (full width)
```

**Company Fields (2-column grid):**
```
Row 1: Company Name (full width)
Row 2: Reg Number | (empty)
Row 3: Legal Address (full width)
Row 4: Actual Address (full width)
Row 5: Bank Details (full width)
```

### 4.2 Left Column - Contacts Section

**Layout:**
```
Row 1: Email (full width input)
       Marketing consent checkbox (inline, same visual row)
Row 2: Phone (full width input)
       SMS consent checkbox (inline, same visual row)
```

**Field Spacing:**
- Between email and phone: `mt-4`
- Checkbox: Inline with input field, right-aligned or below input

### 4.3 Left Column - Roles/Status Section

**Layout:**
```
Roles (vertical list, checkboxes):
  ☑ Client
  ☑ Supplier
  ☐ Subagent

Status (dropdown):
  [Active ▼]

Rating (input):
  [8] / 10
```

**Spacing:**
- Between roles and status: `mt-4`
- Between status and rating: `mt-4`

### 4.4 Supplier Details Section (if Supplier role)

**Position:** Below Roles/Status section in left column, or in Commissions tab

**Layout (2-column grid):**
```
Row 1: Business Category | Commission Type
Row 2: Commission Value | Currency
Row 3: Valid From | Valid To
Row 4: Commission Notes (full width textarea)
```

### 4.5 Subagent Details Section (if Subagent role)

**Position:** Below Roles/Status section in left column, or in Commissions tab

**Layout (2-column grid):**
```
Row 1: Commission Scheme | (empty)
Row 2: Commission Value | Currency
Row 3: Period Type | (empty)
Row 4: Period From | Period To (if custom period)
Row 5: Payout Details (full width textarea)
```

### 4.6 Responsive Layout

**Desktop (lg breakpoint and above):**
- 2-column layout: Left 40%, Right 60%
- All sections in cards with standard padding

**Tablet (md breakpoint):**
- 2-column layout maintained
- Slightly narrower columns

**Mobile (below md breakpoint):**
- Single column layout
- Stack left and right columns vertically
- Full-width sections
- Reduced padding: `p-4` instead of `p-6`

---

## 5. Marketing Consent Checkboxes

### 5.1 Placement

**Email Marketing Consent:**
- **Position:** Directly below Email input field
- **Layout:** Inline checkbox with label on the same visual row
- **Alignment:** Left-aligned with input field, or right-aligned for compact layout

**Phone/SMS Marketing Consent:**
- **Position:** Directly below Phone input field
- **Layout:** Inline checkbox with label on the same visual row
- **Alignment:** Left-aligned with input field, or right-aligned for compact layout

### 5.2 Visual Design

**Option A (Below Input):**
```
Email:        [john@example.com                    ]
              ☑ Email marketing consent

Phone:        [+371 12345678                       ]
              ☑ SMS/Phone marketing consent
```

**Option B (Inline Right):**
```
Email:        [john@example.com        ]  ☑ Email marketing consent

Phone:        [+371 12345678           ]  ☑ SMS/Phone marketing consent
```

**Recommended: Option A (Below Input)** - Better accessibility and clearer association

### 5.3 Styling Specifications

**Checkbox:**
- Size: Standard checkbox size (`h-4 w-4`)
- Color: `text-black` (matches form inputs)
- Focus: `focus:ring-black`

**Label:**
- Text: `text-sm text-gray-700`
- Position: Next to checkbox, inline
- Full label text:
  - Email: "Email marketing consent"
  - Phone: "SMS/Phone marketing consent"

**Layout:**
- Container: `flex items-center gap-2 mt-1`
- Checkbox and label: Inline, horizontally aligned

**Visual Example:**
```
┌────────────────────────────────────────┐
│ Email:                                  │
│ [john@example.com                   ]  │
│ ☑ Email marketing consent              │
│                                         │
│ Phone:                                  │
│ [+371 12345678                      ]  │
│ ☑ SMS/Phone marketing consent          │
└────────────────────────────────────────┘
```

### 5.4 Accessibility

- Checkbox has proper `aria-label` or associated label
- Keyboard navigable
- Screen reader friendly
- Checkbox and label are properly associated via `htmlFor` and `id`

---

## 6. Additional Design Considerations

### 6.1 Loading States

**List Page:**
- Skeleton loaders for table rows
- Loading spinner in table area

**Detail Page:**
- Skeleton loaders for form sections
- Loading state for Save buttons during submission

### 6.2 Error States

**Form Validation:**
- Inline error messages below fields
- Error styling: `text-red-600 text-sm`
- Red border on invalid inputs: `border-red-500`

**API Errors:**
- Toast notification or inline error banner
- Error message displayed prominently

### 6.3 Empty States

**List Page (No Results):**
- Empty state message: "No records found"
- Suggestion to adjust filters or create new record

**Detail Page (Loading):**
- Loading spinner or skeleton
- Error state if record not found

### 6.4 Responsive Breakpoints

- **Mobile (< 768px):** Single column, full-width sections, compact padding
- **Tablet (768px - 1024px):** 2-column layout, reduced spacing
- **Desktop (> 1024px):** Full 2-column layout with standard spacing

### 6.5 Color Consistency

- Follow UI System Consistency standards
- Use established color palette (gray scale, black for primary)
- Role badges use distinct but harmonious colors
- Status indicators use semantic colors (green/red/gray)

---

## 7. Implementation Notes

### 7.1 Component Reusability

- Role badges: Reusable component
- Status indicator: Reusable component
- Sticky save bar: Reusable component (can be used in other forms)
- Statistics section: Reusable component

### 7.2 State Management

- Form state: Local component state or form library
- Filter state: DirectorySearchStore (existing)
- Tab state: Local component state
- Save state: Loading, success, error states

### 7.3 Performance Considerations

- Lazy load tab content (load on tab switch)
- Virtual scrolling for long lists (future optimization)
- Debounce form validation
- Optimistic UI updates for save operations

---

**End of Design Proposals**

These designs should be reviewed and approved before code implementation begins.

