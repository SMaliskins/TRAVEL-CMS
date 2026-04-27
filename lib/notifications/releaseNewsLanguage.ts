export type ReleaseNewsLanguage = "en" | "ru" | "lv";

export const RELEASE_NEWS_LANGUAGES: { code: ReleaseNewsLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "lv", label: "Latviešu" },
];

export function normalizeReleaseNewsLanguage(language: unknown): ReleaseNewsLanguage {
  return language === "ru" || language === "lv" ? language : "en";
}

export function getReleaseNewsText(
  text: Record<string, string> | null | undefined,
  language: unknown
): string {
  if (!text) return "";
  const preferred = normalizeReleaseNewsLanguage(language);
  return text[preferred] || text.en || text.ru || text.lv || "";
}
