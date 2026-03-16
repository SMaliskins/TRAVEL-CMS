import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { generatePDFFromHTML } from "@/lib/invoices/generateInvoicePDF";
import { generateDepositReceiptHTML } from "@/lib/invoices/generateDepositReceiptHTML";
import type { InvoiceCompanyInfo } from "@/lib/invoices/generateInvoiceHTML";
import type { DateFormatPattern } from "@/utils/dateFormat";

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
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = apiUser.companyId;

    const { id } = await params;
    const lang = new URL(request.url).searchParams.get("lang") || "en";

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
      console.error("[receipt] payment query error:", paymentError?.message, "id:", id, "company:", companyId);
      return NextResponse.json({ error: "Payment not found", detail: paymentError?.message }, { status: 404 });
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
        language: lang,
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
    console.error("[payments] receipt GET error:", error instanceof Error ? error.message : error, error instanceof Error ? error.stack : "");
    return NextResponse.json({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
