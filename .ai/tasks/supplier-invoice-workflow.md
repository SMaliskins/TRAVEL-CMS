# Supplier Invoice Matching & Accounting Workflow

**Task ID:** SUPINV1  
**Area:** Finance / Orders / Supplier invoices  
**Pipeline:** DB -> UI -> CW -> QA  
**Status:** Approved design, ready for DB mapping

## Goal

Create a reliable workflow between agents and accounting for supplier invoices uploaded electronically into an order.

The system must answer four questions at any time:

1. Which order services still have no supplier invoice?
2. Which uploaded supplier invoice belongs to which real service?
3. Which invoices are periodic and do not need a one-to-one supplier invoice per service?
4. Which supplier invoices have already been processed by accounting, changed, replaced, or cancelled?

## Current State

- Order documents are stored in `order_documents`.
- The order `Documents` tab lists documents uploaded for one order.
- `/finances/suppliers-invoices` lists uploaded supplier invoices for accounting.
- Documents can be edited and physically deleted.
- There is no durable matching state between documents and `order_services`.
- There is no accounting processing state for supplier invoices.
- Orders list has no supplier invoice completeness status.

## Core Model

Do not use a single overloaded status. Use separate state axes:

### Document State

Stored on `order_documents`.

- `active` - current document.
- `deleted` - removed by agent, but kept for accounting/audit when needed.
- `replaced` - superseded by another uploaded document.

### Match State

Derived from links between supplier invoice documents and services.

- `unmatched` - document is not linked to real order services.
- `matched` - document is linked to one or more order services.
- `periodic` - service is covered by a periodic supplier invoice, not a specific document.

### Accounting State

Stored on `order_documents`.

- `pending` - visible to accountant and not processed yet.
- `processed` - accountant has entered/handled this supplier invoice in their accounting system.
- `attention` - something changed after upload and accountant must review it.
- `cancelled_processed` - deleted/cancelled supplier invoice was acknowledged and processed by accountant.

## Proposed DB Changes

### `order_documents`

Add:

- `document_state text default 'active'`
- `accounting_state text default 'pending'`
- `accounting_processed_at timestamptz`
- `accounting_processed_by uuid references auth.users(id)`
- `attention_reason text`
- `deleted_at timestamptz`
- `deleted_by uuid references auth.users(id)`
- `replaced_by_document_id uuid references order_documents(id)`
- `version int default 1`

Suggested constraints:

- `document_state in ('active', 'deleted', 'replaced')`
- `accounting_state in ('pending', 'processed', 'attention', 'cancelled_processed')`

### `order_document_service_links`

New table:

- `id uuid primary key`
- `company_id uuid`
- `order_id uuid`
- `document_id uuid references order_documents(id)`
- `service_id uuid references order_services(id)`
- `created_at timestamptz`
- `created_by uuid references auth.users(id)`

Purpose: one supplier invoice can cover multiple services, and one service can be covered by multiple supplier invoices if needed.

### `order_services`

Add supplier invoice requirement flags:

- `supplier_invoice_requirement text default 'required'`
- `supplier_invoice_period text null`
- `supplier_invoice_note text null`

Values:

- `required` - a direct supplier invoice is expected.
- `periodic` - covered by a periodic invoice, e.g. BSP or insurance monthly invoice.
- `not_required` - no supplier invoice expected.

Suggested constraint:

- `supplier_invoice_requirement in ('required', 'periodic', 'not_required')`

## Agent UI: Order Documents Tab

Add columns:

- `Service Match`
- `Accounting Status`

Document row examples:

- `Matched: 2 services`
- `Unmatched`
- `Attention: This invoice was changed`
- `Processed`
- `Deleted - pending accountant review`
- `Cancelled Processed`

Add actions:

- `Match services`
- `Mark as periodic`
- `Replace invoice`
- `Delete invoice`

Rules:

- If an unprocessed invoice is edited, show it as changed for accounting only if accounting already saw it or it is in the supplier invoices queue.
- If a processed invoice is edited or replaced, set `accounting_state = 'attention'` and `attention_reason = 'changed'`.
- If a processed invoice is deleted, do not physically delete the row. Set `document_state = 'deleted'`, `accounting_state = 'attention'`, `attention_reason = 'deleted'`.
- If an unprocessed invoice is deleted, it may be soft-deleted and hidden from accountant unless already loaded into an accounting workflow.

## Service UI: Order Services Table

Add a compact supplier invoice status indicator per service:

- `Invoice matched`
- `Missing supplier invoice`
- `Periodic`
- `Not required`

This can be displayed as an icon/badge near Supplier or Status.

## Orders Preview

Add column:

`Supplier invoices`

Values:

- `All matched`
- `Missing supplier invoices`
- `Has unmatched invoices`
- `Attention`
- `Periodic only`

Computation:

- For every active order service:
  - if `supplier_invoice_requirement = 'not_required'`, ignore it.
  - if `supplier_invoice_requirement = 'periodic'`, count as covered.
  - if `required`, it must have at least one active linked document.
- If any active document has no service link, show `Has unmatched invoices`.
- If any document has `accounting_state = 'attention'`, show `Attention`.

## Accountant UI: `/finances/suppliers-invoices`

Add columns:

- `Accounting Status`
- `Service Match`
- `Attention`

Add actions:

- `Process`
- `Mark Cancelled Processed`
- `View order`
- `View matched services`

Rules:

- `Process` sets:
  - `accounting_state = 'processed'`
  - `accounting_processed_at = now()`
  - `accounting_processed_by = current user`
- For deleted processed invoices:
  - accountant sees `Attention: This invoice was deleted`
  - action is `Mark Cancelled Processed`
  - result is `accounting_state = 'cancelled_processed'`
- For changed/replaced invoices:
  - accountant sees `Attention: This invoice was changed`
  - if replacement exists, show link to replacement document

## API Scope

### Order documents

Extend:

- `GET /api/orders/[orderCode]/documents`
- `POST /api/orders/[orderCode]/documents`
- `PATCH /api/orders/[orderCode]/documents/[docId]`
- `DELETE /api/orders/[orderCode]/documents/[docId]`

Add:

- `POST /api/orders/[orderCode]/documents/[docId]/match-services`
- `POST /api/orders/[orderCode]/documents/[docId]/replace`

### Supplier invoices

Extend:

- `GET /api/finances/uploaded-documents`

Add:

- `POST /api/finances/uploaded-documents/[docId]/process`
- `POST /api/finances/uploaded-documents/[docId]/cancelled-processed`

### Orders list

Extend:

- `GET /api/orders`

Return supplier invoice summary fields:

- `supplierInvoiceStatus`
- `supplierInvoiceMissingCount`
- `supplierInvoiceUnmatchedCount`
- `supplierInvoiceAttentionCount`

## Implementation Steps

### Step 1: DB Mapping

- Verify live `order_documents` and `order_services` schemas.
- Add migration for document/accounting states and service links.
- Backfill existing documents:
  - `document_state = 'active'`
  - `accounting_state = 'pending'`
- Backfill existing services:
  - `supplier_invoice_requirement = 'required'`

### Step 2: Order Documents Matching

- Add match-state fields to document API response.
- Add `Match services` UI in Documents tab.
- Add service invoice requirement controls.
- Do not change accountant workflow yet.

### Step 3: Orders Preview Column

- Compute supplier invoice summary in `/api/orders`.
- Add `Supplier invoices` column in `/orders`.

### Step 4: Accountant Process Workflow

- Add `Process` button to `/finances/suppliers-invoices`.
- Add accounting state badges and attention panel.
- Change delete/replace behavior to preserve processed records.

### Step 5: QA

Test cases:

- Upload invoice, leave unmatched -> order shows `Has unmatched invoices`.
- Match invoice to service -> service shows `Invoice matched`.
- Required service without document -> order shows `Missing supplier invoices`.
- Mark BSP/insurance as periodic -> service no longer counts as missing.
- Accountant processes invoice -> agent sees `Processed`.
- Agent deletes processed invoice -> accountant sees `This invoice was deleted`.
- Accountant marks deleted invoice as cancelled processed -> agent sees `Cancelled Processed`.
- Agent replaces unprocessed invoice -> old hidden/replaced, new active.
- Agent replaces processed invoice -> accountant sees `This invoice was changed`.

## Open Decisions

1. Should periodic supplier invoice coverage be configured manually per service, or auto-suggested for categories/suppliers like BSP and insurance?
2. Should unprocessed deleted invoices be soft-deleted always, or physically deleted if accounting has not processed them?
3. Should `Process` be available only for finance/accountant roles, or also supervisor/admin?
