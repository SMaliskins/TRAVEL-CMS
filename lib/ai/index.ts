/**
 * AI Module for Travel CMS
 * 
 * Централизованный модуль для всех AI функций
 * 
 * Использование:
 * 
 * ```ts
 * import { ai } from "@/lib/ai";
 * 
 * // Парсинг билетов
 * const result = await ai.parseFlightItinerary(imageBase64, "image/png");
 * 
 * // Парсинг документов
 * const passport = await ai.parseDocument(imageBase64, "image/jpeg");
 * 
 * // Парсинг email
 * const booking = await ai.parseEmail(emailContent);
 * 
 * // Предложения сервисов
 * const suggestions = await ai.suggestServices({ destinations, dateFrom, dateTo, ... });
 * 
 * // Перевод
 * const translated = await ai.translateText("Hello", "ru");
 * ```
 */

// Config
export { 
  AI_CONFIGS, 
  AI_FEATURES, 
  getAPIKey, 
  isAIAvailable,
  type AIConfig,
  type AIProvider,
  type AIFeature,
} from "./config";

// Client
export {
  aiComplete,
  aiQuickPrompt,
  aiVision,
  aiJSON,
  type AIMessage,
  type AIResponse,
  type AICompletionOptions,
} from "./client";

// Tasks
export {
  parseFlightItinerary,
  parseFlightText,
  type FlightSegmentParsed,
  type ParseFlightResult,
} from "./tasks/parseFlightItinerary";

export {
  parseDocument,
  type PassportData,
  type HotelBookingData,
  type InsuranceData,
  type VisaData,
  type ParsedDocument,
  type ParseDocumentResult,
} from "./tasks/parseDocument";

export {
  parseEmail,
  classifyEmail,
  type EmailBookingInfo,
  type ParseEmailResult,
} from "./tasks/parseEmail";

export {
  suggestServices,
  suggestTransferTime,
  type ServiceSuggestion,
  type SuggestServicesResult,
} from "./tasks/suggestServices";

export {
  translateText,
  detectLanguage,
  translateEmailTemplate,
  type SupportedLanguage,
} from "./tasks/translateText";

// Convenience object for importing all functions
import { parseFlightItinerary, parseFlightText } from "./tasks/parseFlightItinerary";
import { parseDocument } from "./tasks/parseDocument";
import { parseEmail, classifyEmail } from "./tasks/parseEmail";
import { suggestServices, suggestTransferTime } from "./tasks/suggestServices";
import { translateText, detectLanguage, translateEmailTemplate } from "./tasks/translateText";
import { isAIAvailable } from "./config";

export const ai = {
  // Status
  isAvailable: isAIAvailable,
  
  // Flight parsing
  parseFlightItinerary,
  parseFlightText,
  
  // Document parsing
  parseDocument,
  
  // Email parsing
  parseEmail,
  classifyEmail,
  
  // Suggestions
  suggestServices,
  suggestTransferTime,
  
  // Translation
  translateText,
  detectLanguage,
  translateEmailTemplate,
};

export default ai;
