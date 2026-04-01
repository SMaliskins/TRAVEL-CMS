# CODE WRITER TASK — Fix Build Error in OrderClientSection (JSX parse)

**Task ID:** S7 (proposed)  
**Area:** Orders → Order Client Section  
**Priority:** **BLOCKER** (breaks build / page cannot load)  
**Owner:** CODE WRITER  
**Reported by:** QA/REGRESSION (user provided screenshot)  

---

## Problem

Next.js dev/build fails with:

- **Parsing ecmascript source code failed**
- **Expected `'</'`, got `'{'`**
- File: `app/orders/[orderCode]/_components/OrderClientSection.tsx` (around **line ~709**)

This blocks loading `/orders/[orderCode]` entirely.

---

## Repro Steps

1. Open any order detail page: `/orders/[orderCode]`
2. Observe Next.js overlay build error pointing to `OrderClientSection.tsx` around line ~709 (`/* Right: Square Map */`)

---

## Expected vs Actual

- **Expected:** Order detail page renders; no build errors.
- **Actual:** Build fails; page cannot render due to JSX parse error.

---

## Root Cause (likely)

In `OrderClientSection.tsx`, within the “Compact Route + Dates” block, there is a **mismatched JSX/parentheses structure**:

- `&& (` block starting around line **~504** is not properly closed before the map section.
- A wrapper `<div>` opened around line **~505** appears not to be closed at the right place.
- As a result, when parser reaches `{/* Right: Square Map */}` (line ~709), it still expects a closing `)`/`</...>` and throws.

QA lints confirm structural parse issues:
- `L427: JSX element 'div' has no corresponding closing tag`
- `L709: ')' expected`
- `L729: '</' expected`

---

## Trace (exact code area)

File: `app/orders/[orderCode]/_components/OrderClientSection.tsx`
- Around lines **503–710**:
  - `{(parsedRoute.origin ... ) && (`
  - `<div>`
  - `{renderField(..., <div ...>, <div className="space-y-3"> ... )}`
  - **Missing close(s)** for the `&& (` block and/or wrapper `<div>` before the “Right: Square Map” block.

---

## Fix Requirements

1. **Fix JSX/parentheses balance** in the “Compact Route + Dates” section:
   - Ensure every `&& (` has a matching `)` before leaving the block.
   - Ensure every `<div>` has a corresponding `</div>`.
   - Ensure `renderField(` call has correct argument boundaries and closure.

2. Confirm that map block renders under the intended grid layout:
   - Left column: client + route editor
   - Right column: square map (280px)

---

## Acceptance Criteria

- [ ] Next.js dev server starts without build errors
- [ ] `/orders/[orderCode]` renders successfully
- [ ] The “Right: Square Map” block renders when cities exist
- [ ] No TypeScript/ESLint parse errors in `OrderClientSection.tsx`

---

## Notes

This issue likely came from the recent UI change “move map to right column as square”.


