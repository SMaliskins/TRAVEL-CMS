/**
 * AI Module Configuration
 * 
 * Централизованная конфигурация AI для Travel CMS
 * Поддерживает OpenAI, Anthropic, и локальные модели
 */

export type AIProvider = "openai" | "anthropic" | "local";

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Конфигурации для разных задач
export const AI_CONFIGS = {
  // Парсинг изображений (требуется vision)
  vision: {
    provider: "openai" as AIProvider,
    model: "gpt-4o",
    maxTokens: 2000,
    temperature: 0.1,
  },
  
  // Быстрые задачи (извлечение данных, классификация)
  fast: {
    provider: "openai" as AIProvider,
    model: "gpt-4o-mini",
    maxTokens: 1000,
    temperature: 0.2,
  },
  
  // Сложные задачи (генерация текста, анализ)
  complex: {
    provider: "openai" as AIProvider,
    model: "gpt-4o",
    maxTokens: 4000,
    temperature: 0.7,
  },
  
  // Чат-ассистент
  chat: {
    provider: "openai" as AIProvider,
    model: "gpt-4o",
    maxTokens: 2000,
    temperature: 0.8,
  },
};

// Получить API ключ для провайдера
export function getAPIKey(provider: AIProvider): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

// Проверить доступность AI
export function isAIAvailable(configKey: keyof typeof AI_CONFIGS): boolean {
  const config = AI_CONFIGS[configKey];
  return !!getAPIKey(config.provider);
}

// Список доступных AI функций
export const AI_FEATURES = {
  // Уже реализовано
  FLIGHT_ITINERARY_PARSING: "flight_itinerary_parsing",
  
  // Планируется
  DOCUMENT_PARSING: "document_parsing",
  EMAIL_PARSING: "email_parsing",
  CHAT_ASSISTANT: "chat_assistant",
  AUTO_SUGGESTIONS: "auto_suggestions",
  HOTEL_LOOKUP: "hotel_lookup",
  TRANSLATION: "translation",
  SENTIMENT_ANALYSIS: "sentiment_analysis",
} as const;

export type AIFeature = typeof AI_FEATURES[keyof typeof AI_FEATURES];
