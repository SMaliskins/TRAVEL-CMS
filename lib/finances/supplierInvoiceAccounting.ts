export type SupplierInvoiceAccountingState =
  | "pending"
  | "processed"
  | "attention"
  | "cancelled_processed";

export type SupplierInvoiceAttentionReason = "deleted" | "changed" | "replaced" | string | null;

export type SupplierInvoiceAccountingUpdate = {
  accounting_state: SupplierInvoiceAccountingState;
  accounting_processed_at: string;
  accounting_processed_by: string;
  attention_reason: SupplierInvoiceAttentionReason;
};

export type SupplierInvoiceEditChanges = Record<string, string | number | null>;

export type SupplierInvoiceDeleteUpdate =
  | { mode: "hard"; update: null }
  | {
      mode: "soft";
      update: {
        document_state: "deleted";
        accounting_state: "attention";
        attention_reason: "deleted";
        deleted_at: string;
        deleted_by: string;
      };
    };

export function getSupplierInvoiceAccountingUpdate({
  currentState,
  attentionReason,
  processedAt,
  processedBy,
}: {
  currentState: SupplierInvoiceAccountingState | string | null | undefined;
  attentionReason: SupplierInvoiceAttentionReason;
  processedAt: string;
  processedBy: string;
}): SupplierInvoiceAccountingUpdate {
  if (currentState === "processed" || currentState === "cancelled_processed") {
    throw new Error("Supplier invoice is already processed");
  }

  if (currentState === "attention" && attentionReason === "deleted") {
    return {
      accounting_state: "cancelled_processed",
      accounting_processed_at: processedAt,
      accounting_processed_by: processedBy,
      attention_reason: "deleted",
    };
  }

  return {
    accounting_state: "processed",
    accounting_processed_at: processedAt,
    accounting_processed_by: processedBy,
    attention_reason: null,
  };
}

export function getSupplierInvoiceEditUpdate({
  currentState,
  currentVersion,
  changes,
}: {
  currentState: SupplierInvoiceAccountingState | string | null | undefined;
  currentVersion: number | null | undefined;
  changes: SupplierInvoiceEditChanges;
}): SupplierInvoiceEditChanges {
  if (Object.keys(changes).length === 0) return changes;
  if (currentState === "processed") {
    return {
      ...changes,
      accounting_state: "attention",
      attention_reason: "changed",
      version: (currentVersion || 1) + 1,
    };
  }
  return changes;
}

export function getSupplierInvoiceDeleteUpdate({
  currentState,
  deletedAt,
  deletedBy,
}: {
  currentState: SupplierInvoiceAccountingState | string | null | undefined;
  deletedAt: string;
  deletedBy: string;
}): SupplierInvoiceDeleteUpdate {
  if (currentState === "processed" || currentState === "attention") {
    return {
      mode: "soft",
      update: {
        document_state: "deleted",
        accounting_state: "attention",
        attention_reason: "deleted",
        deleted_at: deletedAt,
        deleted_by: deletedBy,
      },
    };
  }
  return { mode: "hard", update: null };
}
