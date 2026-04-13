/**
 * Default VAT % for Pricing from Travel Service category (company settings).
 * Flight keeps 0%; tour with 0 in DB → 21%; missing rate → flight 0%, else 21%.
 */
export function vatRateFromCategory(matched: {
  type?: string | null;
  vat_rate?: number | null;
  vatRate?: number | null;
}): number {
  const raw = matched.vat_rate ?? matched.vatRate;
  const typeLower = String(matched.type ?? "other").toLowerCase();
  const isTour = typeLower === "tour";
  const isFlight = typeLower === "flight";
  const n = raw == null || raw === "" ? NaN : Number(raw);
  if (Number.isFinite(n)) {
    if (isTour && n === 0) return 21;
    return n;
  }
  return isFlight ? 0 : 21;
}
