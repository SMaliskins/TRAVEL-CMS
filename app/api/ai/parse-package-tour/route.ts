import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/aiUsageLogger";
import { requireModule } from "@/lib/modules/checkModule";
import { checkAiUsageLimit } from "@/lib/ai/usageLimit";
import { MODELS } from "@/lib/ai/config";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";

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
        "cabinClass": "economy",
        "baggage": "8kg hand luggage, 20kg checked"
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

ANEX TOUR / ANEX (Latvian "Ceļojumu pakalpojumu sniegšanas līgums", agency e.g. GULLIVER + operator BALTIC WORLD / ANEX):
- bookingRef: The application number in the document header after "Nr." — e.g. "Ceļojumu pakalpojumu sniegšanas līgums Nr. 2002458" → bookingRef "2002458". Also check "līgums Nr." variants.
- detectedOperator: "ANEX Tour" or "ANEX" when ANEX / BALTIC WORLD / ANEX TOUR branding appears.
- travellers (CEĻOTĀJI): Table columns Uzvārds (surname), Vārds (given name), Dzimšanas datums. Names may be ALL CAPS and concatenated (e.g. "INESEELIZABETE" with surname "PAGA") — split into sensible firstName/lastName (e.g. lastName "Paga", firstName "Inese Elizabete"). Birth date DD-MM-YYYY → add optional "dateOfBirth": "1990-10-25" per traveller when visible.
- direction: From flight route (e.g. RIX–AYT) set "Latvia, Riga - Turkey, Antalya" or equivalent.
- flights.segments (LIDOJUMI): Each row — departure/arrival IATA (RIX, AYT), dates/times in DD-MM-YYYY HH:mm → YYYY-MM-DD and HH:mm. Flight number e.g. "4M 806" (store as "4M 806"). Class column "Y" → cabinClass "economy" unless clearly business/first.
- baggage: From BAGĀŽA / baggage section — e.g. hand 8kg (Rokas) and registered 20kg (reģistrējamā). Put the SAME human-readable summary on EACH flight segment in "baggage" (e.g. "8kg hand, 20kg checked") so CRM baggage field can be filled.
- transfers (TRANSFĒRS): e.g. "GROUP TRANSFER ANEX (AIRPORT-HOTEL)" → type "Group"; put full operator wording in transfers.description. Daudzums (quantity) can be noted in description.
- accommodation (IZMITINĀŠANA): hotelName, room type (Istabas tips), meal (Ēdināšanas types e.g. Ultra AI → mealPlan "UAI" or "Ultra All Inclusive"), check-in Ierašanās / check-out Izbraukšana dates DD-MM-YYYY → YYYY-MM-DD as arrivalDate/departureDate.
- pricing/paymentTerms: extract if shown on ANEX voucher; omit if not present.
- hotelName: Extract hotel name UP TO the star rating (*). E.g. "STARLIGHT RESORT HOTEL 5* Ultra All Inclusive" -> hotelName: "STARLIGHT RESORT HOTEL", starRating: "5*"
- starRating: Category/star rating (5*, 4*, etc.)
- roomType: Standard, Club Superior, Club Deluxe, etc.
- mealPlan: Be SPECIFIC. AI (All Inclusive) and UAI (Ultra All Inclusive) are DIFFERENT meal types - do not mix them. Return exactly as in document: "UAI" or "Ultra All Inclusive" for Ultra All Inclusive; "AI" or "All Inclusive" for All Inclusive; "BB" for Bed & Breakfast; "HB" for Half Board; "FB" for Full Board; "RO" for Room Only. Use the abbreviation from the document when present (e.g. "UAI", "AI"), otherwise the full name.
- transfers.type: "Group", "Individual", or "—" if absent
- operator.name: Tour operator name
- bookingRef: Application/booking number if present in document
- totalPrice, cost: Extract Cost (€), Kopējā ceļojuma cena, total trip price, package price - any field showing total cost in EUR. Put in pricing.totalPrice and pricing.cost
- paymentTerms: Extract deposit/final dates and percentages if present
- flights.segments: Same structure as flight itinerary parser - IATA codes, dates YYYY-MM-DD, times HH:mm. Include "baggage" per segment when the document lists allowance (hand + checked kg).
- additionalServices: List each extra service with description and price
- For text input: user may paste agreement text from email, PDF copy, or any source - adapt to the format
- Only return valid JSON, no other text`;

export async function POST(request: NextRequest) {
  const authInfo = await getApiUser(request);
  if (!authInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = consumeRateLimit({
    bucket: "ai-parse-package-tour",
    key: authInfo.userId,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  
  // Check if company has ai_parsing module (skip in development for easier testing)
  if (authInfo && process.env.NODE_ENV === "production") {
    const moduleError = await requireModule(authInfo.companyId, "ai_parsing");
    if (moduleError) {
      return NextResponse.json({ error: moduleError.error }, { status: moduleError.status });
    }
  }

  // Check AI usage limit
  if (authInfo) {
    const usage = await checkAiUsageLimit(authInfo.companyId);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${usage.used}/${usage.limit} calls this month). Upgrade your plan or purchase an AI add-on.` },
        { status: 429 }
      );
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

    // PDF: try unpdf for text. If that fails or empty, fallback to OpenAI (GPT-4o supports PDF natively)
    if (pdfBase64) {
      try {
        const { extractText } = await import("unpdf");
        const buffer = Buffer.from(pdfBase64, "base64");
        const uint8Array = new Uint8Array(buffer);
        const pdfData = await extractText(uint8Array);
        const rawText = Array.isArray(pdfData?.text) ? pdfData.text.join("\n") : (pdfData?.text || "");
        const raw = (typeof rawText === "string" ? rawText : "")
          .replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        if (raw && raw.length >= 10) {
          textContent = raw;
          pdfBase64 = null; // use Anthropic with text
        }
        // else keep pdfBase64 for OpenAI fallback below
      } catch (pdfErr) {
        console.error("unpdf failed:", pdfErr);
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
        body: JSON.stringify({ model: MODELS.OPENAI_VISION, messages, max_tokens: 3000, temperature: 0.1 }),
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
            model: MODELS.OPENAI_VISION,
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
    const TOUR_MODEL = MODELS.ANTHROPIC_FAST;

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
        model: MODELS.ANTHROPIC_FAST,
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
