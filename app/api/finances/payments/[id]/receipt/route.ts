import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generatePDFFromHTML } from "@/lib/invoices/generateInvoicePDF";
import { generateDepositReceiptHTML } from "@/lib/invoices/generateDepositReceiptHTML";
import type { InvoiceCompanyInfo } from "@/lib/invoices/generateInvoiceHTML";
import type { DateFormatPattern } from "@/utils/dateFormat";

async function getCompanyId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.company_id) return profile.company_id as string;

  const { data: userProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  return userProfile?.company_id ?? null;
}

function buildReceiptNumber(paymentId: string, paidAt: string | null): string {
  const date = paidAt ? new Date(paidAt) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const shortId = paymentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `DEP-${y}${m}${d}-${shortId}`;
}

// GET /api/finances/payments/[id]/receipt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        orders(order_code, client_display_name),
        company_bank_accounts(account_name, bank_name)
      `)
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Resolve linked invoice number separately (payments.invoice_id has no FK in schema)
    let linkedInvoiceNumber: string | null = null;
    const paymentInvoiceId = (payment as Record<string, unknown>).invoice_id as string | null;
    if (paymentInvoiceId) {
      const { data: inv } = await supabaseAdmin
        .from("invoices")
        .select("invoice_number")
        .eq("id", paymentInvoiceId)
        .maybeSingle();
      linkedInvoiceNumber = (inv as { invoice_number?: string } | null)?.invoice_number ?? null;
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    const { data: bankAccounts } = await supabaseAdmin
      .from("company_bank_accounts")
      .select("account_name, bank_name, iban, swift, currency")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("account_name");

    const companyLogoUrl = (company as { logo_url?: string | null })?.logo_url ?? null;
    const rawName = (company as { name?: string })?.name ?? "";
    const legalName = (company as { legal_name?: string })?.legal_name ?? "";
    const tradingName = (company as { trading_name?: string })?.trading_name ?? "";
    const displayName =
      legalName ||
      (rawName.trim() !== "Default Company" ? rawName : "") ||
      tradingName ||
      rawName ||
      "";
    const defaultBank = bankAccounts?.[0];

    const companyInfo: InvoiceCompanyInfo | null = company
      ? {
          name: displayName,
          address:
            (company as { address?: string; legal_address?: string; operating_address?: string }).address ||
            (company as { legal_address?: string }).legal_address ||
            (company as { operating_address?: string }).operating_address ||
            null,
          regNr:
            (company as { registration_number?: string; reg_nr?: string }).registration_number ??
            (company as { reg_nr?: string }).reg_nr ??
            null,
          vatNr:
            (company as { vat_number?: string; vat_nr?: string }).vat_number ??
            (company as { vat_nr?: string }).vat_nr ??
            null,
          bankName: defaultBank?.bank_name || (company as { bank_name?: string }).bank_name || null,
          bankAccount: defaultBank?.iban || (company as { bank_account?: string }).bank_account || null,
          bankSwift:
            defaultBank?.swift ||
            (company as { swift_code?: string; bank_swift?: string }).swift_code ||
            (company as { bank_swift?: string }).bank_swift ||
            null,
          bankAccounts: bankAccounts ?? [],
          country: (company as { country?: string }).country ?? null,
        }
      : null;

    const paymentRow = payment as Record<string, unknown>;
    const orderRow = (paymentRow.orders as Record<string, unknown>) || {};
    const accountRow = (paymentRow.company_bank_accounts as Record<string, unknown>) || {};

    const paidAt = String(paymentRow.paid_at || new Date().toISOString());
    const receiptNumber = buildReceiptNumber(String(paymentRow.id), paidAt);
    const dateFormat = (company as { date_format?: DateFormatPattern })?.date_format;

    const html = generateDepositReceiptHTML(
      {
        receiptNumber,
        receiptDate: new Date().toISOString(),
        paymentDate: paidAt,
        orderCode: (orderRow.order_code as string) || null,
        orderClient: (orderRow.client_display_name as string) || null,
        payerName: (paymentRow.payer_name as string) || null,
        amount: Number(paymentRow.amount || 0),
        currency: String(paymentRow.currency || "EUR"),
        paymentMethod: String(paymentRow.method || "bank").toUpperCase(),
        note: (paymentRow.note as string) || null,
        invoiceNumber: linkedInvoiceNumber,
        accountName: (accountRow.account_name as string) || null,
        accountBankName: (accountRow.bank_name as string) || null,
        dateFormat,
      },
      companyLogoUrl,
      companyInfo
    );

    const pdfBuffer = await generatePDFFromHTML(html);

    if (pdfBuffer && pdfBuffer.length > 0) {
      const filename = `${receiptNumber}.pdf`;
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("[payments] receipt GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
