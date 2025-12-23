/**
 * Get GMT offset label for a timezone (e.g., "GMT+2", "GMT-5", "GMT+0")
 * @param timeZone - IANA timezone string (e.g., "Europe/Riga")
 * @param date - Date to calculate offset for (defaults to now)
 * @returns GMT offset label string
 */
export function getGmtOffsetLabel(timeZone: string, date: Date = new Date()): string {
  try {
    // Create formatters for UTC and the target timezone
    const utcFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const tzFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    // Get time parts in both timezones
    const utcParts = utcFormatter.formatToParts(date);
    const tzParts = tzFormatter.formatToParts(date);

    const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

    // Calculate total minutes from midnight
    const utcHour = getPart(utcParts, "hour");
    const utcMinute = getPart(utcParts, "minute");
    const utcSecond = getPart(utcParts, "second");
    const utcTotalMinutes = utcHour * 60 + utcMinute + utcSecond / 60;

    const tzHour = getPart(tzParts, "hour");
    const tzMinute = getPart(tzParts, "minute");
    const tzSecond = getPart(tzParts, "second");
    const tzTotalMinutes = tzHour * 60 + tzMinute + tzSecond / 60;

    // Calculate difference (timezone time - UTC time)
    let diffMinutes = tzTotalMinutes - utcTotalMinutes;

    // Handle day boundary (if difference is > 12 hours, likely next/prev day)
    if (diffMinutes > 12 * 60) {
      diffMinutes -= 24 * 60;
    } else if (diffMinutes < -12 * 60) {
      diffMinutes += 24 * 60;
    }

    // Convert to hours (rounded)
    const offsetHours = Math.round(diffMinutes / 60);

    // Format as GMT±H
    const sign = offsetHours >= 0 ? "+" : "-";
    const absHours = Math.abs(offsetHours);

    return `GMT${sign}${absHours}`;
  } catch (e) {
    console.error("Failed to calculate GMT offset", e);
    return "GMT+0";
  }
}

