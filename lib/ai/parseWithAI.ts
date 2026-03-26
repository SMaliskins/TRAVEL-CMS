/**
 * Parse Orchestrator — single entry point for all document parsing.
 *
 * Flow: intake → load rules → build prompt → AI call → validate → retry → log → return
 */

import { z } from "zod";
import { aiComplete, type AIMessage, type AIMessageContent, type AIResponse } from "./client";
import { processFile, processRequest, type IntakeResult, type ContentMode } from "./documentIntake";
import { PARSE_SCHEMAS, zodSchemaToOpenAI, type DocumentType } from "./parseSchemas";
import { buildSystemPrompt } from "./parsePrompts";
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
  confidence: number;
  warnings: string[];
  retryCount: number;
  model: string;
  provider: string;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a document using the unified pipeline.
 *
 * @example
 * const result = await parseDocument<PackageTourData>({
 *   file: buffer,
 *   filename: "contract.pdf",
 *   documentType: "package_tour",
 *   companyId: auth.companyId,
 *   userId: auth.userId,
 * });
 */
export async function parseDocument<T>(options: ParseOptions): Promise<ParseResult<T>> {
  const start = Date.now();
  const { documentType, companyId, userId } = options;
  const schemaEntry = PARSE_SCHEMAS[documentType];

  try {
    // 1. INTAKE
    const intake = await processFile({
      file: options.file,
      text: options.text,
      filename: options.filename,
      mimeType: options.mimeType,
      documentType,
    });

    // 2. LOAD RULES FROM DB
    const rules = await loadActiveRules(companyId, documentType);

    // 3. BUILD PROMPT
    const systemPrompt = buildSystemPrompt(documentType, rules);

    // 4. CHOOSE MODEL CONFIG
    const configKey = intake.contentMode === "text" ? "parsing_text" : "parsing_vision";

    // 5. BUILD JSON SCHEMA for Structured Outputs (OpenAI only)
    let jsonSchema: { name: string; schema: Record<string, unknown>; strict: boolean } | undefined;
    try {
      jsonSchema = await zodSchemaToOpenAI(schemaEntry.schema, `${documentType}_output`);
    } catch {
      // Fallback: no structured output, rely on prompt + JSON mode
    }

    // 6. CALL AI (with retry on validation failure)
    let lastResult: ParseResult<T> | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const messages = buildMessages(intake, systemPrompt, attempt > 0 ? lastResult?.warnings : undefined);

      const aiResult = await aiComplete({
        configKey: configKey as "parsing_text" | "parsing_vision",
        messages,
        jsonSchema,
        jsonMode: !jsonSchema, // use jsonMode as fallback when no schema
        timeout: 90_000,
      });

      if (!aiResult.success) {
        // If OpenAI fails and this is first attempt, try fallback provider
        if (attempt === 0) {
          const fallbackResult = await tryFallback(intake, systemPrompt, documentType);
          if (fallbackResult?.success) {
            const validated = validateAndScore<T>(fallbackResult.content || "", schemaEntry, documentType);
            await logParseUsage(companyId, userId, documentType, fallbackResult, attempt + 1);
            return {
              ...validated,
              retryCount: attempt + 1,
              model: fallbackResult.model || "unknown",
              provider: fallbackResult.provider || "unknown",
              latencyMs: Date.now() - start,
            };
          }
        }

        lastResult = {
          success: false,
          error: aiResult.error,
          confidence: 0,
          warnings: [],
          retryCount: attempt,
          model: aiResult.model || "unknown",
          provider: aiResult.provider || "unknown",
          latencyMs: Date.now() - start,
        };
        continue;
      }

      // 7. VALIDATE
      const validated = validateAndScore<T>(aiResult.content || "", schemaEntry, documentType);

      // Log usage
      await logParseUsage(companyId, userId, documentType, aiResult, attempt);

      if (validated.success && validated.confidence >= 0.5) {
        return {
          ...validated,
          retryCount: attempt,
          model: aiResult.model || "unknown",
          provider: aiResult.provider || "unknown",
          latencyMs: Date.now() - start,
        };
      }

      // Prepare for retry
      lastResult = {
        ...validated,
        retryCount: attempt,
        model: aiResult.model || "unknown",
        provider: aiResult.provider || "unknown",
        latencyMs: Date.now() - start,
      };
    }

    // Return best result even if low confidence
    return lastResult || {
      success: false,
      error: "All parsing attempts failed",
      confidence: 0,
      warnings: [],
      retryCount: maxRetries,
      model: "unknown",
      provider: "unknown",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Parsing failed",
      confidence: 0,
      warnings: [],
      retryCount: 0,
      model: "unknown",
      provider: "unknown",
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Parse directly from a NextRequest (convenience for API routes).
 */
export async function parseFromRequest<T>(
  request: NextRequest,
  documentType: DocumentType,
  companyId: string,
  userId: string,
  userFeedback?: string
): Promise<ParseResult<T>> {
  const start = Date.now();
  const schemaEntry = PARSE_SCHEMAS[documentType];

  try {
    const intake = await processRequest(request, documentType);
    const rules = await loadActiveRules(companyId, documentType);
    let systemPrompt = buildSystemPrompt(documentType, rules);

    // Inject user feedback as additional instructions (for re-parse with corrections)
    if (userFeedback && userFeedback.trim()) {
      systemPrompt += `\n\n--- USER FEEDBACK (CRITICAL — follow these instructions) ---\nThe user reviewed the previous result and says: "${userFeedback.trim()}"\nMake sure to address this feedback. Extract ALL fields the user mentions are missing.\n---`;
    }

    const configKey = intake.contentMode === "text" ? "parsing_text" : "parsing_vision";

    let jsonSchema: { name: string; schema: Record<string, unknown>; strict: boolean } | undefined;
    try {
      jsonSchema = await zodSchemaToOpenAI(schemaEntry.schema, `${documentType}_output`);
    } catch { /* fallback to jsonMode */ }

    const messages = buildMessages(intake, systemPrompt);

    const aiResult = await aiComplete({
      configKey: configKey as "parsing_text" | "parsing_vision",
      messages,
      jsonSchema,
      jsonMode: !jsonSchema,
      timeout: 90_000,
    });

    if (!aiResult.success) {
      return {
        success: false,
        error: aiResult.error,
        confidence: 0,
        warnings: [],
        retryCount: 0,
        model: aiResult.model || "unknown",
        provider: aiResult.provider || "unknown",
        latencyMs: Date.now() - start,
      };
    }

    const validated = validateAndScore<T>(aiResult.content || "", schemaEntry, documentType);
    await logParseUsage(companyId, userId, documentType, aiResult, 0);

    return {
      ...validated,
      retryCount: 0,
      model: aiResult.model || "unknown",
      provider: aiResult.provider || "unknown",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Parsing failed",
      confidence: 0,
      warnings: [],
      retryCount: 0,
      model: "unknown",
      provider: "unknown",
      latencyMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Message building
// ---------------------------------------------------------------------------

function buildMessages(
  intake: IntakeResult,
  systemPrompt: string,
  retryWarnings?: string[]
): AIMessage[] {
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Build user message based on content mode
  const userContent: AIMessageContent[] = [];

  // Add retry hint if this is a retry
  if (retryWarnings && retryWarnings.length > 0) {
    userContent.push({
      type: "text",
      text: `Previous extraction was incomplete. Missing/invalid: ${retryWarnings.join(", ")}. Please extract more carefully.`,
    });
  }

  // Add content based on mode
  if (intake.contentMode === "vision" || intake.contentMode === "hybrid") {
    // Prefer native PDF for OpenAI
    if (intake.pdfBase64) {
      userContent.push({
        type: "file",
        file: {
          filename: intake.sourceMeta.originalFilename || "document.pdf",
          file_data: `data:application/pdf;base64,${intake.pdfBase64}`,
        },
      });
    }

    // Add page images if available (fallback for providers that don't support PDF)
    for (const img of intake.pageImages) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${img}`,
          detail: "high",
        },
      });
    }
  }

  // Add text content
  if (intake.extractedText && (intake.contentMode === "text" || intake.contentMode === "hybrid")) {
    userContent.push({
      type: "text",
      text: `Extract structured data from this document:\n\n${intake.extractedText.slice(0, 120_000)}`,
    });
  } else if (userContent.length === 0 || (userContent.length === 1 && retryWarnings)) {
    // Vision-only with no text — add instruction
    userContent.push({
      type: "text",
      text: "Extract all structured data from this document. Return JSON only.",
    });
  }

  messages.push({ role: "user", content: userContent });

  return messages;
}

// ---------------------------------------------------------------------------
// Validation & scoring
// ---------------------------------------------------------------------------

function validateAndScore<T>(
  content: string,
  schemaEntry: { schema: z.ZodType; required: readonly string[] },
  documentType: DocumentType
): { success: boolean; data?: T; confidence: number; warnings: string[] } {
  const warnings: string[] = [];

  // Extract JSON from response
  const json = extractJSON(content);
  if (!json) {
    return { success: false, confidence: 0, warnings: ["Failed to parse JSON from AI response"] };
  }

  // Unwrap nested objects (e.g. { "passport": {...} } → {...})
  const unwrapped = unwrapNestedResult(json, documentType);

  // Convert null → undefined (OpenAI Structured Outputs returns null for optional fields,
  // but Zod v4 .optional() only accepts undefined, not null)
  nullsToUndefined(unwrapped);

  // Validate with Zod
  const parseResult = schemaEntry.schema.safeParse(unwrapped);
  if (!parseResult.success) {
    // Try to extract what we can even if validation fails
    const partial = unwrapped as T;
    const zodErrors = parseResult.error.issues.map(
      (i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`
    );
    warnings.push(...zodErrors);

    const confidence = calculateConfidence(unwrapped, schemaEntry.required);
    return { success: confidence > 0, data: partial, confidence, warnings };
  }

  const data = parseResult.data as T;
  const confidence = calculateConfidence(data, schemaEntry.required);

  // Check required fields
  for (const field of schemaEntry.required) {
    const value = (data as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === "") {
      warnings.push(`Missing required field: ${field}`);
    }
  }

  return { success: true, data, confidence, warnings };
}

function calculateConfidence(
  data: unknown,
  requiredFields: readonly string[]
): number {
  if (!data || typeof data !== "object") return 0;
  const obj = data as Record<string, unknown>;

  // Count all non-empty fields
  const allFields = Object.keys(obj);
  const filledFields = allFields.filter((k) => {
    const v = obj[k];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  // Required fields satisfaction
  const requiredFilled = requiredFields.filter((f) => {
    const v = obj[f];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  const requiredScore = requiredFields.length > 0
    ? requiredFilled.length / requiredFields.length
    : 1;

  // Overall fill rate
  const fillRate = allFields.length > 0
    ? filledFields.length / allFields.length
    : 0;

  // Weighted: 70% required fields, 30% fill rate
  return Math.round((requiredScore * 0.7 + fillRate * 0.3) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Null → undefined conversion
// ---------------------------------------------------------------------------

/**
 * Recursively convert null values to undefined in an object.
 * OpenAI Structured Outputs returns null for optional fields,
 * but Zod v4 .optional() only accepts undefined.
 */
function nullsToUndefined(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (obj[key] === null) {
      delete obj[key]; // delete = undefined for Zod
    } else if (Array.isArray(obj[key])) {
      // Recurse into arrays, but filter out null items
      const arr = obj[key] as unknown[];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && typeof arr[i] === "object" && !Array.isArray(arr[i])) {
          nullsToUndefined(arr[i] as Record<string, unknown>);
        }
      }
    } else if (typeof obj[key] === "object") {
      nullsToUndefined(obj[key] as Record<string, unknown>);
    }
  }
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

function extractJSON(content: string): Record<string, unknown> | null {
  if (!content) return null;

  // Strip markdown code fences
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```\s*$/i, "");
    cleaned = cleaned.trim();
  }

  // Try direct parse
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Try extracting JSON object from text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
  }

  return null;
}

/**
 * Some AI responses wrap the data: { "passport": {...} } or { "parsed": {...} }.
 * Unwrap to get the actual data object.
 */
function unwrapNestedResult(
  obj: Record<string, unknown>,
  documentType: DocumentType
): Record<string, unknown> {
  const wrapperKeys: Record<DocumentType, string[]> = {
    passport: ["passport"],
    flight_ticket: [], // flight_ticket has booking + segments at top level
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
// Fallback provider
// ---------------------------------------------------------------------------

async function tryFallback(
  intake: IntakeResult,
  systemPrompt: string,
  _documentType: DocumentType
): Promise<AIResponse | null> {
  // Only try fallback for vision/hybrid modes where Anthropic can help
  if (intake.contentMode === "text" && intake.extractedText) {
    const messages = buildMessages(intake, systemPrompt);
    return aiComplete({
      configKey: "parsing_fallback",
      messages,
      jsonMode: true,
      timeout: 90_000,
    });
  }

  // Anthropic vision needs images, not PDF — skip if only PDF available
  if (intake.pageImages.length > 0) {
    const messages = buildMessages(
      { ...intake, pdfBase64: null }, // remove PDF, use images only
      systemPrompt
    );
    return aiComplete({
      configKey: "parsing_fallback",
      messages,
      jsonMode: true,
      timeout: 90_000,
    });
  }

  return null;
}

// ---------------------------------------------------------------------------
// DB: load correction rules
// ---------------------------------------------------------------------------

async function loadActiveRules(
  companyId: string,
  documentType: DocumentType
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
    // Table may not exist yet — gracefully return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// Usage logging
// ---------------------------------------------------------------------------

async function logParseUsage(
  companyId: string,
  userId: string,
  documentType: DocumentType,
  aiResult: AIResponse,
  retryCount: number
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
    // Non-fatal
  }
}
