type SupplierInvoiceRequirement = "required" | "periodic" | "not_required";

export type SupplierInvoiceOrderStatus =
  | "all_matched"
  | "missing"
  | "unmatched_documents"
  | "attention"
  | "periodic_only";

export type SupplierInvoiceOrderTone = "green" | "amber" | "purple" | "red" | "blue";

function normalizeSupplierInvoiceRequirement(value: unknown): SupplierInvoiceRequirement {
  return value === "periodic" || value === "not_required" ? value : "required";
}

export function getSupplierInvoiceOrderStatus({
  services,
  activeDocumentMatchedCounts,
  hasAttentionDocument,
}: {
  services: { id: string; requirement: SupplierInvoiceRequirement | string | null | undefined; activeDocumentCount: number }[];
  activeDocumentMatchedCounts: number[];
  hasAttentionDocument: boolean;
}): { status: SupplierInvoiceOrderStatus; label: string; tone: SupplierInvoiceOrderTone } {
  if (hasAttentionDocument) {
    return { status: "attention", label: "Attention", tone: "red" };
  }

  if (activeDocumentMatchedCounts.some((count) => count <= 0)) {
    return { status: "unmatched_documents", label: "Has unmatched invoices", tone: "purple" };
  }

  const relevantServices = services.filter(
    (service) => normalizeSupplierInvoiceRequirement(service.requirement) !== "not_required"
  );
  const requiredServices = relevantServices.filter(
    (service) => normalizeSupplierInvoiceRequirement(service.requirement) === "required"
  );

  if (requiredServices.some((service) => service.activeDocumentCount <= 0)) {
    return { status: "missing", label: "Missing supplier invoices", tone: "amber" };
  }

  if (
    relevantServices.length > 0 &&
    relevantServices.every((service) => normalizeSupplierInvoiceRequirement(service.requirement) === "periodic")
  ) {
    return { status: "periodic_only", label: "Periodic only", tone: "blue" };
  }

  return { status: "all_matched", label: "All matched", tone: "green" };
}
