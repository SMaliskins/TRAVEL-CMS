/**
 * Phone formatting utilities for client card and directory.
 * Unified format: (+country) number — country code in parentheses, rest without spaces.
 * Works for any country, e.g. 371 72 27 2 7218 → (+371) 722727218, 49 30 12345678 → (+49) 3012345678.
 */

/** Common 3-digit country codes (EU, Baltic, etc.) */
const COUNTRY_CODES_3 = ["371", "372", "370", "358", "420", "421", "353", "352", "351", "357", "356", "355", "354", "30"];
/** Common 2-digit country codes */
const COUNTRY_CODES_2 = ["49", "48", "47", "46", "45", "44", "43", "42", "41", "39", "38", "36", "34", "33", "32", "31", "20"];
/** 1-digit: 1 (US/CA), 7 (RU) */
const COUNTRY_CODES_1 = ["1", "7"];

/**
 * Normalize phone for storage: (+CC) NNN... -> +CCNNN... (any country)
 * Removes spaces, formats as +CCNNN.
 */
export function normalizePhoneForSave(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.replace(/\s+/g, "").replace(/[()]/g, "").trim();
  if (!cleaned) return "";
  const { countryCode, nationalPart } = parsePhoneForDisplay(cleaned);
  if (countryCode) return `${countryCode}${nationalPart}`;
  return cleaned.startsWith("+") ? cleaned : cleaned;
}

/**
 * Parse phone into country code and national part.
 * Handles: digits with spaces, (+CC) NNN, +CCNNN (any country code)
 */
export function parsePhoneForDisplay(phone: string): {
  countryCode: string;
  nationalPart: string;
  fullForCopy: string;
} {
  if (!phone || typeof phone !== "string") {
    return { countryCode: "", nationalPart: "", fullForCopy: "" };
  }
  const cleaned = phone.replace(/\s+/g, "").replace(/[()]/g, "").trim();
  if (!cleaned) return { countryCode: "", nationalPart: "", fullForCopy: "" };

  // Already has + prefix
  const matchPlus = cleaned.match(/^\+(\d{1,3})(.*)$/);
  if (matchPlus) {
    const countryCode = `+${matchPlus[1]}`;
    const nationalPart = matchPlus[2];
    return { countryCode, nationalPart, fullForCopy: countryCode + nationalPart };
  }

  // No +: try to infer country code (3-digit, 2-digit, 1-digit)
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return { countryCode: "", nationalPart: cleaned, fullForCopy: cleaned };

  for (const code of COUNTRY_CODES_3) {
    if (digits.startsWith(code) && digits.length > code.length) {
      const nationalPart = digits.slice(code.length);
      const countryCode = `+${code}`;
      return { countryCode, nationalPart, fullForCopy: countryCode + nationalPart };
    }
  }
  for (const code of COUNTRY_CODES_2) {
    if (digits.startsWith(code) && digits.length > code.length + 5) {
      const nationalPart = digits.slice(code.length);
      const countryCode = `+${code}`;
      return { countryCode, nationalPart, fullForCopy: countryCode + nationalPart };
    }
  }
  for (const code of COUNTRY_CODES_1) {
    if (digits.startsWith(code) && digits.length > code.length + 5) {
      const nationalPart = digits.slice(code.length);
      const countryCode = `+${code}`;
      return { countryCode, nationalPart, fullForCopy: countryCode + nationalPart };
    }
  }

  return { countryCode: "", nationalPart: digits, fullForCopy: digits };
}

/**
 * Format phone for display: (+country) number (no spaces in number)
 */
export function formatPhoneForDisplay(phone: string): string {
  const { countryCode, nationalPart } = parsePhoneForDisplay(phone);
  if (!countryCode && !nationalPart) return "";
  if (countryCode) {
    return nationalPart ? `(${countryCode}) ${nationalPart}` : `(${countryCode})`;
  }
  return nationalPart;
}
