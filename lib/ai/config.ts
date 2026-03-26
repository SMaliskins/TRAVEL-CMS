/**
 * AI Module Configuration
 *
 * Centralized AI configuration for Travel CMS.
 * Supports OpenAI, Anthropic, and local models.
 *
 * ALL model identifiers live here. When a provider deprecates a model,
 * update ONLY this file — every API route imports from here.
 */

export type AIProvider = "openai" | "anthropic" | "local";

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export const MODELS = {
  OPENAI_VISION: "gpt-4o",
  OPENAI_FAST: "gpt-4o-mini",
  OPENAI_COMPLEX: "gpt-4o",
  ANTHROPIC_FAST: "claude-3-haiku-20240307",
  ANTHROPIC_CHAT: "claude-sonnet-4-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [MODELS.OPENAI_VISION]:   { input: 2.50,  output: 10.00 },
  [MODELS.OPENAI_FAST]:     { input: 0.15,  output: 0.60  },
  [MODELS.ANTHROPIC_FAST]:  { input: 0.25,  output: 1.25  },
  [MODELS.ANTHROPIC_CHAT]:  { input: 3.00,  output: 15.00 },
  "gpt-4-turbo":            { input: 10.00, output: 30.00 },
  "gpt-4":                  { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo":          { input: 0.50,  output: 1.50  },
};

export const AI_CONFIGS = {
  vision: {
    provider: "openai" as AIProvider,
    model: MODELS.OPENAI_VISION,
    maxTokens: 2000,
    temperature: 0.1,
  },
  fast: {
    provider: "openai" as AIProvider,
    model: MODELS.OPENAI_FAST,
    maxTokens: 1000,
    temperature: 0.2,
  },
  complex: {
    provider: "openai" as AIProvider,
    model: MODELS.OPENAI_COMPLEX,
    maxTokens: 4000,
    temperature: 0.7,
  },
  chat: {
    provider: "openai" as AIProvider,
    model: MODELS.OPENAI_COMPLEX,
    maxTokens: 2000,
    temperature: 0.8,
  },
  parsing: {
    provider: "anthropic" as AIProvider,
    model: MODELS.ANTHROPIC_FAST,
    maxTokens: 3000,
    temperature: 0.1,
  },
  concierge: {
    provider: "anthropic" as AIProvider,
    model: MODELS.ANTHROPIC_CHAT,
    maxTokens: 2000,
    temperature: 0.7,
  },
  // Parsing pipeline configs (gpt-4o for all — quality over cost)
  parsing_vision: {
    provider: "openai" as AIProvider,
    model: MODELS.OPENAI_VISION,
    maxTokens: 4000,
    temperature: 0.1,
  },
  parsing_text: {
    provider: "openai" as AIProvider,
    model: MODELS.OPENAI_COMPLEX,
    maxTokens: 4000,
    temperature: 0.1,
  },
  parsing_fallback: {
    provider: "anthropic" as AIProvider,
    model: MODELS.ANTHROPIC_CHAT,
    maxTokens: 4000,
    temperature: 0.1,
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
