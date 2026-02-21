import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getCompanyId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  return profile?.company_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const method = searchParams.get("method");
    const accountId = searchParams.get("accountId");
    const orderId = searchParams.get("orderId");

    let query = supabaseAdmin
      .from("payments")
      .select(`
        *,
        orders(order_code, client_display_name),
        company_bank_accounts(account_name, bank_name)
      `)
      .eq("company_id", companyId)
      .order("paid_at", { ascending: false });

    if (orderId) query = query.eq("order_id", orderId);
    if (dateFrom) query = query.gte("paid_at", dateFrom);
    if (dateTo) query = query.lte("paid_at", dateTo + "T23:59:59Z");
    if (method) query = query.eq("method", method);
    if (accountId) query = query.eq("account_id", accountId);

    const { data, error } = await query;

    if (error) {
      console.error("[payments] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
    }

    const payments = (data ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      order_code: (p.orders as Record<string, unknown>)?.order_code ?? null,
      order_client: (p.orders as Record<string, unknown>)?.client_display_name ?? null,
      account_name: (p.company_bank_accounts as Record<string, unknown>)?.account_name ?? null,
      bank_name: (p.company_bank_accounts as Record<string, unknown>)?.bank_name ?? null,
      orders: undefined,
      company_bank_accounts: undefined,
    }));

    return NextResponse.json({ data: payments });
  } catch (err) {
    console.error("[payments] GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      order_id,
      invoice_id,
      method,
      amount,
      currency,
      paid_at,
      account_id,
      payer_name,
      payer_party_id,
      note,
    } = body;

    if (!order_id || !method || !amount) {
      return NextResponse.json(
        { error: "order_id, method, and amount are required" },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", order_id)
      .eq("company_id", companyId)
      .single();

    if (!order) {
      console.error("[Payments POST] Order not found", { order_id, companyId, orderError });
      return NextResponse.json({ error: "Order not found", debug: { order_id, companyId } }, { status: 404 });
    }

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        company_id: companyId,
        order_id,
        invoice_id: invoice_id || null,
        method,
        amount: parseFloat(amount),
        currency: currency || "EUR",
        paid_at: paid_at || new Date().toISOString(),
        account_id: account_id || null,
        payer_name: payer_name || null,
        payer_party_id: payer_party_id || null,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[payments] POST error:", error);
      return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
    }

    // Recalculate order totals
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("order_id", order_id);

    const totalPaid = (allPayments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
      0
    );

    const { data: orderData } = await supabaseAdmin
      .from("orders")
      .select("amount_total")
      .eq("id", order_id)
      .single();

    const amountTotal = Number(orderData?.amount_total ?? 0);

    await supabaseAdmin
      .from("orders")
      .update({
        amount_paid: totalPaid,
        amount_debt: amountTotal - totalPaid,
      })
      .eq("id", order_id);

    // Auto-update invoice status when payment is linked to an invoice
    const paymentInvoiceId = invoice_id || null;
    if (paymentInvoiceId) {
      const { data: invoicePayments } = await supabaseAdmin
        .from("payments")
        .select("amount")
        .eq("invoice_id", paymentInvoiceId);

      const invoicePaid = (invoicePayments ?? []).reduce(
        (sum: number, p: { amount: number }) => sum + Number(p.amount), 0
      );

      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("total, status")
        .eq("id", paymentInvoiceId)
        .single();

      if (invoice && invoice.status !== "cancelled" && invoice.status !== "replaced") {
        const invoiceTotal = Number(invoice.total) || 0;
        if (invoiceTotal > 0 && invoicePaid >= invoiceTotal - 0.01) {
          await supabaseAdmin
            .from("invoices")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("id", paymentInvoiceId);
        }
      }
    }

    return NextResponse.json({ data: payment });
  } catch (err) {
    console.error("[payments] POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
