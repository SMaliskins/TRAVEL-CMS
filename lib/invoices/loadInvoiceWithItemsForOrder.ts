import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Full invoice row with line items for PDF / Send Invoice (same shape as generateInvoiceHTML expects).
 */
export async function loadInvoiceWithItemsForOrder(
  invoiceId: string,
  orderCode: string
): Promise<
  | {
      ok: true;
      invoice: Record<string, unknown>;
      orderRow: { id: string; order_code: string; company_id: string };
      companyId: string;
    }
  | { ok: false; status: number; error: string }
> {
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .select(`
        *,
        orders(id, order_code, company_id),
        invoice_items (
          id,
          service_name,
          service_client,
          service_category,
          service_date_from,
          service_date_to,
          service_dates_text,
          quantity,
          unit_price,
          line_total
        )
      `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, status: 404, error: "Invoice not found" };
  }

  const inv = invoice as Record<string, unknown> & {
    orders?: { id: string; order_code: string; company_id: string } | { id: string; order_code: string; company_id: string }[] | null;
  };
  const orderRowRaw = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
  if (!orderRowRaw || orderRowRaw.order_code !== orderCode) {
    return { ok: false, status: 404, error: "Invoice not found" };
  }

  return {
    ok: true,
    invoice: inv,
    orderRow: orderRowRaw,
    companyId: orderRowRaw.company_id,
  };
}
