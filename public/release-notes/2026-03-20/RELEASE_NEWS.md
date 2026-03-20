# Release Notes — 20 March 2026

## Cancel Service (mandatory release)

Modal to cancel a service: summary (cost, client paid, margin), **Cancellation details** (refund from supplier, our retention, % of margin 20/50/75/100%), credit to client and refund note. Confirm cancellation in one step.

![Cancel Service modal](cancel-service-modal.png)

---

## Restore to Original for cancelled services

For cancellation-type services, you can no longer cancel again — only **Restore to Original**. One click restores the original service and removes the cancellation record.

*(Add real screenshot: `restore-to-original.png`)*

---

## Company expenses (Finance)

New tab **Company expenses** in Finance for utilities, insurance and other company costs not linked to orders. Upload PDF/images for AI extraction, filter by period, supplier and amount. Supervisor and Finance only.

*(Add real screenshot: `company-expenses.png`)*

---

## Directory merge with preview and bulk merge

Before merging contacts you see both cards, a confirmation checkbox and an irreversible notice. **Bulk merge**: select multiple contacts with checkboxes and merge into a target in one action.

*(Add real screenshot: `merge-preview.png`)*

---

## Lead Passenger avatar in order header

The order header now shows the Lead Passenger's avatar next to their name.

*(Add real screenshot: `order-header-avatar.png`)*

---

## Invoices and services

- **Credit invoice number** — format `original-C` (e.g. INV-001 → INV-001-C)
- **Credit invoice amounts** — Total shown as negative (-€110) in red; Debt = 0 when refund paid
- **Invoice number reservation** — numbers are reserved only when you save, not when opening the Create dialog
- **Service descriptions** — translated to the invoice language on PDFs
- **Supplier** — visible in cancelled services (taken from parent when missing)

---

## Payments & order totals

- **Refund payments** — amount stored and displayed as negative (-€110) in red
- **Refund due** — when client paid more than total (e.g. after cancellation), order header shows «Refund due» instead of «remaining»
- **Total (active services)** — includes cancelled with formal credit: original + cancellation cancel out (665+(-110)+110=665)

---

## Bulk operations on invoiced services

- **Change Supplier / Payer / Client** — bulk actions now work on services already in an invoice. Select all includes invoiced; Create Invoice still only for services without invoice.

---

## Fixes

- Passport DOB saves correctly; directory merge syncs order client name
- AI passport parsing: UK/PDF support, MRZ fallback, improved robustness

---

*Use real screenshots from the app. See `SCREENSHOTS_GUIDE.md` for what to capture and filenames.*
