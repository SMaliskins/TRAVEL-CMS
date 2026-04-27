# SUPINV1 UI Mapping — Supplier Invoice Workflow

**Task ID:** SUPINV1  
**Agent:** UI System  
**Status:** Ready for Code Writer  
**Depends on:** `migrations/add_supplier_invoice_workflow.sql` applied

## Goal

Add clear status visibility and actions for supplier invoice matching and accounting processing without overloading the existing documents table.

This UI step covers three screens:

1. Order `Documents` tab.
2. Order services table.
3. `/finances/suppliers-invoices`.
4. `/orders` preview list.

## Shared Status Display

Use compact badges with consistent colors:

- `Matched` - green.
- `Unmatched` - amber.
- `Periodic` - blue.
- `Not required` - gray.
- `Pending` - gray/amber.
- `Processed` - green.
- `Attention` - red/amber.
- `Cancelled processed` - purple/gray.
- `Deleted` - red outline.
- `Replaced` - amber outline.

All labels must be English in code/UI strings unless translated through i18n.

## Order Documents Tab

Current table columns:

- Type
- File
- Amount
- Invoice No.
- Supplier
- Date
- Size
- Actions

Add columns:

- `Service Match`
- `Accounting`

Recommended order:

1. Type
2. File
3. Amount
4. Invoice No.
5. Supplier
6. Date
7. Service Match
8. Accounting
9. Size
10. Actions

### Service Match Column

Display derived values:

- If `document_state = 'deleted'`: `Deleted`.
- Else if `document_state = 'replaced'`: `Replaced`.
- Else if linked services count > 0: `Matched: N`.
- Else: `Unmatched`.

Click behavior:

- Clicking `Matched: N` opens the same matching modal with selected services checked.
- Clicking `Unmatched` opens matching modal.

### Accounting Column

Display:

- `Pending`
- `Processed`
- `Attention: changed`
- `Attention: deleted`
- `Attention: replaced`
- `Cancelled processed`

If `accounting_processed_at` exists, show a small second line with formatted date using `formatDateDDMMYYYY`.

### Actions

Add actions near existing edit/preview/download/delete:

- `Match services`
- `Replace`

Keep existing:

- Edit extracted data.
- Preview.
- Download.
- Delete.

Delete behavior UI:

- For `accounting_state = 'processed'`, confirmation text must explain:
  `This invoice was already processed by accounting. It will be marked as deleted and sent to Attention instead of being permanently removed.`
- For unprocessed invoice:
  regular delete confirmation is acceptable, but backend should still soft-delete once workflow is enabled.

### Match Services Modal

Open from `Service Match` badge or action.

Content:

- Header: invoice file name, supplier, amount, invoice number.
- Search/filter by service name/supplier/category/traveller.
- Services list with checkboxes.
- Service row should show:
  - category
  - service name
  - supplier
  - service dates
  - service price
  - current supplier invoice requirement badge

Footer actions:

- `Save match`
- `Clear match`
- `Cancel`

Additional control:

- Service requirement selector per selected service:
  - `Required`
  - `Periodic`
  - `Not required`

For v1 CW implementation, it is acceptable to:

- Save only document-service links in the modal.
- Add periodic/not required controls as a separate service-row quick action in the services table.

## Order Services Table

Add compact supplier invoice indicator near Supplier or Status column.

Recommended display:

- `Missing supplier invoice` - red/amber badge.
- `Invoice matched` - green badge.
- `Periodic` - blue badge.
- `Not required` - gray badge.

Rules:

- `supplier_invoice_requirement = 'not_required'` -> `Not required`.
- `supplier_invoice_requirement = 'periodic'` -> `Periodic`.
- `required` + linked active document exists -> `Invoice matched`.
- `required` + no linked active document -> `Missing supplier invoice`.

Actions:

- A small dropdown/quick menu on the badge:
  - `Set required`
  - `Set periodic`
  - `Set not required`
  - `View matched invoices`

## `/finances/suppliers-invoices`

Current table columns:

- Invoice Date
- Supplier
- Amount
- Currency
- File
- Order
- Uploaded
- Actions

Add columns:

- `Match`
- `Accounting`
- `Attention`

Recommended order:

1. Invoice Date
2. Supplier
3. Amount
4. Currency
5. File
6. Order
7. Match
8. Accounting
9. Attention
10. Uploaded
11. Actions

### Match Column

Display:

- `Matched: N services`
- `Unmatched`
- `Deleted`
- `Replaced`

Click behavior:

- `Matched` opens read-only matched services popover/modal.
- `Unmatched` can navigate to order Documents tab or show disabled hint: accountant can see it but agent should match it.

### Accounting Column

Display:

- `Pending`
- `Processed`
- `Attention`
- `Cancelled processed`

Actions:

- If `pending`: show `Process`.
- If `attention_reason = 'deleted'`: show `Mark cancelled processed`.
- If `attention_reason = 'changed'` or `replaced`: show `Process updated`.
- If `processed`: no primary action, show processed date.

### Attention Column

Display:

- empty dash if no attention.
- `This invoice was deleted`.
- `This invoice was changed`.
- `This invoice was replaced`.

If `replaced_by_document_id` exists, show `View replacement`.

## `/orders` Preview List

Add column:

`Supplier invoices`

Badge priority:

1. `Attention` if any supplier invoice in order has `accounting_state = 'attention'`.
2. `Missing: N` if required active services have no linked active supplier invoice.
3. `Unmatched: N` if order has active invoice documents without service links.
4. `All matched` if all required services are covered and no unmatched docs.
5. `Periodic only` if all covered services are periodic/not required.

This column should be narrow but clickable:

- Click opens order page on `Documents` tab if possible.

## API Fields Needed by UI

### Order Documents GET

Each document row should include:

- `document_state`
- `accounting_state`
- `accounting_processed_at`
- `accounting_processed_by`
- `attention_reason`
- `deleted_at`
- `replaced_by_document_id`
- `matched_service_count`
- `matched_services` at least in modal endpoint or initial payload

### Order Services GET

Each service row should include:

- `supplier_invoice_requirement`
- `supplier_invoice_period`
- `supplier_invoice_note`
- `supplier_invoice_document_count`
- `supplier_invoice_status`

### Supplier Invoices GET

Each row should include:

- document/accounting state fields
- `matched_service_count`
- `attention_reason`
- replacement info

### Orders GET

Each order row should include:

- `supplierInvoiceStatus`
- `supplierInvoiceMissingCount`
- `supplierInvoiceUnmatchedCount`
- `supplierInvoiceAttentionCount`

## Code Writer Step Recommendation

Implement in this order:

1. API response extensions for documents/services/supplier invoices.
2. Documents tab status badges + read-only match counts.
3. Match services modal + save endpoint.
4. Service invoice requirement badge/actions.
5. `/orders` supplier invoice status column.
6. `/finances/suppliers-invoices` process/attention actions.

The smallest useful first implementation is:

- Extend documents API with state + matched count.
- Add `Service Match` and `Accounting` columns to the order Documents tab.
- Add a simple `Match services` modal that saves links.

## QA Acceptance

- Existing uploaded invoices still appear after DB migration.
- Existing services default to `Missing supplier invoice` until linked or marked periodic/not required.
- Agent can match one supplier invoice to multiple services.
- Match count appears in Documents tab and supplier invoice list.
- Accountant can see pending supplier invoices.
- Processed invoice shows processed status to agent.
- Deleting processed invoice creates attention state instead of removing it from accountant view.
