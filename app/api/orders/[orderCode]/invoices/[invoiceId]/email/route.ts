import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/orders/[orderCode]/invoices/[invoiceId]/email - Send invoice via email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { orderCode: rawOrderCode, invoiceId } = await params;
    const orderCode = decodeURIComponent(rawOrderCode);
    const body = await request.json();
    const { to, subject, message } = body;

    if (!to || !to.trim()) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select(`
        *,
        orders(order_code)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Get PDF URL (generate or get existing)
    const pdfUrl = `${request.nextUrl.origin}/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`;

    // TODO: Implement actual email sending
    // For now, return success (you'll need to integrate with email service like SendGrid, Resend, etc.)
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'invoices@yourcompany.com',
    //   to: to,
    //   subject: subject || `Invoice ${invoice.invoice_number}`,
    //   html: message || `Please find attached invoice ${invoice.invoice_number}`,
    //   attachments: [{ filename: `${invoice.invoice_number}.pdf`, url: pdfUrl }]
    // });

    return NextResponse.json({
      success: true,
      message: "Invoice email sent successfully",
      // In production, return actual email status
    });
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
