/**
 * Service-line margin / VAT / profit — aligned with app/api/orders/route.ts (orders list).
 * "Profit" in the list = margin minus VAT portion of margin (profit net of VAT).
 * Stored vat_rate applies when set (including 0); only null/empty falls back to category (air ticket / flight → 0%, else 21%).
 *
 * Commission-adjusted net cost (margin = client − (service_price − commission)) must match
 * `COMMISSION_PRICING_CATEGORIES` + airport-services rule in EditServiceModalNew.tsx — not only tour/package.
 */

export type ServiceEconomicsInput = {
  client_price?: unknown;
  service_price?: unknown;
  service_type?: string | null;
  category?: string | null;
  commission_amount?: unknown;
  vat_rate?: unknown;
  /** Per-passenger rows (flight); when top-level service_price is 0 but rows have cost, sums are used */
  pricing_per_client?: { cost?: unknown; sale?: unknown }[] | null;
};

function signed(s: ServiceEconomicsInput, field: "client_price" | "service_price"): number {
  const raw = field === "client_price" ? s.client_price : s.service_price;
  const v = Number(raw) || 0;
  return s.service_type === "cancellation" ? -Math.abs(v) : v;
}

function perClientRows(s: ServiceEconomicsInput): { cost?: unknown; sale?: unknown }[] | null {
  const raw =
    s.pricing_per_client ??
    (s as { pricingPerClient?: { cost?: unknown; sale?: unknown }[] | null }).pricingPerClient;
  return Array.isArray(raw) && raw.length > 0 ? raw : null;
}

function sumPerClientField(rows: { cost?: unknown; sale?: unknown }[], field: "cost" | "sale"): number {
  return rows.reduce((acc, p) => acc + (Math.abs(Number(field === "cost" ? p?.cost : p?.sale)) || 0), 0);
}

/**
 * For flight/air ticket with per-passenger pricing, DB sometimes has service_price=0 while rows hold cost.
 * Use row sums only when the stored aggregate is ~0 and the sum is positive.
 */
function effectiveSignedAmounts(s: ServiceEconomicsInput): { client: number; service: number } {
  const clientSigned = signed(s, "client_price");
  const serviceSigned = signed(s, "service_price");
  const rows = perClientRows(s);
  if (!rows) return { client: clientSigned, service: serviceSigned };
  const cat = (s.category || "").toLowerCase();
  const flightLike = cat.includes("flight") || cat.includes("air ticket");
  if (!flightLike) return { client: clientSigned, service: serviceSigned };
  const sumCost = sumPerClientField(rows, "cost");
  const sumSale = sumPerClientField(rows, "sale");
  const isCancellation = s.service_type === "cancellation";
  const storedServiceAbs = Math.abs(serviceSigned);
  const storedClientAbs = Math.abs(clientSigned);
  let effService = serviceSigned;
  let effClient = clientSigned;
  if (storedServiceAbs < 1e-9 && sumCost > 1e-9) {
    effService = isCancellation ? -sumCost : sumCost;
  }
  if (storedClientAbs < 1e-9 && sumSale > 1e-9) {
    effClient = isCancellation ? -sumSale : sumSale;
  }
  return { client: effClient, service: effService };
}

/**
 * Categories where service_price is gross supplier cost and commission_amount reduces net cost
 * (same intent as EditServiceModalNew `COMMISSION_PRICING_CATEGORIES` + isAirportServicesCategory).
 */
export function categoryUsesCommissionAdjustedNetCost(category: string | null | undefined): boolean {
  const c = (category || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (c.includes("tour") || c.includes("package")) return true;
  if (c.includes("insurance") || c.includes("страхов")) return true;
  if (c.includes("ancillary")) return true;
  if (c.includes("cruise")) return true;
  if (c.includes("rent a car") || c.includes("rent_a_car") || c.includes("car rental")) return true;
  if (c.includes("transfer")) return true;
  if (c.includes("airport") && c.includes("service")) return true;
  return false;
}

/**
 * VAT % on margin. Stored `vat_rate` wins when present (including 0 — flights / exempt).
 * If missing/null/empty, infer: flight-like categories → 0%, else default 21%.
 */
function resolveVatRatePercent(s: ServiceEconomicsInput): number {
  const raw = s.vat_rate;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const cat = (s.category || "").toLowerCase();
  if (cat.includes("flight") || cat.includes("air ticket")) return 0;
  return 21;
}

/**
 * @returns marginGross = client − cost (tour: sale − (cost − commission)); vatOnMargin extracted from margin when margin ≥ 0; profitNetOfVat = margin − vatOnMargin
 */
export function computeServiceLineEconomics(s: ServiceEconomicsInput): {
  clientSigned: number;
  serviceSigned: number;
  marginGross: number;
  vatOnMargin: number;
  profitNetOfVat: number;
} {
  const { client: clientPrice, service: servicePrice } = effectiveSignedAmounts(s);
  const cat = s.category;
  const useCommissionNetCost = categoryUsesCommissionAdjustedNetCost(cat);
  const vatRate = resolveVatRatePercent(s);

  let margin = 0;
  if (useCommissionNetCost) {
    const commission =
      s.service_type === "cancellation"
        ? -Math.abs(Number(s.commission_amount) || 0)
        : Number(s.commission_amount) || 0;
    margin = clientPrice - (servicePrice - commission);
  } else {
    margin = clientPrice - servicePrice;
  }

  const vatAmount =
    vatRate > 0 && margin >= 0 ? Math.round((margin * vatRate) / (100 + vatRate) * 100) / 100 : 0;
  const profitNetOfVat = margin - vatAmount;

  return {
    clientSigned: clientPrice,
    serviceSigned: servicePrice,
    marginGross: margin,
    vatOnMargin: vatAmount,
    profitNetOfVat,
  };
}
