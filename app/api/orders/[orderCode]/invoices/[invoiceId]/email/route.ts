import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInvoiceHTML, type InvoiceCompanyInfo } from "@/lib/invoices/generateInvoiceHTML";
import { generatePDFFromHTML } from "@/lib/invoices/generateInvoicePDF";
import { sendEmail } from "@/lib/email/sendEmail";
import { replaceBase64Images } from "@/lib/email/replaceBase64Images";
import {
  appendHtmlWithEmailSignature,
  normalizeEmailSignatureSource,
  resolveEmailSignatureInnerHtml,
} from "@/lib/email/appendUserEmailSignature";
import {
  applyEmailTemplateLocale,
  loadDefaultEmailTemplateForCategory,
} from "@/lib/email/emailTemplateUtils";
import {
  buildInvoiceEmailTemplateVars,
  formatInvoiceDueParts,
  invoiceOutstandingFormatted,
  resolveInvoiceEmailLetter,
  formatInvoiceMoneyEur,
  INVOICE_EMAIL_PDF_FOOTER_HTML,
} from "@/lib/invoices/invoiceEmailTemplate";
import { loadInvoiceWithItemsForOrder } from "@/lib/invoices/loadInvoiceWithItemsForOrder";

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

/** GET draft subject/message from Settings → Email templates → Invoices (same substitution as POST when body empty). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { orderCode, invoiceId } = await params;
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loaded = await loadInvoiceWithItemsForOrder(invoiceId, orderCode);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name, legal_name, trading_name")
      .eq("id", loaded.companyId)
      .single();

    const rawName = (company as { name?: string } | null)?.name ?? "";
    const legalName = (company as { legal_name?: string } | null)?.legal_name ?? "";
    const tradingName = (company as { trading_name?: string } | null)?.trading_name ?? "";
    const companyDisplayName =
      legalName ||
      (rawName.trim() !== "Default Company" ? rawName : "") ||
      tradingName ||
      rawName ||
      "Our team";

    const { dueDateFormatted, depositDateFormatted, finalPaymentDateFormatted } = formatInvoiceDueParts(
      loaded.invoice
    );
    const invRow = loaded.invoice as {
      total?: unknown;
      payer_name?: unknown;
      invoice_number?: unknown;
      invoice_items?: Parameters<typeof buildInvoiceEmailTemplateVars>[0]["items"];
      paid_amount?: unknown;
      remaining?: unknown;
    };
    const totalNum = Number(invRow.total) || 0;
    const templateRow = await loadDefaultEmailTemplateForCategory(loaded.companyId, "invoice");
    const langParam = request.nextUrl.searchParams.get("lang")?.trim().toLowerCase() || undefined;
    const templateForDisplay = applyEmailTemplateLocale(templateRow, langParam);
    const vars = buildInvoiceEmailTemplateVars({
      payerName: String(invRow.payer_name ?? "").trim() || "Sir/Madam",
      orderCode: loaded.orderRow.order_code,
      invoiceNumber: String(invRow.invoice_number),
      invoiceTotalFormatted: formatInvoiceMoneyEur(totalNum),
      outstandingFormatted: invoiceOutstandingFormatted({
        total: invRow.total as string | number | null,
        paid_amount: invRow.paid_amount as number | null | undefined,
        remaining: invRow.remaining as number | null | undefined,
      }),
      dueDateFormatted,
      depositDateFormatted,
      finalPaymentDateFormatted,
      companyDisplayName,
      items: invRow.invoice_items,
    });

    const canonicalResolved = resolveInvoiceEmailLetter({
      invoiceNumber: String(loaded.invoice.invoice_number),
      subjectFromClient: null,
      messageFromClient: null,
      template: templateRow,
      vars,
    });

    const displayResolved = resolveInvoiceEmailLetter({
      invoiceNumber: String(loaded.invoice.invoice_number),
      subjectFromClient: null,
      messageFromClient: null,
      template: templateForDisplay,
      vars,
    });

    const usedDbTranslation = Boolean(
      langParam &&
        langParam !== "en" &&
        templateRow?.translations?.[langParam] &&
        ((templateRow.translations[langParam].subject ?? "").trim() !== "" ||
          (templateRow.translations[langParam].body ?? "").trim() !== "")
    );

    const subject = displayResolved.subject;
    const bodyHtml = displayResolved.bodyHtml;

    const sigSource = templateRow?.email_signature_source ?? normalizeEmailSignatureSource(null);
    const innerSig = await resolveEmailSignatureInnerHtml({
      source: sigSource,
      userId: user.id,
      companyId: loaded.companyId,
    });
    const sigBlock = innerSig
      ? `<br><div style="margin-top:16px;padding-top:12px">${innerSig}</div>`
      : "";
    const suffixHtml = `${sigBlock}${INVOICE_EMAIL_PDF_FOOTER_HTML}`;
    const message = `${bodyHtml}${suffixHtml}`;

    return NextResponse.json({
      subject,
      message,
      letter_body_html: bodyHtml,
      previewSuffixHtml: suffixHtml,
      canonical_subject: canonicalResolved.subject,
      canonical_letter_body_html: canonicalResolved.bodyHtml,
      used_db_translation: usedDbTranslation,
    });
  } catch (e) {
    console.error("[invoice email] GET:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders/[orderCode]/invoices/[invoiceId]/email - Send invoice via email (Resend)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { orderCode, invoiceId } = await params;
    const body = await request.json();
    const { to, subject, message, email_body_complete } = body;

    const user = await getUser(request);

    if (!to || !to.trim()) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    const loaded = await loadInvoiceWithItemsForOrder(invoiceId, orderCode);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    const invoice = loaded.invoice;
    const orderRow = loaded.orderRow;
    const companyId = loaded.companyId;

    let companyLogoUrl: string | null = null;
    let companyInfo: InvoiceCompanyInfo | null = null;
    let emailFrom: string | null = null;
    let invoiceTemplateId: string | undefined;
    let invoiceAccentColor: string | undefined;
    let companyDisplayNameForTemplate = "Our team";
    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (company) {
        companyLogoUrl = (company as { logo_url?: string | null }).logo_url ?? null;
        const rawName = (company as { name?: string }).name ?? "";
        const legalName = (company as { legal_name?: string }).legal_name ?? "";
        const tradingName = (company as { trading_name?: string }).trading_name ?? "";
        const displayName = legalName || (rawName.trim() !== "Default Company" ? rawName : "") || tradingName || rawName || "";
        companyDisplayNameForTemplate = displayName || companyDisplayNameForTemplate;
        const companyEmailFrom = (company as { invoice_email_from?: string | null }).invoice_email_from?.trim() || null;
        const envFrom = process.env.EMAIL_FROM || "";
        const extractEmail = (s: string) => { const m = s.match(/<([^>]+)>/); return m ? m[1].trim() : s.trim(); };
        const fallbackEmail = envFrom ? extractEmail(envFrom) : "noreply@travel-cms.com";
        emailFrom = `${displayName} <${companyEmailFrom || fallbackEmail}>`;
        const { data: bankAccounts } = await supabaseAdmin
          .from("company_bank_accounts")
          .select("account_name, bank_name, iban, swift, currency")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .eq("use_in_invoices", true)
          .order("is_default", { ascending: false })
          .order("account_name");
        const defaultBank = bankAccounts?.[0];

        companyInfo = {
          name: displayName,
          address: (company as { address?: string; legal_address?: string; operating_address?: string }).address || (company as { legal_address?: string }).legal_address || (company as { operating_address?: string }).operating_address || null,
          regNr: (company as { registration_number?: string; reg_nr?: string }).registration_number ?? (company as { reg_nr?: string }).reg_nr ?? null,
          vatNr: (company as { vat_number?: string; vat_nr?: string }).vat_number ?? (company as { vat_nr?: string }).vat_nr ?? null,
          bankName: defaultBank?.bank_name || (company as { bank_name?: string }).bank_name || null,
          bankAccount: defaultBank?.iban || (company as { bank_account?: string }).bank_account || null,
          bankSwift: defaultBank?.swift || (company as { swift_code?: string; bank_swift?: string }).swift_code || (company as { bank_swift?: string }).bank_swift || null,
          bankAccounts: bankAccounts ?? [],
          country: (company as { country?: string }).country ?? null,
        };
        invoiceTemplateId = (company as { invoice_template?: string }).invoice_template ?? undefined;
        invoiceAccentColor = (company as { invoice_accent_color?: string }).invoice_accent_color ?? undefined;
      }
    }

    const htmlBody = generateInvoiceHTML(invoice, companyLogoUrl, companyInfo, invoiceTemplateId, invoiceAccentColor);

    const emailTemplate = await loadDefaultEmailTemplateForCategory(companyId, "invoice");
    const invPost = invoice as {
      total?: unknown;
      payer_name?: unknown;
      invoice_number?: unknown;
      invoice_items?: Parameters<typeof buildInvoiceEmailTemplateVars>[0]["items"];
      paid_amount?: unknown;
      remaining?: unknown;
    };
    const { dueDateFormatted, depositDateFormatted, finalPaymentDateFormatted } = formatInvoiceDueParts(
      invoice as Parameters<typeof formatInvoiceDueParts>[0]
    );
    const totalNum = Number(invPost.total) || 0;
    const templateVars = buildInvoiceEmailTemplateVars({
      payerName: String(invPost.payer_name ?? "").trim() || "Sir/Madam",
      orderCode: orderRow.order_code,
      invoiceNumber: String(invPost.invoice_number),
      invoiceTotalFormatted: formatInvoiceMoneyEur(totalNum),
      outstandingFormatted: invoiceOutstandingFormatted({
        total: invPost.total as string | number | null,
        paid_amount: invPost.paid_amount as number | null | undefined,
        remaining: invPost.remaining as number | null | undefined,
      }),
      dueDateFormatted,
      depositDateFormatted,
      finalPaymentDateFormatted,
      companyDisplayName: companyDisplayNameForTemplate,
      items: invPost.invoice_items,
    });
    const resolvedLetter = resolveInvoiceEmailLetter({
      invoiceNumber: String(invoice.invoice_number),
      subjectFromClient: subject,
      messageFromClient: message,
      template: emailTemplate,
      vars: templateVars,
    });
    const emailSubject = resolvedLetter.subject;

    const attachments: { filename: string; content: Buffer }[] = [];
    const pdfBuffer = await generatePDFFromHTML(htmlBody);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate invoice PDF attachment. Email was not sent." },
        { status: 500 }
      );
    }
    attachments.push({
      filename: `${(invoice.invoice_number as string).replace(/\s+/g, "-")}.pdf`,
      content: pdfBuffer,
    });

    const clientBodyComplete = email_body_complete === true;
    const sigSource = emailTemplate?.email_signature_source ?? normalizeEmailSignatureSource(null);
    const finalHtml = clientBodyComplete
      ? await replaceBase64Images(resolvedLetter.bodyHtml)
      : await replaceBase64Images(
          `${await appendHtmlWithEmailSignature(
            resolvedLetter.bodyHtml,
            {
              source: sigSource,
              userId: user?.id ?? null,
              companyId,
            },
            { borderTop: false }
          )}${INVOICE_EMAIL_PDF_FOOTER_HTML}`
        );

    const result = await sendEmail(
      to.trim(),
      emailSubject,
      finalHtml,
      undefined,
      attachments,
      { from: emailFrom || undefined, companyId: companyId || undefined }
    );

    if (!result.success) {
      const msg =
        result.reason === "no_api_key"
          ? "Email is not configured (RESEND_API_KEY missing)."
          : result.error || "Failed to send email.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const orderId = orderRow?.id ?? null;
    if (orderId && companyId) {
      await supabaseAdmin.from("order_communications").insert({
        company_id: companyId,
        order_id: orderId,
        invoice_id: invoiceId,
        email_kind: "invoice",
        type: "to_client",
        recipient_email: to.trim(),
        subject: emailSubject,
        body: resolvedLetter.bodyForLog,
        sent_by: user?.id ?? null,
        email_sent: true,
        resend_email_id: result.id ?? null,
        delivery_status: "sent",
      }).then(({ error: commError }) => {
        if (commError) console.error("Failed to log communication:", commError);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Invoice email sent successfully",
      id: result.id,
    });
  } catch (error: unknown) {
    console.error("Error sending invoice email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
