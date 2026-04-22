/**
 * Russian JCUKEN (Windows) → US QWERTY, same physical key.
 * For when the user meant Latin but the wrong layout was active
 * (e.g. "ифдедштук" → "baltliner").
 */
const RU_TO_EN: Record<string, string> = {
  й: "q",
  ц: "w",
  у: "e",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ф: "a",
  ы: "s",
  в: "d",
  а: "f",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  с: "c",
  м: "v",
  и: "b",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
  ё: "`",
};

/**
 * @returns String with Russian letters replaced by their QWERTY counterparts;
 *          other code units preserved. Uppercase Cyrillic → uppercase Latin
 *          when the mapped key is a letter.
 */
export function russianJcukenToLatinQwerty(input: string): string {
  let out = "";
  for (const c of input) {
    const low = c.toLowerCase();
    const mapped = RU_TO_EN[low];
    if (mapped === undefined) {
      out += c;
      continue;
    }
    if (c === low) {
      out += mapped;
    } else {
      if (mapped.length === 1 && /[a-z]/.test(mapped)) {
        out += mapped.toUpperCase();
      } else {
        out += mapped;
      }
    }
  }
  return out;
}

export function hasRussianJcukenChar(input: string): boolean {
  for (const c of input) {
    if (RU_TO_EN[c.toLowerCase()] !== undefined) return true;
  }
  return false;
}
