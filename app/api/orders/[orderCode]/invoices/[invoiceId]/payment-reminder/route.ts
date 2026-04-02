import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  loadDefaultEmailTemplateForCategory,
  substituteEmailTemplatePlaceholders,
} from "@/lib/email/emailTemplateUtils";
import {
  buildPaymentReminderTemplateVars,
  defaultPaymentReminderHtml,
  defaultPaymentReminderPlainText,
  defaultPaymentReminderSubject,
  paymentReminderSignatureHtml,
  plainTextToReminderHtml,
  type PaymentReminderContext,
} from "@/lib/invoices/paymentReminderEmail";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }
  return null;
}

function formatMoneyEur(amount: number): string {
  const n = Number(amount);
  const sign = n < 0 ? "-" : "";
  return `${sign}€${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roughHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Templates from settings are usually HTML; plain text still sends correctly */
function ensurePaymentReminderBodyHtml(body: string): string {
  const t = body.trim();
  if (!t) return "<p></p>";
  if (t.includes("<") && t.includes(">")) return t;
  return plainTextToReminderHtml(t);
}

type InvoiceReminderRow = {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  deposit_date: string | null;
  final_payment_date: string | null;
  deposit_amount: number | null;
  total: number | string | null;
  status: string;
  is_credit: boolean | null;
  payer_name: string | null;
  orders: { id: string; order_code: string; company_id: string } | { id: string; order_code: string; company_id: string }[] | null;
};

async function loadInvoiceReminderRow(
  invoiceId: string,
  orderCode: string
): Promise<
  | { ok: true; invoice: InvoiceReminderRow; orderRow: { id: string; order_code: string; company_id: string }; companyId: string }
  | { ok: false; status: number; error: string }
> {
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .select(
      `
        id,
        invoice_number,
        invoice_date,
        due_date,
        deposit_date,
        final_payment_date,
        deposit_amount,
        total,
        status,
        is_credit,
        payer_name,
        orders(id, order_code, company_id)
      `
    )
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, status: 404, error: "Invoice not found" };
  }

  const inv = invoice as InvoiceReminderRow;
  const orderRow = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
  if (!orderRow || orderRow.order_code !== orderCode) {
    return { ok: false, status: 400, error: "Invoice does not belong to this order" };
  }

  return { ok: true, invoice: inv, orderRow, companyId: orderRow.company_id };
}

async function buildReminderContextAndDebt(
  invoice: InvoiceReminderRow,
  orderRow: { order_code: string },
  companyDisplayName: string
): Promise<{ ctx: PaymentReminderContext; debt: number; invoiceTotalFormatted: string } | { error: string; status: number }> {
  if (invoice.status === "cancelled") {
    return { error: "Cannot send reminder for a cancelled invoice", status: 400 };
  }
  if (invoice.is_credit === true) {
    return { error: "Payment reminders are not used for credit invoices", status: 400 };
  }

  const { data: invPayments } = await supabaseAdmin
    .from("payments")
    .select("amount, status")
    .eq("invoice_id", invoice.id);
  const paid = (invPayments ?? []).reduce((sum: number, p: { amount?: number; status?: string }) => {
    if (p.status === "cancelled") return sum;
    return sum + (Number(p.amount) || 0);
  }, 0);
  const total = Number(invoice.total) || 0;
  const debt = Math.max(0, total - paid);
  if (debt < 0.01) {
    return { error: "Nothing to remind — invoice has no outstanding balance", status: 400 };
  }

  const ctx: PaymentReminderContext = {
    payerName: (invoice.payer_name as string) || "Sir/Madam",
    invoiceNumber: String(invoice.invoice_number),
    orderCode: String(orderRow.order_code),
    outstandingFormatted: formatMoneyEur(debt),
    dueDateFormatted: invoice.due_date ? formatDateDDMMYYYY(String(invoice.due_date)) : null,
    depositDateFormatted: invoice.deposit_date ? formatDateDDMMYYYY(String(invoice.deposit_date)) : null,
    finalPaymentDateFormatted: invoice.final_payment_date
      ? formatDateDDMMYYYY(String(invoice.final_payment_date))
      : null,
    companyDisplayName,
  };

  return { ctx, debt, invoiceTotalFormatted: formatMoneyEur(total) };
}

// GET — draft subject + HTML body (from Settings → Email templates → Payment Reminders, with variables filled)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderCode, invoiceId } = await params;
    const loaded = await loadInvoiceReminderRow(invoiceId, orderCode);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("legal_name, trading_name, name")
      .eq("id", loaded.companyId)
      .single();

    const companyDisplayName =
      (company as { legal_name?: string })?.legal_name ||
      (company as { trading_name?: string })?.trading_name ||
      (company as { name?: string })?.name ||
      "";

    const built = await buildReminderContextAndDebt(loaded.invoice, loaded.orderRow, companyDisplayName);
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: built.status });
    }

    const { ctx, invoiceTotalFormatted } = built;
    const template = await loadDefaultEmailTemplateForCategory(loaded.companyId, "payment_reminder");
    const vars = buildPaymentReminderTemplateVars(ctx, invoiceTotalFormatted);
    const fromDb =
      template && (template.subject.trim() || template.body.trim())
        ? {
            subject: substituteEmailTemplatePlaceholders(template.subject, vars),
            message: substituteEmailTemplatePlaceholders(template.body, vars),
          }
        : null;

    const subject = fromDb?.subject.trim() || defaultPaymentReminderSubject(ctx);
    const message = fromDb?.message.trim()
      ? ensurePaymentReminderBodyHtml(fromDb.message)
      : defaultPaymentReminderHtml(ctx);

    return NextResponse.json({
      subject,
      message,
      fromTemplate: Boolean(fromDb?.message.trim()),
    });
  } catch (e) {
    console.error("[payment-reminder] GET:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — send payment reminder (tracked via order_communications + Resend webhooks)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { orderCode, invoiceId } = await params;
    const body = await request.json().catch(() => ({}));
    const { to, subject, message } = body as { to?: string; subject?: string; message?: string };

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!to || !to.trim()) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const loaded = await loadInvoiceReminderRow(invoiceId, orderCode);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const { data: company } = await supabaseAdmin.from("companies").select("*").eq("id", loaded.companyId).single();

    let emailFrom: string | null = null;
    if (company) {
      const rawName = (company as { name?: string }).name ?? "";
      const legalName = (company as { legal_name?: string }).legal_name ?? "";
      const tradingName = (company as { trading_name?: string }).trading_name ?? "";
      const displayName = legalName || (rawName.trim() !== "Default Company" ? rawName : "") || tradingName || rawName || "";
      const companyEmailFrom = (company as { invoice_email_from?: string | null }).invoice_email_from?.trim() || null;
      const envFrom = process.env.EMAIL_FROM || "";
      const extractEmail = (s: string) => {
        const m = s.match(/<([^>]+)>/);
        return m ? m[1].trim() : s.trim();
      };
      const fallbackEmail = envFrom ? extractEmail(envFrom) : "noreply@travel-cms.com";
      emailFrom = `${displayName} <${companyEmailFrom || fallbackEmail}>`;
    }

    const companyDisplayName =
      (company as { legal_name?: string })?.legal_name ||
      (company as { trading_name?: string })?.trading_name ||
      (company as { name?: string })?.name ||
      "Our team";

    const built = await buildReminderContextAndDebt(loaded.invoice, loaded.orderRow, companyDisplayName);
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: built.status });
    }

    const { ctx, invoiceTotalFormatted } = built;

    const template = await loadDefaultEmailTemplateForCategory(loaded.companyId, "payment_reminder");
    const vars = buildPaymentReminderTemplateVars(ctx, invoiceTotalFormatted);
    const fromDb =
      template && (template.subject.trim() || template.body.trim())
        ? {
            subject: substituteEmailTemplatePlaceholders(template.subject, vars),
            bodyHtml: substituteEmailTemplatePlaceholders(template.body, vars),
          }
        : null;

    const emailSubject =
      subject?.trim() || fromDb?.subject.trim() || defaultPaymentReminderSubject(ctx);

    const msg = message?.trim();
    let emailHtml: string;
    let bodyForLog: string;

    if (msg) {
      if (msg.includes("<") && msg.includes(">")) {
        // HTML from template or RichTextEditor: do not append signature (avoid duplicate with {{company_name}} in template)
        emailHtml = msg;
        bodyForLog = roughHtmlToPlain(msg);
      } else {
        emailHtml = plainTextToReminderHtml(msg) + paymentReminderSignatureHtml(ctx.companyDisplayName);
        bodyForLog = msg;
      }
    } else if (fromDb?.bodyHtml.trim()) {
      emailHtml = ensurePaymentReminderBodyHtml(fromDb.bodyHtml);
      bodyForLog = roughHtmlToPlain(emailHtml);
    } else {
      emailHtml = defaultPaymentReminderHtml(ctx);
      bodyForLog = defaultPaymentReminderPlainText(ctx);
    }

    const result = await sendEmail(
      to.trim(),
      emailSubject,
      emailHtml,
      undefined,
      undefined,
      { from: emailFrom || undefined, companyId: loaded.companyId }
    );

    if (!result.success) {
      const errMsg =
        result.reason === "no_api_key"
          ? "Email is not configured (RESEND_API_KEY missing)."
          : result.error || "Failed to send email.";
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const orderId = loaded.orderRow.id as string;
    await supabaseAdmin
      .from("order_communications")
      .insert({
        company_id: loaded.companyId,
        order_id: orderId,
        invoice_id: invoiceId,
        type: "to_client",
        email_kind: "payment_reminder",
        recipient_email: to.trim(),
        subject: emailSubject,
        body: bodyForLog,
        sent_by: user.id,
        email_sent: true,
        resend_email_id: result.id ?? null,
        delivery_status: "sent",
      })
      .then(({ error: commError }) => {
        if (commError) console.error("[payment-reminder] Failed to log communication:", commError);
      });

    return NextResponse.json({ success: true, message: "Payment reminder sent", id: result.id });
  } catch (e) {
    console.error("[payment-reminder] POST:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
