/**
 * Parse Orchestrator — single entry point for all document parsing.
 *
 * Flow: intake -> load rules -> build prompt -> SDK structured call ->
 *       validate -> retry-with-feedback -> provider fallback -> log -> return
 *
 * Powered by Vercel AI SDK (`Output.object` with Zod schema). The previous
 * hand-rolled OpenAI Structured Outputs path lives only as a legacy escape
 * hatch in `client.ts` for non-parsing call sites.
 */

import { z } from "zod";
import type { AIMessage, AIMessageContent, AIResponse } from "./client";
import { aiCompleteStructured, type StructuredResponse } from "./sdk";
import { processFile, processRequest, type IntakeResult } from "./documentIntake";
import { PARSE_SCHEMAS, type DocumentType } from "./parseSchemas";
import { buildSystemPrompt } from "./parsePrompts";
import { buildCacheKey, readCache, writeCache } from "./parseCache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAiUsage } from "@/lib/aiUsageLogger";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParseOptions {
  file?: Buffer;
  text?: string;
  filename?: string;
  mimeType?: string;
  documentType: DocumentType;
  companyId: string;
  userId: string;
  orderId?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** HTTP-style hint so route handlers can pick 422 / 502 / 504 etc. */
  errorCode?: "validation" | "provider" | "timeout" | "intake" | "unknown";
  confidence: number;
  warnings: string[];
  retryCount: number;
  model: string;
  provider: string;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// parseDocument — file-based entry (Buffer in)
// ---------------------------------------------------------------------------

export async function parseDocument<T>(options: ParseOptions): Promise<ParseResult<T>> {
  const start = Date.now();
  const { documentType, companyId, userId } = options;

  try {
    const intake = await processFile({
      file: options.file,
      text: options.text,
      filename: options.filename,
      mimeType: options.mimeType,
      documentType,
    });

    return await runPipeline<T>({
      intake,
      documentType,
      companyId,
      userId,
      start,
    });
  } catch (err) {
    return failure<T>(start, "intake", err);
  }
}

// ---------------------------------------------------------------------------
// parseFromRequest — NextRequest entry (multipart / JSON in)
// ---------------------------------------------------------------------------

export async function parseFromRequest<T>(
  request: NextRequest,
  documentType: DocumentType,
  companyId: string,
  userId: string,
  userFeedback?: string,
  promptExtensions?: { fewShotExamples?: string },
): Promise<ParseResult<T>> {
  const start = Date.now();
  try {
    const intake = await processRequest(request, documentType);
    return await runPipeline<T>({
      intake,
      documentType,
      companyId,
      userId,
      start,
      userFeedback,
      promptExtensions,
    });
  } catch (err) {
    return failure<T>(start, "intake", err);
  }
}

// ---------------------------------------------------------------------------
// Shared pipeline (retry + fallback + validation feedback)
// ---------------------------------------------------------------------------

interface RunPipelineArgs {
  intake: IntakeResult;
  documentType: DocumentType;
  companyId: string;
  userId: string;
  start: number;
  userFeedback?: string;
  promptExtensions?: { fewShotExamples?: string };
}

const MAX_RETRIES = 2;

async function runPipeline<T>({
  intake,
  documentType,
  companyId,
  userId,
  start,
  userFeedback,
  promptExtensions,
}: RunPipelineArgs): Promise<ParseResult<T>> {
  const schemaEntry = PARSE_SCHEMAS[documentType];

  // Cache lookup — only meaningful when there's no per-call user feedback
  // (feedback fundamentally changes the desired output).
  const cacheKey = buildCacheKey(documentType, intake);
  if (!userFeedback) {
    const hit = await readCache<T>(cacheKey, documentType);
    if (hit) {
      return {
        success: true,
        data: hit.data,
        confidence: hit.confidence,
        warnings: [],
        retryCount: 0,
        model: hit.model || "cache",
        provider: hit.provider || "cache",
        latencyMs: Date.now() - start,
      };
    }
  }

  const rules = await loadActiveRules(companyId, documentType);
  let systemPrompt = buildSystemPrompt(documentType, rules);

  if (promptExtensions?.fewShotExamples?.trim()) {
    systemPrompt +=
      "\n\n--- FEW-SHOT EXAMPLES (similar previously-parsed documents) ---\n" +
      promptExtensions.fewShotExamples.trim();
  }

  if (userFeedback?.trim()) {
    systemPrompt +=
      `\n\n--- USER FEEDBACK (CRITICAL — follow these instructions) ---\n` +
      `The user reviewed the previous result and says: "${userFeedback.trim()}"\n` +
      `Make sure to address this feedback. Extract ALL fields the user mentions are missing.\n---`;
  }

  const primaryConfigKey =
    intake.contentMode === "text" ? "parsing_text" : "parsing_vision";

  let lastWarnings: string[] = [];
  let lastResult: ParseResult<T> | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const messages = buildMessages(intake, systemPrompt, attempt > 0 ? lastWarnings : undefined);

    // Primary call (with built-in fallback to Anthropic on failure).
    const aiResult = await aiCompleteStructured<T>({
      configKey: primaryConfigKey,
      fallbackConfigKey: "parsing_fallback",
      messages,
      schema: schemaEntry.schema as unknown as z.ZodType<T>,
      schemaName: `${documentType}_output`,
      timeout: 90_000,
    });

    if (!aiResult.success || !aiResult.data) {
      lastResult = {
        success: false,
        error: aiResult.error || "AI provider returned no data",
        errorCode: aiResult.error?.toLowerCase().includes("abort") ? "timeout" : "provider",
        confidence: 0,
        warnings: [],
        retryCount: attempt,
        model: aiResult.model || "unknown",
        provider: aiResult.provider || "unknown",
        latencyMs: Date.now() - start,
      };
      // No point retrying if both providers failed; break early.
      break;
    }

    const validated = validateAndScore<T>(aiResult.data, schemaEntry, documentType);
    await logParseUsage(companyId, userId, documentType, aiResult, attempt);

    if (validated.success && validated.confidence >= 0.5) {
      // Persist high-confidence results for future identical inputs.
      if (!userFeedback && validated.data && validated.confidence >= 0.7) {
        void writeCache(
          cacheKey,
          documentType,
          validated.data,
          validated.confidence,
          aiResult.model || "unknown",
          aiResult.provider || "unknown",
        );
      }
      return {
        ...validated,
        retryCount: attempt,
        model: aiResult.model || "unknown",
        provider: aiResult.provider || "unknown",
        latencyMs: Date.now() - start,
      };
    }

    lastWarnings = validated.warnings;
    lastResult = {
      ...validated,
      errorCode: validated.success ? undefined : "validation",
      retryCount: attempt,
      model: aiResult.model || "unknown",
      provider: aiResult.provider || "unknown",
      latencyMs: Date.now() - start,
    };
  }

  return (
    lastResult ||
    failure<T>(start, "unknown", new Error("All parsing attempts failed"))
  );
}

// ---------------------------------------------------------------------------
// Message building
// ---------------------------------------------------------------------------

function buildMessages(
  intake: IntakeResult,
  systemPrompt: string,
  retryWarnings?: string[],
): AIMessage[] {
  const messages: AIMessage[] = [{ role: "system", content: systemPrompt }];
  const userContent: AIMessageContent[] = [];

  if (retryWarnings && retryWarnings.length > 0) {
    userContent.push({
      type: "text",
      text:
        `Previous extraction was incomplete or failed validation. Issues:\n` +
        retryWarnings.slice(0, 12).map((w) => `- ${w}`).join("\n") +
        `\nPlease re-extract carefully, paying special attention to the fields above.`,
    });
  }

  if (intake.contentMode === "vision" || intake.contentMode === "hybrid") {
    if (intake.pdfBase64) {
      userContent.push({
        type: "file",
        file: {
          filename: intake.sourceMeta.originalFilename || "document.pdf",
          file_data: `data:application/pdf;base64,${intake.pdfBase64}`,
        },
      });
    }
    for (const img of intake.pageImages) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${img}`, detail: "high" },
      });
    }
  }

  if (
    intake.extractedText &&
    (intake.contentMode === "text" || intake.contentMode === "hybrid")
  ) {
    userContent.push({
      type: "text",
      text: `Extract structured data from this document:\n\n${intake.extractedText.slice(0, 120_000)}`,
    });
  } else if (
    userContent.length === 0 ||
    (userContent.length === 1 && retryWarnings)
  ) {
    userContent.push({
      type: "text",
      text: "Extract all structured data from this document. Return JSON only.",
    });
  }

  messages.push({ role: "user", content: userContent });
  return messages;
}

// ---------------------------------------------------------------------------
// Validation & scoring (now operates on already-parsed objects from the SDK)
// ---------------------------------------------------------------------------

function validateAndScore<T>(
  raw: unknown,
  schemaEntry: { schema: z.ZodType; required: readonly string[] },
  documentType: DocumentType,
): { success: boolean; data?: T; confidence: number; warnings: string[] } {
  const warnings: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { success: false, confidence: 0, warnings: ["AI returned non-object output"] };
  }

  const unwrapped = unwrapNestedResult(raw as Record<string, unknown>, documentType);
  nullsToUndefined(unwrapped);

  const parseResult = schemaEntry.schema.safeParse(unwrapped);
  if (!parseResult.success) {
    const partial = unwrapped as T;
    const zodErrors = parseResult.error.issues.map(
      (i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`,
    );
    warnings.push(...zodErrors);
    const confidence = calculateConfidence(unwrapped, schemaEntry.required);
    return { success: confidence > 0, data: partial, confidence, warnings };
  }

  const data = parseResult.data as T;
  const confidence = calculateConfidence(data, schemaEntry.required);

  for (const field of schemaEntry.required) {
    const value = (data as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === "") {
      warnings.push(`Missing required field: ${field}`);
    }
  }

  return { success: true, data, confidence, warnings };
}

function calculateConfidence(data: unknown, requiredFields: readonly string[]): number {
  if (!data || typeof data !== "object") return 0;
  const obj = data as Record<string, unknown>;

  const allFields = Object.keys(obj);
  const filledFields = allFields.filter((k) => isFilled(obj[k]));
  const requiredFilled = requiredFields.filter((f) => isFilled(obj[f]));

  const requiredScore =
    requiredFields.length > 0 ? requiredFilled.length / requiredFields.length : 1;
  const fillRate = allFields.length > 0 ? filledFields.length / allFields.length : 0;
  return Math.round((requiredScore * 0.7 + fillRate * 0.3) * 100) / 100;
}

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function nullsToUndefined(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (obj[key] === null) {
      delete obj[key];
    } else if (Array.isArray(obj[key])) {
      const arr = obj[key] as unknown[];
      for (const item of arr) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          nullsToUndefined(item as Record<string, unknown>);
        }
      }
    } else if (typeof obj[key] === "object") {
      nullsToUndefined(obj[key] as Record<string, unknown>);
    }
  }
}

function unwrapNestedResult(
  obj: Record<string, unknown>,
  documentType: DocumentType,
): Record<string, unknown> {
  const wrapperKeys: Record<DocumentType, string[]> = {
    passport: ["passport"],
    flight_ticket: [],
    package_tour: ["parsed", "tour"],
    invoice: ["invoice", "parsed"],
    expense: ["expense", "parsed"],
    company_doc: ["company", "parsed"],
  };
  const keys = wrapperKeys[documentType] || [];
  for (const key of keys) {
    if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      return obj[key] as Record<string, unknown>;
    }
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failure<T>(
  start: number,
  errorCode: ParseResult<T>["errorCode"],
  err: unknown,
): ParseResult<T> {
  return {
    success: false,
    error: err instanceof Error ? err.message : "Parsing failed",
    errorCode,
    confidence: 0,
    warnings: [],
    retryCount: 0,
    model: "unknown",
    provider: "unknown",
    latencyMs: Date.now() - start,
  };
}

async function loadActiveRules(
  companyId: string,
  documentType: DocumentType,
): Promise<{ rule_text: string; id: string }[]> {
  try {
    const { data } = await supabaseAdmin
      .from("parse_rules")
      .select("id, rule_text")
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .eq("document_type", documentType)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(50);
    return (data || []) as { rule_text: string; id: string }[];
  } catch {
    return [];
  }
}

async function logParseUsage(
  companyId: string,
  userId: string,
  documentType: DocumentType,
  aiResult: AIResponse | StructuredResponse<unknown>,
  retryCount: number,
): Promise<void> {
  try {
    await logAiUsage({
      companyId,
      userId,
      operation: `parse_${documentType}`,
      model: aiResult.model || "unknown",
      inputTokens: aiResult.usage?.promptTokens || 0,
      outputTokens: aiResult.usage?.completionTokens || 0,
      success: aiResult.success,
      metadata: {
        provider: aiResult.provider,
        retryCount,
        latencyMs: aiResult.latencyMs,
      },
    });
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
// HTTP status helper for route handlers
// ---------------------------------------------------------------------------

export function parseErrorToStatus(code: ParseResult<unknown>["errorCode"]): number {
  switch (code) {
    case "validation":
      return 422;
    case "timeout":
      return 504;
    case "provider":
      return 502;
    case "intake":
      return 400;
    default:
      return 500;
  }
}
