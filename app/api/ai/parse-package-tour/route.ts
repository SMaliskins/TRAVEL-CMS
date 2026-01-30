import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
- direction: Derive from flight cities/airports. Format: "Country, City - Country, City" (e.g. "Latvia, Riga - Turkey, Antalya"). Use departureCountry+departureCity and arrivalCountry+arrivalCity from first/last segments. If country unknown, infer from city (Riga→Latvia, Antalya→Turkey).
- hotelName: Extract hotel name UP TO the star rating (*). E.g. "STARLIGHT RESORT HOTEL 5* Ultra All Inclusive" -> hotelName: "STARLIGHT RESORT HOTEL", starRating: "5*"
- starRating: Category/star rating (5*, 4*, etc.)
- roomType: Standard, Club Superior, Club Deluxe, etc.
- mealPlan: Use EXACT text from document - do not abbreviate or convert. If document says "Ultra All Inclusive" write that; if "UAI" write "UAI"; if "BB" write "BB"
- transfers.type: "Group", "Individual", or "—" if absent
- operator.name: Tour operator name
- bookingRef: Application/booking number (номер заявки) if present in document
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

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: "AI parsing not configured. Add OPENAI_API_KEY.", parsed: null },
        { status: 503 }
      );
    }

    // Build user message content: text, PDF file, or image
    let userContent: string | object[];
    if (textContent) {
      userContent = `Parse this Package Tour document:\n\n${textContent}`;
    } else if (pdfBase64) {
      // GPT-4o native PDF input - no pdf-parse needed
      userContent = [
        { type: "file", file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${pdfBase64}` } },
        { type: "text", text: "Extract all Package Tour information from this PDF. Return JSON only." },
      ] as object[];
    } else {
      userContent = [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: "text", text: "Extract all Package Tour information. Return JSON only." },
      ] as object[];
    }

    const messages: { role: string; content: string | object[] }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 3000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: "AI parsing failed", details: errorData, parsed: null },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};

    // Log AI usage for billing
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
      console.error("Failed to parse AI response:", parseErr, "Content:", content);
    }

    return NextResponse.json({ error: "Could not extract tour information", parsed: null });
  } catch (err) {
    console.error("Parse package tour error:", err);
    // Log failed usage
    if (authInfo) {
      await logAiUsage({
        companyId: authInfo.companyId,
        userId: authInfo.userId,
        operation: "parse_package_tour",
        model: "gpt-4o",
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
