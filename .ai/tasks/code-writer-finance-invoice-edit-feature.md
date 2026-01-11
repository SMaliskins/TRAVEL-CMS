# CODE WRITER: Finance Tab — Add Edit Invoice Feature

**Task ID:** FN1  
**Created:** 2026-01-11  
**Agent:** UI System / Consistency  
**Assignee:** Code Writer  
**Priority:** High  
**Complexity:** 🟠 Medium  

---

## 📋 SUMMARY

Add **Edit** button and functionality to Invoices in Finance tab.  
Currently only "View/Edit coming soon" placeholder exists.

---

## 🎯 USER REQUEST

> http://localhost:3000/orders/0002-26-sm  
> раздел Finance.  
> Invoices:  
> - сделать EDIT  
> - Export PDF ✅ (уже есть)  
> - Cancel ✅ (уже есть)

---

## 📍 CURRENT STATE

**File:** `app/orders/[orderCode]/_components/InvoiceList.tsx`

**Current Actions Row (line 215-232):**
```tsx
<div className="flex items-center gap-2 pt-3 border-t">
  <button
    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
    onClick={() => alert('View/Edit coming soon')}
  >
    View
  </button>
  {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
    <button
      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
      onClick={() => handleCancelInvoice(invoice.id)}
    >
      Cancel
    </button>
  )}
  <button
    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
    onClick={() => alert('Export PDF coming soon')}
  >
    Export PDF
  </button>
</div>
```

**Problems:**
❌ No separate **Edit** button  
❌ "View" button has placeholder alert  
❌ "Export PDF" has placeholder alert  

---

## ✅ REQUIRED CHANGES

### 1. Add **Edit** Button

**New Actions Row:**
```tsx
<div className="flex items-center gap-2 pt-3 border-t">
  <button
    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
    onClick={() => handleViewInvoice(invoice.id)}
  >
    View
  </button>
  
  {/* NEW: Edit button — только для Draft/Sent */}
  {(invoice.status === 'draft' || invoice.status === 'sent') && (
    <button
      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
      onClick={() => handleEditInvoice(invoice.id)}
    >
      Edit
    </button>
  )}
  
  {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
    <button
      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
      onClick={() => handleCancelInvoice(invoice.id)}
    >
      Cancel
    </button>
  )}
  
  <button
    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
    onClick={() => handleExportPDF(invoice.id)}
  >
    Export PDF
  </button>
</div>
```

---

### 2. Edit Button Visibility Rules

| Status | View | Edit | Cancel | Export PDF |
|--------|------|------|--------|------------|
| `draft` | ✅ | ✅ | ✅ | ✅ |
| `sent` | ✅ | ✅ (limited) | ✅ | ✅ |
| `paid` | ✅ | ❌ | ❌ | ✅ |
| `cancelled` | ✅ | ❌ | ❌ | ✅ |
| `overdue` | ✅ | ✅ (limited) | ✅ | ✅ |

---

### 3. Edit Invoice Modal

**New Component:** `EditInvoiceModal.tsx`

**Location:** `app/orders/[orderCode]/_components/EditInvoiceModal.tsx`

**Props:**
```tsx
interface EditInvoiceModalProps {
  orderCode: string;
  invoiceId: string;
  onClose: () => void;
  onSave: () => void;
}
```

**Editable Fields (Draft):**
- ✏️ **Due Date** (DatePicker)
- ✏️ **Services** (add/remove from order's services)
- ✏️ **Client** (if needed — dropdown from directory)
- ✏️ **Notes** (textarea)
- 🔒 **Invoice Date** (read-only)
- 🔒 **Total** (auto-calculated)

**Editable Fields (Sent):**
- ✏️ **Due Date** (only if not overdue)
- ✏️ **Notes** (limited)
- 🔒 **Services** (locked)
- 🔒 **Client** (locked)
- 🔒 **Total** (locked)

**Layout:**
```tsx
┌─────────────────────────────────────────────────────────┐
│ Edit Invoice: INV-0002/26-SM-082010            [❌ Close]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─ Basic Info ────────────────────────────────────────┐ │
│ │ Invoice Number:  INV-0002/26-SM-082010 (read-only) │ │
│ │ Invoice Date:    11.01.2026 (read-only)            │ │
│ │ Due Date:        [25.01.2026] 📅                    │ │
│ │ Client:          [Antons Nenaševs] 🔽               │ │
│ │ Status:          Draft                               │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Services (1) ───────────────────────────────────────┐ │
│ │ ☑ Riga-Dubai — €185.00 (10.01 - 14.01)   [❌ Remove]│ │
│ │                                                      │ │
│ │ [+ Add Service from Order]                           │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Totals ─────────────────────────────────────────────┐ │
│ │ Subtotal:  €185.00                                  │ │
│ │ Tax:       €0.00                                    │ │
│ │ Total:     €185.00                                  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Notes ──────────────────────────────────────────────┐ │
│ │ [Text area for notes...]                            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│                           [Cancel]  [Save Changes]      │
└─────────────────────────────────────────────────────────┘
```

---

### 4. Handler Functions

**Add to `InvoiceList.tsx`:**

```tsx
const handleViewInvoice = async (invoiceId: string) => {
  // TODO: Open view-only modal or navigate to invoice detail page
  alert('View invoice detail — implementation pending');
};

const handleEditInvoice = async (invoiceId: string) => {
  setEditingInvoiceId(invoiceId);
  setShowEditModal(true);
};

const handleExportPDF = async (invoiceId: string) => {
  try {
    const response = await fetch(
      `/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`
    );
    if (!response.ok) throw new Error('Failed to export PDF');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
    alert('✅ PDF exported successfully');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('❌ Failed to export PDF');
  }
};
```

---

## 🧪 TESTING CHECKLIST

### Manual Testing

1. **Edit Button Visibility**
   - [ ] Draft invoice → Edit button visible
   - [ ] Sent invoice → Edit button visible
   - [ ] Paid invoice → Edit button hidden
   - [ ] Cancelled invoice → Edit button hidden

2. **Edit Modal (Draft)**
   - [ ] Click Edit → modal opens
   - [ ] Due Date picker works
   - [ ] Can add services from order
   - [ ] Can remove services
   - [ ] Total auto-calculates
   - [ ] Notes field editable
   - [ ] Save → updates invoice
   - [ ] Cancel → closes without changes

3. **Edit Modal (Sent)**
   - [ ] Only Due Date & Notes editable
   - [ ] Services locked
   - [ ] Client locked

4. **Export PDF**
   - [ ] Click Export PDF → downloads PDF
   - [ ] PDF contains correct invoice data
   - [ ] Filename format: `invoice-{number}.pdf`

5. **View Button**
   - [ ] Click View → opens view-only modal
   - [ ] All data displayed correctly

---

## 📁 FILES TO MODIFY

1. `app/orders/[orderCode]/_components/InvoiceList.tsx`
   - Add Edit button
   - Add handler functions
   - Add state for edit modal

2. **NEW:** `app/orders/[orderCode]/_components/EditInvoiceModal.tsx`
   - Create modal component
   - Implement edit logic
   - Handle Draft vs Sent permissions

3. `app/api/orders/[orderCode]/invoices/[invoiceId]/route.ts`
   - Update PATCH endpoint for edits
   - Add validation for status-based permissions

4. **NEW:** `app/api/orders/[orderCode]/invoices/[invoiceId]/pdf/route.ts`
   - Create PDF export endpoint
   - Generate PDF from invoice data

---

## 🚀 IMPLEMENTATION ORDER

1. **Phase 1:** Add Edit button with visibility rules ✅
2. **Phase 2:** Create EditInvoiceModal component ✅
3. **Phase 3:** Implement edit logic (Draft) ✅
4. **Phase 4:** Implement edit logic (Sent) ✅
5. **Phase 5:** Implement PDF export ✅
6. **Phase 6:** Testing & QA ✅

---

## 📌 ACCEPTANCE CRITERIA

✅ Edit button appears for Draft/Sent invoices  
✅ Edit button hidden for Paid/Cancelled  
✅ Edit modal opens on click  
✅ Draft invoices: all fields editable  
✅ Sent invoices: limited fields editable  
✅ Export PDF downloads correct PDF  
✅ Cancel button still works  
✅ View button opens view-only mode  

---

## 📝 NOTES

- Use existing `InvoiceCreator` component as reference for services selection
- Follow existing design system (same buttons, colors, modals)
- Ensure locked services show "🔒 Invoiced" badge (as per OD2 spec)
- PDF export can use a library like `react-pdf` or `puppeteer` (server-side)

---

**Status:** ✅ READY FOR CODE WRITER  
**Estimated Time:** 3-4 hours  
**Priority:** High (user explicitly requested)
