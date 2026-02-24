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

/**
 * Parse display date string (e.g. "24.02.2026" or "2026-02-24") to ISO YYYY-MM-DD.
 * Uses pattern for dd.mm.yyyy / mm.dd.yyyy / yyyy-mm-dd.
 */
export function parseDisplayToIso(display: string, pattern?: DateFormatPattern): string | null {
  const fmt = pattern ?? _globalDateFormat;
  const sep = fmt === "yyyy-mm-dd" ? "-" : ".";
  const parts = display.trim().split(sep).map((p) => p.trim());
  if (parts.length !== 3) return null;
  let d: string, m: string, y: string;
  if (fmt === "dd.mm.yyyy") [d, m, y] = parts;
  else if (fmt === "mm.dd.yyyy") [m, d, y] = parts;
  else [y, m, d] = parts;
  if (y.length === 4 && d.length >= 1 && d.length <= 2 && m.length >= 1 && m.length <= 2) {
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const date = parseDateSafe(iso);
    return date ? iso : null;
  }
  return null;
}

/**
 * For a flight segment: if arrival date has same MM-DD as departure but different (wrong) year,
 * return arrival date with departure's year (YYYY-MM-DD). Fixes AI/parsing returning e.g. 2024 for arrival when departure is 2026.
 */
export function segmentDisplayArrivalDate(seg: { departureDate?: string; arrivalDate?: string }): string {
  const dep = seg.departureDate || "";
  const arr = seg.arrivalDate || dep;
  if (!dep || !arr || dep.length < 10 || arr.length < 10) return arr;
  const depY = dep.slice(0, 4), depMD = dep.slice(5, 10);
  const arrY = arr.slice(0, 4), arrMD = arr.slice(5, 10);
  if (arrMD === depMD && arrY !== depY) return `${depY}-${arrMD}`;
  return arr;
}

/** Normalize segment so arrivalDate uses departure year when same MM-DD (fixes Schedule display and saved data). */
export function normalizeSegmentArrivalYear<T extends { departureDate?: string; arrivalDate?: string }>(seg: T): T {
  const fixed = segmentDisplayArrivalDate(seg);
  if (fixed === (seg.arrivalDate || seg.departureDate || "")) return seg;
  return { ...seg, arrivalDate: fixed };
}

/** If date has same MM-DD as ref (YYYY-MM-DD) but different year, return ref's year + MM-DD. */
function applyYearFromRef(date: string, ref: string): string {
  if (!date || !ref || date.length < 10 || ref.length < 10) return date;
  const refY = ref.slice(0, 4), refMD = ref.slice(5, 10);
  const dateMD = date.slice(5, 10);
  if (dateMD === refMD && date.slice(0, 4) !== refY) return `${refY}-${dateMD}`;
  return date;
}

/**
 * Normalize segment dates using calendar range (dateFrom, dateTo) so Schedule shows correct year.
 * When segment's MM-DD matches dateFrom or dateTo, use that ref's year (fixes 2024 stuck when calendar is 2026).
 */
export function normalizeSegmentWithCalendar<T extends { departureDate?: string; arrivalDate?: string }>(
  seg: T,
  dateFrom?: string | null,
  dateTo?: string | null
): T {
  let dep = seg.departureDate || "";
  let arr = seg.arrivalDate || seg.departureDate || "";
  if (dateFrom && dateFrom.length >= 10) {
    dep = applyYearFromRef(dep, dateFrom);
    arr = applyYearFromRef(arr, dateFrom);
  }
  if (dateTo && dateTo.length >= 10) {
    dep = applyYearFromRef(dep, dateTo);
    arr = applyYearFromRef(arr, dateTo);
  }
  // same-day fix: arrival year = departure year when same MM-DD
  if (dep && arr && dep.length >= 10 && arr.length >= 10) {
    const depY = dep.slice(0, 4), depMD = dep.slice(5, 10);
    const arrMD = arr.slice(5, 10);
    if (arrMD === depMD && arr.slice(0, 4) !== depY) arr = `${depY}-${arrMD}`;
  }
  const out = { ...seg, departureDate: dep || seg.departureDate, arrivalDate: arr || seg.arrivalDate };
  return out as T;
}

/** Normalize array of segments (each arrivalDate aligned to departure year when same day). */
export function normalizeSegmentsArrivalYear<T extends { departureDate?: string; arrivalDate?: string }>(segments: T[]): T[] {
  return segments.map(normalizeSegmentArrivalYear);
}

/** Normalize segments using calendar dateFrom/dateTo so all segment years match the calendar (fixes 27.03.2024 → 27.03.2026). */
export function normalizeSegmentsWithCalendar<T extends { departureDate?: string; arrivalDate?: string }>(
  segments: T[],
  dateFrom?: string | null,
  dateTo?: string | null
): T[] {
  if (!dateFrom && !dateTo) return segments.map(normalizeSegmentArrivalYear);
  return segments.map(seg => normalizeSegmentWithCalendar(seg, dateFrom, dateTo));
}
