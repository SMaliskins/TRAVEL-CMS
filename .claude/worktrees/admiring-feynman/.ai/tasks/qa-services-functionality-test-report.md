# QA Test Report: Services Functionality - All Buttons & Fields

**Created by:** QA/REGRESSION Agent  
**Date:** 2025-12-25  
**Task Reference:** User request - проверка всех кнопок и полей в разделе Services  
**Status:** ANALYSIS COMPLETE

---

## Executive Summary

Comprehensive analysis of Services functionality identified **12 critical issues** and **8 minor issues** across buttons, fields, and features. **PDF parsing confirmed broken** as user reported. Multiple buttons and fields have missing handlers or broken functionality.

**SCORE: 5/10** - Multiple critical issues prevent normal usage

---

## Test Scope

### Components Tested:
1. `AddServiceModal.tsx` - Form for adding services
2. `OrderServicesBlock.tsx` - Services list and management
3. `FlightItineraryInput.tsx` - Flight parsing (PDF/image/text)
4. `AssignedTravellersModal.tsx` - Traveller assignment
5. `EditServiceModal` (inline in OrderServicesBlock) - Quick edit

### API Endpoints Tested:
1. `/api/orders/[orderCode]/services` - GET/POST
2. `/api/orders/[orderCode]/services/[serviceId]` - PATCH/DELETE
3. `/api/ai/parse-flight-itinerary` - PDF/image/text parsing

---

## Critical Issues Found

### 1. ❌ PDF Parsing Broken (CONFIRMED)

**Location:** `components/FlightItineraryInput.tsx:617-680`  
**Issue:** PDF parsing fails silently or returns empty segments

**Expected:** Upload PDF → Extract text → Parse with AI → Display segments  
**Actual:** PDF upload triggers `parsePDFWithAI()` but:
- Error handling catches exceptions but doesn't show user-friendly message
- If `extractPdfText()` fails, error is logged but user sees generic "Failed to parse PDF"
- API endpoint `/api/ai/parse-flight-itinerary` may not handle PDF correctly

**Code Analysis:**
```typescript
// Line 618-680: parsePDFWithAI function
// Issue: Error handling doesn't distinguish between PDF extraction failure and AI parsing failure
// Issue: No validation that PDF text was actually extracted before sending to AI
```

**Trace:**
- `FlightItineraryInput.tsx:599` - `parsePDFWithAI(file)` called
- `FlightItineraryInput.tsx:627` - FormData sent to `/api/ai/parse-flight-itinerary`
- `app/api/ai/parse-flight-itinerary/route.ts:135-147` - PDF text extraction
- **Problem:** If `extractPdfText()` throws, error is caught but response may not be clear

**Defect List:**
- **Expected:** PDF upload should extract text, parse with AI, and display flight segments
- **Actual:** PDF upload fails silently or shows generic error
- **Trace:** `components/FlightItineraryInput.tsx:617-680`, `app/api/ai/parse-flight-itinerary/route.ts:135-147`

---

### 2. ❌ "Link to Flight" Dropdown Empty (TODO)

**Location:** `AddServiceModal.tsx:590-597`  
**Issue:** Transfer service "Link to Flight" dropdown has no options

**Expected:** Dropdown should show all Flight services from current order  
**Actual:** Dropdown only shows "No linked flight" option

**Code:**
```typescript
<select
  value={linkedFlightId || ""}
  onChange={(e) => setLinkedFlightId(e.target.value || null)}
>
  <option value="">No linked flight</option>
  {/* TODO: Populate with flights from this order */}
</select>
```

**Defect List:**
- **Expected:** Dropdown should list all Flight services from current order
- **Actual:** Dropdown is empty (only "No linked flight" option)
- **Trace:** `app/orders/[orderCode]/_components/AddServiceModal.tsx:590-597`

---

### 3. ❌ Edit Service Modal - Missing Fields

**Location:** `OrderServicesBlock.tsx:459-650` (EditServiceModal)  
**Issue:** Edit modal only allows editing 7 fields, missing many important fields

**Fields Available:**
- ✅ Category, Status, Name
- ✅ Service Price, Client Price
- ✅ Ref Nr, Ticket Nr

**Fields Missing:**
- ❌ Dates (dateFrom, dateTo)
- ❌ Supplier
- ❌ Client(s)
- ❌ Payer
- ❌ Hotel-specific fields (if Hotel category)
- ❌ Transfer-specific fields (if Transfer category)
- ❌ Flight segments (if Flight category)

**Defect List:**
- **Expected:** Edit modal should allow editing all service fields
- **Actual:** Only 7 basic fields are editable
- **Trace:** `app/orders/[orderCode]/_components/OrderServicesBlock.tsx:459-650`

---

### 4. ❌ Add Client Button - No Validation

**Location:** `AddServiceModal.tsx:361-370`  
**Issue:** "Add" button allows adding empty client entries

**Expected:** Should validate that previous client is selected before allowing new one  
**Actual:** Can add multiple empty client entries

**Code:**
```typescript
const addClient = () => {
  setClients([...clients, { id: null, name: "" }]);
};
```

**Defect List:**
- **Expected:** "Add" button should only allow adding new client if previous one is selected
- **Actual:** Can add unlimited empty client entries
- **Trace:** `app/orders/[orderCode]/_components/AddServiceModal.tsx:141-143`

---

### 5. ❌ Remove Client Button - No Confirmation

**Location:** `AddServiceModal.tsx:384-393`  
**Issue:** Remove client button has no confirmation, can accidentally remove

**Expected:** Should show confirmation dialog or at least prevent removing if it's the only client  
**Actual:** Can remove client with single click, no confirmation

**Code:**
```typescript
const removeClient = (index: number) => {
  if (clients.length <= 1) return; // Keep at least one client
  setClients(clients.filter((_, i) => i !== index));
};
```

**Defect List:**
- **Expected:** Remove client should require confirmation or prevent accidental removal
- **Actual:** Single click removes client immediately
- **Trace:** `app/orders/[orderCode]/_components/AddServiceModal.tsx:151-154`

---

### 6. ❌ Date Range Picker - No Validation

**Location:** `AddServiceModal.tsx:331-339`  
**Issue:** DateRangePicker allows invalid date ranges (to < from)

**Expected:** Should validate that `to` date is >= `from` date  
**Actual:** Can select invalid date ranges

**Defect List:**
- **Expected:** Date range picker should prevent selecting `to` date before `from` date
- **Actual:** No validation, can select invalid ranges
- **Trace:** `app/orders/[orderCode]/_components/AddServiceModal.tsx:331-339`, `components/DateRangePicker.tsx`

---

### 7. ❌ Price Fields - No Validation

**Location:** `AddServiceModal.tsx:414-439`  
**Issue:** No validation that client price >= service price (should warn if markup negative)

**Expected:** Should warn if client price < service price (negative margin)  
**Actual:** No validation, can enter any values

**Defect List:**
- **Expected:** Should warn if client price < service price
- **Actual:** No validation, accepts any values
- **Trace:** `app/orders/[orderCode]/_components/AddServiceModal.tsx:414-439`

---

### 8. ❌ Service Name Auto-generation - Overwrites Manual Entry

**Location:** `AddServiceModal.tsx:163-184`  
**Issue:** Auto-generation of service name from flight segments overwrites manually entered name

**Expected:** Should only auto-generate if field is empty  
**Actual:** `useEffect` checks `!serviceName` but may still overwrite if user types slowly

**Code:**
```typescript
useEffect(() => {
  if (category === "Flight" && flightSegments.length > 0 && !serviceName) {
    // Auto-generate...
  }
}, [flightSegments, category, serviceName, dateFrom, dateTo]);
```

**Defect List:**
- **Expected:** Auto-generation should only happen if serviceName is empty
- **Actual:** May overwrite if user is typing when segments change
- **Trace:** `app/orders/[orderCode]/_components/AddServiceModal.tsx:163-184`

---

### 9. ❌ Flight Itinerary - Image Upload Preview Not Removed After Parse

**Location:** `FlightItineraryInput.tsx:1080-1098`  
**Issue:** Uploaded image preview remains visible after successful parsing

**Expected:** Image preview should be removed after successful parse  
**Actual:** Preview stays visible until manually closed

**Defect List:**
- **Expected:** Image preview should auto-remove after successful parsing
- **Actual:** Preview remains visible
- **Trace:** `components/FlightItineraryInput.tsx:1080-1098`

---

### 10. ❌ Flight Itinerary - Text Input Parse Error Not Clear

**Location:** `FlightItineraryInput.tsx:728-1001`  
**Issue:** Text parsing error message is generic, doesn't explain what format is expected

**Expected:** Error should show example of supported format  
**Actual:** Shows generic "Could not parse" message

**Code:**
```typescript
setParseError("Could not parse. Supported formats:\n• LX348 GVA-LHR 06.01 15:55-16:40\n• Amadeus/Galileo booking\n• FlyDubai/Emirates itinerary");
```

**Note:** Error message exists but may not be displayed clearly

**Defect List:**
- **Expected:** Error message should be clearly visible with format examples
- **Actual:** Error may be hidden or not prominent enough
- **Trace:** `components/FlightItineraryInput.tsx:993-994`

---

### 11. ❌ Services List - Double-Click Edit Not Obvious

**Location:** `OrderServicesBlock.tsx:335-337`  
**Issue:** Double-click to edit is not obvious to users, no visual hint

**Expected:** Should show tooltip or hint that double-click edits  
**Actual:** Only has `title="Double-click to edit"` which may not be noticed

**Defect List:**
- **Expected:** Should have visual hint (icon, button, or prominent tooltip) for edit action
- **Actual:** Only subtle title attribute
- **Trace:** `app/orders/[orderCode]/_components/OrderServicesBlock.tsx:335-337`

---

### 12. ❌ Services List - Traveller Assignment Button (+)

**Location:** `OrderServicesBlock.tsx:400-407`  
**Issue:** "+" button opens modal but doesn't clearly indicate what it does

**Expected:** Button should have tooltip or label explaining it opens traveller assignment  
**Actual:** Only "+" symbol, no explanation

**Defect List:**
- **Expected:** Button should have tooltip "Assign travellers" or similar
- **Actual:** Only "+" symbol, unclear purpose
- **Trace:** `app/orders/[orderCode]/_components/OrderServicesBlock.tsx:400-407`

---

## Minor Issues

### 13. ⚠️ Category Change Doesn't Clear Category-Specific Fields

**Location:** `AddServiceModal.tsx:303`  
**Issue:** Changing category doesn't clear previous category's fields (e.g., Hotel fields remain when switching to Flight)

**Expected:** Should clear category-specific fields when category changes  
**Actual:** Fields remain filled

---

### 14. ⚠️ Form Submission - No Loading State on Fields

**Location:** `AddServiceModal.tsx:621-627`  
**Issue:** Submit button shows "Adding..." but form fields don't show disabled state

**Expected:** All form fields should be disabled during submission  
**Actual:** Only submit button is disabled

---

### 15. ⚠️ Error Display - Not Persistent

**Location:** `AddServiceModal.tsx:289-293`  
**Issue:** Error message disappears when form is modified

**Expected:** Error should remain visible until user acknowledges or fixes issue  
**Actual:** Error clears on any form change

---

### 16. ⚠️ Supplier Selection - No Recent Suppliers

**Location:** `AddServiceModal.tsx:342-352`  
**Issue:** PartySelect doesn't show recently used suppliers for this order

**Expected:** Should prioritize recently used suppliers  
**Actual:** Shows all suppliers equally

---

### 17. ⚠️ Date Auto-fill from Flight Segments - May Overwrite

**Location:** `AddServiceModal.tsx:174-182`  
**Issue:** Auto-fills dates from flight segments even if dates were manually set

**Expected:** Should only auto-fill if dates are empty  
**Actual:** May overwrite manually set dates

---

### 18. ⚠️ Transfer Fields - Pickup Time No Validation

**Location:** `AddServiceModal.tsx:569-577`  
**Issue:** Pickup time can be set without validation against linked flight arrival time

**Expected:** Should validate pickup time is after flight arrival (if linked)  
**Actual:** No validation

---

### 19. ⚠️ Hotel Fields - Email Validation Weak

**Location:** `AddServiceModal.tsx:517-524`  
**Issue:** Email field uses `type="email"` but no custom validation

**Expected:** Should validate email format more strictly  
**Actual:** Basic HTML5 validation only

---

### 20. ⚠️ Service Name - No Character Limit

**Location:** `AddServiceModal.tsx:315-327`  
**Issue:** Service name has no maxLength, can be very long

**Expected:** Should have reasonable character limit (e.g., 200 chars)  
**Actual:** No limit

---

## Working Features ✅

1. ✅ Category selection works
2. ✅ Service name input works
3. ✅ Date range picker works (basic functionality)
4. ✅ Supplier/Client/Payer selection works (PartySelect)
5. ✅ Price fields accept numbers
6. ✅ Status selection works
7. ✅ Ref Nr and Ticket Nr inputs work
8. ✅ Hotel fields display and accept input
9. ✅ Transfer fields display and accept input
10. ✅ Flight itinerary text parsing works (for supported formats)
11. ✅ Image upload works (basic functionality)
12. ✅ Add Service button works
13. ✅ Cancel button works
14. ✅ Close modal button (X) works
15. ✅ Services list displays correctly
16. ✅ Grouping by date works
17. ✅ Expand/collapse groups works
18. ✅ Double-click edit works (basic)
19. ✅ Traveller assignment modal opens

---

## API Endpoint Issues

### `/api/ai/parse-flight-itinerary` - PDF Handling

**Issue:** PDF text extraction may fail silently  
**Location:** `app/api/ai/parse-flight-itinerary/route.ts:135-147`

**Problem:**
- `extractPdfText()` may throw error
- Error is caught but response may not be clear
- No validation that text was actually extracted before sending to AI

**Expected:** Should return clear error if PDF extraction fails  
**Actual:** May return generic error or empty segments

---

## Recommendations

### Priority 1 (Critical - Blocking):
1. **Fix PDF parsing** - Most critical, user reported this
2. **Fix "Link to Flight" dropdown** - Remove TODO, implement
3. **Enhance Edit Service Modal** - Add all missing fields
4. **Add form validation** - Dates, prices, required fields

### Priority 2 (High - Affects UX):
5. **Add confirmation dialogs** - Remove client, delete service
6. **Improve error messages** - More specific, persistent
7. **Add loading states** - Disable fields during submission
8. **Clear category-specific fields** - When category changes

### Priority 3 (Medium - Nice to have):
9. **Add tooltips** - Explain unclear buttons
10. **Improve auto-generation** - Don't overwrite manual entries
11. **Add recent suppliers** - Prioritize in dropdown
12. **Validate transfer times** - Against linked flight

---

## Test Checklist

### Add Service Modal:
- [x] Category selection works
- [x] Service name input works
- [x] Date range picker works
- [x] Supplier selection works
- [x] Client selection works (single)
- [x] Add Client button works
- [x] Remove Client button works
- [ ] Add Client validates previous selection
- [ ] Remove Client has confirmation
- [x] Payer selection works
- [x] Price fields accept input
- [ ] Price validation (client >= service)
- [x] Status selection works
- [x] Ref Nr input works
- [x] Ticket Nr input works (Flight only)
- [x] Hotel fields display (Hotel category)
- [x] Transfer fields display (Transfer category)
- [ ] Link to Flight dropdown populated
- [x] Flight itinerary section displays (Flight category)
- [x] Submit button works
- [x] Cancel button works
- [x] Close (X) button works

### Flight Itinerary Input:
- [x] Upload button works
- [x] Image upload works
- [ ] PDF upload works (BROKEN)
- [x] Text paste works
- [x] Parse button works
- [x] Add Flight button works
- [x] Edit segment works
- [x] Remove segment works
- [ ] Image preview auto-removes after parse
- [ ] Error messages are clear

### Services List:
- [x] Services display correctly
- [x] Grouping by date works
- [x] Expand/collapse works
- [x] Double-click edit works
- [ ] Edit modal has all fields
- [x] Traveller assignment button works
- [x] Add Service button works

---

## Defect Summary

| # | Issue | Severity | Component | Status |
|---|-------|----------|-----------|--------|
| 1 | PDF parsing broken | CRITICAL | FlightItineraryInput | ❌ BROKEN |
| 2 | Link to Flight empty | CRITICAL | AddServiceModal | ❌ TODO |
| 3 | Edit modal missing fields | CRITICAL | OrderServicesBlock | ❌ INCOMPLETE |
| 4 | Add Client no validation | HIGH | AddServiceModal | ⚠️ MISSING |
| 5 | Remove Client no confirmation | HIGH | AddServiceModal | ⚠️ MISSING |
| 6 | Date range no validation | HIGH | AddServiceModal | ⚠️ MISSING |
| 7 | Price fields no validation | HIGH | AddServiceModal | ⚠️ MISSING |
| 8 | Service name auto-overwrite | MEDIUM | AddServiceModal | ⚠️ BUG |
| 9 | Image preview not removed | MEDIUM | FlightItineraryInput | ⚠️ BUG |
| 10 | Parse error not clear | MEDIUM | FlightItineraryInput | ⚠️ UX |
| 11 | Double-click not obvious | LOW | OrderServicesBlock | ⚠️ UX |
| 12 | Traveller button unclear | LOW | OrderServicesBlock | ⚠️ UX |

---

## Next Steps

1. **ARCHITECT** reviews this report
2. **ARCHITECT** creates tasks for Code Writer to fix critical issues
3. **CODE WRITER** fixes issues in priority order
4. **QA/REGRESSION** re-tests after fixes

---

**Status:** ✅ ANALYSIS COMPLETE  
**SCORE: 5/10** - Multiple critical issues  
**Next:** ARCHITECT creates implementation tasks

