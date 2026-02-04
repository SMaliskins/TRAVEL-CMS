/**
 * AI Client — unified client for AI operations.
 *
 * Supports:
 * - OpenAI (GPT-4, GPT-4o, GPT-4o-mini)
 * - Anthropic Claude (planned)
 * - Vision (image analysis)
 * - Structured output (JSON)
 */

import { AI_CONFIGS, getAPIKey, AIProvider } from "./config";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | AIMessageContent[];
}

export interface AIMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AICompletionOptions {
  configKey?: keyof typeof AI_CONFIGS;
  messages: AIMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Execute AI request
 */
export async function aiComplete(options: AICompletionOptions): Promise<AIResponse> {
  const config = AI_CONFIGS[options.configKey || "fast"];
  const apiKey = getAPIKey(config.provider);

  if (!apiKey) {
    return {
      success: false,
      error: `AI not configured. Missing API key for ${config.provider}`,
    };
  }

  try {
    switch (config.provider) {
      case "openai":
        return await openAIComplete({
          ...config,
          apiKey,
          messages: options.messages,
          jsonMode: options.jsonMode,
          maxTokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
        });
      
      case "anthropic":
        return await anthropicComplete({
          ...config,
          apiKey,
          messages: options.messages,
          maxTokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
        });
      
      default:
        return { success: false, error: "Unknown AI provider" };
    }
  } catch (err) {
    console.error("AI completion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}

/**
 * OpenAI API
 */
async function openAIComplete(options: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
}): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("OpenAI error:", errorData);
    return {
      success: false,
      error: errorData.error?.message || `OpenAI API error: ${response.status}`,
    };
  }

  const data = await response.json();
  
  return {
    success: true,
    content: data.choices?.[0]?.message?.content || "",
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  };
}

/**
 * Anthropic Claude API (placeholder)
 */
async function anthropicComplete(options: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<AIResponse> {
  // TODO: Implement Anthropic API
  // const response = await fetch("https://api.anthropic.com/v1/messages", {...});
  
  return {
    success: false,
    error: "Anthropic API not yet implemented",
  };
}

/**
 * Quick text prompt
 */
export async function aiQuickPrompt(
  prompt: string,
  systemPrompt?: string
): Promise<string | null> {
  const messages: AIMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const result = await aiComplete({
    configKey: "fast",
    messages,
  });

  return result.success ? result.content || null : null;
}

/**
 * AI request with image (vision)
 */
export async function aiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  systemPrompt?: string
): Promise<AIResponse> {
  const messages: AIMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  
  messages.push({
    role: "user",
    content: [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
          detail: "high",
        },
      },
      {
        type: "text",
        text: prompt,
      },
    ],
  });

  return aiComplete({
    configKey: "vision",
    messages,
  });
}

/**
 * AI request returning JSON
 */
export async function aiJSON<T>(
  prompt: string,
  systemPrompt: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await aiComplete({
    configKey: "fast",
    messages: [
      { role: "system", content: systemPrompt + "\n\nAlways respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    jsonMode: true,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  try {
    const data = JSON.parse(result.content || "{}") as T;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: "Failed to parse AI response as JSON" };
  }
}
