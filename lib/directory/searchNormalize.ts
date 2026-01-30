/**
 * Directory search normalization: diacritics, keyboard layout, name variants
 * Used for DIR3: Search improvements
 */

// Diacritics → ASCII (Latvian, Lithuanian, Polish, etc.)
const DIACRITIC_MAP: Record<string, string> = {
  ā: "a", Ā: "A", ē: "e", Ē: "E", ī: "i", Ī: "I", ū: "u", Ū: "U", ō: "o", Ō: "O",
  ķ: "k", Ķ: "K", ļ: "l", Ļ: "L", ņ: "n", Ņ: "N", ģ: "g", Ģ: "G",
  č: "c", Č: "C", š: "s", Š: "S", ž: "z", Ž: "Z",
  ą: "a", Ą: "A", ę: "e", Ę: "E", į: "i", Į: "I", ų: "u", Ų: "U", ń: "n", Ń: "N",
  ł: "l", Ł: "L", ś: "s", Ś: "S", ź: "z", Ź: "Z", ż: "z", Ż: "Z",
  ë: "e", ï: "i", ü: "u", ö: "o", ä: "a", ÿ: "y",
  ß: "ss", ñ: "n", ç: "c",
};

// Cyrillic → Latin (Russian/Latvian keyboard layout - user types Latin, DB may have Cyrillic or vice versa)
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "ju", я: "ja",
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z",
  И: "I", Й: "J", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R",
  С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "Ch", Ш: "Sh", Щ: "Sch",
  Ы: "Y", Э: "E", Ю: "Ju", Я: "Ja",
};

// Latin → Cyrillic (reverse layout - user typed in wrong layout)
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: "а", b: "б", c: "ц", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "й",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т",
  u: "у", v: "в", w: "в", x: "х", y: "ы", z: "з",
  A: "А", B: "Б", C: "Ц", D: "Д", E: "Е", F: "Ф", G: "Г", H: "Х", I: "И", J: "Й",
  K: "К", L: "Л", M: "М", N: "Н", O: "О", P: "П", R: "Р", S: "С", T: "Т",
  U: "У", V: "В", W: "В", X: "Х", Y: "Ы", Z: "З",
};

// Common name spelling variants (query → possible DB spellings)
const NAME_VARIANTS: Record<string, string[]> = {
  natalija: ["natalja", "natalia", "nataliya"],
  natalja: ["natalija", "natalia", "nataliya"],
  natalia: ["natalija", "natalja", "nataliya"],
  vjaceslavs: ["vacheslav", "vyacheslav", "vjaceslav"],
  vacheslav: ["vjaceslavs", "vyacheslav", "vjaceslav"],
  vyacheslav: ["vjaceslavs", "vacheslav", "vjaceslav"],
  irina: ["iryna", "irina"],
  iryna: ["irina"],
  janis: ["janis", "janis"],
  berzins: ["berzins", "berzinš"],
};

/** Remove diacritics for search matching */
export function normalizeForSearch(s: string): string {
  if (!s || typeof s !== "string") return "";
  let out = "";
  for (const c of s.trim()) {
    out += DIACRITIC_MAP[c] ?? c;
  }
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Transliterate Cyrillic to Latin */
function transliterateCyrillicToLatin(s: string): string {
  let out = "";
  for (const c of s) {
    out += CYRILLIC_TO_LATIN[c] ?? c;
  }
  return out;
}

/** Transliterate Latin to Cyrillic (keyboard layout) */
function transliterateLatinToCyrillic(s: string): string {
  let out = "";
  for (const c of s) {
    out += LATIN_TO_CYRILLIC[c] ?? c;
  }
  return out;
}

/** Check if string contains Cyrillic */
function hasCyrillic(s: string): boolean {
  return /[\u0400-\u04FF]/.test(s);
}

/** Get search patterns: original, diacritic-normalized, layout-transliterated */
export function getSearchPatterns(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const patterns = new Set<string>();
  patterns.add(trimmed);
  patterns.add(normalizeForSearch(trimmed));

  if (hasCyrillic(trimmed)) {
    patterns.add(transliterateCyrillicToLatin(trimmed));
    patterns.add(normalizeForSearch(transliterateCyrillicToLatin(trimmed)));
  } else {
    const cyrillic = transliterateLatinToCyrillic(trimmed);
    if (cyrillic !== trimmed) {
      patterns.add(cyrillic);
    }
  }

  // Add name variants for each word
  const words = trimmed.toLowerCase().split(/\s+/);
  for (const word of words) {
    const norm = normalizeForSearch(word);
    const variants = NAME_VARIANTS[norm];
    if (variants) {
      variants.forEach((v) => patterns.add(v));
    }
  }

  return Array.from(patterns).filter(Boolean);
}

/** Check if text matches any of the search patterns (for in-memory filtering) */
export function matchesSearch(text: string | null | undefined, patterns: string[]): boolean {
  if (!text) return false;
  const textNorm = normalizeForSearch(text);
  const textLower = text.toLowerCase();
  for (const p of patterns) {
    const pNorm = normalizeForSearch(p);
    const pLower = p.toLowerCase();
    if (textLower.includes(pLower) || textNorm.includes(pNorm)) return true;
  }
  return false;
}
