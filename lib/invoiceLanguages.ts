/**
 * Invoice language options (value + label) for Settings and Invoice Creator.
 * Must match keys in lib/invoices/generateInvoiceHTML.ts INVOICE_LABELS.
 */
export const INVOICE_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "lv", label: "Latvian" },
  { value: "ru", label: "Russian" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
] as const;

export type InvoiceLanguageCode = (typeof INVOICE_LANGUAGE_OPTIONS)[number]["value"];

export function getInvoiceLanguageLabel(code: string): string {
  const found = INVOICE_LANGUAGE_OPTIONS.find((o) => o.value === code);
  return found ? found.label : code;
}

/** Filter options by search (label or value), exclude already selected codes */
export function filterInvoiceLanguageSuggestions(
  search: string,
  excludeCodes: string[]
): { value: string; label: string }[] {
  const q = search.trim().toLowerCase();
  if (!q) return INVOICE_LANGUAGE_OPTIONS.filter((o) => !excludeCodes.includes(o.value));
  return INVOICE_LANGUAGE_OPTIONS.filter(
    (o) =>
      !excludeCodes.includes(o.value) &&
      (o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
  );
}
