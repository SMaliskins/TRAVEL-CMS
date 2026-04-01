/**
 * Directory search normalization: diacritics, keyboard layout, name variants
 * Used for DIR3: Search improvements + semantic search
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

// ASCII → diacritic (for query: user types "sva", we also search "šva" to match "Švanka")
const ASCII_TO_DIACRITIC: Record<string, string> = {
  s: "š", S: "Š", c: "č", C: "Č", z: "ž", Z: "Ž",
  a: "ā", A: "Ā", e: "ē", E: "Ē", i: "ī", I: "Ī", u: "ū", U: "Ū", o: "ō", O: "Ō",
  n: "ņ", N: "Ņ", l: "ļ", L: "Ļ", k: "ķ", K: "Ķ", g: "ģ", G: "Ģ",
};

// Cyrillic → Latin (transliteration by sound, for display/embedding)
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

// Keyboard layout: same physical key — JCUKEN (Russian) ↔ QWERTY (English)
// Cyrillic → Latin: user typed with Russian layout but meant English (e.g. "руддщ" → "hello")
const CYRILLIC_KEYBOARD_TO_LATIN: Record<string, string> = {
  й: "q", ц: "w", у: "e", к: "r", е: "t", н: "y", г: "u", ш: "i", щ: "o", з: "p", х: "[", ъ: "]", ё: "`",
  ф: "a", ы: "s", в: "d", а: "f", п: "g", р: "h", о: "j", л: "k", д: "l", ж: ";", э: "'",
  я: "z", ч: "x", с: "c", м: "v", и: "b", т: "n", ь: "m", б: ",", ю: ".",
  Й: "Q", Ц: "W", У: "E", К: "R", Е: "T", Н: "Y", Г: "U", Ш: "I", Щ: "O", З: "P", Х: "{", Ъ: "}", Ё: "~",
  Ф: "A", Ы: "S", В: "D", А: "F", П: "G", Р: "H", О: "J", Л: "K", Д: "L", Ж: ":", Э: '"',
  Я: "Z", Ч: "X", С: "C", М: "V", И: "B", Т: "N", Ь: "M", Б: "<", Ю: ">",
};

// Latin → Cyrillic (same key): user typed with English layout but meant Russian (e.g. "ghbdtn" → "привет")
const LATIN_KEYBOARD_TO_CYRILLIC: Record<string, string> = {
  q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ", p: "з", "[": "х", "]": "ъ", "`": "ё",
  a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о", k: "л", l: "д", ";": "ж", "'": "э",
  z: "я", x: "ч", c: "с", v: "м", b: "и", n: "т", m: "ь", ",": "б", ".": "ю",
  Q: "Й", W: "Ц", E: "У", R: "К", T: "Е", Y: "Н", U: "Г", I: "Ш", O: "Щ", P: "З", "{": "Х", "}": "Ъ", "~": "Ё",
  A: "Ф", S: "Ы", D: "В", F: "А", G: "П", H: "Р", J: "О", K: "Л", L: "Д", ":": "Ж", '"': "Э",
  Z: "Я", X: "Ч", C: "С", V: "М", B: "И", N: "Т", M: "Ь", "<": "Б", ">": "Ю",
};

// Legacy: Latin → Cyrillic by key (kept for backward compat; prefer LATIN_KEYBOARD_TO_CYRILLIC)
const LATIN_TO_CYRILLIC: Record<string, string> = LATIN_KEYBOARD_TO_CYRILLIC;

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
  pricite: ["procote", "pricote", "procite"],
  procote: ["pricite", "pricote", "procite"],
};

// QWERTY keyboard: adjacent keys (horizontal, vertical, diagonal) — for typo variants
const QWERTY_NEIGHBORS: Record<string, string[]> = {
  q: ["w", "a"], w: ["q", "e", "a", "s"], e: ["w", "r", "s", "d"], r: ["e", "t", "d", "f"], t: ["r", "y", "f", "g"],
  y: ["t", "u", "g", "h"], u: ["y", "i", "h", "j"], i: ["u", "o", "j", "k"], o: ["i", "p", "k", "l"], p: ["o", "l"],
  a: ["q", "w", "s", "z"], s: ["w", "e", "a", "d", "z", "x"], d: ["e", "r", "s", "f", "x", "c"], f: ["r", "t", "d", "g", "c", "v"],
  g: ["t", "y", "f", "h", "v", "b"], h: ["y", "u", "g", "j", "b", "n"], j: ["u", "i", "h", "k", "n", "m"], k: ["i", "o", "j", "l", "m"],
  l: ["o", "p", "k", "m"], z: ["a", "s", "x"], x: ["s", "d", "z", "c"], c: ["d", "f", "x", "v"], v: ["f", "g", "c", "b"],
  b: ["g", "h", "v", "n"], n: ["h", "j", "b", "m"], m: ["j", "k", "n", "l"],
};

/** (from, to) pairs from QWERTY_NEIGHBORS for semantic: try first substitution that changes the string */
const KEYBOARD_SUBSTITUTIONS: [string, string][] = (() => {
  const pairs: [string, string][] = [];
  const order = "oeiartnslcudpmhybgvfkxjqz"; // try common letters first
  for (const from of order) {
    const neighbors = QWERTY_NEIGHBORS[from];
    if (neighbors) for (const to of neighbors) pairs.push([from, to]);
  }
  return pairs;
})();

/** Typo variants by replacing each char with a keyboard neighbor (one replacement per variant). Limit size. */
function getKeyboardTypoVariants(s: string, maxVariants: number): string[] {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length && out.size < maxVariants; i++) {
    const c = lower[i];
    const neighbors = QWERTY_NEIGHBORS[c];
    if (!neighbors) continue;
    for (const repl of neighbors) {
      const variant = lower.slice(0, i) + repl + lower.slice(i + 1);
      if (variant !== lower) out.add(variant);
      if (out.size >= maxVariants) break;
    }
  }
  return Array.from(out);
}

/** One keyboard-typo correction for semantic: first (from→to) that changes the string */
function getTypoCorrectionForSemantic(s: string): string | null {
  const lower = s.toLowerCase();
  for (const [from, to] of KEYBOARD_SUBSTITUTIONS) {
    if (!lower.includes(from)) continue;
    const variant = lower.split(from).join(to);
    if (variant !== lower) return variant;
  }
  return null;
}

/** Layout + diacritics only (no typo correction) — for "user intent" embedding. */
function normalizeQueryForSemanticNoTypo(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  if (hasCyrillic(trimmed)) {
    const byKeyboard = convertKeyboardCyrillicToLatin(trimmed);
    const looksLikeWrongLayout = /[a-zA-Z]/.test(byKeyboard) && byKeyboard !== trimmed;
    if (looksLikeWrongLayout) return byKeyboard;
    return transliterateCyrillicToLatin(trimmed);
  }
  const cyrillicByKeyboard = convertKeyboardLatinToCyrillic(trimmed);
  if (cyrillicByKeyboard !== trimmed && hasCyrillic(cyrillicByKeyboard)) {
    return transliterateCyrillicToLatin(cyrillicByKeyboard);
  }
  return normalizeForSearch(trimmed) || trimmed;
}

/**
 * Several query variants for semantic search: normalized (no typo) + 1–2 typo corrections.
 * So we embed "procote", "pricite", "pricote" and merge results for better recall.
 */
export function getSemanticQueryVariants(query: string, maxVariants: number = 3): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const out = new Set<string>();
  const base = normalizeQueryForSemanticNoTypo(trimmed);
  if (base) out.add(base);

  let cur = base || trimmed.toLowerCase();
  for (let i = 0; i < maxVariants - 1 && out.size < maxVariants; i++) {
    const next = getTypoCorrectionForSemantic(cur);
    if (!next || next === cur) break;
    out.add(next);
    cur = next;
  }

  return Array.from(out);
}

// Common diacritic forms for DB matching (ASCII → one Latvian-style form so ILIKE matches "Prīcīte")
const DIACRITIC_FOR_ILIKE: Record<string, string> = {
  i: "ī", a: "ā", e: "ē", u: "ū", o: "ō",
  I: "Ī", A: "Ā", E: "Ē", U: "Ū", O: "Ō",
};

/** Add one diacritic variant so SQL ilike matches DB "Prīcīte" when pattern is "pricite" */
function addDiacriticVariantForIlike(s: string): string {
  let out = s;
  for (const [ascii, diacritic] of Object.entries(DIACRITIC_FOR_ILIKE)) {
    if (out.includes(ascii)) {
      out = out.split(ascii).join(diacritic);
      break;
    }
  }
  return out;
}

/** Generate diacritic variants so "sva" also matches "Švanka" (s→š, c→č, etc.). Returns variants with first occurrence replaced. */
function getDiacriticQueryVariants(s: string, maxVariants: number = 5): string[] {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length && out.size < maxVariants; i++) {
    const c = lower[i];
    const diacritic = ASCII_TO_DIACRITIC[c];
    if (diacritic) {
      const variant = lower.slice(0, i) + diacritic + lower.slice(i + 1);
      out.add(variant);
    }
  }
  return Array.from(out);
}

/**
 * Cyrillic letters that look like Latin (passport / copy-paste). Without folding,
 * "gilch" (Latin) does not match "gilсh" (Cyrillic с) — short prefixes like "gil" still match.
 */
const CYRILLIC_LOOKALIKE_TO_LATIN: Record<string, string> = {
  "\u0430": "a", "\u0410": "a",
  "\u0432": "v", "\u0412": "v",
  "\u0435": "e", "\u0415": "e",
  "\u043E": "o", "\u041E": "o",
  "\u0440": "p", "\u0420": "p",
  "\u0441": "c", "\u0421": "c",
  "\u0443": "y", "\u0423": "y",
  "\u0445": "x", "\u0425": "x",
  "\u0456": "i", "\u0406": "i",
  "\u0458": "j", "\u0408": "j",
};

/** Lowercase, strip diacritics, fold Cyrillic→Latin confusables for substring / fuzzy match */
export function foldForSearchMatch(s: string): string {
  const base = normalizeForSearch(s);
  let out = "";
  for (const ch of base) {
    out += CYRILLIC_LOOKALIKE_TO_LATIN[ch] ?? ch;
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * True if some slice of haystack is within maxDist edits of needle (typos, one adjacent swap costs ≤2 in Levenshtein).
 */
function fuzzySubstringMatch(haystack: string, needle: string, maxDist: number): boolean {
  if (needle.length === 0) return true;
  if (needle.length > haystack.length) {
    return levenshtein(haystack, needle) <= maxDist;
  }
  const n = needle.length;
  const minLen = Math.max(1, n - maxDist);
  const maxLen = Math.min(haystack.length, n + maxDist);
  for (let len = minLen; len <= maxLen; len++) {
    for (let i = 0; i + len <= haystack.length; i++) {
      const slice = haystack.slice(i, i + len);
      if (levenshtein(slice, needle) <= maxDist) return true;
    }
  }
  return false;
}

/**
 * Plain-text query match: folded substring + optional fuzzy tolerance (for list / filter UIs).
 */
export function matchesLooseTextQuery(
  text: string | null | undefined,
  query: string,
  options?: { fuzzy?: boolean; maxDist?: number; minFuzzyLen?: number }
): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = query.trim();
  if (!trimmed) return true;
  const t = foldForSearchMatch(text);
  const q = foldForSearchMatch(trimmed);
  if (!q) return true;
  if (t.includes(q)) return true;
  const fuzzy = options?.fuzzy !== false;
  const maxDist = options?.maxDist ?? 2;
  const minLen = options?.minFuzzyLen ?? 4;
  if (fuzzy && q.length >= minLen) {
    return fuzzySubstringMatch(t, q, maxDist);
  }
  return false;
}

/** Remove diacritics for search matching */
export function normalizeForSearch(s: string): string {
  if (!s || typeof s !== "string") return "";
  let out = "";
  for (const c of s.trim()) {
    out += DIACRITIC_MAP[c] ?? c;
  }
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Transliterate Cyrillic to Latin (by sound) */
function transliterateCyrillicToLatin(s: string): string {
  let out = "";
  for (const c of s) {
    out += CYRILLIC_TO_LATIN[c] ?? c;
  }
  return out;
}

/** Convert Cyrillic to Latin by keyboard layout (e.g. "руддщ" → "hello") */
function convertKeyboardCyrillicToLatin(s: string): string {
  let out = "";
  for (const c of s) {
    out += CYRILLIC_KEYBOARD_TO_LATIN[c] ?? c;
  }
  return out;
}

/** Convert Latin to Cyrillic by keyboard layout (e.g. "hello" → "руддщ", "ghbdtn" → "привет") */
function convertKeyboardLatinToCyrillic(s: string): string {
  let out = "";
  for (const c of s) {
    out += LATIN_KEYBOARD_TO_CYRILLIC[c] ?? c;
  }
  return out;
}

/** Transliterate Latin to Cyrillic (keyboard layout) — alias */
function transliterateLatinToCyrillic(s: string): string {
  return convertKeyboardLatinToCyrillic(s);
}

/** Check if string contains Cyrillic */
function hasCyrillic(s: string): boolean {
  return /[\u0400-\u04FF]/.test(s);
}

/** Get search patterns: original, diacritic-normalized, diacritic variants (sva→šva for Švanka), keyboard-layout, transliteration */
export function getSearchPatterns(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const patterns = new Set<string>();
  patterns.add(trimmed);
  patterns.add(normalizeForSearch(trimmed));
  // So "sva" also matches "Švanka": add šva, etc.
  getDiacriticQueryVariants(trimmed, 6).forEach((v) => patterns.add(v));
  getDiacriticQueryVariants(normalizeForSearch(trimmed), 6).forEach((v) => patterns.add(v));

  if (hasCyrillic(trimmed)) {
    patterns.add(transliterateCyrillicToLatin(trimmed));
    patterns.add(normalizeForSearch(transliterateCyrillicToLatin(trimmed)));
    const byKeyboard = convertKeyboardCyrillicToLatin(trimmed);
    if (byKeyboard !== trimmed) {
      patterns.add(byKeyboard);
      patterns.add(normalizeForSearch(byKeyboard));
    }
  } else {
    const cyrillicByKeyboard = convertKeyboardLatinToCyrillic(trimmed);
    if (cyrillicByKeyboard !== trimmed) {
      patterns.add(cyrillicByKeyboard);
      patterns.add(transliterateCyrillicToLatin(cyrillicByKeyboard));
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

  // Typo variants by keyboard neighbors (e.g. procote→pricite, pricote, procite; r→e→t, etc.)
  const typoVariants = getKeyboardTypoVariants(trimmed, 25);
  typoVariants.forEach((v) => {
    patterns.add(v);
    patterns.add(normalizeForSearch(v));
    patterns.add(addDiacriticVariantForIlike(v));
  });

  return Array.from(patterns).filter(Boolean);
}

/**
 * Normalize query for semantic search (embedding): fix wrong keyboard layout, prefer Latin,
 * and apply one typo variant (e.g. procote → pricite) so embedding is closer to DB text.
 */
export function normalizeQueryForSemantic(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";

  if (hasCyrillic(trimmed)) {
    const byKeyboard = convertKeyboardCyrillicToLatin(trimmed);
    const looksLikeWrongLayout = /[a-zA-Z]/.test(byKeyboard) && byKeyboard !== trimmed;
    if (looksLikeWrongLayout) return byKeyboard;
    return transliterateCyrillicToLatin(trimmed);
  }

  const cyrillicByKeyboard = convertKeyboardLatinToCyrillic(trimmed);
  if (cyrillicByKeyboard !== trimmed && hasCyrillic(cyrillicByKeyboard)) {
    return transliterateCyrillicToLatin(cyrillicByKeyboard);
  }

  let out = normalizeForSearch(trimmed) || trimmed;

  // One typo correction for embedding: "procote" → "pricite" (only o→i, e→i, never i→o)
  const corrected = getTypoCorrectionForSemantic(out);
  if (corrected) out = corrected;

  return out;
}

/** Check if text matches any of the search patterns (for in-memory filtering) */
export function matchesSearch(text: string | null | undefined, patterns: string[]): boolean {
  if (!text) return false;
  const textFold = foldForSearchMatch(text);
  for (const p of patterns) {
    const pFold = foldForSearchMatch(p);
    if (!pFold) continue;
    if (textFold.includes(pFold)) return true;
    if (pFold.length >= 4 && fuzzySubstringMatch(textFold, pFold, 2)) return true;
  }
  return false;
}
