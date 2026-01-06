/**
 * AI Task: Translate Text
 * 
 * Перевод текста для:
 * - Клиентской коммуникации
 * - Документов
 * - Интерфейса
 */

import { aiQuickPrompt } from "../client";

export type SupportedLanguage = 
  | "en" // English
  | "ru" // Russian
  | "lv" // Latvian
  | "de" // German
  | "fr" // French
  | "es" // Spanish
  | "it" // Italian
  | "pt" // Portuguese
  | "zh" // Chinese
  | "ja" // Japanese
  | "ko" // Korean
  | "ar"; // Arabic

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  ru: "Russian",
  lv: "Latvian",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
};

/**
 * Перевести текст
 */
export async function translateText(
  text: string,
  targetLanguage: SupportedLanguage,
  context?: string
): Promise<{ success: boolean; translation?: string; error?: string }> {
  const langName = LANGUAGE_NAMES[targetLanguage];
  
  const systemPrompt = `You are a professional translator for a travel agency.
Translate the text to ${langName}.
${context ? `Context: ${context}` : ""}
Keep the tone professional but friendly.
Only return the translated text, nothing else.`;

  const result = await aiQuickPrompt(text, systemPrompt);
  
  if (!result) {
    return { success: false, error: "Translation failed" };
  }
  
  return { success: true, translation: result };
}

/**
 * Определить язык текста
 */
export async function detectLanguage(
  text: string
): Promise<{ language: SupportedLanguage; confidence: number } | null> {
  const result = await aiQuickPrompt(
    `Detect the language of this text and return ONLY the 2-letter ISO code (en, ru, de, fr, es, it, lv, pt, zh, ja, ko, ar):\n\n${text}`,
    "You are a language detector. Return only the ISO 639-1 language code, nothing else."
  );
  
  if (!result) return null;
  
  const code = result.trim().toLowerCase() as SupportedLanguage;
  if (code in LANGUAGE_NAMES) {
    return { language: code, confidence: 0.9 };
  }
  
  return null;
}

/**
 * Перевести email шаблон
 */
export async function translateEmailTemplate(
  template: string,
  variables: Record<string, string>,
  targetLanguage: SupportedLanguage
): Promise<string | null> {
  // Replace variables with placeholders
  let textToTranslate = template;
  const placeholders: Record<string, string> = {};
  
  Object.entries(variables).forEach(([key, value], index) => {
    const placeholder = `[[VAR_${index}]]`;
    placeholders[placeholder] = value;
    textToTranslate = textToTranslate.replace(new RegExp(`{${key}}`, "g"), placeholder);
  });
  
  const result = await translateText(textToTranslate, targetLanguage, "Email template for travel booking");
  
  if (!result.success || !result.translation) {
    return null;
  }
  
  // Restore variables
  let translated = result.translation;
  Object.entries(placeholders).forEach(([placeholder, value]) => {
    translated = translated.replace(new RegExp(placeholder.replace(/[[\]]/g, "\\$&"), "g"), value);
  });
  
  return translated;
}
