/**
 * Sanitize numeric input: strip spaces, replace commas with dots.
 * Use in onChange handlers for all financial/numeric input fields.
 *
 * Examples:
 *   "112,12"   → "112.12"
 *   "3 442"    → "3442"
 *   "112.12 "  → "112.12"
 *   " 1 000,50 " → "1000.50"
 */
export function sanitizeNumber(value: string): string {
  return value.replace(/\s/g, "").replace(/,/g, ".");
}
