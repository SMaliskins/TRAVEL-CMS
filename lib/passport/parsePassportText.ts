/**
 * Parse passport data from PDF text using regex patterns.
 * NO AI - pure regex matching for common passport formats.
 * Supports: Ukrainian, Latvian, Russian, EU passports.
 */

export interface PassportData {
  passportNumber?: string;
  passportIssueDate?: string; // YYYY-MM-DD
  passportExpiryDate?: string; // YYYY-MM-DD
  passportIssuingCountry?: string;
  passportFullName?: string;
  firstName?: string;
  lastName?: string;
  dob?: string; // YYYY-MM-DD
  nationality?: string;
  personalCode?: string; // Record No / РНОКПП (Ukrainian tax ID)
  avatarUrl?: string; // Photo extracted from passport
  /** male | female — from passport Sex/Gender field or MRZ */
  gender?: string;
}

// Country name <-> code mapping (for parsing and returning full name)
const COUNTRY_CODES: Record<string, string> = {
  ukraine: "UA", україна: "UA", ukr: "UA", ua: "UA",
  latvia: "LV", latvija: "LV", lva: "LV", lv: "LV",
  russia: "RU", россия: "RU", rus: "RU", ru: "RU",
  germany: "DE", deutschland: "DE", deu: "DE", de: "DE",
  france: "FR", fra: "FR", fr: "FR",
  usa: "US", "united states": "US", us: "US",
  uk: "GB", "united kingdom": "GB", gbr: "GB", gb: "GB",
  poland: "PL", polska: "PL", pol: "PL", pl: "PL",
  lithuania: "LT", lietuva: "LT", ltu: "LT", lt: "LT",
  estonia: "EE", eesti: "EE", est: "EE", ee: "EE",
};

const CODE_TO_NAME: Record<string, string> = {
  UA: "Ukraine", LV: "Latvia", RU: "Russia", DE: "Germany", FR: "France",
  US: "United States", GB: "United Kingdom", PL: "Poland", LT: "Lithuania", EE: "Estonia",
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  // Ukrainian abbreviations
  січ: "01", лют: "02", бер: "03", кві: "04", тра: "05", чер: "06",
  лип: "07", сер: "08", вер: "09", жов: "10", лис: "11", гру: "12",
};

/** Convert 2-digit year to 4-digit: 76->1976, 18->2018, 28->2028 */
function yyToYyyy(yy: number): number {
  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

/**
 * Parse date from various formats to YYYY-MM-DD
 * Ukrainian passport: 07 ЛЮТ/FEB 18, 08 ТРА/MAY 76
 */
function parseDate(str: string): string | undefined {
  if (!str) return undefined;
  
  // DD.MM.YYYY or DD/MM/YYYY
  let m = str.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  
  // YYYY-MM-DD
  m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  
  // DD MMM YYYY (e.g., 15 Jan 2020)
  m = str.match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i);
  if (m) {
    const [, d, mon, y] = m;
    const mo = MONTHS[mon.toLowerCase()];
    if (mo) return `${y}-${mo}-${d.padStart(2, "0")}`;
  }
  
  // Ukrainian passport: DD УКР/ENG YY (08 СІЧ/JAN 80, 07 ЛЮТ/FEB 18)
  m = str.match(/(\d{1,2})\s+[^\s\/]*\/([A-Za-z]{3})\s+(\d{2})\b/i);
  if (m) {
    const [, d, monEn, yy] = m;
    const mo = MONTHS[monEn.toLowerCase()];
    if (mo) {
      const yyyy = yyToYyyy(parseInt(yy, 10));
      return `${yyyy}-${mo}-${d.padStart(2, "0")}`;
    }
  }
  
  // Fallback: DD MONTH YY without slash
  m = str.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})\b/i);
  if (m) {
    const [, d, monEn, yy] = m;
    const mo = MONTHS[monEn.toLowerCase()];
    if (mo) {
      const yyyy = yyToYyyy(parseInt(yy, 10));
      return `${yyyy}-${mo}-${d.padStart(2, "0")}`;
    }
  }
  
  return undefined;
}

/**
 * Extract passport number (alphanumeric, 6-9 chars)
 */
function extractPassportNumber(text: string): string | undefined {
  const patterns = [
    /(?:passport\s*(?:no|number|№)?[:\s]*)?([A-Z]{2}\d{6,7})/i,
    /(?:document\s*(?:no|number|№)?[:\s]*)?([A-Z]{1,2}\d{6,8})/i,
    /(?:номер[:\s]*)?([A-Z]{2}\d{6,7})/i,
    /\b([A-Z]{2}\d{6,7})\b/,
    /\b([A-Z]{1,2}\d{6,8})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return undefined;
}

/**
 * Extract Latin name from "КИРИЛЛИЦА/LATIN" format
 */
function extractLatinPart(value: string): string {
  if (!value) return "";
  if (value.includes("/")) {
    return value.split("/").pop()?.trim() || "";
  }
  return value.trim();
}

/** First letter of each word uppercase, rest lowercase; preserves diacritics (Rāvis, Žaklīna). */
function toTitleCase(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

/**
 * Extract name (surname + given names) - ENGLISH/LATIN only
 */
function extractNames(text: string): { firstName?: string; lastName?: string; fullName?: string } {
  let firstName: string | undefined;
  let lastName: string | undefined;

  const surnameMatch = text.match(/Surname[^\p{L}]*([\p{L}'\-]+(?:\/[\p{L}'\-]+)?)/u);
  if (surnameMatch) {
    lastName = extractLatinPart(surnameMatch[1]);
  }

  const givenMatch = text.match(/Given\s*names?[^\p{L}]*([\p{L}'\-]+(?:\/[\p{L}'\-]+)?)/u);
  if (givenMatch) {
    firstName = extractLatinPart(givenMatch[1]);
  }

  /** Keep Unicode letters (e.g. ā, ž, ī) — do not strip diacritics */
  firstName = firstName?.replace(/[^\p{L}'\s-]/gu, "").trim() || undefined;
  lastName = lastName?.replace(/[^\p{L}'\s-]/gu, "").trim() || undefined;

  if (!lastName || !firstName) {
    const mrzMatch = text.match(/([A-Z]+)<<([A-Z]+)/);
    if (mrzMatch) {
      if (!lastName) lastName = mrzMatch[1];
      if (!firstName) firstName = mrzMatch[2].replace(/<+/g, " ").trim();
    }
  }

  // Title case: first letter uppercase, rest lowercase
  if (firstName) firstName = toTitleCase(firstName);
  if (lastName) lastName = toTitleCase(lastName);

  const fullName = [lastName, firstName].filter(Boolean).join(" ") || undefined;
  return { firstName, lastName, fullName };
}

/**
 * Extract dates (DOB, issue, expiry) - by reading labels from text
 */
function extractDates(text: string): { dob?: string; issueDate?: string; expiryDate?: string } {
  let dob: string | undefined;
  let issueDate: string | undefined;
  let expiryDate: string | undefined;

  const datePattern = `(\\d{1,2}\\s+[^\\s\\/]*\\/[A-Za-z]{3}\\s+\\d{2}|\\d{1,2}\\s+[A-Za-z]{3}\\s+\\d{2}|\\d{1,2}[.\\/]\\d{1,2}[.\\/]\\d{4})`;

  const dobPatterns = [
    new RegExp(`Date\\s*of\\s*birth[^\\d]*${datePattern}`, "i"),
    new RegExp(`[Дд]ата\\s*народження[^\\d]*${datePattern}`, "i"),
    new RegExp(`DOB[^\\d]*${datePattern}`, "i"),
    new RegExp(`Birth[^\\d]*${datePattern}`, "i"),
  ];
  for (const p of dobPatterns) {
    const m = text.match(p);
    if (m) {
      dob = parseDate(m[1]);
      if (dob) break;
    }
  }

  const datePatternDot = "(\\d{1,2}[.\\/]\\d{1,2}[.\\/]\\d{4})";
  const issuePatterns = [
    new RegExp(`Date\\s*of\\s*issue[^\\d]*${datePattern}`, "i"),
    new RegExp(`[Дд]ата\\s*видач[іi][^\\d]*${datePattern}`, "i"),
    new RegExp(`Issue\\s*date[^\\d]*${datePattern}`, "i"),
    new RegExp(`Issued[^\\d]*${datePattern}`, "i"),
    new RegExp(`Izdošanas\\s*datums[^\\d]*${datePatternDot}`, "i"),
    new RegExp(`(?:Date of issue|Issue date)[^\\d]*${datePatternDot}`, "i"),
    new RegExp(`${datePatternDot}[^\\d]*(?:Date of issue|Issue date)`, "i"),
    new RegExp(`${datePatternDot}[^\\d]{0,30}(?:issue|izdošanas)`, "i"),
  ];
  for (const p of issuePatterns) {
    const m = text.match(p);
    if (m) {
      issueDate = parseDate(m[1]);
      if (issueDate) break;
    }
  }

  const expiryPatterns = [
    new RegExp(`Date\\s*of\\s*expiry[^\\d]*${datePattern}`, "i"),
    new RegExp(`[Дд]ата\\s*зак[іi]нчення[^\\d]*${datePattern}`, "i"),
    new RegExp(`Expiry\\s*date[^\\d]*${datePattern}`, "i"),
    new RegExp(`Expires[^\\d]*${datePattern}`, "i"),
    new RegExp(`Valid\\s*until[^\\d]*${datePattern}`, "i"),
    new RegExp(`Derīgums\\s*līdz[^\\d]*${datePatternDot}`, "i"),
    new RegExp(`(?:Date of expiry|Expiry date)[^\\d]*${datePatternDot}`, "i"),
    new RegExp(`${datePatternDot}[^\\d]*(?:Date of expiry|Expiry date)`, "i"),
    new RegExp(`${datePatternDot}[^\\d]{0,30}(?:expiry|derīgums)`, "i"),
  ];
  for (const p of expiryPatterns) {
    const m = text.match(p);
    if (m) {
      expiryDate = parseDate(m[1]);
      if (expiryDate) break;
    }
  }

  return { dob, issueDate, expiryDate };
}

/**
 * Extract Record No / Personal Code (Ukrainian)
 */
function extractPersonalCode(text: string): string | undefined {
  const labelPatterns = [
    /(?:Record\s*No\.?|Запис\s*[N№]?\.?\/?)\s*(\d{8}-\d{5})/i,
    /(?:Record\s*No\.?|Запис\s*[N№]?\.?\/?)\s*(\d{10})/i,
    /(?:Record\s*No\.?|Запис\s*[N№]?\.?\/?)[\s\S]*?(\d{8}-\d{5})/i,
    /(?:Record\s*No\.?|Запис\s*[N№]?\.?\/?)[\s\S]*?(\d{10})/i,
  ];
  for (const p of labelPatterns) {
    const m = text.match(p);
    if (m) return m[1].replace(/\s/g, "");
  }
  
  const codeMatch = text.match(/(\d{8}-\d{5})/);
  if (codeMatch && /Surname|Given|Record|Запис|Passport/i.test(text)) {
    return codeMatch[1];
  }
  
  const tenDigit = text.match(/(?:Record\s*No\.?|Запис\s*[N№]?\.?\/?)[\s\S]*?(\d{10})/i);
  if (tenDigit) return tenDigit[1];
  
  return undefined;
}

/**
 * Extract country/nationality. Returns full country name (for statistics), not code.
 */
function extractCountry(text: string): { country?: string; nationality?: string } {
  let code: string | undefined;
  let nationality: string | undefined;

  const lowerText = text.toLowerCase();

  for (const [name, c] of Object.entries(COUNTRY_CODES)) {
    if (lowerText.includes(name)) {
      code = c;
      break;
    }
  }

  const natMatch = text.match(/(?:nationality|громадянство|гражданство|pilsonība)[:\s]+([A-Za-zА-Яа-яІіЇїЄє]+)/i);
  if (natMatch) {
    const natLower = natMatch[1].toLowerCase();
    const natCode = COUNTRY_CODES[natLower] || natMatch[1].toUpperCase().slice(0, 2);
    nationality = CODE_TO_NAME[natCode] || natMatch[1].trim();
  }

  const codeMatch = text.match(/\b(UKR|LVA|RUS|DEU|FRA|USA|GBR|POL|LTU|EST)\b/);
  if (codeMatch && !code) {
    const map: Record<string, string> = { UKR: "UA", LVA: "LV", RUS: "RU", DEU: "DE", FRA: "FR", USA: "US", GBR: "GB", POL: "PL", LTU: "LT", EST: "EE" };
    code = map[codeMatch[1]] || codeMatch[1];
  }
  const country = code ? (CODE_TO_NAME[code] || code) : undefined;
  return { country, nationality: nationality || country };
}

/**
 * Extract gender from passport text. Returns "male" | "female" or undefined.
 * Labels: Sex, Gender, Dzimums (LV), Стать (UA), etc.
 */
function extractGender(text: string): string | undefined {
  const t = text.replace(/\s+/g, " ").trim();
  // After Sex/Gender/Dzimums/Стать: M or F
  const mfAfterLabel = t.match(/(?:Sex|Gender|Dzimums|Стать|Пол)[:\s]*([MF])\b/i);
  if (mfAfterLabel) return mfAfterLabel[1].toUpperCase() === "M" ? "male" : "female";
  // Male/Female or Latvian Vīrietis/Sieviete or Ukrainian
  if (/\b(Female|Sieviete|Жін\.?|Жінка)\b/i.test(t)) return "female";
  if (/\b(Male|Vīrietis|Чол\.?|Чоловік)\b/i.test(t)) return "male";
  // Standalone M or F (e.g. in a table)
  const mf = t.match(/\b([MF])\s*(?:\/|\.|,|\s|$)/);
  if (mf) return mf[1].toUpperCase() === "M" ? "male" : "female";
  return undefined;
}

/**
 * Parse passport data from PDF text content.
 */
export function parsePassportFromText(text: string): PassportData | null {
  if (!text || text.trim().length < 20) return null;

  const passportNumber = extractPassportNumber(text);
  let { firstName, lastName, fullName } = extractNames(text);
  let { dob, issueDate, expiryDate } = extractDates(text);
  const { country, nationality } = extractCountry(text);
  const personalCode = extractPersonalCode(text);
  const gender = extractGender(text);

  // When we only have fullName (e.g. "RAVIS GUNTIS"), split into firstName and lastName with title case
  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.trim().split(/\s+/).map((p) => toTitleCase(p));
    if (parts.length >= 2) {
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
      fullName = [firstName, lastName].join(" ");
    } else {
      fullName = toTitleCase(fullName);
    }
  } else if (fullName) {
    fullName = toTitleCase(fullName);
  }

  // Fallback: DOB from personalCode 19800108-00720
  if (!dob && personalCode && /^\d{8}-\d{5}$/.test(personalCode)) {
    const yyyy = personalCode.slice(0, 4);
    const mm = personalCode.slice(4, 6);
    const dd = personalCode.slice(6, 8);
    if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
      dob = `${yyyy}-${mm}-${dd}`;
    }
  }

  if (!passportNumber && !fullName) return null;

  return {
    passportNumber,
    passportIssueDate: issueDate,
    passportExpiryDate: expiryDate,
    passportIssuingCountry: country,
    passportFullName: fullName,
    firstName,
    lastName,
    dob,
    nationality,
    personalCode,
    gender,
  };
}
