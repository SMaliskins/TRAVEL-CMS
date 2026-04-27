export type AutoMatchService = {
  id: string;
  supplierName?: string | null;
  supplier_name?: string | null;
  servicePrice?: number | null;
  service_price?: number | null;
  serviceDateFrom?: string | null;
  service_date_from?: string | null;
  serviceDateTo?: string | null;
  service_date_to?: string | null;
  supplierInvoiceRequirement?: string | null;
  supplier_invoice_requirement?: string | null;
};

export type AutoMatchDocument = {
  supplier_name?: string | null;
  amount?: number | null;
  invoice_date?: string | null;
};

export type AutoMatchReason = "supplier" | "amount" | "date";

export interface AutoMatchSuggestion {
  serviceId: string;
  reasons: AutoMatchReason[];
  score: number;
}

export function normalizeSupplierKey(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readServiceField<T>(
  service: AutoMatchService,
  camel: keyof AutoMatchService,
  snake: keyof AutoMatchService
): T | null {
  const camelValue = service[camel];
  if (camelValue !== undefined && camelValue !== null && camelValue !== "") return camelValue as unknown as T;
  const snakeValue = service[snake];
  if (snakeValue !== undefined && snakeValue !== null && snakeValue !== "") return snakeValue as unknown as T;
  return null;
}

/**
 * Suggest services that likely correspond to the given supplier-invoice document.
 *
 * Strategy (intentionally conservative):
 *  - Only services with requirement === "required" are eligible.
 *  - Services already linked to this document stay selected (they're not suggestions, they're current state).
 *  - A service must share the supplier with the document (normalized substring match).
 *  - Amount and date overlaps boost confidence and are reported as reasons (used for the "why" tooltip in UI).
 *
 * The function never modifies the inputs and is safe to call from both server and browser.
 */
export function suggestServiceMatchesForDocument(
  document: AutoMatchDocument,
  services: AutoMatchService[],
  alreadyMatchedServiceIds: Iterable<string> = []
): {
  suggestedServiceIds: string[];
  details: Map<string, AutoMatchSuggestion>;
} {
  const alreadyMatched = new Set<string>();
  for (const id of alreadyMatchedServiceIds) {
    if (typeof id === "string" && id) alreadyMatched.add(id);
  }

  const docSupplier = normalizeSupplierKey(document?.supplier_name ?? null);
  const docAmount = readNumber(document?.amount);
  const docDate = readDate(document?.invoice_date);

  const details = new Map<string, AutoMatchSuggestion>();
  const suggested: string[] = [];

  if (!docSupplier) {
    // Without a supplier we don't propose anything automatically — the user must match manually.
    return { suggestedServiceIds: suggested, details };
  }

  for (const service of services) {
    if (!service || typeof service.id !== "string" || !service.id) continue;
    const requirement =
      readServiceField<string>(service, "supplierInvoiceRequirement", "supplier_invoice_requirement") || "required";
    if (requirement !== "required") continue;

    if (alreadyMatched.has(service.id)) {
      continue;
    }

    const serviceSupplier = normalizeSupplierKey(
      readServiceField<string>(service, "supplierName", "supplier_name")
    );
    if (!serviceSupplier) continue;

    const supplierMatch =
      serviceSupplier === docSupplier ||
      serviceSupplier.includes(docSupplier) ||
      docSupplier.includes(serviceSupplier);
    if (!supplierMatch) continue;

    const reasons: AutoMatchReason[] = ["supplier"];
    let score = 3;

    const servicePrice = readNumber(readServiceField<number | string>(service, "servicePrice", "service_price"));
    if (docAmount != null && servicePrice != null) {
      const tolerance = Math.max(1, Math.abs(servicePrice) * 0.02);
      if (Math.abs(docAmount - servicePrice) <= tolerance) {
        reasons.push("amount");
        score += 2;
      }
    }

    const dateFrom = readDate(readServiceField<string>(service, "serviceDateFrom", "service_date_from"));
    const dateTo = readDate(readServiceField<string>(service, "serviceDateTo", "service_date_to"));
    if (docDate && dateFrom && dateTo) {
      if (docDate.getTime() >= dateFrom.getTime() && docDate.getTime() <= dateTo.getTime()) {
        reasons.push("date");
        score += 1;
      }
    } else if (docDate && dateFrom) {
      const diffDays = Math.abs((docDate.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 60) {
        reasons.push("date");
        score += 1;
      }
    }

    suggested.push(service.id);
    details.set(service.id, { serviceId: service.id, reasons, score });
  }

  return { suggestedServiceIds: suggested, details };
}

export function describeAutoMatchReasons(reasons: AutoMatchReason[]): string {
  const parts: string[] = [];
  if (reasons.includes("supplier")) parts.push("Supplier matches");
  if (reasons.includes("amount")) parts.push("Amount matches");
  if (reasons.includes("date")) parts.push("Date in range");
  return parts.join(" · ");
}
