import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI-powered passport parsing
 * 
 * Supports:
 * - Image upload (base64 or FormData)
 * - PDF upload (FormData) - sent directly to GPT-4o (works for scanned/image-based PDFs, Ukrainian passports, etc.)
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
    "passportIssuingCountry": "US",
    "passportFullName": "SMITH JOHN MICHAEL",
    "firstName": "JOHN MICHAEL",
    "lastName": "SMITH",
    "dob": "1985-05-20",
    "nationality": "US",
    "personalCode": "123456-12345",
    "isAlienPassport": false
  }
}

Rules:
- Dates in YYYY-MM-DD format
- passportIssuingCountry should be 2-letter ISO country code (e.g., "US", "GB", "DE", "UA" for Ukraine)
- passportFullName: full name exactly as shown in passport
- Supports all passport formats: EU, US, UK, Ukrainian (Україна), Russian (Россия), Estonian, etc. Parse Cyrillic names correctly.
- firstName: given name(s) - from MRZ line 2 or visual "First name" / "Given names"
- lastName: surname/family name - from MRZ line 1 (before <<) or visual "Surname" / "Last name"
- dob is the date of birth from the passport
- nationality should be 2-letter ISO country code
- personalCode: ALWAYS extract if present. National personal ID / personal code. Look for: "Personal No.", "Personal code", "Isikukood" (Estonia), "Personas kods" (Latvia), "Asmens kodas" (Lithuania), "Идентификационный код", "Record No.", "Запис N", or any numeric ID field (e.g. 11 digits, or XXXXXX-XXXXX). Copy exactly as shown (with or without hyphen). Omit only if truly not on the document.
- isAlienPassport: You MUST always include this field. Set to true when the document is an Alien's passport (Estonia: "Välismaalase pass" / "Alien's passport"; Latvia: "Ārzemnieka pase" / "Alien's passport"). For Estonian or Latvian documents, look at the document type or title on the cover/page – if it says "Alien's passport", "Välismaalase pass", "Ārzemnieka pase", or "non-citizen passport", set isAlienPassport: true. For regular (citizen) passports set false.
- If you cannot determine a value, omit it or use empty string
- Only return valid JSON, no other text`;

function formatDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  return undefined;
}

function normalizePassport(passport: PassportData): PassportData {
  return {
    passportNumber: passport.passportNumber || undefined,
    passportIssueDate: formatDate(passport.passportIssueDate),
    passportExpiryDate: formatDate(passport.passportExpiryDate),
    passportIssuingCountry: passport.passportIssuingCountry || undefined,
    passportFullName: passport.passportFullName || undefined,
    firstName: passport.firstName || undefined,
    lastName: passport.lastName || undefined,
    dob: formatDate(passport.dob),
    nationality: passport.nationality || undefined,
    personalCode: passport.personalCode ? String(passport.personalCode).trim() || undefined : undefined,
    isAlienPassport: passport.isAlienPassport === true,
  };
}

function mergePassports(primary: PassportData, secondary: PassportData): PassportData {
  const merged = { ...primary };
  for (const k of Object.keys(secondary) as (keyof PassportData)[]) {
    const v = secondary[k];
    if (k === "isAlienPassport") {
      merged.isAlienPassport = primary.isAlienPassport === true || secondary.isAlienPassport === true;
    } else if (v && !merged[k]) merged[k] = v;
  }
  return merged;
}

export async function POST(request: NextRequest) {
  try {
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
      
      mimeType = file.type;
      isPDF = file.type === "application/pdf";
      
      if (isPDF) {
        // Send PDF directly to GPT-4o (native PDF support - works for scanned/image-based PDFs, Ukrainian passports, etc.)
        const buffer = await file.arrayBuffer();
        pdfBase64 = Buffer.from(buffer).toString("base64");
      } else if (file.type.startsWith("image/")) {
        const buffer = await file.arrayBuffer();
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
      let messages;
      
      if (textContent) {
        // Text-based parsing
        messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Parse this passport text and extract all passport information:\n\n${textContent}`,
          },
        ];
      } else if (isPDF && pdfBase64) {
        // PDF parsing - GPT-4o native PDF support (works for scanned/image-based PDFs, Ukrainian passports, etc.)
        messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "passport.pdf",
                  file_data: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all passport information from this PDF document. Include isAlienPassport: true if the document type is Alien's passport (Estonia: Välismaalase pass; Latvia: Ārzemnieka pase). Return JSON only.",
              },
            ],
          },
        ];
      } else {
        // Image parsing
        messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
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
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_tokens: 1000,
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
      const content = data.choices?.[0]?.message?.content || "";

      let openaiPassport: PassportData | null = null;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const raw = parsed.passport && typeof parsed.passport === "object" ? parsed.passport : parsed;
          openaiPassport = normalizePassport(raw || {});
        }
      } catch (parseErr) {
        console.error("Failed to parse OpenAI response:", parseErr, "Content:", content);
      }

      // Second pass: Anthropic (if configured and we have image/text)
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      let anthropicPassport: PassportData | null = null;
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
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userContent }],
          });
          const text = msg.content.find((c) => c.type === "text");
          const textContent2 = text && "text" in text ? text.text : "";
          const jsonMatch2 = textContent2.match(/\{[\s\S]*\}/);
          if (jsonMatch2) {
            const parsed = JSON.parse(jsonMatch2);
            const raw = parsed.passport && typeof parsed.passport === "object" ? parsed.passport : parsed;
            anthropicPassport = normalizePassport(raw || {});
          }
        } catch (anthErr) {
          console.warn("Anthropic second pass failed:", anthErr);
        }
      }

      // Merge: prefer OpenAI as primary, fill gaps from Anthropic
      const finalPassport = openaiPassport
        ? anthropicPassport
          ? mergePassports(openaiPassport, anthropicPassport)
          : openaiPassport
        : anthropicPassport;

      if (finalPassport) {
        return NextResponse.json({ passport: finalPassport });
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

