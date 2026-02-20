/**
 * Central date formatting utility.
 * Format is determined by company settings (Company Settings > Regional Settings > Date Format).
 * Supported patterns: 'dd.mm.yyyy' | 'mm.dd.yyyy' | 'yyyy-mm-dd'
 */

export type DateFormatPattern = 'dd.mm.yyyy' | 'mm.dd.yyyy' | 'yyyy-mm-dd';

let _globalDateFormat: DateFormatPattern = 'dd.mm.yyyy';

export function setGlobalDateFormat(pattern: DateFormatPattern) {
  _globalDateFormat = pattern;
}

export function getGlobalDateFormat(): DateFormatPattern {
  return _globalDateFormat;
}

function parseDateSafe(dateString: string): Date | null {
  try {
    const date = new Date(dateString + (dateString.includes("T") ? "" : "T00:00:00"));
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function parts(date: Date) {
  return {
    dd: String(date.getDate()).padStart(2, "0"),
    mm: String(date.getMonth() + 1).padStart(2, "0"),
    yyyy: String(date.getFullYear()),
  };
}

function applyPattern(date: Date, pattern: DateFormatPattern): string {
  const p = parts(date);
  switch (pattern) {
    case 'mm.dd.yyyy': return `${p.mm}.${p.dd}.${p.yyyy}`;
    case 'yyyy-mm-dd': return `${p.yyyy}-${p.mm}-${p.dd}`;
    case 'dd.mm.yyyy':
    default: return `${p.dd}.${p.mm}.${p.yyyy}`;
  }
}

function applyShortPattern(date: Date, pattern: DateFormatPattern): string {
  const p = parts(date);
  switch (pattern) {
    case 'mm.dd.yyyy': return `${p.mm}.${p.dd}`;
    case 'yyyy-mm-dd': return `${p.mm}-${p.dd}`;
    case 'dd.mm.yyyy':
    default: return `${p.dd}.${p.mm}`;
  }
}

/**
 * Format date according to company date format setting.
 * @param dateString - ISO date (YYYY-MM-DD or full ISO)
 * @param pattern - Override pattern (defaults to global company setting)
 */
export function formatDateDDMMYYYY(dateString?: string | null, pattern?: DateFormatPattern): string {
  if (!dateString) return "-";
  const date = parseDateSafe(dateString);
  if (!date) return "-";
  return applyPattern(date, pattern ?? _globalDateFormat);
}

export function formatDateShort(dateString: string, pattern?: DateFormatPattern): string {
  const date = parseDateSafe(dateString);
  if (!date) return "-";
  return applyShortPattern(date, pattern ?? _globalDateFormat);
}

/**
 * Format date range.
 * @param from - Start date
 * @param to - End date
 * @param full - Include year if true
 * @param pattern - Override pattern (defaults to global company setting)
 */
export function formatDateRange(
  from: string | undefined,
  to: string | undefined,
  full: boolean = false,
  pattern?: DateFormatPattern
): string {
  if (!from && !to) return "Select range";

  const fmt = pattern ?? _globalDateFormat;

  if (full) {
    if (from && !to) return `${formatDateDDMMYYYY(from, fmt)} — ...`;
    if (from && to) return `${formatDateDDMMYYYY(from, fmt)} — ${formatDateDDMMYYYY(to, fmt)}`;
    return "Select range";
  }

  if (from && !to) return `${formatDateShort(from, fmt)} — ...`;
  if (from && to) return `${formatDateShort(from, fmt)} — ${formatDateShort(to, fmt)}`;
  return "Select range";
}
