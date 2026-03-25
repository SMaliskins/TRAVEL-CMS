import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractTd3MrzLinesFromText, parseMrzToPassportData } from "@/lib/passport/parseMrz";
import type { PassportDataFromMrz } from "@/lib/passport/parseMrz";
import { MODELS } from "@/lib/ai/config";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import {
  inferMimeFromBytes,
  inferMimeFromFilename,
  normalizeImageMime,
} from "@/lib/files/inferUploadMime";

/**
 * AI-powered passport parsing
 * 
 * Supports:
 * - Image upload (base64 or FormData)
 * - PDF upload (FormData) — OpenAI Files API + Responses API (`input_file`, gpt-4o); not Chat Completions
 * - Text parsing (JSON body)
 * 
 * Expected FormData:
 *   file: File (image or PDF)
 *   type: "image" | "pdf" (optional, auto-detected)
 * 
 * Expected JSON body:
 *   { image: string (base64), mimeType: string }
 *   OR
 *   { text: string }
 */

interface PassportData {
  passportNumber?: string;
  passportIssueDate?: string; // YYYY-MM-DD
  passportExpiryDate?: string; // YYYY-MM-DD
  passportIssuingCountry?: string;
  passportFullName?: string;
  firstName?: string;  // Given name(s) - from MRZ line 2 or visual zone
  lastName?: string;   // Surname - from MRZ line 1 (before <<) or visual zone
  dob?: string; // YYYY-MM-DD
  nationality?: string;
  personalCode?: string; // Personal ID / national ID (e.g. "123456-12345", "Запис N")
  /** male | female — from Sex/Gender field (e.g. M/F, Male/Female, Dzimums, Vīrietis/Sieviete) */
  gender?: string;
  /** Estonia/Latvia Alien's passport – document explicitly says "Alien's passport" / "Välismaalase pass" / "Ārzemnieka pase" */
  isAlienPassport?: boolean;
}

const SYSTEM_PROMPT = `You are a passport document parser. Extract passport information from images of passport pages, passport scans, or PDFs.

Passport MRZ (Machine Readable Zone) format: Line 1 = Surname<<Given Names (e.g. SMITH<<JOHN MICHAEL means lastName=SMITH, firstName=JOHN MICHAEL).
Visual zone may show "Surname / Given names" or "Last name / First name" - use that order.

Return a JSON object with this structure:
{
  "passport": {
    "passportNumber": "AB123456",
    "passportIssueDate": "2020-01-15",
    "passportExpiryDate": "2030-01-14",
    "passportIssuingCountry": "Latvia",
    "passportFullName": "Ravis Guntis",
    "firstName": "Ravis",
    "lastName": "Guntis",
    "dob": "1985-05-20",
    "nationality": "LV",
    "personalCode": "123456-12345",
    "gender": "male",
    "isAlienPassport": false,
    "mrzLine1": "P<LVTEMPLATE<<JOHN<DOE<<<<<<<<<<<<<<<<<<<<<<<<<<",
    "mrzLine2": "AB12345670LV1101014M3001018<<<<<<<<<<<<<<04"
  }
}

CRITICAL — Date of birth (dob):
- European format DD.MM.YYYY means day.month.year (e.g. 07.09.2011 = 7 September 2011 → 2011-09-07).
- Look for the field labeled "Date of birth" / "Dzimšanas datums" / "Dzimšanas datums/Date of birth/Date de naissance" / "Date de naissance" — extract EXACTLY the value shown there.
- NEVER swap day and month. 07.09 = 7 Sept, 27.04 = 27 April.
- If the date is unclear or ambiguous, omit dob rather than guess.
- Always output YYYY-MM-DD (ISO).

MRZ (Machine Readable Zone):
- If the passport has MRZ at the bottom (2 lines of ~44 chars, A-Z 0-9 <), copy them EXACTLY as printed into mrzLine1 and mrzLine2. Used for reliable DOB and expiry extraction. Omit if not visible.
- United Kingdom (GBR) and all ICAO passports: each MRZ line must be exactly 44 characters (pad with <). UK line 1 starts with P<GBR.

Date of issue (passportIssueDate) and Date of expiry (passportExpiryDate):
- Look for "Izdošanas datums/Date of issue", "Derīga līdz/Date of expiry", "Date de validité". European DD.MM.YYYY — convert to YYYY-MM-DD. NEVER swap day and month.

Rules:
- Dates in YYYY-MM-DD format (always year-month-day). European passports use DD.MM.YYYY — convert to YYYY-MM-DD. Example: 15.03.2028 → 2028-03-15 (March 15, not day 15 of month 3). NEVER swap month and day.
- passportIssuingCountry: full country name in English (e.g. "Latvia", "United States", "Ukraine", "United Kingdom"), NOT a 2-letter code. This is used for statistics.
- passportFullName, firstName, lastName: First letter of each word UPPERCASE, rest lowercase. CRITICAL — preserve EXACT diacritics from the human-readable zone (NOT MRZ). Latvian: ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž. Example: Pavloviča, Žaklīna — NEVER write Pavlovica, Zaklina. Copy characters exactly as printed on the passport.
- Supports all passport formats: EU, US, UK, Ukrainian (Україна), Russian (Россия), Estonian, Latvian, etc. Parse Cyrillic names correctly and output in Latin with Title Case.
- nationality: 2-letter ISO country code is acceptable.
- personalCode: ALWAYS extract if present. National personal ID / personal code. Look for: "Personal No.", "Personal code", "Isikukood" (Estonia), "Personas kods" (Latvia), "Asmens kodas" (Lithuania), "Record No.", "Запис N", or any numeric ID field. Copy exactly as shown (with or without hyphen). Omit only if truly not on the document.
- gender: Extract when present. Output "male" or "female" only. Look for: "Sex", "Gender", "Dzimums" (Latvian), "Стать" (Ukrainian), M/F, Male/Female, Vīrietis/Sieviete (LV), Чол./Жін. (UA). Omit if not on the document.
- isAlienPassport: You MUST always include this field. Set to true when the document is an Alien's passport (Estonia: "Välismaalase pass"; Latvia: "Ārzemnieka pase"). For regular (citizen) passports set false.
- If you cannot determine a value, omit it or use empty string.
- Only return valid JSON, no other text.`;

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  UA: "Ukraine", LV: "Latvia", RU: "Russia", DE: "Germany", FR: "France",
  US: "United States", GB: "United Kingdom", PL: "Poland", LT: "Lithuania", EE: "Estonia",
};

function formatDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY or DD/MM/YYYY (European) — avoid JS Date parsing month/day swap
  const eu = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
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

/** Title case preserving diacritics (Rāvis, Žaklīna). */
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

/** Support both camelCase and snake_case from AI response */
function getRaw<T>(p: Record<string, unknown>, camel: string, snake: string): T | undefined {
  const v = p[camel] ?? p[snake];
  return (typeof v === "string" ? v.trim() : v) as T | undefined;
}

function normalizePassport(passport: Record<string, unknown> & Partial<PassportData>): PassportData {
  let issuingCountry = getRaw<string>(passport, "passportIssuingCountry", "passport_issuing_country") || undefined;
  if (issuingCountry && issuingCountry.length === 2) {
    issuingCountry = COUNTRY_CODE_TO_NAME[issuingCountry.toUpperCase()] || issuingCountry;
  }
  let nationality = passport.nationality?.trim() || undefined;
  if (nationality && nationality.length === 2) {
    nationality = COUNTRY_CODE_TO_NAME[nationality.toUpperCase()] || nationality;
  }
  let fullName = passport.passportFullName?.trim() || undefined;
  if (fullName && fullName === fullName.toUpperCase()) fullName = toTitleCase(fullName);
  const g = passport.gender?.trim()?.toLowerCase();
  const gender =
    g === "male" || g === "female"
      ? g
      : g === "m" || g === "mr"
        ? "male"
        : g === "f" || g === "mrs" || g === "ms"
          ? "female"
          : undefined;

  return {
    passportNumber: passport.passportNumber || undefined,
    passportIssueDate: formatDate(passport.passportIssueDate),
    passportExpiryDate: formatDate(passport.passportExpiryDate),
    passportIssuingCountry: issuingCountry,
    passportFullName: fullName,
    firstName: passport.firstName ? toTitleCase(passport.firstName.trim()) : undefined,
    lastName: passport.lastName ? toTitleCase(passport.lastName.trim()) : undefined,
    dob: formatDate(passport.dob),
    nationality,
    personalCode: passport.personalCode ? String(passport.personalCode).trim() || undefined : undefined,
    gender: gender === "male" || gender === "female" ? gender : undefined,
    isAlienPassport: passport.isAlienPassport === true,
  };
}

function stripMarkdownCodeFences(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "");
    t = t.replace(/\s*```\s*$/i, "");
  }
  return t.trim();
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

/** When MRZ parses (ICAO TD3), prefer it for identity + dates — fixes wrong visual OCR (e.g. UK biodata). */
function applyMrzOverrides(
  passport: PassportData,
  mrzLine1?: string,
  mrzLine2?: string
): PassportData {
  if (!mrzLine1 || !mrzLine2) return passport;
  const mrzText = `${mrzLine1.trim()}\n${mrzLine2.trim()}`;
  const mrz = parseMrzToPassportData(mrzText);
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

function recoverMrzLinesFromModelText(content: string, existing1?: string, existing2?: string): { mrzLine1?: string; mrzLine2?: string } {
  if (existing1 && existing2) return { mrzLine1: existing1, mrzLine2: existing2 };
  const extracted = extractTd3MrzLinesFromText(content);
  if (!extracted || extracted.length < 2) return { mrzLine1: existing1, mrzLine2: existing2 };
  return { mrzLine1: extracted[0], mrzLine2: extracted[1] };
}

/** OpenAI Responses API: aggregate text from `output` message parts (raw fetch has no `output_text`). */
function extractOpenAiResponsesOutputText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.output_text === "string" && d.output_text.trim()) return d.output_text;
  const output = d.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "message") continue;
    const contentParts = o.content;
    if (!Array.isArray(contentParts)) continue;
    for (const part of contentParts) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") chunks.push(p.text);
    }
  }
  return chunks.join("");
}

async function openaiUploadUserDataPdf(
  apiKey: string,
  pdfBase64: string,
  filename: string
): Promise<{ fileId: string } | { error: unknown }> {
  const bytes = Buffer.from(pdfBase64, "base64");
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([bytes], { type: "application/pdf" }), filename);
  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json };
  const id = json && typeof json === "object" && typeof (json as { id?: unknown }).id === "string"
    ? (json as { id: string }).id
    : null;
  if (!id) return { error: json };
  return { fileId: id };
}

async function openaiDeleteFileSafe(apiKey: string, fileId: string): Promise<void> {
  try {
    await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    /* ignore */
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getApiUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = consumeRateLimit({
      bucket: "ai-parse-passport",
      key: authUser.userId,
      limit: 12,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    
    let imageBase64: string | null = null;
    let pdfBase64: string | null = null;
    let mimeType: string = "image/png";
    let textContent: string | null = null;
    let isPDF = false;

    // Handle FormData (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "File is required" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const sniffed = inferMimeFromBytes(bytes);
      let declared = normalizeImageMime(file.type?.trim() || "");
      let fallback = inferMimeFromFilename(file.name) || "";
      if (fallback === "image/jpg") fallback = "image/jpeg";
      if (!declared || declared === "application/octet-stream") {
        declared = normalizeImageMime(fallback);
      }

      if (sniffed === "application/pdf") {
        isPDF = true;
        mimeType = "application/pdf";
        pdfBase64 = Buffer.from(buffer).toString("base64");
      } else if (sniffed?.startsWith("image/")) {
        isPDF = false;
        mimeType = normalizeImageMime(sniffed);
        imageBase64 = Buffer.from(buffer).toString("base64");
      } else if (declared === "application/pdf") {
        isPDF = true;
        mimeType = "application/pdf";
        pdfBase64 = Buffer.from(buffer).toString("base64");
      } else if (declared.startsWith("image/")) {
        isPDF = false;
        mimeType = declared;
        imageBase64 = Buffer.from(buffer).toString("base64");
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload an image or PDF." },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON body
      const body = await request.json();
      
      if (body.text) {
        textContent = body.text;
      } else if (body.image) {
        imageBase64 = body.image;
        mimeType = body.mimeType || "image/png";
      } else {
        return NextResponse.json(
          { error: "Image or text is required" },
          { status: 400 }
        );
      }
    }

    // Check if OpenAI API key is configured
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      return NextResponse.json(
        { error: "AI parsing not configured. Please add OPENAI_API_KEY to environment.", passport: null },
        { status: 503 }
      );
    }

    try {
      let content = "";

      if (textContent) {
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Parse this passport text and extract all passport information:\n\n${textContent}`,
          },
        ];
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: MODELS.OPENAI_VISION,
            messages,
            max_tokens: 1500,
            temperature: 0.1,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("OpenAI API error:", errorData);
          return NextResponse.json(
            { error: "AI parsing failed", details: errorData, passport: null },
            { status: 500 }
          );
        }
        const data = await response.json();
        content = data.choices?.[0]?.message?.content || "";
      } else if (isPDF && pdfBase64) {
        /**
         * PDFs must use Responses API + Files API (`input_file`).
         * Chat Completions does not accept `type: file` / data-URL PDFs reliably.
         */
        const upload = await openaiUploadUserDataPdf(openaiKey, pdfBase64, "passport.pdf");
        if ("error" in upload) {
          console.error("OpenAI PDF upload error:", upload.error);
          return NextResponse.json(
            { error: "AI parsing failed (PDF upload)", details: upload.error, passport: null },
            { status: 500 }
          );
        }
        try {
          const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: MODELS.OPENAI_VISION,
              instructions: SYSTEM_PROMPT,
              max_output_tokens: 1500,
              temperature: 0.1,
              store: false,
              input: [
                {
                  role: "user",
                  content: [
                    { type: "input_file", file_id: upload.fileId },
                    {
                      type: "input_text",
                      text: "Extract all passport information from this PDF document. Include isAlienPassport: true if the document type is Alien's passport (Estonia: Välismaalase pass; Latvia: Ārzemnieka pase). Return JSON only.",
                    },
                  ],
                },
              ],
            }),
          });
          const respData = await response.json().catch(() => ({}));
          if (!response.ok) {
            console.error("OpenAI Responses API error:", respData);
            return NextResponse.json(
              { error: "AI parsing failed", details: respData, passport: null },
              { status: 500 }
            );
          }
          const status =
            respData && typeof respData === "object"
              ? (respData as { status?: string }).status
              : undefined;
          if (status === "failed" || status === "cancelled" || status === "incomplete") {
            console.error("OpenAI Responses status:", respData);
            return NextResponse.json(
              { error: "AI parsing failed", details: respData, passport: null },
              { status: 500 }
            );
          }
          content = extractOpenAiResponsesOutputText(respData);
        } finally {
          await openaiDeleteFileSafe(openaiKey, upload.fileId);
        }
      } else {
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all passport information from this image. Include isAlienPassport: true if the document type is Alien's passport (Estonia: Välismaalase pass; Latvia: Ārzemnieka pase). Return JSON only.",
              },
            ],
          },
        ];
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: MODELS.OPENAI_VISION,
            messages,
            max_tokens: 1500,
            temperature: 0.1,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("OpenAI API error:", errorData);
          return NextResponse.json(
            { error: "AI parsing failed", details: errorData, passport: null },
            { status: 500 }
          );
        }
        const data = await response.json();
        content = data.choices?.[0]?.message?.content || "";
      }
      const contentStripped = stripMarkdownCodeFences(content);

      let openaiPassport: PassportData | null = null;
      let mrzLine1: string | undefined;
      let mrzLine2: string | undefined;
      try {
        const jsonMatch = contentStripped.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const raw = parsed.passport && typeof parsed.passport === "object" ? parsed.passport : parsed;
          const r = raw || {};
          mrzLine1 = typeof r.mrzLine1 === "string" ? r.mrzLine1.trim() : undefined;
          mrzLine2 = typeof r.mrzLine2 === "string" ? r.mrzLine2.trim() : undefined;
          openaiPassport = normalizePassport(r);
        }
      } catch (parseErr) {
        console.error("Failed to parse OpenAI response:", parseErr, "Content:", content);
      }

      // Second pass: Anthropic (if configured and we have image/text)
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      let anthropicPassport: PassportData | null = null;
      let anthropicRawText = "";
      if (anthropicKey && (imageBase64 || textContent) && !isPDF) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          const userContent = textContent
            ? [{ type: "text" as const, text: `Parse this passport text and extract all passport information. Return JSON only.\n\n${textContent}` }]
            : [
                { type: "image" as const, source: { type: "base64" as const, media_type: (mimeType || "image/png") as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64! } },
                { type: "text" as const, text: "Extract all passport information from this image. Return JSON only." },
              ];
          const msg = await anthropic.messages.create({
            model: MODELS.ANTHROPIC_FAST,
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userContent }],
          });
          const text = msg.content.find((c) => c.type === "text");
          anthropicRawText = text && "text" in text ? text.text : "";
          const text2Stripped = stripMarkdownCodeFences(anthropicRawText);
          const jsonMatch2 = text2Stripped.match(/\{[\s\S]*\}/);
          if (jsonMatch2?.[0]) {
            const parsed = JSON.parse(jsonMatch2[0]);
            const raw = parsed.passport && typeof parsed.passport === "object" ? parsed.passport : parsed;
            const r = raw || {};
            if (!mrzLine1 && typeof r.mrzLine1 === "string") mrzLine1 = r.mrzLine1.trim();
            if (!mrzLine2 && typeof r.mrzLine2 === "string") mrzLine2 = r.mrzLine2.trim();
            anthropicPassport = normalizePassport(r);
          }
        } catch (anthErr) {
          console.warn("Anthropic second pass failed:", anthErr);
        }
      }

      // Recover MRZ from raw model text if JSON omitted lines (common on UK biodata pages)
      const textBlob = `${content}\n${anthropicRawText}`;
      ({ mrzLine1, mrzLine2 } = recoverMrzLinesFromModelText(textBlob, mrzLine1, mrzLine2));

      // Merge: prefer OpenAI as primary, fill gaps from Anthropic
      let finalPassport = openaiPassport
        ? anthropicPassport
          ? mergePassports(openaiPassport, anthropicPassport)
          : openaiPassport
        : anthropicPassport;

      if (finalPassport) {
        finalPassport = applyMrzOverrides(finalPassport, mrzLine1, mrzLine2);
        return NextResponse.json({ passport: finalPassport });
      }

      if (mrzLine1 && mrzLine2) {
        const mrzOnly = parseMrzToPassportData(`${mrzLine1}\n${mrzLine2}`);
        if (mrzOnly && (mrzOnly.passportNumber || mrzOnly.lastName || mrzOnly.firstName)) {
          return NextResponse.json({ passport: mrzBlocksToPassportData(mrzOnly) });
        }
      }

      return NextResponse.json({ 
        error: "Could not extract passport information",
        passport: null 
      });
    } catch (aiError) {
      console.error("OpenAI API call failed:", aiError);
      return NextResponse.json(
        { error: "AI service unavailable", passport: null },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("Parse passport error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

