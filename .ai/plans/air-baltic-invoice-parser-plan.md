# Implementation Plan: Air Baltic Invoice Parser

**Date:** 2026-03-01  
**Task:** Learn to parse Air Baltic airline tickets from invoice PDFs  
**Reference:** `invoice-20260225-9YOOTU-1.pdf`

---

## 1. Executive Summary

Add a dedicated **Air Baltic invoice format** parser inside `parseAirBaltic()` in `lib/flights/airlineParsers.ts`. The current generic Air Baltic parser expects IATA route patterns (e.g. `RIX-AYT`) and standard English labels; Air Baltic invoices use **Latvian** labels and **city names** (Rīga, Antālija) instead of IATA codes.

---

## 2. Reference Data Structure (from PDF)

### Invoice sample (extracted text)

```
RĒĶINS
Rēķina numurs: 2621869522
Rezervācijas numurs: 9YOOTU
Rezervēšanas datums: 25.02.2026
Biļetes numurs
K-dze LARISA GURARIJA 657-2423595985
K-dze IRINA SOMOVA 657-2423595986
S 09/05 15:30 Rīga 19:15 Antālija BT715 Economy FLEX, P
O 19/05 20:25 Antālija 00:15 Rīga BT716 Economy FLEX, K
...
Cena EUR 480.00
Nodokļi EUR 58.64
...
Kopā EUR 681.96
AIR BALTIC CORPORATION A/S
```

### Key patterns to parse

| Field       | Latvian label             | Example        | Regex / logic                         |
|------------|---------------------------|----------------|----------------------------------------|
| Booking ref| Rezervācijas numurs       | 9YOOTU         | `Rezervācijas numurs:\s*([A-Z0-9]{6})` |
| Booking dt | Rezervēšanas datums       | 25.02.2026     | use `parseDate()`                      |
| Invoice #  | Rēķina numurs             | 2621869522     | optional, for logging                  |
| Passengers | K-dze FIRSTNAME LASTNAME  | 657-2423595985 | `K-dze\s+([A-Z\s]+?)\s+(\d{3}-\d{10})` |
| Segments   | S/O DD/MM HH:mm City …    | BT715 …        | custom segment regex below             |
| Total price| Kopā EUR                  | 681.96         | `Kopā\s+EUR\s+([\d.,]+)`               |
| Base price | Cena EUR                  | 480.00         | `Cena\s+EUR\s+([\d.,]+)`               |

### Segment line format

```
[S|O] DD/MM HH:mm DepartureCity HH:mm ArrivalCity BT### Economy FLEX, [P|K]
```

- **S** = outbound, **O** = return (informational)
- **DD/MM** = date (year inferred from booking date)
- **HH:mm** = departure time, **HH:mm** = arrival time
- City names in Latvian: Rīga → RIX, Antālija → AYT (and variants)
- **BT###** = flight number
- **Economy FLEX** = cabin class
- **P / K** = fare/batch code (optional)

**Example:**  
`S 09/05 15:30 Rīga 19:15 Antālija BT715 Economy FLEX, P`

→ Departure: Rīga (RIX) 09.05.2026 15:30  
→ Arrival: Antālija (AYT) 09.05.2026 19:15  
→ Flight: BT715

---

## 3. Implementation Steps

### Step 1: Detect Air Baltic invoice format (high priority)

**File:** `lib/flights/airlineParsers.ts`  
**Function:** `parseAirBaltic()`

Add early detection for the invoice format before the generic logic:

- Match: `Rezervācijas numurs:` OR `Rēķina numurs:` OR `Biļetes numurs`
- Or: `AIR BALTIC CORPORATION` + segment lines with city names (Rīga, Antālija, etc.)

If detected → use new invoice-specific parsing branch; otherwise fall through to existing generic parser.

**Deliverable:** Boolean `isAirBalticInvoiceFormat(text)` or inline condition.

---

### Step 2: Add Latvian city → IATA mapping

**File:** `lib/flights/airlineParsers.ts`  
**Function:** `getIATAFromCity()` (extend city map)

Add entries:

| City (Latvian / variant) | IATA |
|--------------------------|------|
| rīga                     | RIX  |
| antālija, antalija       | AYT  |
| tallina, tallinn         | TLL  |
| vilņa, vilnius           | VNO  |
| helsinki                 | HEL  |
| stockholm                | ARN  |
| ... (common Air Baltic destinations) |

Handle normalization: trim, lowercase, strip diacritics (ī→i, ā→a, ņ→n) for matching.

**Deliverable:** Extended city map + `normalizeCityForMatch(name: string)` helper if needed.

---

### Step 3: Parse segment lines (invoice format)

**File:** `lib/flights/airlineParsers.ts`  
**Function:** New `parseAirBalticInvoiceSegments(text: string, bookingYear: string): ParsedSegment[]`

Regex for one segment line:

```
^\s*[SO]\s+(\d{1,2})/(\d{1,2})\s+(\d{1,2}):(\d{2})\s+([A-Za-zāčēģīķļņōŗšūžĀČĒĢĪĶĻŅŌŖŠŪŽ\s]+?)\s+(\d{1,2}):(\d{2})\s+([A-Za-zāčēģīķļņōŗšūžĀČĒĢĪĶĻŅŌŖŠŪŽ\s]+?)\s+BT(\d{3,4})
```

Capture groups: depDay, depMonth, depH, depM, depCity, arrH, arrM, arrCity, flightNum.

- Build `departureDate` = `YYYY-MM-depDay-depMonth` (use booking date for year)
- `arrivalDate`: same as departure for same-day; if arr time < dep time, add 1 day
- Map cities to IATA via `getIATAFromCity()`
- Cabin class: "Economy FLEX" → `economy` (or keep "Economy FLEX" as display string if needed)

**Deliverable:** `parseAirBalticInvoiceSegments()` returning `ParsedSegment[]`.

---

### Step 4: Parse passengers and ticket numbers (invoice format)

**File:** `lib/flights/airlineParsers.ts`  
**Function:** New `parseAirBalticInvoicePassengers(text: string): ParsedPassenger[]`

Pattern:

```
K-dze\s+([A-Z\s]+?)\s+(\d{3}-\d{10})
```

- Extract full name (trim, normalize spaces)
- Map ticket numbers to passengers in order
- Return `ParsedPassenger[]` with `name` and `ticketNumber`

**Deliverable:** `parseAirBalticInvoicePassengers()` returning `ParsedPassenger[]`.

---

### Step 5: Parse booking ref, date, and price

**File:** `lib/flights/airlineParsers.ts`  
**Function:** Inside `parseAirBaltic()` invoice branch

- `Rezervācijas numurs:\s*([A-Z0-9]{6})` → bookingRef
- `Rezervēšanas datums:\s*(\d{1,2}\.\d{1,2}\.\d{4})` → bookingDate, use `parseDate()`
- `Kopā\s+EUR\s+([\d.,]+)` → totalPrice (replace comma with dot, parseFloat)
- Optionally: `Cena\s+EUR\s+([\d.,]+)` for base fare if needed later

**Deliverable:** Extracted bookingRef, bookingDate, totalPrice in invoice branch.

---

### Step 6: Assemble ParseResult in parseAirBaltic

**File:** `lib/flights/airlineParsers.ts`  
**Function:** `parseAirBaltic()`

Flow:

1. Check `isAirBalticInvoiceFormat(text)`.
2. If yes:
   - Parse segments via `parseAirBalticInvoiceSegments(text, year)`.
   - Parse passengers via `parseAirBalticInvoicePassengers(text)`.
   - Parse booking ref, date, total price.
   - Build `ParseResult` with `segments`, `booking` (including `passengers`, `ticketNumbers`, `totalPrice`, `currency`, `cabinClass`, etc.), `parser: "airbaltic_invoice"`.
3. If no (or segments empty), fall through to existing generic Air Baltic parser.

**Deliverable:** Unified `ParseResult` for invoice format.

---

### Step 7: Unit test with reference PDF text

**File:** `lib/flights/__tests__/airBalticInvoice.test.ts` (or similar)

- Paste the extracted PDF text as fixture.
- Assert:
  - 2 segments (BT715 RIX→AYT, BT716 AYT→RIX)
  - bookingRef = "9YOOTU"
  - 2 passengers with names and ticket numbers
  - totalPrice = 681.96
  - cabinClass = "economy" (or "Economy FLEX" if we keep it)

**Deliverable:** Passing test(s) for the reference invoice.

---

### Step 8: Manual QA in Add Service modal

- Open Add Service → Flight.
- Paste PDF text (or upload PDF if parse-pdf is used first) into the flight parser input.
- Confirm segments, passengers, price, and booking ref populate correctly.
- Add 1–2 more Air Baltic invoice samples (if available) to catch variants.

**Deliverable:** Manual verification log / checklist.

---

## 4. Data Flow Summary

```
PDF → parse-pdf API (or paste) → raw text
       ↓
parseFlightBooking(text)
       ↓
parseAirBaltic(text)
       ↓
isAirBalticInvoiceFormat? 
  YES → parseAirBalticInvoiceSegments + parseAirBalticInvoicePassengers + booking/price
        → ParseResult
  NO  → existing generic Air Baltic parser (IATA routes, etc.)
```

---

## 5. Edge Cases to Consider

| Case | Handling |
|------|----------|
| Arrival next day (e.g. 00:15) | If arrTime < depTime, add 1 day to arrivalDate |
| Multi-city (3+ segments) | Loop over all matching segment lines |
| Missing passenger / ticket | Allow partial match; ticketNumbers from segment area if needed |
| Invoice in English | Could add "Reservation no.:" etc. as fallback; keep Latvian primary |
| Different cabin (Business) | Extend regex for "Business" and map to cabinClass |

---

## 6. Acceptance Criteria

1. Pasted Air Baltic invoice text (Latvian format) is recognized and parsed.
2. All segments have correct: flight number, departure/arrival IATA, date, time.
3. Passengers and ticket numbers are extracted.
4. Booking ref and total price are correct.
5. Result fits `ParseResult` and works in Add Service / Edit Service modals.
6. Existing Air Baltic parsing (non-invoice) is unchanged.

---

## 7. Estimated Effort

| Step | Effort |
|------|--------|
| 1. Detection | 0.5 h |
| 2. City map | 0.5 h |
| 3. Segments | 1 h |
| 4. Passengers | 0.5 h |
| 5. Booking/price | 0.5 h |
| 6. Assemble | 0.5 h |
| 7. Tests | 1 h |
| 8. QA | 0.5 h |
| **Total** | **~5 h** |

---

## 8. Files to Modify / Create

| File | Action |
|------|--------|
| `lib/flights/airlineParsers.ts` | Extend `parseAirBaltic`, add helpers |
| `lib/flights/__tests__/airBalticInvoice.test.ts` | Create (optional) |

---

*Plan created with writing-plans approach. Execute one step at a time, verify, then proceed.*
