import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInvoiceHTML } from "@/lib/invoices/generateInvoiceHTML";
import { generatePDFFromHTML } from "@/lib/invoices/generateInvoicePDF";
import { sendEmail } from "@/lib/email/sendEmail";

// POST /api/orders/[orderCode]/invoices/[invoiceId]/email - Send invoice via email (Resend)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;
    const body = await request.json();
    const { to, subject, message } = body;

    if (!to || !to.trim()) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    // Get invoice with items and company logo
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

    let companyLogoUrl: string | null = null;
    if (invoice?.orders?.company_id) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("logo_url")
        .eq("id", invoice.orders.company_id)
        .single();
      companyLogoUrl = company?.logo_url ?? null;
    }

    const htmlBody = generateInvoiceHTML(invoice, companyLogoUrl);
    const emailSubject = subject?.trim() || `Invoice ${invoice.invoice_number}`;
    const emailHtml =
      (message?.trim()
        ? `<p>${message.replace(/\n/g, "<br>")}</p><hr style="margin:16px 0">${htmlBody}`
        : `<p>Please find attached invoice ${invoice.invoice_number}.</p><hr style="margin:16px 0">${htmlBody}`);

    const attachments: { filename: string; content: Buffer }[] = [];
    const pdfBuffer = await generatePDFFromHTML(htmlBody);
    if (pdfBuffer && pdfBuffer.length > 0) {
      attachments.push({
        filename: `${(invoice.invoice_number as string).replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer,
      });
    }

    const result = await sendEmail(
      to.trim(),
      emailSubject,
      emailHtml,
      undefined,
      attachments.length ? attachments : undefined
    );

    if (!result.success) {
      const msg =
        result.reason === "no_api_key"
          ? "Email is not configured (RESEND_API_KEY missing)."
          : result.error || "Failed to send email.";
      return NextResponse.json({ error: msg }, { status: 502 });
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
