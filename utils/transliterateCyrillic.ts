/**
 * Transliterate Cyrillic (Ukrainian, Russian) to Latin.
 * Used for passport names - store only Latin script.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  // Ukrainian + Russian
  А: "A", а: "a", Б: "B", б: "b", В: "V", в: "v", Г: "G", г: "g",
  Ґ: "G", ґ: "g", Д: "D", д: "d", Е: "E", е: "e", Є: "Ye", є: "ye",
  Ж: "Zh", ж: "zh", З: "Z", з: "z", И: "Y", и: "y", І: "I", і: "i",
  Ї: "Yi", ї: "yi", Й: "Y", й: "y", К: "K", к: "k", Л: "L", л: "l",
  М: "M", м: "m", Н: "N", н: "n", О: "O", о: "o", П: "P", п: "p",
  Р: "R", р: "r", С: "S", с: "s", Т: "T", т: "t", У: "U", у: "u",
  Ф: "F", ф: "f", Х: "Kh", х: "kh", Ц: "Ts", ц: "ts", Ч: "Ch", ч: "ch",
  Ш: "Sh", ш: "sh", Щ: "Shch", щ: "shch", Ь: "'", ь: "'", Ю: "Yu", ю: "yu",
  Я: "Ya", я: "ya",
  // Russian specific
  Ы: "Y", ы: "y", Э: "E", э: "e", Ё: "Yo", ё: "yo",
};

/** Check if string contains Cyrillic characters */
export function hasCyrillic(str: string): boolean {
  return /[\u0400-\u04FF]/.test(str);
}

/** Transliterate Cyrillic to Latin. Non-Cyrillic chars pass through. */
export function transliterateCyrillicToLatin(str: string): string {
  if (!str) return str;
  return str
    .split("")
    .map((c) => CYRILLIC_TO_LATIN[c] ?? c)
    .join("");
}

/**
 * Extract Latin name from passport format "КИРИЛЛИЦА / LATIN".
 * Passports show both scripts separated by / — use the official Latin from the document.
 */
export function extractLatinFromPassportFormat(str: string | undefined): string | undefined {
  if (!str) return str;
  const trimmed = str.trim();
  if (!trimmed.includes("/")) return trimmed;
  const segments = trimmed.split("/").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (!hasCyrillic(seg)) return seg;
  }
  return transliterateCyrillicToLatin(segments[segments.length - 1] ?? trimmed);
}
