/**
 * Parse passport MRZ (Machine Readable Zone) without AI.
 * Uses ICAO 9303 standard - works for all passports (EU, US, UK, Ukrainian, etc.)
 */

import { parse } from "mrz";

export interface PassportDataFromMrz {
  passportNumber?: string;
  passportIssueDate?: string; // YYYY-MM-DD - not in MRZ, leave empty
  passportExpiryDate?: string; // YYYY-MM-DD
  passportIssuingCountry?: string;
  passportFullName?: string;
  firstName?: string;
  lastName?: string;
  dob?: string; // YYYY-MM-DD
  nationality?: string;
  /** male | female — from MRZ line 2 position 15 (M/F) */
  gender?: string;
}

/** First letter of each word uppercase, rest lowercase; preserves diacritics (Rāvis, Žaklīna). */
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

/** MRZ uses 3-letter ISO codes; map to full country name (same as Issuing Country / Nationality list) */
const MRZ_COUNTRY_TO_NAME: Record<string, string> = {
  LVA: "Latvia", EST: "Estonia", LTU: "Lithuania", USA: "United States", GBR: "United Kingdom",
  UKR: "Ukraine", RUS: "Russia", DEU: "Germany", FRA: "France", POL: "Poland", LV: "Latvia", EE: "Estonia", LT: "Lithuania", US: "United States", GB: "United Kingdom", UA: "Ukraine", RU: "Russia", DE: "Germany", FR: "France", PL: "Poland",
};

function codeToCountryName(code: string | undefined): string | undefined {
  if (!code || !code.trim()) return undefined;
  const c = code.trim().toUpperCase();
  return MRZ_COUNTRY_TO_NAME[c] || code;
}

/**
 * Convert YYMMDD (MRZ format) to YYYY-MM-DD
 */
function mrzDateToIso(mrzDate: string | null | undefined): string | undefined {
  if (!mrzDate || mrzDate.length < 6) return undefined;
  const yy = parseInt(mrzDate.slice(0, 2), 10);
  const mm = mrzDate.slice(2, 4);
  const dd = mrzDate.slice(4, 6);
  if (mm === "00" || dd === "00") return undefined;
  // YY: 00-30 -> 2000-2030, 31-99 -> 1931-1999 (for birth dates)
  const century = yy <= 30 ? 2000 : 1900;
  const year = century + yy;
  return `${year}-${mm}-${dd}`;
}

/**
 * Extract MRZ lines from full PDF/text content.
 * PDF text may have extra content, different line breaks, or spaces.
 * TD3 passport: 2 lines of 44 chars each, line 1 starts with P<
 */
function extractMrzLinesFromText(text: string): string[] | null {
  // Remove all whitespace to get continuous MRZ-like string
  const noSpaces = text.replace(/\s/g, "");
  // MRZ uses only A-Z, 0-9, <
  const mrzOnly = noSpaces.replace(/[^A-Z0-9<]/gi, "");
  const upper = mrzOnly.toUpperCase();

  // Find P< (passport) or I< (ID) - start of TD3 line 1
  const pIdx = upper.indexOf("P<");
  const iIdx = upper.indexOf("I<");
  const idx = pIdx >= 0 ? pIdx : iIdx >= 0 ? iIdx : -1;
  if (idx < 0) return null;
  const fromStart = upper.slice(idx);

  // Need 88 chars (44+44) for 2 MRZ lines
  if (fromStart.length < 88) return null;

  const line1 = fromStart.slice(0, 44);
  const line2 = fromStart.slice(44, 88);

  // Validate: both lines should be MRZ format (alphanumeric + <)
  if (!/^[A-Z0-9<]{44}$/.test(line1) || !/^[A-Z0-9<]{44}$/.test(line2)) return null;

  return [line1, line2];
}

/**
 * Normalize MRZ input: split by newlines, trim, ensure correct line lengths (44 for TD3 passport)
 */
function normalizeMrzLines(text: string): string[] {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim().replace(/\s+/g, ""))
    .filter((l) => l.length >= 30);
  // TD3 passport: 44 chars per line
  return lines.map((l) => (l.length > 44 ? l.slice(0, 44) : l));
}

/**
 * Parse MRZ text (2 lines for passport TD3) and return passport data.
 * Handles: direct paste of 2 lines, or full PDF text with MRZ embedded.
 * Returns null if input is not valid MRZ format.
 */
export function parseMrzToPassportData(text: string): PassportDataFromMrz | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try 1: Direct paste (2 lines)
  const lines = normalizeMrzLines(trimmed);
  if (lines.length >= 2) {
    const result = tryParseMrz(lines);
    if (result) return result;
  }

  // Try 2: Extract MRZ from full PDF text (P<... continuous or embedded)
  const extracted = extractMrzLinesFromText(trimmed);
  if (extracted) {
    const result = tryParseMrz(extracted);
    if (result) return result;
  }

  return null;
}

function tryParseMrz(lines: string[]): PassportDataFromMrz | null {
  if (!lines || lines.length < 2) return null;
  try {
    const result = parse(lines, { autocorrect: true }) as unknown as Record<string, unknown>;
    const fields = (result.fields ?? result) as Record<string, string | null | undefined>;
    const documentNumber = (fields.documentNumber ?? result.documentNumber) as string | undefined;
    let lastName = ((fields.lastName ?? fields.surname ?? result.lastName) as string | undefined)
      ?.replace(/<+/g, " ")
      .trim();
    let firstName = ((fields.firstName ?? fields.names ?? result.firstName) as string | undefined)
      ?.replace(/<+/g, " ")
      .trim();
    const birthDate = (fields.birthDate ?? result.birthDate) as string | undefined;
    const expirationDate = (fields.expirationDate ?? fields.expiryDate ?? result.expirationDate) as string | undefined;
    const nationality = (fields.nationality ?? result.nationality) as string | undefined;
    const issuingState = (fields.issuingState ?? fields.issuingCountry ?? result.issuingState) as string | undefined;

    if (!documentNumber && !lastName && !firstName) return null;

    if (firstName) firstName = toTitleCase(firstName);
    if (lastName) lastName = toTitleCase(lastName);
    const passportFullName = [lastName, firstName].filter(Boolean).join(" ") || undefined;

    // MRZ TD3 line 2: position 15 (0-based) is sex: M, F or <
    let gender: string | undefined;
    const line2 = lines[1];
    if (line2 && line2.length > 15) {
      const sexChar = line2.charAt(15).toUpperCase();
      if (sexChar === "M") gender = "male";
      else if (sexChar === "F") gender = "female";
    }

    return {
      passportNumber: documentNumber || undefined,
      passportExpiryDate: mrzDateToIso(expirationDate),
      passportIssuingCountry: codeToCountryName(issuingState) || undefined,
      passportFullName: passportFullName || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      dob: mrzDateToIso(birthDate),
      nationality: codeToCountryName(nationality) || undefined,
      gender,
    };
  } catch {
    return null;
  }
}
