/**
 * Currency formatting for project display.
 * Use company default_currency (Settings → Company) so when user sets USD, all relevant UI shows USD.
 */

const SYMBOL_MAP: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  JPY: "¥",
  CNY: "¥",
  AED: "AED",
  CAD: "CA$",
  PLN: "zł",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  TRY: "₺",
};

/**
 * Get display symbol for currency code (e.g. EUR → €, USD → $).
 * Falls back to code if unknown.
 */
export function getCurrencySymbol(code: string): string {
  const c = (code || "EUR").toUpperCase();
  return SYMBOL_MAP[c] ?? c;
}

/**
 * Format amount with currency symbol/code.
 * Uses en-US number format; currency is from company default_currency.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = "EUR"
): string {
  const absAmount = Math.abs(amount);
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = `${symbol}${absAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return amount < 0 ? `-${formatted}` : formatted;
}
