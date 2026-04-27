import assert from "node:assert/strict";
import {
  getSupplierInvoiceAccountingUpdate,
  getSupplierInvoiceDeleteUpdate,
  getSupplierInvoiceEditUpdate,
} from "../lib/finances/supplierInvoiceAccounting.ts";
import { getSupplierInvoiceServiceStatus } from "../lib/finances/supplierInvoiceServiceStatus.ts";
import { getSupplierInvoiceOrderStatus } from "../lib/finances/supplierInvoiceOrderStatus.ts";

const processedAt = "2026-04-27T11:50:00.000Z";
const processedBy = "user-1";

assert.deepEqual(
  getSupplierInvoiceAccountingUpdate({
    currentState: "pending",
    attentionReason: null,
    processedAt,
    processedBy,
  }),
  {
    accounting_state: "processed",
    accounting_processed_at: processedAt,
    accounting_processed_by: processedBy,
    attention_reason: null,
  },
  "pending invoices should become processed"
);

assert.deepEqual(
  getSupplierInvoiceAccountingUpdate({
    currentState: "attention",
    attentionReason: "changed",
    processedAt,
    processedBy,
  }),
  {
    accounting_state: "processed",
    accounting_processed_at: processedAt,
    accounting_processed_by: processedBy,
    attention_reason: null,
  },
  "changed attention invoices should become processed after updated processing"
);

assert.deepEqual(
  getSupplierInvoiceAccountingUpdate({
    currentState: "attention",
    attentionReason: "deleted",
    processedAt,
    processedBy,
  }),
  {
    accounting_state: "cancelled_processed",
    accounting_processed_at: processedAt,
    accounting_processed_by: processedBy,
    attention_reason: "deleted",
  },
  "deleted attention invoices should become cancelled processed"
);

assert.throws(
  () =>
    getSupplierInvoiceAccountingUpdate({
      currentState: "processed",
      attentionReason: null,
      processedAt,
      processedBy,
    }),
  /already processed/i,
  "processed invoices must not be processed again"
);

assert.deepEqual(
  getSupplierInvoiceEditUpdate({
    currentState: "processed",
    currentVersion: 2,
    changes: { amount: 100 },
  }),
  {
    amount: 100,
    accounting_state: "attention",
    attention_reason: "changed",
    version: 3,
  },
  "editing a processed supplier invoice should send it to accounting attention"
);

assert.deepEqual(
  getSupplierInvoiceDeleteUpdate({
    currentState: "processed",
    deletedAt: processedAt,
    deletedBy: processedBy,
  }),
  {
    mode: "soft",
    update: {
      document_state: "deleted",
      accounting_state: "attention",
      attention_reason: "deleted",
      deleted_at: processedAt,
      deleted_by: processedBy,
    },
  },
  "deleting a processed supplier invoice should soft-delete and send it to attention"
);

assert.deepEqual(
  getSupplierInvoiceDeleteUpdate({
    currentState: "pending",
    deletedAt: processedAt,
    deletedBy: processedBy,
  }),
  { mode: "hard", update: null },
  "pending supplier invoices can still be physically deleted"
);

assert.deepEqual(
  getSupplierInvoiceServiceStatus({ requirement: "required", activeDocumentCount: 0 }),
  { status: "missing", label: "Missing supplier invoice", tone: "amber" },
  "required services with no active supplier invoice should be missing"
);

assert.deepEqual(
  getSupplierInvoiceServiceStatus({ requirement: "required", activeDocumentCount: 2 }),
  { status: "matched", label: "Invoice matched", tone: "green" },
  "required services with active supplier invoices should be matched"
);

assert.deepEqual(
  getSupplierInvoiceServiceStatus({ requirement: "periodic", activeDocumentCount: 0 }),
  { status: "periodic", label: "Periodic", tone: "blue" },
  "periodic services should count as covered"
);

assert.deepEqual(
  getSupplierInvoiceServiceStatus({ requirement: "not_required", activeDocumentCount: 0 }),
  { status: "not_required", label: "Not required", tone: "gray" },
  "not required services should be ignored by supplier invoice completeness"
);

assert.deepEqual(
  getSupplierInvoiceOrderStatus({
    services: [{ id: "svc-1", requirement: "required", activeDocumentCount: 1 }],
    activeDocumentMatchedCounts: [1],
    hasAttentionDocument: false,
  }),
  { status: "all_matched", label: "All matched", tone: "green" },
  "orders with all required services matched should be all matched"
);

assert.deepEqual(
  getSupplierInvoiceOrderStatus({
    services: [{ id: "svc-1", requirement: "required", activeDocumentCount: 0 }],
    activeDocumentMatchedCounts: [],
    hasAttentionDocument: false,
  }),
  { status: "missing", label: "Missing supplier invoices", tone: "amber" },
  "orders with unmatched required services should be missing supplier invoices"
);

assert.deepEqual(
  getSupplierInvoiceOrderStatus({
    services: [{ id: "svc-1", requirement: "periodic", activeDocumentCount: 0 }],
    activeDocumentMatchedCounts: [],
    hasAttentionDocument: false,
  }),
  { status: "periodic_only", label: "Periodic only", tone: "blue" },
  "orders with only periodic supplier invoice requirements should show periodic only"
);

assert.deepEqual(
  getSupplierInvoiceOrderStatus({
    services: [{ id: "svc-1", requirement: "required", activeDocumentCount: 1 }],
    activeDocumentMatchedCounts: [0],
    hasAttentionDocument: false,
  }),
  { status: "unmatched_documents", label: "Has unmatched invoices", tone: "purple" },
  "orders with active invoice documents that have no service links should show unmatched invoices"
);

assert.deepEqual(
  getSupplierInvoiceOrderStatus({
    services: [{ id: "svc-1", requirement: "required", activeDocumentCount: 0 }],
    activeDocumentMatchedCounts: [0],
    hasAttentionDocument: true,
  }),
  { status: "attention", label: "Attention", tone: "red" },
  "accounting attention should take priority in orders preview"
);

console.log("Supplier invoice accounting checks passed");
