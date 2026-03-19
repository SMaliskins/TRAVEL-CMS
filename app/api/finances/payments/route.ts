import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

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
    query = query.limit(500);

    let data: unknown[] | null = null;
    let error: { message?: string } | null = null;
    try {
      const result = await query;
      data = result.data;
      error = result.error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) {
        return NextResponse.json(
          { error: "Database connection failed. Please check your network and Supabase status." },
          { status: 503 }
        );
      }
      throw err;
    }

    if (error) {
      const isNetwork = /fetch failed|ECONNREFUSED|ETIMEDOUT|network/i.test(error.message || "");
      if (isNetwork) {
        return NextResponse.json(
          { error: "Database connection failed. Please check your network and Supabase status." },
          { status: 503 }
        );
      }
      console.error("[payments] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const payments = rows.map((p) => ({
      ...p,
      order_code: (p.orders as Record<string, unknown>)?.order_code ?? null,
      order_client: (p.orders as Record<string, unknown>)?.client_display_name ?? null,
      account_name: (p.company_bank_accounts as Record<string, unknown>)?.account_name ?? null,
      bank_name: (p.company_bank_accounts as Record<string, unknown>)?.bank_name ?? null,
      orders: undefined,
      company_bank_accounts: undefined,
    }));

    return NextResponse.json({ data: payments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) {
      return NextResponse.json(
        { error: "Database connection failed. Please check your network and Supabase status." },
        { status: 503 }
      );
    }
    console.error("[payments] GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

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

    // Recalculate order totals (exclude cancelled payments)
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("amount, status")
      .eq("order_id", order_id);

    const totalPaid = (allPayments ?? []).reduce(
      (sum: number, p: { amount: number; status?: string }) =>
        p.status === "cancelled" ? sum : sum + Number(p.amount),
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
