import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/orders/[orderCode]/invoices/[invoiceId]/pdf - Generate PDF for invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { orderCode: rawOrderCode, invoiceId } = await params;
    const orderCode = decodeURIComponent(rawOrderCode);

    // Get invoice with all details including company logo
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
    
    // Get company logo if available
    let companyLogoUrl = null;
    if (invoice?.orders?.company_id) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("logo_url")
        .eq("id", invoice.orders.company_id)
        .single();
      companyLogoUrl = company?.logo_url || null;
    }

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // For now, return HTML that can be converted to PDF on client side
    // In production, you might want to use puppeteer or similar for server-side PDF generation
    const html = generateInvoiceHTML(invoice, companyLogoUrl);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(invoice: any, companyLogoUrl: string | null = null): string {
  const formatCurrency = (amount: number) => {
    return `€${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .invoice-title { font-size: 24px; font-weight: bold; }
    .invoice-number { text-align: right; }
    .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .section { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .section-title { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 10px; }
    .section-content { font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 10px; background: #f5f5f5; border-bottom: 2px solid #ddd; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    .totals { text-align: right; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .total-final { font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
    .payment-terms { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .notes { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: start; gap: 15px;">
      ${companyLogoUrl ? `
        <div style="width: 64px; height: 64px; overflow: hidden; flex-shrink: 0;">
          <img src="${companyLogoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
      ` : `
        <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; flex-shrink: 0;">
          Logo
        </div>
      `}
    </div>
    <div style="text-align: right; flex: 1;">
      <div class="invoice-title" style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">${invoice.is_credit ? 'CREDIT NOTE' : 'INVOICE'}</div>
      ${invoice.is_credit ? '<div style="color: green; font-size: 12px;">Refund / Credit</div>' : ''}
      <div class="invoice-number" style="margin-top: 8px;">
        <div style="font-size: 11px; color: #666;">Invoice #</div>
        <div style="font-weight: bold;">${invoice.invoice_number}</div>
      </div>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <strong>Date:</strong> ${formatDate(invoice.invoice_date)}
  </div>

    <div class="sections">
      <div class="section">
        <div class="section-title">Beneficiary</div>
        <div class="section-content">
          <strong>${invoice.client_name || 'Company Name'}</strong><br>
          ${(invoice.payer_reg_nr || invoice.payer_vat_nr) ? `${invoice.payer_reg_nr ? 'Reg. Nr: ' + invoice.payer_reg_nr : ''}${invoice.payer_reg_nr && invoice.payer_vat_nr ? ' • ' : ''}${invoice.payer_vat_nr ? 'PVN: ' + invoice.payer_vat_nr : ''}<br>` : ''}
          ${invoice.client_address ? invoice.client_address + '<br>' : ''}
        </div>
      </div>
      <div class="section">
        <div class="section-title">Payer</div>
        <div class="section-content">
          <strong>${invoice.payer_name || '-'}</strong><br>
          ${invoice.payer_address ? invoice.payer_address + '<br>' : ''}
          ${invoice.payer_email ? invoice.payer_email + '<br>' : ''}
          ${invoice.payer_phone ? invoice.payer_phone : ''}
        </div>
      </div>
    </div>

  <table>
    <thead>
      <tr>
        <th>Dates</th>
        <th>Service</th>
        <th>Client</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.invoice_items?.map((item: any) => `
        <tr>
          <td>${item.service_date_from ? formatDate(item.service_date_from) : '-'}${item.service_date_to && item.service_date_to !== item.service_date_from ? ` - ${formatDate(item.service_date_to)}` : ''}</td>
          <td style="word-wrap: break-word; white-space: normal;">${item.service_name || '-'}</td>
          <td>${item.service_client || '-'}</td>
          <td style="text-align: right;">${formatCurrency(item.line_total)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4">No items</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${formatCurrency(invoice.subtotal || 0)}</span>
    </div>
    <div class="total-row">
      <span>VAT (${invoice.tax_rate || 0}%):</span>
      <span>${formatCurrency(invoice.tax_amount || 0)}</span>
    </div>
    <div class="total-row total-final">
      <span>Total:</span>
      <span>${formatCurrency(invoice.total || 0)}</span>
    </div>
  </div>

  ${(invoice.deposit_amount || invoice.final_payment_amount) ? `
    <div class="payment-terms">
      <strong>Payment Terms</strong><br>
      ${invoice.deposit_amount && invoice.deposit_date ? `Deposit: ${formatCurrency(invoice.deposit_amount)} by ${formatDate(invoice.deposit_date)}<br>` : ''}
      ${invoice.final_payment_amount && invoice.final_payment_date ? `Final Payment: ${formatCurrency(invoice.final_payment_amount)} by ${formatDate(invoice.final_payment_date)}<br>` : ''}
      ${(invoice.bank_name || invoice.bank_account || invoice.bank_swift) ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
          <strong>Banking Details</strong><br>
          ${invoice.bank_name ? `Bank: ${invoice.bank_name}<br>` : ''}
          ${invoice.bank_account ? `Account: ${invoice.bank_account}<br>` : ''}
          ${invoice.bank_swift ? `SWIFT: ${invoice.bank_swift}` : ''}
        </div>
      ` : ''}
    </div>
  ` : (invoice.due_date ? `
    <div class="payment-terms">
      <strong>Due Date</strong><br>
      ${formatDate(invoice.due_date)}
      ${(invoice.bank_name || invoice.bank_account || invoice.bank_swift) ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
          <strong>Banking Details</strong><br>
          ${invoice.bank_name ? `Bank: ${invoice.bank_name}<br>` : ''}
          ${invoice.bank_account ? `Account: ${invoice.bank_account}<br>` : ''}
          ${invoice.bank_swift ? `SWIFT: ${invoice.bank_swift}` : ''}
        </div>
      ` : ''}
    </div>
  ` : '')}

  <div style="margin-top: 40px; text-align: center; color: #999; font-size: 11px;">
    Thank you for your business!
  </div>
</body>
</html>
  `;
}
