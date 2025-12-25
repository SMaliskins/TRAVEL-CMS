# Directory v1 - Critical Fixes & Enhancements Plan

**Created:** 2024-12-24  
**Status:** 🔄 In Progress  
**Priority:** High

---

## Critical Issues (Fix First)

### 1. ✅ Fix "Failed to create party" Error
- **Status:** ✅ Fixed
- **Changes:**
  - Improved error logging in `/api/directory/create` to show detailed error messages
  - Fixed field mapping: `isActive` → `status` in `new/page.tsx`
- **Files:** `app/api/directory/create/route.ts`, `app/directory/new/page.tsx`

### 2. ✅ Remove Duplicate Roles Display
- **Status:** ✅ Fixed
- **Changes:**
  - Removed roles checkboxes from NEW RECORD header (lines 192-223 in `new/page.tsx`)
  - Roles are now only in "Roles & status" section in DirectoryForm
- **Files:** `app/directory/new/page.tsx`

---

## Missing Fields & Features

### 3. Add Missing Person Fields
- **Status:** 🔄 In Progress
- **Missing:**
  - Title (Mr/Mrs/Ms) - exists in schema, not in form
  - Citizenship - exists in schema, not in form
  - Address - exists in schema, but only shown for Company, not Person
- **Files:** `components/DirectoryForm.tsx`
- **Action:** Add Title dropdown, Citizenship autocomplete, Address field for Person type

### 4. Add Documents Section
- **Status:** ⏳ Pending
- **Requirements:**
  - Document type (passport/ID)
  - Document number
  - Issue date
  - Expiry date
  - Issuing authority (optional)
  - File upload capability (future: OCR auto-fill)
  - Expiry tracking with warnings (6 months, 3 months)
- **Files:** New component `components/DirectoryDocuments.tsx`, update `DirectoryForm.tsx`
- **Database:** `party_documents` table (check if exists in migrations)

### 5. Add Marketing Consent History
- **Status:** ⏳ Pending
- **Requirements:**
  - Track consent changes (date, source)
  - Display history in form
- **Files:** New component or section in `DirectoryForm.tsx`
- **Database:** `party_marketing_consent_history` table (may need migration)

### 6. Add Loyalty Programs Section
- **Status:** ⏳ Pending
- **Requirements:**
  - Multiple entries support
  - Program type: Airline, Hotel, Rent a Car, Company
  - Member number
  - Notes
- **Files:** New component `components/DirectoryLoyalty.tsx`, update `DirectoryForm.tsx`
- **Database:** `party_loyalty_programs` table (may need migration)

---

## UI/UX Improvements

### 7. Compact Layout Redesign
- **Status:** ⏳ Pending
- **Requirements:**
  - Reduce spacing between sections
  - Remove empty zones
  - Modern, tech-savvy design
  - Better use of space
- **Files:** `components/DirectoryForm.tsx`, `app/directory/new/page.tsx`, `app/directory/[id]/page.tsx`

### 8. Date Format: dd.mm.yyyy
- **Status:** ⏳ Pending
- **Requirements:**
  - Change all date inputs to dd.mm.yyyy format
  - Update date display throughout
- **Files:** All date-related components, formatters

### 9. Visual Feedback on Changes
- **Status:** ⏳ Pending
- **Requirements:**
  - Green pulsing border around changed fields
  - Indicate unsaved changes visually
- **Files:** `components/DirectoryForm.tsx` - add CSS animation classes

---

## Business Logic Enhancements

### 10. Internal Client Number Generation
- **Status:** ⏳ Pending
- **Requirements:**
  - Generate sequential numbers: 00001, 00002, etc.
  - Store in `party.internal_number` or separate field
- **Files:** `app/api/directory/create/route.ts` - add number generation logic
- **Database:** Add `internal_number` field to `party` table (may need migration)

### 11. Improved Duplicate Detection
- **Status:** ⏳ Pending
- **Requirements:**
  - Compare by DOB + name
  - Typo tolerance: 2-3 letter differences
  - Suggest corrections
- **Files:** `app/api/directory/check-duplicates/route.ts` - improve fuzzy matching

### 12. Commission Type Display
- **Status:** ⏳ Pending
- **Requirements:**
  - Show commission type (% or Sum) next to value for Supplier
- **Files:** `components/DirectoryForm.tsx` - update Supplier section display

---

## Integration Features

### 13. Quick Client Creation from New Order
- **Status:** ⏳ Pending
- **Requirements:**
  - Popup in New Order page
  - Fast client creation
  - Auto-select in order after creation
  - Should not slow down with large database
- **Files:** New component `components/QuickClientCreate.tsx`, update `app/orders/new/page.tsx`

---

## Implementation Order

1. ✅ Fix critical errors (1-2)
2. 🔄 Add missing Person fields (3)
3. Compact layout (7)
4. Date format (8)
5. Visual feedback (9)
6. Internal client number (10)
7. Documents section (4)
8. Loyalty programs (6)
9. Marketing consent history (5)
10. Duplicate detection improvements (11)
11. Commission type display (12)
12. Quick client creation (13)

---

## Notes

- All changes must maintain backward compatibility
- Test each feature independently
- Update TypeScript types as needed
- Ensure RLS policies are updated for new tables

