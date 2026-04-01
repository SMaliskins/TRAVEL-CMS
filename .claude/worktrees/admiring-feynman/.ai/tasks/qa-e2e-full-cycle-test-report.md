# 🧪 QA E2E TEST REPORT — ПОЛНЫЙ ЦИКЛ РАБОТЫ С ЗАКАЗОМ

**Date:** 2026-01-12  
**QA Agent:** Regression Testing  
**Test Environment:** http://localhost:3000  
**Branch:** feature/x  

---

## 📋 ТЕСТОВЫЙ СЦЕНАРИЙ

### ✅ Шаг 1: Создать Order
**URL:** `/orders` → Create Order button

**Expected:**
- Форма создания заказа открывается
- Поля: Client (combobox), Dates (from/to), Destination, Order Type
- Кнопка "Create Order" активна после заполнения обязательных полей

**Test Steps:**
1. Navigate to `/orders`
2. Click "Create Order"
3. Select Client from dropdown (или создать нового)
4. Enter Date From: `15.01.2026`
5. Enter Date To: `20.01.2026`
6. Enter Destination: `RIX - DXB - RIX`
7. Select Order Type: `Package`
8. Click "Create Order"

**Acceptance Criteria:**
- [ ] Order создан успешно
- [ ] Redirect на `/orders/[orderCode]`
- [ ] Order Code отображается корректно
- [ ] Client, Dates, Destination отображаются в Order Detail

---

### ✅ Шаг 2: Добавить 2 сервиса

**URL:** `/orders/[orderCode]` → Services tab → "+ Add Service"

#### Service #1: Flight RIX - DXB

**Test Steps:**
1. Click "+ Add Service"
2. Select Category: `Flight`
3. Enter Service Name: `RIX - DXB - RIX`
4. Select Supplier (combobox или создать)
5. Select Client (combobox) — по умолчанию order client
6. Select Payer (combobox) — по умолчанию order client
7. Enter Service Price: `€20.00`
8. Enter Client Price: `€90.00`
9. Enter Date From: `15.01.2026`
10. Enter Date To: `20.01.2026`
11. Enter Ref Nr: `ABC123`
12. Enter Ticket Nr: `TKT-001`
13. Click "Add Service"

**Acceptance Criteria:**
- [ ] Service добавлен в таблицу
- [ ] Все поля отображаются корректно
- [ ] Service Price и Client Price правильные

#### Service #2: Hotel Dubai

**Test Steps:**
1. Click "+ Add Service"
2. Select Category: `Hotel`
3. Enter Service Name: `Hotel Atlantis Dubai`
4. Select Supplier
5. Select Client
6. Select Payer (ДРУГОЙ чем в Service #1 для тестирования split)
7. Enter Service Price: `€200.00`
8. Enter Client Price: `€350.00`
9. Enter Date From: `15.01.2026`
10. Enter Date To: `19.01.2026`
11. Enter Hotel Name: `Atlantis The Palm`
12. Enter Hotel Address: `Crescent Road, Dubai`
13. Click "Add Service"

**Acceptance Criteria:**
- [ ] Service #2 добавлен
- [ ] Оба сервиса видны в таблице
- [ ] Группировка по датам работает
- [ ] Total amounts корректны

---

### ✅ Шаг 3: Выбрать плательщиков и клиентов

**Already done in Step 2** ✅

**Verification:**
- [ ] Service #1 имеет Payer = Client 1
- [ ] Service #2 имеет Payer = Client 2 (или другой party)
- [ ] Можно изменить Payer через Edit modal (double-click на service)

---

### ✅ Шаг 4: Выписать счет (Invoice)

**URL:** `/orders/[orderCode]` → Finance tab

**Test Steps:**
1. Select checkbox для обоих сервисов (или одного)
2. Click "Create Invoice" (или floating action bar кнопка)
3. Verify modal opens with selected services
4. Check Invoice Number auto-generated: `INV-[orderCode]-[timestamp]`
5. Check Invoice Date = today
6. Check Due Date = today + 14 days
7. Enter Client Name (pre-filled)
8. Enter Client Address
9. Enter Client Email: `test@example.com`
10. Check VAT Rate: `0%` (или 21%)
11. Verify Total = Sum of selected services
12. Click "Save & Issue Invoice"

**Acceptance Criteria:**
- [ ] Invoice created successfully
- [ ] Alert "✅ Invoice created successfully!" shown
- [ ] Invoice appears in Finance tab → Invoices list
- [ ] Invoice status = `draft`
- [ ] Selected services now locked (🔒 icon, no checkbox)
- [ ] Invoice items correct (service names, amounts)

---

### ❌ Шаг 5: Отправить счет клиенту на email

**Status:** ⚠️ **NOT IMPLEMENTED**

**Expected Feature:**
- Button "Send Email" in Invoice List for each invoice
- Modal to confirm email address
- Email template with Invoice PDF or link
- Status change: `draft` → `sent`
- Email sent confirmation

**Current State:**
```typescript
// InvoiceList.tsx line 195-214
<button
  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
  onClick={() => alert('Export PDF coming soon')}
>
  Export PDF
</button>
```

**Missing:**
- ❌ No "Send Email" button
- ❌ No email API endpoint (`POST /api/orders/[orderCode]/invoices/[id]/send`)
- ❌ No email service integration (Resend, SendGrid, etc.)
- ❌ No email template
- ❌ No status update to `sent`

**Task:** O8 — Invoice creation with service selection — **TODO**

---

### ❌ Шаг 6: Проставить оплаты

**Status:** ⚠️ **NOT IMPLEMENTED**

**Expected Feature:**
- Payment form in Finance tab
- Fields:
  - Amount (€)
  - Payment Type: `bank transfer` / `cash` / `card`
  - Payment Date
  - Payer (combobox)
  - Invoice link (optional)
  - Notes
- Payment list showing:
  - All payments for order
  - Total Paid
  - Balance Due = Total Amount - Total Paid
- Status badge based on payment:
  - `Unpaid` (red) — paid = 0
  - `Partially Paid` (yellow) — 0 < paid < amount
  - `Paid` (green) — paid >= amount

**Current State:**
- ❌ No Payment form component
- ❌ No Payment API endpoint (`POST /api/orders/[orderCode]/payments`)
- ❌ No payments table in database
- ❌ No payment list UI
- ❌ No payment tracking in Order Detail

**Task:** O7 — Payment form in Finance tab — **TODO**

**Schema Needed:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  invoice_id UUID REFERENCES invoices(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_type TEXT CHECK (payment_type IN ('bank_transfer', 'cash', 'card')),
  payment_date DATE NOT NULL,
  payer_party_id UUID REFERENCES party(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 SUMMARY

### ✅ WORKING (Ready for Testing):

| Feature | Status | Ready for E2E |
|---------|--------|---------------|
| Create Order | ✅ DONE | YES |
| Add Services | ✅ DONE | YES |
| Select Payer/Client | ✅ DONE | YES |
| Create Invoice | ✅ DONE | YES |
| Invoice List | ✅ DONE | YES |
| Service Locking | ✅ DONE | YES |
| Split Service | ✅ DONE | YES (bonus) |

### ❌ MISSING (Blocks Full E2E):

| Feature | Status | Blocker |
|---------|--------|---------|
| Send Email | ❌ NOT IMPLEMENTED | YES |
| Record Payment | ❌ NOT IMPLEMENTED | YES |
| Payment Tracking | ❌ NOT IMPLEMENTED | YES |

---

## 🎯 RECOMMENDATIONS

### Priority 1: Payment System (O7)

**Complexity:** 🟠 Medium  
**Estimated Time:** 4-6 hours  
**Pipeline:** DB → CW → QA

**Tasks:**
1. **DB Specialist:**
   - Create `payments` table migration
   - Add RLS policies (tenant isolation)
   - Add indexes
   
2. **Code Writer:**
   - Create `PaymentForm.tsx` component
   - Create API endpoint `POST /api/orders/[orderCode]/payments`
   - Create `PaymentList.tsx` component
   - Integrate in Order Detail Finance tab
   - Add payment summary (Total Paid, Balance Due)
   
3. **QA:**
   - Test payment recording
   - Test payment list
   - Verify amounts calculation
   - Test RLS isolation

### Priority 2: Email System (O8)

**Complexity:** 🟠 Medium  
**Estimated Time:** 6-8 hours  
**Pipeline:** CW → QA

**Tasks:**
1. **Code Writer:**
   - Choose email service (Resend recommended)
   - Create email template (HTML)
   - Create API endpoint `POST /api/orders/[orderCode]/invoices/[id]/send`
   - Add "Send Email" button in InvoiceList
   - Update invoice status to `sent` after email
   - Add email sent timestamp to invoices table
   
2. **QA:**
   - Test email sending
   - Verify email template
   - Test status update
   - Verify email content (invoice details, amounts)

---

## 📝 TESTING NOTES

### Can Test Now (Partial E2E):

**Scenario A: Basic Invoice Flow**
1. ✅ Create Order
2. ✅ Add 2 Services with different payers
3. ✅ Create Invoice from selected services
4. ✅ Verify Invoice appears in list
5. ✅ Verify Services are locked (🔒)

**Score:** 60% complete (4/6 steps)

### Cannot Test (Missing Features):

**Scenario B: Full Payment Cycle**
1. ❌ Send Invoice via Email
2. ❌ Record Payment (bank transfer €100)
3. ❌ Record Payment (cash €40)
4. ❌ Verify Total Paid = €140
5. ❌ Verify Balance Due calculated
6. ❌ Verify Invoice status = `paid` when fully paid

**Score:** 0% complete (0/6 steps)

---

## ✅ QA VERDICT

**System Readiness:** 60% ⚠️

**Functional:**
- ✅ Order Management
- ✅ Service Management
- ✅ Invoice Creation
- ❌ Email Communication
- ❌ Payment Tracking

**Recommendation:**
1. **Implement O7 (Payments)** — CRITICAL для бизнес-процесса
2. **Implement O8 (Email)** — HIGH для коммуникации с клиентами
3. После реализации — полное E2E тестирование

**Next Step:**
- Runner creates tasks O7-IMPL and O8-IMPL
- Code Writer implements Payment System
- Code Writer implements Email System
- QA runs full E2E test

---

**Report Created:** 2026-01-12  
**QA Agent:** Regression Testing  
**Status:** GAPS IDENTIFIED ⚠️
