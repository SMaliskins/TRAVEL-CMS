import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/sendEmail";
import {
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
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const orderRow = Array.isArray(invoice.orders) ? invoice.orders[0] : invoice.orders;
    if (!orderRow || orderRow.order_code !== orderCode) {
      return NextResponse.json({ error: "Invoice does not belong to this order" }, { status: 400 });
    }

    const companyId = orderRow.company_id as string;
    if (invoice.status === "cancelled") {
      return NextResponse.json({ error: "Cannot send reminder for a cancelled invoice" }, { status: 400 });
    }

    if (invoice.is_credit === true) {
      return NextResponse.json({ error: "Payment reminders are not used for credit invoices" }, { status: 400 });
    }

    const { data: invPayments } = await supabaseAdmin
      .from("payments")
      .select("amount, status")
      .eq("invoice_id", invoiceId);
    const paid = (invPayments ?? []).reduce((sum: number, p: { amount?: number; status?: string }) => {
      if (p.status === "cancelled") return sum;
      return sum + (Number(p.amount) || 0);
    }, 0);
    const total = Number(invoice.total) || 0;
    const debt = Math.max(0, total - paid);
    if (debt < 0.01) {
      return NextResponse.json({ error: "Nothing to remind — invoice has no outstanding balance" }, { status: 400 });
    }

    const { data: company } = await supabaseAdmin.from("companies").select("*").eq("id", companyId).single();

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

    const ctx: PaymentReminderContext = {
      payerName: (invoice.payer_name as string) || "Sir/Madam",
      invoiceNumber: String(invoice.invoice_number),
      orderCode: String(orderRow.order_code),
      outstandingFormatted: formatMoneyEur(debt),
      dueDateFormatted: invoice.due_date ? formatDateDDMMYYYY(String(invoice.due_date)) : null,
      depositDateFormatted: invoice.deposit_date ? formatDateDDMMYYYY(String(invoice.deposit_date)) : null,
      companyDisplayName,
    };

    const emailSubject = subject?.trim() || defaultPaymentReminderSubject(ctx);
    const emailHtml = message?.trim()
      ? plainTextToReminderHtml(message.trim()) + paymentReminderSignatureHtml(companyDisplayName)
      : defaultPaymentReminderHtml(ctx);

    const result = await sendEmail(
      to.trim(),
      emailSubject,
      emailHtml,
      undefined,
      undefined,
      { from: emailFrom || undefined, companyId }
    );

    if (!result.success) {
      const msg =
        result.reason === "no_api_key"
          ? "Email is not configured (RESEND_API_KEY missing)."
          : result.error || "Failed to send email.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const orderId = orderRow.id as string;
    await supabaseAdmin
      .from("order_communications")
      .insert({
        company_id: companyId,
        order_id: orderId,
        invoice_id: invoiceId,
        type: "to_client",
        email_kind: "payment_reminder",
        recipient_email: to.trim(),
        subject: emailSubject,
        body: message?.trim() || defaultPaymentReminderPlainText(ctx),
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
