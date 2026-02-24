/**
 * Format names for display (Title Case, preserve diacritics).
 * Used for parsed client/passenger names so "ZAKLINA RAVE" shows as "Zaklina Rave"
 * and "Žaklīna Rāve" stays "Žaklīna Rāve".
 */
export function toTitleCaseForDisplay(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}
