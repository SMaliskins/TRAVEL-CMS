import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { parseDocument } from "@/lib/ai/parseWithAI";
import type { InvoiceData } from "@/lib/ai/parseSchemas";

const ALLOWED_ROLES = ["supervisor", "finance"];

function canAccessCompanyExpenses(role: string): boolean {
  return ALLOWED_ROLES.includes(role.toLowerCase());
}

/**
 * Regex fallback for expense invoice data extraction.
 */
function extractExpenseInvoiceData(text: string): {
  supplier?: string;
  invoice_date?: string;
  amount?: number;
  currency?: string;
  description?: string;
} {
  const result: { supplier?: string; invoice_date?: string; amount?: number; currency?: string; description?: string } = {};

  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // Supplier
  const fromMatch = text.match(/(?:from|supplier|issuer|pakalpojuma\s+sniedzējs|rēķina\s+izsniedzējs)\s*:?\s*([^\n]+)/i);
  if (fromMatch) {
    result.supplier = fromMatch[1].trim().slice(0, 150);
  } else {
    const first = lines.find((l) => l.length > 3 && !/^(invoice|rēķins|bill|receipt|nr|no\.?|#)\s*/i.test(l) && !/^\d+$/.test(l));
    if (first) result.supplier = first.slice(0, 150);
  }

  // Amount
  const amountRe = /(?:total|summa|kopā|amount|apmaksa|maksājums)\s*:?\s*(?:€|EUR|USD|\$)?\s*([\d\s.,]+)/gi;
  let m;
  while ((m = amountRe.exec(text)) !== null) {
    const numStr = (m[1] || "").replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(numStr);
    if (!isNaN(n) && n > 0 && n < 1e9) {
      result.amount = n;
      result.currency = "EUR";
    }
  }

  // Date (invoice date, NOT due date)
  const dateRe = /(?:rēķina\s+datums|invoice\s*date|date|datums|issued)\s*:?\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i;
  const dm = text.match(dateRe);
  if (dm) {
    const d = dm[1].trim();
    const [a, b, c] = d.split(/[.\/]/).map((x) => x.trim());
    if (a && b && c) {
      const day = a.padStart(2, "0");
      const month = b.padStart(2, "0");
      const year = c.length === 2 ? `20${c}` : c;
      result.invoice_date = `${year}-${month}-${day}`;
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessCompanyExpenses(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden. Supervisor or Finance only." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isPdf = file.type === "application/pdf" || ext === "pdf";
    const isImage = /^(image\/png|image\/jpeg|image\/jpg|image\/webp)$/.test(file.type) || /^(png|jpe?g|webp)$/.test(ext);
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: "Allowed: PDF or image (PNG, JPG, WebP)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Use unified pipeline
    const result = await parseDocument<InvoiceData>({
      file: buffer,
      filename: file.name,
      mimeType: file.type,
      documentType: "expense",
      companyId: apiUser.companyId,
      userId: apiUser.userId,
    });

    if (result.success && result.data) {
      const data = {
        supplier: result.data.supplier,
        invoice_date: result.data.invoiceDate,
        amount: result.data.amount,
        currency: result.data.currency || "EUR",
        description: result.data.description,
      };
      return NextResponse.json({ data });
    }

    // Regex fallback
    if (isPdf) {
      try {
        const { extractText } = await import("unpdf");
        const pdfData = await extractText(new Uint8Array(buffer));
        const raw = Array.isArray(pdfData?.text) ? pdfData.text.join("\n") : (pdfData?.text || "");
        const text = typeof raw === "string" ? raw.trim() : "";
        if (text) {
          const extracted = extractExpenseInvoiceData(text);
          return NextResponse.json({ data: extracted });
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json({ data: { supplier: undefined, amount: undefined, currency: "EUR" } });
  } catch (err) {
    console.error("[company-expenses parse] POST:", err);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
