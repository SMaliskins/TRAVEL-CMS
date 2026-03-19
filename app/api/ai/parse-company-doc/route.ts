import { NextRequest, NextResponse } from "next/server";
import { MODELS } from "@/lib/ai/config";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";

export interface CompanyDocData {
  companyName?: string;
  regNumber?: string;
  vatNumber?: string;
  legalAddress?: string;
  country?: string;
  bankName?: string;
  iban?: string;
  swift?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

const SYSTEM_PROMPT = `You are a business document parser. Extract company registration details from images or PDFs of official documents such as:
- Company registration certificates
- VAT registration certificates
- Bank account statements / confirmations
- Business licenses
- Invoices or letterheads (extract sender company info)

Return a JSON object with this structure:
{
  "company": {
    "companyName": "SIA Example Ltd",
    "regNumber": "40103123456",
    "vatNumber": "LV40103123456",
    "legalAddress": "Brīvības iela 45, Rīga, LV-1010",
    "country": "Latvia",
    "bankName": "Swedbank AS",
    "iban": "LV02HABALV22000000000",
    "swift": "HABALV22",
    "contactPerson": "John Smith",
    "phone": "+371 20000000",
    "email": "info@example.com"
  }
}

Rules:
- companyName: Full legal name as written on the document. Preserve original casing and legal form (SIA, OÜ, UAB, GmbH, Ltd, etc.).
- regNumber: Company registration / unified reg. number. Look for: "Reģistrācijas Nr.", "Reg. Nr.", "Registration number", "Registrikood", "Įmonės kodas", "IČO", etc.
- vatNumber: VAT / PVN / PVM number. Look for: "PVN reģ. Nr.", "VAT number", "Käibemaksukohustuslase number", "PVM mokėtojo kodas", etc.
- legalAddress: Full registered / legal address as written. Preserve original language.
- country: Full country name in English (e.g. "Latvia", "Estonia", "Lithuania", "Germany").
- bankName, iban, swift: Bank details if present on the document.
- contactPerson, phone, email: Contact info if visible.
- If you cannot determine a value, omit it or use empty string.
- Only return valid JSON, no other text.`;

export async function POST(request: NextRequest) {
  try {
    const authUser = await getApiUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = consumeRateLimit({
      bucket: "ai-parse-company-doc",
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
    let mimeType = "image/png";
    let isPDF = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }

      mimeType = file.type;
      isPDF = file.type === "application/pdf";

      if (isPDF) {
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
      const body = await request.json();
      if (body.image) {
        imageBase64 = body.image;
        mimeType = body.mimeType || "image/png";
      } else {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: "AI parsing not configured.", company: null },
        { status: 503 }
      );
    }

    const userPrompt = "Extract all company/business information from this document. Return JSON only.";

    let messages;
    if (isPDF && pdfBase64) {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "file", file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${pdfBase64}` } },
            { type: "text", text: userPrompt },
          ],
        },
      ];
    } else {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: "text", text: userPrompt },
          ],
        },
      ];
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.OPENAI_VISION,
        messages,
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error (company doc):", errorData);
      return NextResponse.json(
        { error: "AI parsing failed", company: null },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const raw = parsed.company && typeof parsed.company === "object" ? parsed.company : parsed;
        const company: CompanyDocData = {};
        if (raw.companyName) company.companyName = String(raw.companyName).trim();
        if (raw.regNumber) company.regNumber = String(raw.regNumber).trim();
        if (raw.vatNumber) company.vatNumber = String(raw.vatNumber).trim();
        if (raw.legalAddress) company.legalAddress = String(raw.legalAddress).trim();
        if (raw.country) company.country = String(raw.country).trim();
        if (raw.bankName) company.bankName = String(raw.bankName).trim();
        if (raw.iban) company.iban = String(raw.iban).trim();
        if (raw.swift) company.swift = String(raw.swift).trim();
        if (raw.contactPerson) company.contactPerson = String(raw.contactPerson).trim();
        if (raw.phone) company.phone = String(raw.phone).trim();
        if (raw.email) company.email = String(raw.email).trim();

        return NextResponse.json({ company });
      }
    } catch (parseErr) {
      console.error("Failed to parse company doc response:", parseErr, "Content:", content);
    }

    return NextResponse.json({ error: "Could not extract company information", company: null });
  } catch (err) {
    console.error("Parse company doc error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
