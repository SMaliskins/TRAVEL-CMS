/**
 * AI Task: Translate Text
 *
 * Text translation for:
 * - Client communication
 * - Documents
 * - UI
 */

import { aiQuickPrompt, aiJSON } from "../client";

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

/** ISO codes used by invoice email language picker (plus generic translate). */
const EXTENDED_LANG_NAMES: Record<string, string> = {
  ...LANGUAGE_NAMES,
  lt: "Lithuanian",
  et: "Estonian",
  pl: "Polish",
  hu: "Hungarian",
};

/**
 * Translate invoice / reminder email subject + HTML body while preserving markup.
 * Used by POST /api/ai task "translate" when the client sends JSON { subject, message }.
 */
export async function translateEmailSubjectAndBody(
  subject: string,
  messageHtml: string,
  targetLanguageCode: string
): Promise<{ subject: string; message: string } | null> {
  const code = targetLanguageCode.trim().toLowerCase();
  if (code === "en") {
    return { subject, message: messageHtml };
  }
  const langName = EXTENDED_LANG_NAMES[code];
  if (!langName) {
    return null;
  }

  const systemPrompt = `You translate outbound business email fields for a travel agency.
Target language: ${langName}. Translate all human-readable text fully into ${langName}.
Rules:
- "subject": natural professional email subject line in ${langName}.
- "message": translate only visible text; keep every HTML tag, attribute, class, inline style, link href, and image src unchanged. Preserve paragraph and block structure (p, br, div, lists, tables, etc.). Do not summarize or shorten the body.
Return a single JSON object with exactly two string properties: "subject" and "message".`;

  const payload = JSON.stringify({ subject, message: messageHtml });
  const result = await aiJSON<{ subject: string; message: string }>(
    `Translate both fields in this JSON to ${langName}. Reply with JSON only, same keys. Input:\n${payload}`,
    systemPrompt
  );

  if (!result.success || !result.data) {
    return null;
  }
  const s = result.data.subject;
  const m = result.data.message;
  if (typeof s !== "string" || typeof m !== "string" || !m.trim()) {
    return null;
  }
  return { subject: s, message: m };
}

/**
 * Translate text
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  context?: string
): Promise<{ success: boolean; translation?: string; error?: string }> {
  const langName =
    EXTENDED_LANG_NAMES[targetLanguage.trim().toLowerCase()] || targetLanguage;
  
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
 * Detect text language
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
 * Translate email template
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
