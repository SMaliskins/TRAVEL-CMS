/**
 * Format date to dd.mm.yyyy format
 * @param dateString - Date string (YYYY-MM-DD or ISO format)
 * @returns Formatted string like "15.03.2025" or "-" if invalid
 */
export function formatDateDDMMYYYY(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString + (dateString.includes("T") ? "" : "T00:00:00"));
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
}

/**
 * Format date to dd.mm format (e.g., "15.03")
 */
function formatDateDDMM(dateString: string): string {
  try {
    const date = new Date(dateString + (dateString.includes("T") ? "" : "T00:00:00"));
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  } catch {
    return "-";
  }
}

/**
 * Format date range for display (compact format: "15.03 — 22.03" or full: "15.03.2025 — 22.03.2025")
 * @param from - Start date in YYYY-MM-DD format
 * @param to - End date in YYYY-MM-DD format
 * @param full - If true, include year in format
 * @returns Formatted string like "15.03 — 22.03" or "Select range"
 */
export function formatDateRange(
  from: string | undefined,
  to: string | undefined,
  full: boolean = false
): string {
  if (!from && !to) {
    return "Select range";
  }

  if (full) {
    // Full format with year: "15.03.2025 — 22.03.2025"
    if (from && !to) {
      return `${formatDateDDMMYYYY(from)} — ...`;
    }
    if (from && to) {
      return `${formatDateDDMMYYYY(from)} — ${formatDateDDMMYYYY(to)}`;
    }
    return "Select range";
  }

  // Compact format: "15.03 — 22.03"
  if (from && !to) {
    return `${formatDateDDMM(from)} — ...`;
  }

  if (from && to) {
    return `${formatDateDDMM(from)} — ${formatDateDDMM(to)}`;
  }

  return "Select range";
}

