import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/aiUsageLogger";
import { requireModule } from "@/lib/modules/checkModule";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuthInfo(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  
  const userId = data.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  
  if (!profile?.company_id) return null;
  return { userId, companyId: profile.company_id };
}

/**
 * Package Tour document parser - multi-operator, multi-format
 *
 * Supported input: PDF, image, or plain text
 * Supported operators (document formats):
 *   - Coral Travel (TŪRISMA PAKALPOJUMU SNIEGŠANAS LĪGUMS, NAKTSMĪTNES, LIDOJUMI, TRANSPORTĒŠANA, PAPILDU PAKALPOJUMI)
 *   - Novatours
 *   - Tez Tour
 *   - Anex
 *   - Join Up
 *   - Other tour operators (extract what you can)
 *
 * The parser detects operator from document content and extracts data accordingly.
 * Text input: paste agreement text directly (e.g. from email, copied from PDF).
 */

const SYSTEM_PROMPT = `You are a Package Tour document parser for a travel agency CRM.

INPUT: PDF, image, or plain text. Document can be from different tour operators:
- Coral Travel (Latvian format: NAKTSMĪTNES, LIDOJUMI, TRANSPORTĒŠANA, PAPILDU PAKALPOJUMI, KOPĒJĀ CEĻOJUMA CENA)
- Novatours
- Tez Tour
- Anex
- Join Up
- Other operators (adapt to their layout)

DETECT the operator from the document (logo, header, company name) and extract data in the unified format below.

Return a JSON object with this structure:
{
  "detectedOperator": "Coral Travel",
  "operator": {
    "name": "Coral Travel",
    "registrationNo": "40203293469",
    "licenseNo": "T-2021-1"
  },
  "bookingRef": "12345678",
  "travellers": [
    { "name": "Janis Berzins", "firstName": "Janis", "lastName": "Berzins" },
    { "name": "Anna Liepa", "firstName": "Anna", "lastName": "Liepa" }
  ],
  "direction": "Latvia, Riga - Turkey, Antalya",
  "accommodation": {
    "hotelName": "STARLIGHT RESORT HOTEL",
    "starRating": "5*",
    "roomType": "Club Superior",
    "mealPlan": "UAI",
    "arrivalDate": "2026-09-19",
    "departureDate": "2026-09-27",
    "nights": 8
  },
  "flights": {
    "segments": [
      {
        "flightNumber": "FH 728",
        "airline": "Free Bird Airlines",
        "departure": "RIX",
        "departureCity": "Riga",
        "arrival": "AYT",
        "arrivalCity": "Antalya",
        "departureDate": "2026-09-19",
        "departureTimeScheduled": "05:00",
        "arrivalDate": "2026-09-19",
        "arrivalTimeScheduled": "08:50",
        "duration": "3h 50m",
        "cabinClass": "economy"
      }
    ]
  },
  "transfers": {
    "type": "Group",
    "description": "Airport - Hotel - Airport"
  },
  "additionalServices": [
    {
      "description": "Travel package changes (charter flights only) / 21 days before departure",
      "price": 0.02,
      "currency": "EUR"
    }
  ],
  "pricing": {
    "packagePrice": 3005.65,
    "discount": 75.00,
    "additionalServicesTotal": 0.04,
    "totalPrice": 2930.69,
    "currency": "EUR"
  },
  "paymentTerms": {
    "depositAmount": 293.07,
    "depositDueDate": "2026-01-29",
    "finalAmount": 2637.62,
    "finalDueDate": "2026-09-05",
    "depositPercent": 10,
    "finalPercent": 90
  }
}

Rules:
- detectedOperator: Name of tour operator as found in document
- travellers: List ALL traveller names. Include name (full), firstName (given name), lastName (surname). Document may show "Surname FirstName" or "FirstName Surname" - parse correctly. For "Pricite Irina" (Latvian/Russian style: Surname FirstName) use firstName: "Irina", lastName: "Pricite"

Tez Tour specific (Latvian "LĪGUMS Par tūrisma pakalpojumu sniegšanu", PAKALPOJUMU PROGRAMMA):
- bookingRef: from "Rezervācijas Nr." or "Nr. XXXXX" in contract header
- destination: "Ceļojuma galamērķis BULGARIA, NESSEBAR" → direction "Latvia, Riga - Bulgaria, Nessebar" (from–to: departure city first, then destination)
- traveller: "Tūrists MRS. JANA BRJUHOVECKA (17.12.1967)" → name "Jana Brjuhovecka", firstName "Jana", lastName "Brjuhovecka"
- flights: "Izlidošanas Datums... 09.06.2026 07:15/RIGA(RIX)-BURGAS(BOJ) INC/BT755/Economy" → segment with departure RIX, arrival BOJ, flightNumber "BT 755", airline "airBaltic" (BT = airBaltic, NOT Bulgaria Air). "Atlidošanas Datums... 16.06.2026 10:40/BURGAS(BOJ)INC-RIGA(RIX)/BT756/Economy" → return segment. Dates in DD.MM.YYYY, convert to YYYY-MM-DD. For RIX-BOJ/BOJ-RIX: duration typically 2h 40m
- hotel: "Viesnīcas nosaukums/līmenis*/Numur tips/ēdināšana" e.g. "MIRAGE NESSEBAR 3*/Standard Sea View/SGL/BB" → hotelName "MIRAGE NESSEBAR", starRating "3*", roomType "Standard Sea View", mealPlan "BB". SGL=Single room
- nights: "Nakšu skaits 7"
- transfers: "Transfēri 09.06.2026 BURGAS(BOJ)INC-MIRAGENESSEBAR:G" — "G" means Group. Extract dates and route
- pricing: "Visu pakalpojumu kopējā cena 702.2 EUR", "Apmaksai 702.2 EUR" → totalPrice
- paymentTerms: "Maksājumu plāns saskaņā ar līguma punktu 5.1: 27.02.2026-140.44EUR, 19.05.2026-561.76EUR" (or similar) → first date+amount = deposit, last = final. Convert DD.MM.YYYY to YYYY-MM-DD
- operator: "SIA Tez Tour", reg "Vienotais reģistrācijas Nr. 40003586306", license "T-2018-24"
- direction: Format "from - to" (departure - arrival). E.g. "Latvia, Riga - Turkey, Antalya". Use departure city/country FIRST, then arrival. From first outbound segment: departure = from, arrival = to. If country unknown, infer (Riga→Latvia, Antalya→Turkey).
- hotelName: Extract hotel name UP TO the star rating (*). E.g. "STARLIGHT RESORT HOTEL 5* Ultra All Inclusive" -> hotelName: "STARLIGHT RESORT HOTEL", starRating: "5*"
- starRating: Category/star rating (5*, 4*, etc.)
- roomType: Standard, Club Superior, Club Deluxe, etc.
- mealPlan: Be SPECIFIC. AI (All Inclusive) and UAI (Ultra All Inclusive) are DIFFERENT meal types - do not mix them. Return exactly as in document: "UAI" or "Ultra All Inclusive" for Ultra All Inclusive; "AI" or "All Inclusive" for All Inclusive; "BB" for Bed & Breakfast; "HB" for Half Board; "FB" for Full Board; "RO" for Room Only. Use the abbreviation from the document when present (e.g. "UAI", "AI"), otherwise the full name.
- transfers.type: "Group", "Individual", or "—" if absent
- operator.name: Tour operator name
- bookingRef: Application/booking number if present in document
- totalPrice, cost: Extract Cost (€), Kopējā ceļojuma cena, total trip price, package price - any field showing total cost in EUR. Put in pricing.totalPrice and pricing.cost
- paymentTerms: Extract deposit/final dates and percentages if present
- flights.segments: Same structure as flight itinerary parser - IATA codes, dates YYYY-MM-DD, times HH:mm
- additionalServices: List each extra service with description and price
- For text input: user may paste agreement text from email, PDF copy, or any source - adapt to the format
- Only return valid JSON, no other text`;

export async function POST(request: NextRequest) {
  // Get auth info for usage logging and module check
  const authInfo = await getAuthInfo(request);
  
  // Check if company has ai_parsing module (skip in development for easier testing)
  if (authInfo && process.env.NODE_ENV === "production") {
    const moduleError = await requireModule(authInfo.companyId, "ai_parsing");
    if (moduleError) {
      return NextResponse.json({ error: moduleError.error }, { status: moduleError.status });
    }
  }
  
  try {
    const contentType = request.headers.get("content-type") || "";
    let imageBase64: string | null = null;
    let pdfBase64: string | null = null;
    let mimeType = "image/png";
    let textContent: string | null = null;
    let inputType: "pdf" | "image" | "text" = "text";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }
      mimeType = file.type;
      const buffer = await file.arrayBuffer();
      const bytes = Buffer.from(buffer);
      if (file.type === "application/pdf") {
        // Send PDF directly to GPT-4o - it natively supports PDF (text + images)
        pdfBase64 = bytes.toString("base64");
        inputType = "pdf";
      } else if (file.type.startsWith("image/")) {
        imageBase64 = bytes.toString("base64");
        inputType = "image";
      } else {
        return NextResponse.json({ error: "Unsupported file type. Use image or PDF." }, { status: 400 });
      }
    } else {
      const body = await request.json();
      if (body.text) textContent = body.text;
      else if (body.image) {
        imageBase64 = body.image;
        mimeType = body.mimeType || "image/png";
      } else {
        return NextResponse.json({
          error: "Provide file (PDF/image) or text. For text: { \"text\": \"...\" }",
          parsed: null,
        }, { status: 400 });
      }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "AI parsing not configured. Add ANTHROPIC_API_KEY.", parsed: null },
        { status: 503 }
      );
    }

    // PDF: try pdf-parse for Anthropic (text). If that fails, fallback to OpenAI (GPT-4o supports PDF natively)
    if (pdfBase64) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const buffer = Buffer.from(pdfBase64, "base64");
        const pdfData = await pdfParse(buffer);
        const raw = (pdfData.text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        if (raw && raw.length >= 10) {
          textContent = raw;
          pdfBase64 = null; // use Anthropic with text
        }
        // else keep pdfBase64 for OpenAI fallback below
      } catch (pdfErr) {
        console.error("pdf-parse failed:", pdfErr);
        // keep pdfBase64 for OpenAI fallback below
      }
    }

    // Fallback: PDF but no text (scanned/image PDF) — use OpenAI with raw PDF if key is set
    if (pdfBase64 && openaiKey) {
      const messages: { role: string; content: string | object[] }[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "file", file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${pdfBase64}` } },
            { type: "text", text: "Extract all Package Tour information from this PDF. Return JSON only." },
          ] as object[],
        },
      ];
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 3000, temperature: 0.1 }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const usage = data.usage || {};
        if (authInfo) {
          await logAiUsage({
            companyId: authInfo.companyId,
            userId: authInfo.userId,
            operation: "parse_package_tour",
            model: "gpt-4o",
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
            success: true,
            metadata: { inputType, fallback: "openai_pdf" },
          });
        }
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ parsed, detectedOperator: parsed.detectedOperator || parsed.operator?.name || null });
        }
      }
    }

    // If we still have PDF and no OpenAI fallback succeeded, return helpful error
    if (pdfBase64) {
      return NextResponse.json(
        {
          error: openaiKey
            ? "Could not extract tour data from this PDF. Try pasting the text manually or use a different PDF."
            : "Could not extract text from PDF. Add OPENAI_API_KEY for image/scanned PDF support, or paste the text manually.",
          parsed: null,
        },
        { status: 400 }
      );
    }

    // Build user message for Anthropic: text or image (inline type — SDK MessageCreateParams shape varies by version)
    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };
    let userContent: ContentBlock[];
    if (textContent) {
      userContent = [{ type: "text" as const, text: `Parse this Package Tour document:\n\n${textContent}` }];
    } else if (imageBase64) {
      const mediaType = (mimeType === "image/jpeg" ? "image/jpeg" : mimeType === "image/gif" ? "image/gif" : mimeType === "image/webp" ? "image/webp" : "image/png") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      userContent = [
        { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: imageBase64 } },
        { type: "text" as const, text: "Extract all Package Tour information from this image. Return JSON only." },
      ];
    } else {
      return NextResponse.json(
        { error: "No text or image to parse.", parsed: null },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const TOUR_MODEL = "claude-3-5-haiku-20241022";

    const msg = await anthropic.messages.create({
      model: TOUR_MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = msg.content.find((c) => c.type === "text");
    const content = textBlock && "text" in textBlock ? textBlock.text : "";
    const usage = msg.usage ?? { input_tokens: 0, output_tokens: 0 };

    if (authInfo) {
      await logAiUsage({
        companyId: authInfo.companyId,
        userId: authInfo.userId,
        operation: "parse_package_tour",
        model: TOUR_MODEL,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        success: true,
        metadata: { inputType },
      });
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          parsed,
          detectedOperator: parsed.detectedOperator || parsed.operator?.name || null,
        });
      }
    } catch (parseErr) {
      console.error("Failed to parse Anthropic response:", parseErr, "Content:", content);
    }

    return NextResponse.json({ error: "Could not extract tour information", parsed: null });
  } catch (err) {
    console.error("Parse package tour error:", err);
    if (authInfo) {
      await logAiUsage({
        companyId: authInfo.companyId,
        userId: authInfo.userId,
        operation: "parse_package_tour",
        model: "claude-3-5-haiku-20241022",
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
