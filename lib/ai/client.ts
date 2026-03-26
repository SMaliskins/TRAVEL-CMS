/**
 * AI Client — unified client for AI operations.
 *
 * Supports:
 * - OpenAI (GPT-4o, GPT-4o-mini) — Chat Completions + Structured Outputs
 * - Anthropic Claude (claude-sonnet-4-5, claude-3-haiku) — Messages API
 * - Vision (image analysis) for both providers
 * - PDF-as-file for OpenAI
 * - Transport retry (429, 500, 503) with exponential backoff
 * - Timeout support
 */

import { AI_CONFIGS, getAPIKey, AIProvider } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | AIMessageContent[];
}

export interface AIMessageContent {
  type: "text" | "image_url" | "file";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
  /** OpenAI PDF-as-file content */
  file?: {
    filename: string;
    file_data: string; // data:application/pdf;base64,...
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
  rawResponse?: unknown;
  model?: string;
  provider?: string;
  latencyMs?: number;
}

export interface AICompletionOptions {
  configKey?: keyof typeof AI_CONFIGS;
  messages: AIMessage[];
  jsonMode?: boolean;
  /** OpenAI Structured Outputs — JSON schema object. Implies jsonMode. */
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
  maxTokens?: number;
  temperature?: number;
  /** Request timeout in ms (default 60000) */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function aiComplete(options: AICompletionOptions): Promise<AIResponse> {
  const config = AI_CONFIGS[options.configKey || "fast"];
  const apiKey = getAPIKey(config.provider);

  if (!apiKey) {
    return {
      success: false,
      error: `AI not configured. Missing API key for ${config.provider}`,
    };
  }

  const start = Date.now();

  try {
    let result: AIResponse;

    switch (config.provider) {
      case "openai":
        result = await openAIComplete({
          ...config,
          apiKey,
          messages: options.messages,
          jsonMode: options.jsonMode,
          jsonSchema: options.jsonSchema,
          maxTokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
          timeout: options.timeout ?? 60_000,
        });
        break;

      case "anthropic":
        result = await anthropicComplete({
          ...config,
          apiKey,
          messages: options.messages,
          jsonMode: options.jsonMode,
          maxTokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
          timeout: options.timeout ?? 60_000,
        });
        break;

      default:
        return { success: false, error: "Unknown AI provider" };
    }

    result.latencyMs = Date.now() - start;
    result.provider = config.provider;
    result.model = config.model;
    return result;
  } catch (err) {
    console.error("AI completion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI request failed",
      latencyMs: Date.now() - start,
      provider: config.provider,
      model: config.model,
    };
  }
}

// ---------------------------------------------------------------------------
// Transport-level retry with exponential backoff (429, 500, 503)
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (response.ok || attempt === maxRetries) return response;

      const status = response.status;
      if (status !== 429 && status !== 500 && status !== 503) return response;

      // Retry with backoff
      const retryAfter = response.headers.get("retry-after");
      const delay = retryAfter
        ? Math.min(parseInt(retryAfter, 10) * 1000, 30_000)
        : Math.min(1000 * Math.pow(2, attempt), 15_000);

      console.warn(`[AI] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status ${status})`);
      await new Promise((r) => setTimeout(r, delay));
    } catch (err) {
      clearTimeout(timer);
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 15_000);
      console.warn(`[AI] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (error: ${err})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("fetchWithRetry: unreachable");
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions
// ---------------------------------------------------------------------------

async function openAIComplete(options: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
  timeout: number;
}): Promise<AIResponse> {
  // Build response_format
  let responseFormat: Record<string, unknown> | undefined;
  if (options.jsonSchema) {
    responseFormat = {
      type: "json_schema",
      json_schema: {
        name: options.jsonSchema.name,
        schema: options.jsonSchema.schema,
        strict: options.jsonSchema.strict ?? true,
      },
    };
  } else if (options.jsonMode) {
    responseFormat = { type: "json_object" };
  }

  const response = await fetchWithRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    },
    options.timeout
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("OpenAI error:", errorData);
    return {
      success: false,
      error: (errorData as Record<string, { message?: string }>).error?.message || `OpenAI API error: ${response.status}`,
      rawResponse: errorData,
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
    rawResponse: data,
  };
}

// ---------------------------------------------------------------------------
// Anthropic Messages API
// ---------------------------------------------------------------------------

async function anthropicComplete(options: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
  timeout: number;
}): Promise<AIResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: options.apiKey });

  // Extract system prompt (Anthropic uses separate `system` param, not message role)
  let systemPrompt: string | undefined;
  const userMessages: AIMessage[] = [];

  for (const msg of options.messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${text}` : text;
    } else {
      userMessages.push(msg);
    }
  }

  // If jsonMode, append instruction to system prompt (Anthropic doesn't have json_mode)
  if (options.jsonMode && systemPrompt) {
    systemPrompt += "\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just JSON.";
  }

  // Convert messages to Anthropic format
  const anthropicMessages = userMessages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role as "user" | "assistant", content: msg.content };
    }

    // Convert content array to Anthropic format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];

    for (const part of msg.content) {
      if (part.type === "text" && part.text) {
        content.push({ type: "text" as const, text: part.text });
      } else if (part.type === "image_url" && part.image_url?.url) {
        // Parse data URL: data:image/png;base64,xxx
        const match = part.image_url.url.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          content.push({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: match[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
              data: match[2],
            },
          });
        }
      }
      // Note: Anthropic doesn't support PDF-as-file — skip `file` type
    }

    return { role: msg.role as "user" | "assistant", content };
  });

  try {
    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: anthropicMessages,
    });

    // Extract text from response
    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    return {
      success: true,
      content: textContent,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      rawResponse: response,
    };
  } catch (err) {
    console.error("Anthropic error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Anthropic API request failed",
      rawResponse: err,
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers (preserved from original)
// ---------------------------------------------------------------------------

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
  } catch {
    return { success: false, error: "Failed to parse AI response as JSON" };
  }
}
