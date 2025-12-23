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
 * Format date to MMM DD format (e.g., "Mar 15")
 */
function formatDateMMMDD(dateString: string): string {
  try {
    const date = new Date(dateString + (dateString.includes("T") ? "" : "T00:00:00"));
    if (isNaN(date.getTime())) return "-";
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    return `${month} ${day}`;
  } catch {
    return "-";
  }
}

/**
 * Format date range for display (compact format: "Mar 15 — Mar 22" or "Mar 30 — Apr 2")
 * @param from - Start date in YYYY-MM-DD format
 * @param to - End date in YYYY-MM-DD format
 * @returns Formatted string like "Mar 15 — Mar 22" or "Mar 30 — Apr 2" or "Select range"
 */
export function formatDateRange(
  from: string | undefined,
  to: string | undefined
): string {
  if (!from && !to) {
    return "Select range";
  }

  if (from && !to) {
    return `${formatDateMMMDD(from)} — ...`;
  }

  if (from && to) {
    // Check if same month
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T00:00:00");
    const sameMonth = fromDate.getMonth() === toDate.getMonth() && fromDate.getFullYear() === toDate.getFullYear();
    
    if (sameMonth) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[fromDate.getMonth()];
      return `${month} ${fromDate.getDate()} — ${month} ${toDate.getDate()}`;
    } else {
      return `${formatDateMMMDD(from)} — ${formatDateMMMDD(to)}`;
    }
  }

  return "Select range";
}

