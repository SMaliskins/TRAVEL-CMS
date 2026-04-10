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

/**
 * For controlled cost/price fields while typing: keep partial decimals ("78.", "0.09").
 * Does not coerce to a number (unlike parseFloat in onChange), so the decimal point is not lost.
 * Allows digits and a single "."; strips other characters.
 */
export function sanitizeDecimalInput(value: string): string {
  let s = value.replace(/\s/g, "").replace(/,/g, ".");
  s = s.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  // "0144" → "144"; keep "0", "0.5", ".5" (empty int part before dot is unchanged)
  const fd = s.indexOf(".");
  const intPart = fd === -1 ? s : s.slice(0, fd);
  const rest = fd === -1 ? "" : s.slice(fd);
  if (intPart.length > 0 && intPart !== "0") {
    let norm = intPart.replace(/^0+(?=\d)/, "");
    if (norm === "" || /^0+$/.test(norm)) norm = "0";
    s = norm + rest;
  }
  return s;
}
