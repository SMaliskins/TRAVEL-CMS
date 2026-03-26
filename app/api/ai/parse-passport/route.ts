import { NextRequest, NextResponse } from "next/server";
import { extractTd3MrzLinesFromText, parseMrzToPassportData } from "@/lib/passport/parseMrz";
import type { PassportDataFromMrz } from "@/lib/passport/parseMrz";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { aiComplete, type AIMessage, type AIMessageContent } from "@/lib/ai/client";
import { processRequest } from "@/lib/ai/documentIntake";
import { buildSystemPrompt } from "@/lib/ai/parsePrompts";
import { logAiUsage } from "@/lib/aiUsageLogger";

/**
 * AI-powered passport parsing
 *
 * Uses unified pipeline for file intake + AI client,
 * but keeps passport-specific orchestration:
 * - MRZ library parsing (pre-AI, most reliable for DOB/expiry)
 * - Dual-model: OpenAI primary + Anthropic fallback
 * - Merge results from both models
 * - MRZ overrides on final result
 *
 * Supports: Image (base64/FormData), PDF (FormData), Text (JSON body)
 */

interface PassportData {
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportIssuingCountry?: string;
  passportFullName?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  nationality?: string;
  personalCode?: string;
  gender?: string;
  isAlienPassport?: boolean;
}

// ---------------------------------------------------------------------------
// Normalization helpers (passport-specific)
// ---------------------------------------------------------------------------

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  UA: "Ukraine", LV: "Latvia", RU: "Russia", DE: "Germany", FR: "France",
  US: "United States", GB: "United Kingdom", PL: "Poland", LT: "Lithuania", EE: "Estonia",
};

function formatDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const eu = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (eu) {
    const [, d, mo, y] = eu;
    const dN = parseInt(d, 10);
    const moN = parseInt(mo, 10);
    if (moN >= 1 && moN <= 12 && dN >= 1 && dN <= 31) {
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  const date = new Date(s);
  if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  return undefined;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

function normalizePassport(passport: Record<string, unknown>): PassportData {
  const get = (camel: string, snake: string): string | undefined => {
    const v = passport[camel] ?? passport[snake];
    return typeof v === "string" ? v.trim() || undefined : undefined;
  };

  let issuingCountry = get("passportIssuingCountry", "passport_issuing_country");
  if (issuingCountry && issuingCountry.length === 2) {
    issuingCountry = COUNTRY_CODE_TO_NAME[issuingCountry.toUpperCase()] || issuingCountry;
  }
  let nationality = (passport.nationality as string)?.trim() || undefined;
  if (nationality && nationality.length === 2) {
    nationality = COUNTRY_CODE_TO_NAME[nationality.toUpperCase()] || nationality;
  }
  let fullName = (passport.passportFullName as string)?.trim() || undefined;
  if (fullName && fullName === fullName.toUpperCase()) fullName = toTitleCase(fullName);

  const g = (passport.gender as string)?.trim()?.toLowerCase();
  const gender =
    g === "male" || g === "female" ? g
    : g === "m" || g === "mr" ? "male"
    : g === "f" || g === "mrs" || g === "ms" ? "female"
    : undefined;

  return {
    passportNumber: (passport.passportNumber as string)?.trim() || undefined,
    passportIssueDate: formatDate(passport.passportIssueDate as string),
    passportExpiryDate: formatDate(passport.passportExpiryDate as string),
    passportIssuingCountry: issuingCountry,
    passportFullName: fullName,
    firstName: passport.firstName ? toTitleCase((passport.firstName as string).trim()) : undefined,
    lastName: passport.lastName ? toTitleCase((passport.lastName as string).trim()) : undefined,
    dob: formatDate(passport.dob as string),
    nationality,
    personalCode: passport.personalCode ? String(passport.personalCode).trim() || undefined : undefined,
    gender: gender === "male" || gender === "female" ? gender : undefined,
    isAlienPassport: passport.isAlienPassport === true,
  };
}

function mergePassports(primary: PassportData, secondary: PassportData): PassportData {
  const merged = { ...primary };
  for (const k of Object.keys(secondary) as (keyof PassportData)[]) {
    const v = secondary[k];
    if (k === "isAlienPassport") {
      merged.isAlienPassport = primary.isAlienPassport === true || secondary.isAlienPassport === true;
    } else if (typeof v === "string" && v && !merged[k]) {
      (merged as Record<string, string | undefined>)[k] = v;
    }
  }
  return merged;
}

function applyMrzOverrides(passport: PassportData, mrzLine1?: string, mrzLine2?: string): PassportData {
  if (!mrzLine1 || !mrzLine2) return passport;
  const mrz = parseMrzToPassportData(`${mrzLine1.trim()}\n${mrzLine2.trim()}`);
  if (!mrz) return passport;
  return {
    ...passport,
    passportNumber: mrz.passportNumber ?? passport.passportNumber,
    passportExpiryDate: mrz.passportExpiryDate ?? passport.passportExpiryDate,
    passportIssuingCountry: mrz.passportIssuingCountry ?? passport.passportIssuingCountry,
    passportFullName: mrz.passportFullName ?? passport.passportFullName,
    firstName: mrz.firstName ?? passport.firstName,
    lastName: mrz.lastName ?? passport.lastName,
    dob: mrz.dob ?? passport.dob,
    nationality: mrz.nationality ?? passport.nationality,
    gender: mrz.gender ?? passport.gender,
  };
}

function mrzBlocksToPassportData(m: PassportDataFromMrz): PassportData {
  return {
    passportNumber: m.passportNumber,
    passportExpiryDate: m.passportExpiryDate,
    passportIssuingCountry: m.passportIssuingCountry,
    passportFullName: m.passportFullName,
    firstName: m.firstName,
    lastName: m.lastName,
    dob: m.dob,
    nationality: m.nationality,
    gender: m.gender,
  };
}

// ---------------------------------------------------------------------------
// JSON extraction from AI response
// ---------------------------------------------------------------------------

function extractPassportFromContent(content: string): {
  passport: PassportData | null;
  mrzLine1?: string;
  mrzLine2?: string;
} {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { passport: null };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const raw = parsed.passport && typeof parsed.passport === "object" ? parsed.passport : parsed;
    const mrzLine1 = typeof raw.mrzLine1 === "string" ? raw.mrzLine1.trim() : undefined;
    const mrzLine2 = typeof raw.mrzLine2 === "string" ? raw.mrzLine2.trim() : undefined;
    return { passport: normalizePassport(raw), mrzLine1, mrzLine2 };
  } catch {
    return { passport: null };
  }
}

// ---------------------------------------------------------------------------
// Build AI messages from intake
// ---------------------------------------------------------------------------

function buildPassportMessages(
  systemPrompt: string,
  intake: { contentMode: string; extractedText: string | null; pageImages: string[]; pdfBase64: string | null }
): AIMessage[] {
  const messages: AIMessage[] = [{ role: "system", content: systemPrompt }];
  const userContent: AIMessageContent[] = [];

  if (intake.contentMode === "text" && intake.extractedText) {
    userContent.push({
      type: "text",
      text: `Parse this passport text and extract all passport information:\n\n${intake.extractedText.slice(0, 120_000)}`,
    });
  } else if (intake.pdfBase64) {
    userContent.push({
      type: "file",
      file: { filename: "passport.pdf", file_data: `data:application/pdf;base64,${intake.pdfBase64}` },
    });
    userContent.push({
      type: "text",
      text: "Extract all passport information from this PDF document. Include isAlienPassport field. Return JSON only.",
    });
  } else if (intake.pageImages.length > 0) {
    for (const img of intake.pageImages) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${img}`, detail: "high" },
      });
    }
    userContent.push({
      type: "text",
      text: "Extract all passport information from this image. Include isAlienPassport field. Return JSON only.",
    });
  }

  messages.push({ role: "user", content: userContent });
  return messages;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authUser = await getApiUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = consumeRateLimit({ bucket: "ai-parse-passport", key: authUser.userId, limit: 12, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // 1. INTAKE — shared pipeline handles FormData/JSON, PDF/image/text detection
    const intake = await processRequest(request, "passport");

    // 2. BUILD PROMPT (includes correction rules from DB)
    const systemPrompt = buildSystemPrompt("passport");

    // 3. PRIMARY: OpenAI
    const messages = buildPassportMessages(systemPrompt, intake);
    const primaryResult = await aiComplete({
      configKey: "parsing_vision",
      messages,
      jsonMode: true,
      timeout: 90_000,
    });

    const primaryContent = primaryResult.success ? primaryResult.content || "" : "";
    let { passport: openaiPassport, mrzLine1, mrzLine2 } = extractPassportFromContent(primaryContent);

    // Log primary usage
    await logAiUsage({
      companyId: authUser.companyId,
      userId: authUser.userId,
      operation: "parse_passport",
      model: primaryResult.model || "gpt-4o",
      inputTokens: primaryResult.usage?.promptTokens || 0,
      outputTokens: primaryResult.usage?.completionTokens || 0,
      success: primaryResult.success,
      metadata: { provider: "openai", pass: "primary" },
    }).catch(() => {});

    // 4. FALLBACK: Anthropic (non-PDF — Anthropic doesn't support native PDF)
    let anthropicPassport: PassportData | null = null;
    let anthropicRawText = "";
    const canDoFallback = intake.contentMode !== "text"
      ? intake.pageImages.length > 0
      : !!intake.extractedText;

    if (canDoFallback) {
      try {
        const fallbackMessages = buildPassportMessages(systemPrompt, { ...intake, pdfBase64: null });
        const fallbackResult = await aiComplete({
          configKey: "parsing_fallback",
          messages: fallbackMessages,
          jsonMode: true,
          timeout: 90_000,
        });

        if (fallbackResult.success && fallbackResult.content) {
          anthropicRawText = fallbackResult.content;
          const extracted = extractPassportFromContent(anthropicRawText);
          anthropicPassport = extracted.passport;
          if (!mrzLine1 && extracted.mrzLine1) mrzLine1 = extracted.mrzLine1;
          if (!mrzLine2 && extracted.mrzLine2) mrzLine2 = extracted.mrzLine2;
        }

        await logAiUsage({
          companyId: authUser.companyId,
          userId: authUser.userId,
          operation: "parse_passport",
          model: fallbackResult.model || "claude-sonnet-4-5",
          inputTokens: fallbackResult.usage?.promptTokens || 0,
          outputTokens: fallbackResult.usage?.completionTokens || 0,
          success: fallbackResult.success,
          metadata: { provider: "anthropic", pass: "fallback" },
        }).catch(() => {});
      } catch (err) {
        console.warn("Anthropic passport fallback failed:", err);
      }
    }

    // 5. RECOVER MRZ from raw model text if JSON omitted lines
    const textBlob = `${primaryContent}\n${anthropicRawText}`;
    const recovered = extractTd3MrzLinesFromText(textBlob);
    if (recovered && recovered.length >= 2) {
      if (!mrzLine1) mrzLine1 = recovered[0];
      if (!mrzLine2) mrzLine2 = recovered[1];
    }

    // 6. MERGE: prefer OpenAI primary, fill gaps from Anthropic
    let finalPassport = openaiPassport
      ? anthropicPassport
        ? mergePassports(openaiPassport, anthropicPassport)
        : openaiPassport
      : anthropicPassport;

    // 7. APPLY MRZ OVERRIDES (most reliable for DOB, expiry, passport number)
    if (finalPassport) {
      finalPassport = applyMrzOverrides(finalPassport, mrzLine1, mrzLine2);
      return NextResponse.json({ passport: finalPassport });
    }

    // 8. LAST RESORT: MRZ-only parse
    if (mrzLine1 && mrzLine2) {
      const mrzOnly = parseMrzToPassportData(`${mrzLine1}\n${mrzLine2}`);
      if (mrzOnly && (mrzOnly.passportNumber || mrzOnly.lastName || mrzOnly.firstName)) {
        return NextResponse.json({ passport: mrzBlocksToPassportData(mrzOnly) });
      }
    }

    return NextResponse.json({ error: "Could not extract passport information", passport: null });
  } catch (err) {
    console.error("Parse passport error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
