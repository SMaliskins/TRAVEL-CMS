/**
 * Service-line margin / VAT / profit — aligned with app/api/orders/route.ts (orders list).
 * "Profit" in the list = margin minus VAT portion of margin (profit net of VAT).
 * Stored vat_rate applies when set (including 0); only null/empty falls back to category (air ticket / flight → 0%, else 21%).
 */

export type ServiceEconomicsInput = {
  client_price?: unknown;
  service_price?: unknown;
  service_type?: string | null;
  category?: string | null;
  commission_amount?: unknown;
  vat_rate?: unknown;
};

function signed(s: ServiceEconomicsInput, field: "client_price" | "service_price"): number {
  const raw = field === "client_price" ? s.client_price : s.service_price;
  const v = Number(raw) || 0;
  return s.service_type === "cancellation" ? -Math.abs(v) : v;
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
  const clientPrice = signed(s, "client_price");
  const servicePrice = signed(s, "service_price");
  const cat = (s.category || "").toLowerCase();
  const isTour = cat.includes("tour") || cat.includes("package");
  const vatRate = resolveVatRatePercent(s);

  let margin = 0;
  if (isTour && s.commission_amount != null) {
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
