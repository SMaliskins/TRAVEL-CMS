import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { logAiUsage } from "@/lib/aiUsageLogger";
import { MODELS } from "@/lib/ai/config";

const ALLOWED_ROLES = ["supervisor", "finance"];
const OPENAI_MODEL = MODELS.OPENAI_VISION;

function canAccessCompanyExpenses(role: string): boolean {
  return ALLOWED_ROLES.includes(role.toLowerCase());
}

function normalizeDate(s: string): string {
  const d = s.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (iso) return d;
  const [a, b, c] = d.split(/[.\/-]/).map((x) => x.trim());
  if (!a || !b || !c) return d;
  let day: string, month: string, year: string;
  if (a.length === 4) {
    year = a;
    month = b.padStart(2, "0");
    day = c.padStart(2, "0");
  } else {
    day = a.padStart(2, "0");
    month = b.padStart(2, "0");
    year = c.length === 2 ? `20${c}` : c;
  }
  return `${year}-${month}-${day}`;
}

function extractExpenseInvoiceData(text: string): {
  supplier?: string;
  amount?: number;
  currency?: string;
  invoice_date?: string;
  description?: string;
} {
  const result: {
    supplier?: string;
    amount?: number;
    currency?: string;
    invoice_date?: string;
    description?: string;
  } = {};
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // Supplier = invoice issuer (e.g. Pakalpojuma sniedzējs), not the brand in line items (e.g. Vienna Insurance).
  const issuerLvSameLine = text.match(/(?:Pakalpojuma\s*sniedzējs|pakalpojuma\s*sniedzējs)\s*:?\s*(?:name\s*:?\s*)?([^\n]+)/i);
  const issuerLvNextLine = text.match(/(?:Pakalpojuma\s*sniedzējs|pakalpojuma\s*sniedzējs)\s*:?\s*\n\s*(?:name\s*:?\s*)?([^\n]+)/i);
  const issuerLv = issuerLvSameLine ?? issuerLvNextLine;
  if (issuerLv) {
    let name = issuerLv[1].trim().replace(/^\s*name\s*:?\s*/i, "").replace(/\s*Registration\s*Number[\s\S]*$/i, "").replace(/\s*\d{8,}\s*$/i, "").trim();
    if (name.length > 2 && name.length < 200) result.supplier = name.slice(0, 200);
  }
  if (!result.supplier) {
    const fromMatch = text.match(/(?:from|supplier|issuer|seller|vendor|service\s*provider)\s*:?\s*(?:name\s*:?\s*)?([^\n]+)/i);
    if (fromMatch) {
      const name = fromMatch[1].trim().replace(/^\s*name\s*:?\s*/i, "").replace(/\s*Registration\s*Number[\s\S]*$/i, "").trim();
      if (name.length > 2) result.supplier = name.slice(0, 200);
    }
  }
  if (!result.supplier && lines.length > 0) {
    const siaLine = lines.find((l) => /^(SIA|AS|UAB|OÜ)\s+.+/.test(l) && l.length < 200 && !/registration|reģ\.|reg\./i.test(l));
    if (siaLine) result.supplier = siaLine.slice(0, 200);
    else {
      const first = lines.find((l) => l.length > 3 && !/^(invoice|bill|receipt|№|no\.?|#|total|date)\s*/i.test(l) && !/^\d+$/.test(l));
      if (first) result.supplier = first.slice(0, 200);
    }
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

  // Invoice date = issue date (usually at top). Exclude due date (Apmaksāt līdz, Due date, pay by).
  const dueDateBlock = text.match(/(?:apmaksāt\s*līdz|due\s*date|payable\s*by|payment\s*by|pay\s*by|līdz)\s*:?\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{4}-\d{2}-\d{2})/gi);
  const dueDateValues = dueDateBlock ? dueDateBlock.map((s) => normalizeDate((s.replace(/^[^0-9]+/i, "").match(/(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{4}-\d{2}-\d{2})/)?.[1] ?? "").trim())) : [];
  const isDueDate = (d: string) => dueDateValues.some((due) => due === d);

  const invoiceDatePatterns = [
    /(?:invoice\s*date|issue\s*date|issued|faktūras\s*datums|datums|date)\s*:?\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i,
    /(?:invoice\s*date|issue\s*date)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    /(\d{4})\.\s*gada\.\s*(\d{1,2})\.\s*(marts|janvāris|februāris|aprīlis|maijs|jūnijs|jūlijs|augusts|septembris|oktobris|novembris|decembris)/i,
  ];
  const monthsLv: Record<string, string> = { marts: "03", janvāris: "01", februāris: "02", aprīlis: "04", maijs: "05", jūnijs: "06", jūlijs: "07", augusts: "08", septembris: "09", oktobris: "10", novembris: "11", decembris: "12" };
  for (const re of invoiceDatePatterns) {
    const match = text.match(re);
    if (match) {
      let dateStr = match[1].trim();
      if (match[3] && monthsLv[match[3].toLowerCase()]) {
        const year = match[1];
        const month = monthsLv[match[3].toLowerCase()];
        const day = (match[2] ?? "01").padStart(2, "0");
        dateStr = `${year}-${month}-${day}`;
      }
      const normalized = normalizeDate(dateStr);
      if (normalized && !isDueDate(normalized)) {
        result.invoice_date = normalized;
        break;
      }
    }
  }
  if (!result.invoice_date) {
    const anyDate = text.match(/\b(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})\b/);
    if (anyDate) {
      const normalized = normalizeDate(anyDate[1].trim());
      if (normalized && !isDueDate(normalized)) result.invoice_date = normalized;
    }
  }

  const descMatch = text.match(/(?:for|service|description|subject|purpose|object|apraksts|pamats)\s*:?\s*([^\n]+(?:\n[^\n]+){0,3})/i);
  if (descMatch) {
    result.description = descMatch[1].replace(/\s+/g, " ").trim().slice(0, 500);
  } else {
    const meaningful = lines
      .filter((l) => l.length > 2 && l.length < 200 && !/^(invoice|bill|receipt|№|no\.?|#|total|sum|date)\s*/i.test(l) && !/^\d+[.,]\d+/.test(l))
      .slice(0, 5);
    if (meaningful.length > 0) {
      result.description = meaningful.join(" · ").slice(0, 500);
    }
  }

  return result;
}

const EXPENSE_AI_PROMPT = `You are an expense invoice parser. Extract structured data (company bills, insurance, utilities, etc.).

Return a JSON object with exactly these fields (use null for missing):
{
  "supplier": "The company that ISSUED the invoice (invoice issuer, document issuer, 'Pakalpojuma sniedzējs' / service provider). Use the name at the top of the invoice who is the sender/issuer. Do NOT use the insurance company or brand mentioned in the product line (e.g. Vienna Insurance, Compensa) — that is not the supplier if the invoice was issued by a broker (e.g. SIA R&D Apdrošināšanas Brokers).",
  "invoice_date": "Date the invoice was ISSUED (usually at the top of the document), in YYYY-MM-DD only. Do NOT use the payment due date (Apmaksāt līdz, Due date, pay by, payable by) — that is different from the invoice date.",
  "amount": number (total amount, numeric only),
  "currency": "EUR" or "USD",
  "description": "Concrete, specific description from the document: include what the invoice is for (e.g. type of insurance, policy number or reference, period covered, product/service names, line items or subscription name). Do NOT use a single generic word like 'Insurance' or 'Utilities' — use the actual details from the invoice so a reader knows exactly what this expense is (e.g. 'D&O insurance policy XYZ, period 01.01.2026–31.12.2026' or 'Office electricity, meter 12345, January 2026'). Max 400 characters."
}

Return only valid JSON, no other text.`;

async function parseTextWithAI(
  text: string,
  companyId: string,
  userId: string
): Promise<{ supplier?: string; invoice_date?: string; amount?: number; currency?: string; description?: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 600,
        messages: [
          { role: "system", content: EXPENSE_AI_PROMPT },
          { role: "user", content: `Extract expense invoice data from:\n\n${text.slice(0, 12000)}` },
        ],
      }),
    });
    if (!res.ok) return null;
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
      metadata: { type: "parse_company_expense" },
    });
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as Record<string, unknown>;
      const invDate = typeof parsed.invoice_date === "string" ? parsed.invoice_date : undefined;
      return {
        supplier: typeof parsed.supplier === "string" ? parsed.supplier : undefined,
        invoice_date: invDate ? normalizeDate(invDate) : undefined,
        amount: typeof parsed.amount === "number" ? parsed.amount : undefined,
        currency: typeof parsed.currency === "string" ? parsed.currency : "EUR",
        description: typeof parsed.description === "string" ? parsed.description.trim().slice(0, 500) : undefined,
      };
    }
  } catch (e) {
    console.error("[company-expenses parse] AI error:", e);
  }
  return null;
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let text = "";

    if (isPdf) {
      const { extractText } = await import("unpdf");
      const uint8 = new Uint8Array(buffer);
      const pdfData = await extractText(uint8);
      const raw = Array.isArray(pdfData?.text) ? pdfData.text.join("\n") : (pdfData?.text || "");
      text = typeof raw === "string" ? raw.trim() : "";
    }

    let result: { supplier?: string; invoice_date?: string; amount?: number; currency?: string; description?: string };

    if (text.length > 50) {
      const aiParsed = await parseTextWithAI(text, apiUser.companyId, apiUser.userId);
      if (aiParsed && (aiParsed.supplier || aiParsed.amount != null || aiParsed.invoice_date || aiParsed.description)) {
        result = aiParsed;
      } else {
        const extracted = extractExpenseInvoiceData(text);
        result = {
          supplier: extracted.supplier,
          invoice_date: extracted.invoice_date,
          amount: extracted.amount,
          currency: extracted.currency || "EUR",
          description: extracted.description,
        };
      }
    } else {
      const extracted = extractExpenseInvoiceData(text || file.name);
      result = {
        supplier: extracted.supplier,
        invoice_date: extracted.invoice_date,
        amount: extracted.amount,
        currency: extracted.currency || "EUR",
        description: extracted.description,
      };
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[company-expenses parse] POST:", err);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
