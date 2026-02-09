import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInvoiceHTML } from "@/lib/invoices/generateInvoiceHTML";
import { generatePDFFromHTML } from "@/lib/invoices/generateInvoicePDF";

// GET /api/orders/[orderCode]/invoices/[invoiceId]/pdf - Generate PDF (or HTML fallback) for invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select(`
        *,
        orders(order_code, company_id),
        invoice_items (
          id,
          service_name,
          service_client,
          service_category,
          service_date_from,
          service_date_to,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const orderRow = Array.isArray(invoice?.orders) ? invoice.orders[0] : invoice?.orders;
    const companyId = orderRow?.company_id ?? null;

    let companyLogoUrl: string | null = null;
    let companyInfo: { name: string; address?: string | null; regNr?: string | null; vatNr?: string | null; bankName?: string | null; bankAccount?: string | null; bankSwift?: string | null } | null = null;
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
        companyInfo = {
          name: displayName,
          address: (company as { address?: string; legal_address?: string; operating_address?: string }).address || (company as { legal_address?: string }).legal_address || (company as { operating_address?: string }).operating_address || null,
          regNr: (company as { registration_number?: string; reg_nr?: string }).registration_number ?? (company as { reg_nr?: string }).reg_nr ?? null,
          vatNr: (company as { vat_number?: string; vat_nr?: string }).vat_number ?? (company as { vat_nr?: string }).vat_nr ?? null,
          bankName: (company as { bank_name?: string }).bank_name ?? null,
          bankAccount: (company as { bank_account?: string }).bank_account ?? null,
          bankSwift: (company as { swift_code?: string; bank_swift?: string }).swift_code ?? (company as { bank_swift?: string }).bank_swift ?? null,
        };
      }
    }

    const html = generateInvoiceHTML(invoice, companyLogoUrl, companyInfo);
    const pdfBuffer = await generatePDFFromHTML(html);

    if (pdfBuffer && pdfBuffer.length > 0) {
      const filename = `${String(invoice.invoice_number).replace(/\s+/g, "-")}.pdf`;
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Fallback: return HTML (e.g. when Chromium is unavailable locally)
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error: unknown) {
    console.error("Error generating invoice PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
