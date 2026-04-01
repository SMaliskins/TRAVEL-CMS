# 🐛 QA DEFECT REPORT: Invoice Creator

**Date:** 2026-01-10 01:15  
**Reporter:** QA Agent  
**Task:** OD6-FIX  
**Severity:** CRITICAL

---

## 📋 SUMMARY

Invoice Creator показывает "Invoice saved!" но **НЕ сохраняет данные в БД**.

**User Impact:**
- ❌ Счета не создаются
- ❌ Статус сервисов не меняется (invoice_id остаётся NULL)
- ❌ Список счетов остаётся пустым
- ❌ Невозможно выписать счёт клиенту

---

## 🔍 ROOT CAUSE ANALYSIS

### Defect #1: API Call Missing

**File:** `app/orders/[orderCode]/_components/InvoiceCreator.tsx`  
**Line:** 67-71  
**Function:** `handleSave()`

**Current Code:**
```typescript
const handleSave = () => {
  // TODO: API call to save invoice  ← ПРОБЛЕМА ТУТ!
  alert('Invoice saved! (API integration pending)');
  onClose();
};
```

**Problem:**
- Функция НЕ вызывает POST /api/orders/[orderCode]/invoices
- Данные собираются в state, но никуда не отправляются
- Alert фейковый - показывает успех, но ничего не сохраняет

---

### Defect #2: onSuccess() Not Called

**Problem:**
- Даже если API был бы вызван, `onSuccess()` callback не вызывается
- Это ломает обновление списка инвойсов

---

## ✅ VERIFIED: API Exists and Works

**API Endpoint:** `app/api/orders/[orderCode]/invoices/route.ts`
- ✅ POST handler exists (line 73-228)
- ✅ Validation implemented
- ✅ Creates invoice in `invoices` table
- ✅ Creates items in `invoice_items` table
- ✅ Updates `order_services.invoice_id`
- ✅ Rollback on error

**Expected Payload:**
```typescript
{
  invoice_number: string,
  invoice_date: string,
  due_date: string,
  client_name: string,
  client_address: string,
  client_email: string,
  services: Array<{
    service_id: string,
    service_name: string,
    service_category: string,
    quantity: number,
    unit_price: number
  }>,
  subtotal: number,
  tax_rate: number,
  tax_amount: number,
  total: number,
  notes: string
}
```

---

## 📊 DATA MAPPING: UI → API

**InvoiceCreator State → API Payload:**

| UI State | API Field | Status |
|----------|-----------|--------|
| `invoiceNumber` | `invoice_number` | ✅ Ready |
| `invoiceDate` | `invoice_date` | ✅ Ready |
| `dueDate` | `due_date` | ✅ Ready |
| `clientNameEditable` | `client_name` | ✅ Ready |
| `clientAddress` | `client_address` | ✅ Ready |
| `clientEmail` | `client_email` | ✅ Ready |
| `selectedServices` | `services[]` | ⚠️ Needs mapping |
| `subtotal` | `subtotal` | ✅ Ready |
| `taxRate` | `tax_rate` | ✅ Ready |
| `taxAmount` | `tax_amount` | ✅ Ready |
| `total` | `total` | ✅ Ready |
| `notes` | `notes` | ✅ Ready |

**Services Mapping Required:**
```typescript
selectedServices.map(s => ({
  service_id: s.id,          // Service.id → service_id
  service_name: s.name,      // Service.name → service_name
  service_category: s.category, // Service.category → service_category
  quantity: 1,                // Default quantity
  unit_price: s.clientPrice,  // Service.clientPrice → unit_price
}))
```

---

## 🛠️ FIX IMPLEMENTATION

### File: `app/orders/[orderCode]/_components/InvoiceCreator.tsx`

**Replace lines 67-71:**

```typescript
const handleSave = async () => {
  try {
    // 1. Prepare payload
    const payload = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      client_name: clientNameEditable,
      client_address: clientAddress,
      client_email: clientEmail,
      services: selectedServices.map(s => ({
        service_id: s.id,
        service_name: s.name,
        service_category: s.category,
        quantity: 1,
        unit_price: s.clientPrice,
      })),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes,
    };

    // 2. Call API
    const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create invoice');
    }

    // 3. Success
    alert('✅ Invoice created successfully!');
    onSuccess?.();  // ← Trigger list refresh
    onClose();
  } catch (error) {
    console.error('Error creating invoice:', error);
    alert(`❌ Failed to create invoice: ${error.message}`);
  }
};
```

---

## ⚠️ DB SCHEMA VERIFICATION REQUIRED

**Issue:** Две разные схемы обнаружены в проекте!

### Old Schema (`supabase_schema.sql`):
```sql
CREATE TABLE invoices (
  invoice_no text NOT NULL,          -- ← Старое название
  status text CHECK (status IN ('Draft', 'Issued', 'Cancelled', 'Paid')),
  amount_total numeric(12,2),
  -- Отсутствуют: client_name, client_address, subtotal, tax_rate, notes
)
```

### New Schema (`migrations/create_invoices_tables.sql`):
```sql
CREATE TABLE invoices (
  invoice_number text NOT NULL UNIQUE,  -- ← Новое название
  client_name text NOT NULL,
  client_address text,
  client_email text,
  subtotal numeric(12,2),
  tax_rate numeric(5,2),
  tax_amount numeric(12,2),
  total numeric(12,2),
  status text CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue')),
  notes text,
  -- + invoice_items table
  -- + order_services.invoice_id column
)
```

**Action Required:**
1. DB Specialist должен проверить актуальную схему в Supabase
2. Если схема старая → применить миграцию `create_invoices_tables.sql`
3. Если схема новая → проверить RLS policies

**Migration File:** `migrations/create_invoices_tables.sql`

---

## 📝 TEST PLAN (After Fix)

### Test Case 1: Create Invoice Successfully
1. Open order page (e.g., /orders/0002-26-sm)
2. Go to Finance tab
3. Select services with checkboxes
4. Click "Issue Invoice"
5. Fill invoice form:
   - Invoice number: auto-generated
   - Client name: from order
   - Due date: +14 days
   - VAT: 0%
6. Click "Save & Issue Invoice"

**Expected:**
- ✅ Alert "Invoice created successfully!"
- ✅ Invoice Creator closes
- ✅ Invoice List shows new invoice
- ✅ Services show "Invoiced" badge
- ✅ order_services.invoice_id populated

### Test Case 2: Create Invoice with VAT
- Same as TC1, but VAT = 21%

**Expected:**
- ✅ Subtotal, VAT amount, Total calculated correctly
- ✅ Invoice saved with correct amounts

### Test Case 3: Cannot Invoice Same Service Twice
1. Create invoice with service A
2. Try to create another invoice with same service A

**Expected:**
- ❌ API returns error "Some services are already invoiced"
- ✅ User sees error alert

---

## 🎯 ACCEPTANCE CRITERIA

- [ ] handleSave() calls POST API
- [ ] Invoice saved to `invoices` table
- [ ] Invoice items saved to `invoice_items` table
- [ ] order_services.invoice_id updated
- [ ] onSuccess() called → list refreshes
- [ ] Services show "Invoiced" status
- [ ] No console errors
- [ ] DB schema verified by DB Specialist

---

## 📌 RELATED TASKS

- **OD6:** Invoice Creator (REWORK)
- **OD6-FIX:** This defect fix (TODO)
- **DB Migration:** Verify invoices schema (BLOCKED - awaiting DB Specialist)

---

**Next Step:** CODE WRITER должен исправить `handleSave()` и вызвать QA для тестирования.
