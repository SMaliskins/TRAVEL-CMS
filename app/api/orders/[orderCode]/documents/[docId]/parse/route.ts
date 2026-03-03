import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAiUsage } from "@/lib/aiUsageLogger";

const OPENAI_MODEL = "gpt-4o";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET_NAME = "order-documents";

async function getCompanyId(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
  if (p?.company_id) return p.company_id as string;
  const { data: up } = await supabaseAdmin.from("user_profiles").select("company_id").eq("id", userId).maybeSingle();
  return (up?.company_id as string) ?? null;
}

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
    return user;
  }
  return null;
}

function extractInvoiceData(text: string): {
  supplier?: string;
  amount?: number;
  currency?: string;
  invoice_number?: string;
  invoice_date?: string;
} {
  const result: {
    supplier?: string;
    amount?: number;
    currency?: string;
    invoice_number?: string;
    invoice_date?: string;
  } = {};

  // Supplier: first non-empty line(s) often; or after "From:", "Supplier:", "Issuer:"
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const fromMatch = text.match(/(?:from|supplier|issuer|seller|vendor)\s*:?\s*([^\n]+)/i);
  if (fromMatch) {
    result.supplier = fromMatch[1].trim().slice(0, 100);
  } else if (lines.length > 0) {
    // First meaningful line (skip "INVOICE", "Bill", numbers)
    const first = lines.find((l) => l.length > 3 && !/^(invoice|bill|receipt|№|no\.?|#)\s*/i.test(l) && !/^\d+$/.test(l));
    if (first) result.supplier = first.slice(0, 100);
  }

  // Amount: TOTAL AMOUNT, KOPEJA SUMMA, Total, Sum, Amount, Due, Balance
  const totalRe = /(?:total\s*amount|kopeja\s*summa|kokku|koondsumma|total|sum|amount|due|balance|payable)\s*:?\s*(?:€|EUR|USD|\$)?\s*([\d\s.,]+)/gi;
  const currencyRe = /(?:€|EUR|USD|\$)\s*([\d\s.,]+)/g;
  const allMatches: { n: number; isTotal: boolean; cur: string }[] = [];
  let m;
  while ((m = totalRe.exec(text)) !== null) {
    const numStr = (m[1] || "").replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(numStr);
    if (!isNaN(n) && n > 0 && n < 1e9) allMatches.push({ n, isTotal: true, cur: "EUR" });
  }
  while ((m = currencyRe.exec(text)) !== null) {
    const numStr = m[0].replace(/[^\d.,]/g, "").replace(",", ".");
    const n = parseFloat(numStr);
    if (!isNaN(n) && n > 0 && n < 1e9) {
      const cur = /USD|\$/.test(m[0]) ? "USD" : "EUR";
      allMatches.push({ n, isTotal: false, cur });
    }
  }
  const totalMatch = allMatches.find((x) => x.isTotal) || allMatches[allMatches.length - 1];
  const amount = totalMatch?.n ?? null;
  const currency = totalMatch?.cur ?? "EUR";
  if (amount != null) {
    result.amount = amount;
    result.currency = currency;
  }

  // Invoice number: Invoice #, No., Nr., №, inv.no.
  const invNumRe = /(?:invoice|inv\.?|no\.?|nr\.?|number|№)\s*:?\s*([A-Za-z0-9\-\/]+)/gi;
  const invNumM = invNumRe.exec(text);
  if (invNumM) result.invoice_number = invNumM[1].trim().slice(0, 50);

  // Invoice date: Date, Invoice date, Issue date, dd.mm.yyyy, dd/mm/yyyy
  const dateFormats = [
    /(?:invoice\s*date|date|issue\s*date|issued)\s*:?\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i,
    /(?:invoice\s*date|date|issue\s*date)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    /\b(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})\b/,
  ];
  for (const re of dateFormats) {
    const m = text.match(re);
    if (m) {
      result.invoice_date = m[1].trim().slice(0, 12);
      break;
    }
  }

  return result;
}

const INVOICE_AI_PROMPT = `You are an invoice parser for a travel agency CRM. Extract structured data from the invoice text.

Return a JSON object with exactly these fields (use null for missing):
{
  "supplier": "Company/supplier name as shown on invoice",
  "invoice_number": "Invoice number, reference, or ID",
  "invoice_date": "Invoice date in format DD.MM.YYYY or YYYY-MM-DD",
  "amount": number (total amount, numeric only),
  "currency": "EUR" or "USD"
}

Rules:
- supplier: The company that issued the invoice (seller, issuer). Often at top or after "From:", "Supplier:", "Bill to" issuer.
- invoice_number: Any reference like "Inv #123", "No. ABC-001", "Rechnungsnummer", "Invoice No."
- invoice_date: Issue date, invoice date, or document date
- amount: Look for labels such as "TOTAL AMOUNT", "KOPEJA SUMMA" (Estonian total), "Total", "Sum total", "Grand total", "Kokku", "Koondsumma", "To pay", "Amount due". Extract the main total amount as a number.
- Return only valid JSON, no other text.`;

function isImageMime(mime: string): boolean {
  return /^image\/(png|jpeg|jpg|webp)$/.test(mime) || /\.(png|jpg|jpeg|webp)$/i.test(mime);
}

async function parseImageWithAI(
  buffer: Buffer,
  mimeType: string,
  companyId: string,
  userId: string
): Promise<{ supplier?: string; amount?: number; currency?: string; invoice_number?: string; invoice_date?: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const mediaType = mimeType.includes("png") ? "image/png" : mimeType.includes("webp") ? "image/webp" : "image/jpeg";
  const base64 = buffer.toString("base64");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 500,
        messages: [
          { role: "system", content: INVOICE_AI_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
              { type: "text", text: "Extract invoice data from this image." },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Documents parse] OpenAI image error:", err);
      return null;
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    await logAiUsage({
      companyId,
      userId,
      operation: "other",
      model: OPENAI_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      success: true,
      metadata: { type: "parse_invoice_image" },
    });
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as Record<string, unknown>;
      return {
        supplier: typeof parsed.supplier === "string" ? parsed.supplier : undefined,
        invoice_number: typeof parsed.invoice_number === "string" ? parsed.invoice_number : undefined,
        invoice_date: typeof parsed.invoice_date === "string" ? parsed.invoice_date : undefined,
        amount: typeof parsed.amount === "number" ? parsed.amount : undefined,
        currency: typeof parsed.currency === "string" ? parsed.currency : "EUR",
      };
    }
  } catch (e) {
    console.error("[Documents parse] AI image parsing failed:", e);
  }
  return null;
}

async function parsePdfWithAI(
  buffer: Buffer,
  companyId: string,
  userId: string
): Promise<{ supplier?: string; amount?: number; currency?: string; invoice_number?: string; invoice_date?: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base64 = buffer.toString("base64");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 500,
        messages: [
          { role: "system", content: INVOICE_AI_PROMPT },
          {
            role: "user",
            content: [
              { type: "file", file: { filename: "invoice.pdf", file_data: `data:application/pdf;base64,${base64}` } },
              { type: "text", text: "Extract invoice data from this PDF. Look for TOTAL AMOUNT, KOPEJA SUMMA, supplier, date, invoice number." },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Documents parse] OpenAI PDF error:", err);
      return null;
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    await logAiUsage({
      companyId,
      userId,
      operation: "other",
      model: OPENAI_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      success: true,
      metadata: { type: "parse_invoice_pdf_vision" },
    });
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as Record<string, unknown>;
      return {
        supplier: typeof parsed.supplier === "string" ? parsed.supplier : undefined,
        invoice_number: typeof parsed.invoice_number === "string" ? parsed.invoice_number : undefined,
        invoice_date: typeof parsed.invoice_date === "string" ? parsed.invoice_date : undefined,
        amount: typeof parsed.amount === "number" ? parsed.amount : undefined,
        currency: typeof parsed.currency === "string" ? parsed.currency : "EUR",
      };
    }
  } catch (e) {
    console.error("[Documents parse] AI PDF parsing failed:", e);
  }
  return null;
}

async function parseWithAI(
  text: string,
  companyId: string,
  userId: string
): Promise<{ supplier?: string; amount?: number; currency?: string; invoice_number?: string; invoice_date?: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 500,
        messages: [
          { role: "system", content: INVOICE_AI_PROMPT },
          { role: "user", content: `Extract invoice data from:\n\n${text.slice(0, 15000)}` },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Documents parse] OpenAI error:", err);
      return null;
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    await logAiUsage({
      companyId,
      userId,
      operation: "other",
      model: OPENAI_MODEL,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      success: true,
      metadata: { type: "parse_invoice" },
    });
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as Record<string, unknown>;
      return {
        supplier: typeof parsed.supplier === "string" ? parsed.supplier : undefined,
        invoice_number: typeof parsed.invoice_number === "string" ? parsed.invoice_number : undefined,
        invoice_date: typeof parsed.invoice_date === "string" ? parsed.invoice_date : undefined,
        amount: typeof parsed.amount === "number" ? parsed.amount : undefined,
        currency: typeof parsed.currency === "string" ? parsed.currency : "EUR",
      };
    }
  } catch (e) {
    console.error("[Documents parse] AI parsing failed:", e);
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; docId: string }> }
) {
  try {
    const { orderCode, docId } = await params;
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    const { data: doc, error: docErr } = await supabaseAdmin
      .from("order_documents")
      .select("id, company_id, file_path, file_name, mime_type")
      .eq("id", docId)
      .single();

    if (docErr || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.company_id !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const mime = (doc.mime_type || doc.file_name || "").toLowerCase();
    const isPdf = mime.includes("pdf");
    const isImage = isImageMime(mime) || isImageMime(doc.file_name || "");

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: "Only PDF and images (PNG, JPG, WebP) can be parsed" }, { status: 400 });
    }

    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(BUCKET_NAME).download(doc.file_path);
    if (dlErr || !blob) {
      console.error("[Documents parse] Download error:", dlErr);
      return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    const saveParsed = async (p: { supplier?: string; amount?: number; currency?: string; invoice_number?: string; invoice_date?: string }) => {
      if (!p || (!p.supplier && p.amount == null && !p.invoice_number && !p.invoice_date)) return;
      await supabaseAdmin.from("order_documents").update({
        parsed_supplier: p.supplier || null,
        parsed_amount: p.amount ?? null,
        parsed_currency: p.currency || "EUR",
        parsed_invoice_number: p.invoice_number || null,
        parsed_invoice_date: p.invoice_date || null,
      }).eq("id", docId);
    };

    if (isImage) {
      const mediaType = mime.includes("png") ? "image/png" : mime.includes("webp") ? "image/webp" : "image/jpeg";
      const aiParsed = await parseImageWithAI(buffer, mediaType, companyId, user.id);
      if (aiParsed && (aiParsed.supplier || aiParsed.amount != null || aiParsed.invoice_number || aiParsed.invoice_date)) {
        await saveParsed(aiParsed);
        return NextResponse.json(aiParsed);
      }
      return NextResponse.json({ supplier: undefined, amount: undefined, currency: undefined });
    }

    // PDF
    const { extractText } = await import("unpdf");
    const uint8Array = new Uint8Array(buffer);
    const pdfData = await extractText(uint8Array);
    const rawText = Array.isArray(pdfData?.text) ? pdfData.text.join("\n") : (pdfData?.text || "");
    const text = typeof rawText === "string" ? rawText.trim() : "";

    if (!text) {
      // Scanned/image PDF: unpdf returns empty text — send PDF directly to GPT-4o
      const pdfVision = await parsePdfWithAI(buffer, companyId, user.id);
      if (pdfVision && (pdfVision.supplier || pdfVision.amount != null || pdfVision.invoice_number || pdfVision.invoice_date)) {
        await saveParsed(pdfVision);
        return NextResponse.json(pdfVision);
      }
      return NextResponse.json({ supplier: undefined, amount: undefined, currency: undefined });
    }

    const aiParsed = await parseWithAI(text, companyId, user.id);
    if (aiParsed && (aiParsed.supplier || aiParsed.amount != null || aiParsed.invoice_number || aiParsed.invoice_date)) {
      await saveParsed(aiParsed);
      return NextResponse.json(aiParsed);
    }

    const parsed = extractInvoiceData(text);
    await saveParsed(parsed);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[Documents parse]:", e);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
