/**
 * AI SDK wrapper — Vercel AI SDK based structured-output entry point.
 *
 * Replaces direct `fetch` to OpenAI/Anthropic with the official Vercel AI SDK,
 * giving us:
 *   - Built-in retry, timeout, schema validation
 *   - Cross-provider message format
 *   - Easy swap to Vercel AI Gateway later (single env var, no code change here)
 *
 * Existing `aiComplete` in client.ts is kept as a thin shim for legacy callers.
 * New parsing pipeline uses `aiCompleteStructured` directly.
 */

import { generateText, Output, gateway, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { z } from "zod";

import type { AIMessage, AIMessageContent, AIResponse } from "./client";
import { AI_CONFIGS, getAPIKey, type AIProvider } from "./config";

const USE_GATEWAY = !!process.env.AI_GATEWAY_API_KEY;

// ---------------------------------------------------------------------------
// Legacy → SDK message conversion
// ---------------------------------------------------------------------------

/**
 * Convert our internal AIMessage[] (with image_url / file content parts)
 * to the AI SDK's ModelMessage[] format. Provider-agnostic.
 */
export function toModelMessages(messages: AIMessage[]): ModelMessage[] {
  return messages.map((msg): ModelMessage => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content } as ModelMessage;
    }
    const parts = msg.content
      .map((p) => convertPart(p))
      .filter((p): p is NonNullable<ReturnType<typeof convertPart>> => p !== null);
    return { role: msg.role, content: parts } as ModelMessage;
  });
}

function convertPart(part: AIMessageContent) {
  if (part.type === "text" && part.text) {
    return { type: "text" as const, text: part.text };
  }
  if (part.type === "image_url" && part.image_url?.url) {
    // Data URL or http(s) URL — both are valid for the SDK `image` field.
    return { type: "image" as const, image: part.image_url.url };
  }
  if (part.type === "file" && part.file?.file_data) {
    // Strip data URL prefix if present, the SDK accepts base64 string with mediaType.
    const dataUrl = part.file.file_data;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        type: "file" as const,
        mediaType: match[1],
        data: match[2],
        filename: part.file.filename,
      };
    }
    return {
      type: "file" as const,
      mediaType: "application/pdf",
      data: dataUrl,
      filename: part.file.filename,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

function getModel(provider: AIProvider, modelId: string) {
  // When AI_GATEWAY_API_KEY is set, route every call through Vercel AI Gateway
  // for unified observability, automatic failover, rate-limiting and caching.
  // Format is `provider/model-id` (e.g. `openai/gpt-4o`).
  if (USE_GATEWAY) {
    return gateway(`${provider}/${modelId}`);
  }
  switch (provider) {
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// Structured-output entry point
// ---------------------------------------------------------------------------

export interface StructuredOptions<T> {
  configKey: keyof typeof AI_CONFIGS;
  messages: AIMessage[];
  schema: z.ZodType<T>;
  /** Optional schema name (for provider-side caching / debugging) */
  schemaName?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  /** If primary provider fails, try this config as fallback */
  fallbackConfigKey?: keyof typeof AI_CONFIGS;
}

export interface StructuredResponse<T> extends AIResponse {
  data?: T;
}

/**
 * Generate validated structured output via Vercel AI SDK.
 *
 * Behaviour:
 *   1. Call primary provider with `Output.object({ schema })` — the SDK
 *      enforces the schema (Structured Outputs on OpenAI, JSON mode on
 *      Anthropic) and validates with Zod.
 *   2. If primary fails (network, auth, schema-violation thrown by SDK), and
 *      `fallbackConfigKey` is supplied, retry with the fallback provider.
 *   3. Return a uniform `{ success, data, content, usage, model, provider }`
 *      shape compatible with the legacy `AIResponse` envelope.
 */
export async function aiCompleteStructured<T>(
  options: StructuredOptions<T>,
): Promise<StructuredResponse<T>> {
  const primary = AI_CONFIGS[options.configKey];
  const primaryResult = await tryProvider<T>(primary, options);
  if (primaryResult.success) return primaryResult;

  if (options.fallbackConfigKey) {
    const fallback = AI_CONFIGS[options.fallbackConfigKey];
    if (fallback.provider !== primary.provider || fallback.model !== primary.model) {
      const fallbackResult = await tryProvider<T>(fallback, options);
      if (fallbackResult.success) return fallbackResult;
    }
  }
  return primaryResult;
}

async function tryProvider<T>(
  config: (typeof AI_CONFIGS)[keyof typeof AI_CONFIGS],
  options: StructuredOptions<T>,
): Promise<StructuredResponse<T>> {
  const start = Date.now();
  const apiKey = getAPIKey(config.provider);
  if (!apiKey) {
    return {
      success: false,
      error: `Missing API key for provider ${config.provider}`,
      provider: config.provider,
      model: config.model,
      latencyMs: 0,
    };
  }

  try {
    const modelMessages = toModelMessages(options.messages);
    const result = await generateText({
      model: getModel(config.provider, config.model),
      messages: modelMessages,
      output: Output.object({ schema: options.schema }),
      maxOutputTokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
      abortSignal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    return {
      success: true,
      data: result.output as T,
      content: typeof result.text === "string" ? result.text : JSON.stringify(result.output),
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
      rawResponse: result.response,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI SDK call failed",
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
      rawResponse: err,
    };
  }
}

// ---------------------------------------------------------------------------
// Plain text generation via SDK (used by aiComplete shim)
// ---------------------------------------------------------------------------

export interface TextOptions {
  configKey: keyof typeof AI_CONFIGS;
  messages: AIMessage[];
  /** If true, instructs the model to return JSON (no schema enforcement). */
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export async function aiCompleteText(options: TextOptions): Promise<AIResponse> {
  const config = AI_CONFIGS[options.configKey];
  const start = Date.now();
  const apiKey = getAPIKey(config.provider);
  if (!apiKey) {
    return {
      success: false,
      error: `Missing API key for provider ${config.provider}`,
      provider: config.provider,
      model: config.model,
      latencyMs: 0,
    };
  }

  try {
    const modelMessages = toModelMessages(options.messages);

    // For JSON mode without a schema, append a hint to the system message;
    // SDK has no first-class "json_object" mode without Output.object.
    if (options.jsonMode) {
      const sysIdx = modelMessages.findIndex((m) => m.role === "system");
      const jsonHint =
        "\n\nReturn ONLY valid JSON. No markdown fences, no commentary.";
      if (sysIdx >= 0) {
        const m = modelMessages[sysIdx];
        if (typeof m.content === "string") {
          modelMessages[sysIdx] = { role: "system", content: m.content + jsonHint };
        }
      } else {
        modelMessages.unshift({ role: "system", content: jsonHint.trim() });
      }
    }

    const result = await generateText({
      model: getModel(config.provider, config.model),
      messages: modelMessages,
      maxOutputTokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
      abortSignal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    return {
      success: true,
      content: result.text,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
      rawResponse: result.response,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI SDK call failed",
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
      rawResponse: err,
    };
  }
}
