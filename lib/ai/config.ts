/**
 * AI Module Configuration
 *
 * Centralized AI configuration for Travel CMS.
 * Supports OpenAI, Anthropic, and local models.
 */

export type AIProvider = "openai" | "anthropic" | "local";

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Configs for different task types
export const AI_CONFIGS = {
  // Image parsing (requires vision)
  vision: {
    provider: "openai" as AIProvider,
    model: "gpt-4o",
    maxTokens: 2000,
    temperature: 0.1,
  },
  
  // Fast tasks (data extraction, classification)
  fast: {
    provider: "openai" as AIProvider,
    model: "gpt-4o-mini",
    maxTokens: 1000,
    temperature: 0.2,
  },
  
  // Complex tasks (text generation, analysis)
  complex: {
    provider: "openai" as AIProvider,
    model: "gpt-4o",
    maxTokens: 4000,
    temperature: 0.7,
  },
  
  // Chat assistant
  chat: {
    provider: "openai" as AIProvider,
    model: "gpt-4o",
    maxTokens: 2000,
    temperature: 0.8,
  },
};

// Get API key for provider
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

// Check AI availability
export function isAIAvailable(configKey: keyof typeof AI_CONFIGS): boolean {
  const config = AI_CONFIGS[configKey];
  return !!getAPIKey(config.provider);
}

// List of available AI features
export const AI_FEATURES = {
  // Implemented
  FLIGHT_ITINERARY_PARSING: "flight_itinerary_parsing",
  
  // Planned
  DOCUMENT_PARSING: "document_parsing",
  EMAIL_PARSING: "email_parsing",
  CHAT_ASSISTANT: "chat_assistant",
  AUTO_SUGGESTIONS: "auto_suggestions",
  HOTEL_LOOKUP: "hotel_lookup",
  TRANSLATION: "translation",
  SENTIMENT_ANALYSIS: "sentiment_analysis",
} as const;

export type AIFeature = typeof AI_FEATURES[keyof typeof AI_FEATURES];
