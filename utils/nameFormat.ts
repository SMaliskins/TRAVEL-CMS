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

const UND_LOCALE = "und";

/** True if any letter after the first code unit is uppercase (user intent, e.g. McDonald, Dins). */
function hasInteriorUppercaseLetter(s: string): boolean {
  const chars = [...s];
  if (chars.length <= 1) return false;
  return chars.slice(1).some((ch) => /\p{Lu}/u.test(ch));
}

/**
 * Normalize a single name segment (no spaces): ALL CAPS or all lower → Title case for that segment only.
 * If the segment already has mixed case (e.g. second part of double first name with capital), leave unchanged.
 */
function capitalizeUniformWordSegment(segment: string): string {
  if (!segment) return segment;
  if (hasInteriorUppercaseLetter(segment)) {
    return segment;
  }
  const lower = segment.toLocaleLowerCase(UND_LOCALE);
  const upper = segment.toLocaleUpperCase(UND_LOCALE);
  const isAllLower = segment === lower;
  const isAllUpper = segment === upper && /[\p{L}]/u.test(segment) && segment.length > 1;
  if (isAllLower || isAllUpper) {
    const first = segment.slice(0, 1);
    const rest = segment.slice(1);
    return first.toLocaleUpperCase(UND_LOCALE) + rest.toLocaleLowerCase(UND_LOCALE);
  }
  return segment;
}

/** Split on hyphens and apostrophes, normalize inner segments, rejoin (Jean-Pierre, O'Brien). */
function formatNameWordToken(token: string): string {
  if (!token) return token;
  if (token.includes("-")) {
    return token.split("-").map((t) => formatNameWordToken(t)).join("-");
  }
  if (token.includes("'")) {
    return token.split("'").map((t) => formatNameWordToken(t)).join("'");
  }
  return capitalizeUniformWordSegment(token);
}

/**
 * Normalize first/last name for DB: trim, collapse spaces, normalize per word.
 * Double first/last names (space-separated): each word is title-cased only if uniform case;
 * if the user already typed a capital after a space (e.g. "Ričards Dins"), that is preserved.
 */
export function formatNameForDb(name: string): string {
  if (!name || typeof name !== "string") return "";
  const s = name.trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s.split(/\s+/).map(formatNameWordToken).join(" ");
}
