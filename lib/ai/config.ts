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

// gpt-5.5 is available on this Vercel AI Gateway account and is used for
// high-quality parsing/vision tasks. Keep fast utility calls on gpt-5.4-mini.
export const MODELS = {
  OPENAI_VISION: "gpt-5.5",
  OPENAI_FAST: "gpt-5.4-mini",
  OPENAI_COMPLEX: "gpt-5.5",
  ANTHROPIC_FAST: "claude-haiku-4.5",
  ANTHROPIC_CHAT: "claude-sonnet-4.5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.5":                { input: 3.00,  output: 12.00 },
  "gpt-5.5-pro":            { input: 15.00, output: 60.00 },
  "gpt-5.4":                { input: 3.00,  output: 12.00 },
  "gpt-5.4-mini":           { input: 0.20,  output: 0.80  },
  "gpt-5.4-nano":           { input: 0.10,  output: 0.40  },
  "claude-haiku-4.5":       { input: 0.80,  output: 4.00  },
  "claude-sonnet-4.5":      { input: 3.00,  output: 15.00 },
  "claude-sonnet-4.6":      { input: 3.00,  output: 15.00 },
  "gpt-4o":                 { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":            { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":            { input: 10.00, output: 30.00 },
  "gpt-4":                  { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo":          { input: 0.50,  output: 1.50  },
  "claude-3-haiku-20240307":{ input: 0.25,  output: 1.25  },
  "claude-sonnet-4-5":      { input: 3.00,  output: 15.00 },
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
  // Parsing pipeline configs: primary OpenAI model is the strongest Gateway
  // model currently available on this account; Anthropic Sonnet remains fallback.
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

// Get API key for provider.
// If AI_GATEWAY_API_KEY is set, lib/ai/sdk.ts routes every call through the
// Vercel AI Gateway and the gateway key alone is enough for any provider —
// we surface it here so callers that gate on key presence stay happy without
// requiring direct OPENAI_API_KEY / ANTHROPIC_API_KEY in production.
export function getAPIKey(provider: AIProvider): string | undefined {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) return gatewayKey;
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
