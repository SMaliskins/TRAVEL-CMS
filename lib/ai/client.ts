/**
 * AI Client — legacy facade over the Vercel AI SDK.
 *
 * Historically this file owned the raw `fetch` to OpenAI / Anthropic.
 * Today the actual provider calls live in `./sdk.ts` (via Vercel AI SDK).
 * This file is preserved as a backwards-compatible shim because many
 * non-parsing call sites (chat helpers, dashboards, ad-hoc prompts) still
 * import `aiComplete`, `aiQuickPrompt`, `aiVision`, `aiJSON`.
 *
 * New code should call `aiCompleteStructured` from `./sdk.ts` directly.
 */

import { AI_CONFIGS } from "./config";
import { aiCompleteText } from "./sdk";

// ---------------------------------------------------------------------------
// Public types (kept for backwards compatibility with existing imports)
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
  /**
   * Legacy field — kept only for compatibility.
   * Schema-enforced output now lives in `aiCompleteStructured` (sdk.ts).
   * When set on this entry point, `jsonMode` is enabled instead.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
  maxTokens?: number;
  temperature?: number;
  /** Request timeout in ms (default 60000) */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Main entry point — delegates to sdk.ts
// ---------------------------------------------------------------------------

export async function aiComplete(options: AICompletionOptions): Promise<AIResponse> {
  return aiCompleteText({
    configKey: options.configKey || "fast",
    messages: options.messages,
    jsonMode: options.jsonMode || !!options.jsonSchema,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    timeout: options.timeout ?? 60_000,
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers (same signatures as before)
// ---------------------------------------------------------------------------

export async function aiQuickPrompt(
  prompt: string,
  systemPrompt?: string,
): Promise<string | null> {
  const messages: AIMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  const result = await aiComplete({ configKey: "fast", messages });
  return result.success ? result.content || null : null;
}

export async function aiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  systemPrompt?: string,
): Promise<AIResponse> {
  const messages: AIMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
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
      { type: "text", text: prompt },
    ],
  });
  return aiComplete({ configKey: "vision", messages });
}

export async function aiJSON<T>(
  prompt: string,
  systemPrompt: string,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await aiComplete({
    configKey: "fast",
    messages: [
      { role: "system", content: systemPrompt + "\n\nAlways respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    jsonMode: true,
  });
  if (!result.success) return { success: false, error: result.error };
  try {
    const data = JSON.parse(result.content || "{}") as T;
    return { success: true, data };
  } catch {
    return { success: false, error: "Failed to parse AI response as JSON" };
  }
}
