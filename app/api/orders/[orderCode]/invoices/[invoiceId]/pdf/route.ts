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

    let companyLogoUrl: string | null = null;
    if (invoice?.orders?.company_id) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("logo_url")
        .eq("id", invoice.orders.company_id)
        .single();
      companyLogoUrl = company?.logo_url ?? null;
    }

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const html = generateInvoiceHTML(invoice, companyLogoUrl);
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
