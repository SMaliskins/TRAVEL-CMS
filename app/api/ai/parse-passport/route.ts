import { NextRequest, NextResponse } from "next/server";

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
    "nationality": "US"
  }
}

Rules:
- Dates in YYYY-MM-DD format
- passportIssuingCountry should be 2-letter ISO country code (e.g., "US", "GB", "DE", "UA" for Ukraine)
- passportFullName: full name exactly as shown in passport
- Supports all passport formats: EU, US, UK, Ukrainian (Україна), Russian (Россия), etc. Parse Cyrillic names correctly.
- firstName: given name(s) - from MRZ line 2 or visual "First name" / "Given names"
- lastName: surname/family name - from MRZ line 1 (before <<) or visual "Surname" / "Last name"
- dob is the date of birth from the passport
- nationality should be 2-letter ISO country code
- If you cannot determine a value, omit it or use empty string
- Only return valid JSON, no other text`;

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
                text: "Extract all passport information from this PDF document. Return JSON only.",
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
                text: "Extract all passport information from this image. Return JSON only.",
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

      // Parse JSON from response
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const passport: PassportData = parsed.passport || {};

          // Validate and format dates
          const formatDate = (dateStr: string | undefined): string | undefined => {
            if (!dateStr) return undefined;
            // If already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              return dateStr;
            }
            // Try to parse other formats
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toISOString().split("T")[0];
            }
            return undefined;
          };

          return NextResponse.json({
            passport: {
              passportNumber: passport.passportNumber || undefined,
              passportIssueDate: formatDate(passport.passportIssueDate),
              passportExpiryDate: formatDate(passport.passportExpiryDate),
              passportIssuingCountry: passport.passportIssuingCountry || undefined,
              passportFullName: passport.passportFullName || undefined,
              firstName: passport.firstName || undefined,
              lastName: passport.lastName || undefined,
              dob: formatDate(passport.dob),
              nationality: passport.nationality || undefined,
            },
          });
        }
      } catch (parseErr) {
        console.error("Failed to parse AI response:", parseErr, "Content:", content);
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

