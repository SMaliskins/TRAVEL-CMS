export type SupplierInvoiceRequirement = "required" | "periodic" | "not_required";
export type SupplierInvoiceServiceStatus = "missing" | "matched" | "periodic" | "not_required";
export type SupplierInvoiceServiceTone = "amber" | "green" | "blue" | "gray";

export function normalizeSupplierInvoiceRequirement(value: unknown): SupplierInvoiceRequirement {
  return value === "periodic" || value === "not_required" ? value : "required";
}

export function getSupplierInvoiceServiceStatus({
  requirement,
  activeDocumentCount,
}: {
  requirement: unknown;
  activeDocumentCount: number;
}): { status: SupplierInvoiceServiceStatus; label: string; tone: SupplierInvoiceServiceTone } {
  const normalized = normalizeSupplierInvoiceRequirement(requirement);
  if (normalized === "not_required") {
    return { status: "not_required", label: "Not required", tone: "gray" };
  }
  if (normalized === "periodic") {
    return { status: "periodic", label: "Periodic — covered by periodic invoice", tone: "green" };
  }
  if (activeDocumentCount > 0) {
    return { status: "matched", label: "Invoice matched", tone: "green" };
  }
  return { status: "missing", label: "Missing supplier invoice", tone: "amber" };
}
