import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { parseDocument } from "@/lib/ai/parseWithAI";
import type { InvoiceData } from "@/lib/ai/parseSchemas";

const BUCKET_NAME = "order-documents";

function isImageMime(mime: string): boolean {
  return /^image\/(png|jpeg|jpg|webp)$/.test(mime) || /\.(png|jpg|jpeg|webp)$/i.test(mime);
}

/**
 * Regex fallback for text-based invoice extraction (when AI fails).
 */
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

  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const fromMatch = text.match(/(?:from|supplier|issuer|seller|vendor)\s*:?\s*([^\n]+)/i);
  if (fromMatch) {
    result.supplier = fromMatch[1].trim().slice(0, 100);
  } else if (lines.length > 0) {
    const first = lines.find((l) => l.length > 3 && !/^(invoice|bill|receipt|№|no\.?|#)\s*/i.test(l) && !/^\d+$/.test(l));
    if (first) result.supplier = first.slice(0, 100);
  }

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
  if (totalMatch) {
    result.amount = totalMatch.n;
    result.currency = totalMatch.cur;
  }

  const invNumRe = /(?:invoice|inv\.?|no\.?|nr\.?|number|№)\s*:?\s*([A-Za-z0-9\-\/]+)/gi;
  const invNumM = invNumRe.exec(text);
  if (invNumM) result.invoice_number = invNumM[1].trim().slice(0, 50);

  const dateFormats = [
    /(?:invoice\s*date|date|issue\s*date|issued)\s*:?\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i,
    /(?:invoice\s*date|date|issue\s*date)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    /\b(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})\b/,
  ];
  for (const re of dateFormats) {
    const dm = text.match(re);
    if (dm) {
      result.invoice_date = dm[1].trim().slice(0, 12);
      break;
    }
  }

  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId } = apiUser;

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

    // Use unified pipeline
    const result = await parseDocument<InvoiceData>({
      file: buffer,
      filename: doc.file_name || "document",
      mimeType: doc.mime_type || mime,
      documentType: "invoice",
      companyId,
      userId,
    });

    // Map to legacy response format
    const mapped = {
      supplier: result.data?.supplier,
      amount: result.data?.amount,
      currency: result.data?.currency || "EUR",
      invoice_number: result.data?.invoiceNumber,
      invoice_date: result.data?.invoiceDate,
    };

    // If AI returned nothing useful, try regex fallback on PDF text
    if (!mapped.supplier && mapped.amount == null && !mapped.invoice_number && !mapped.invoice_date) {
      if (isPdf) {
        try {
          const { extractText } = await import("unpdf");
          const pdfData = await extractText(new Uint8Array(buffer));
          const rawText = Array.isArray(pdfData?.text) ? pdfData.text.join("\n") : (pdfData?.text || "");
          const text = typeof rawText === "string" ? rawText.trim() : "";
          if (text) {
            const regexParsed = extractInvoiceData(text);
            await saveParsed(docId, regexParsed);
            return NextResponse.json(regexParsed);
          }
        } catch { /* ignore regex fallback failure */ }
      }
      return NextResponse.json({ supplier: undefined, amount: undefined, currency: undefined });
    }

    await saveParsed(docId, mapped);
    return NextResponse.json(mapped);
  } catch (e) {
    console.error("[Documents parse]:", e);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}

async function saveParsed(
  docId: string,
  p: { supplier?: string; amount?: number; currency?: string; invoice_number?: string; invoice_date?: string }
) {
  if (!p || (!p.supplier && p.amount == null && !p.invoice_number && !p.invoice_date)) return;
  await supabaseAdmin.from("order_documents").update({
    parsed_supplier: p.supplier || null,
    parsed_amount: p.amount ?? null,
    parsed_currency: p.currency || "EUR",
    parsed_invoice_number: p.invoice_number || null,
    parsed_invoice_date: p.invoice_date || null,
  }).eq("id", docId);
}
