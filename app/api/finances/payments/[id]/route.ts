import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { canModifyFinancePayments } from "@/lib/auth/paymentPermissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enrichPaymentsWithEnteredBy } from "@/lib/finances/paymentEnteredBy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        orders(order_code, client_display_name),
        company_bank_accounts(account_name, bank_name)
      `)
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const row = data as Record<string, unknown>;
    const flat = {
      ...row,
      order_code: (row.orders as Record<string, unknown>)?.order_code ?? null,
      order_client: (row.orders as Record<string, unknown>)?.client_display_name ?? null,
      account_name: (row.company_bank_accounts as Record<string, unknown>)?.account_name ?? null,
      bank_name: (row.company_bank_accounts as Record<string, unknown>)?.bank_name ?? null,
      orders: undefined,
      company_bank_accounts: undefined,
    };
    const [enriched] = await enrichPaymentsWithEnteredBy([flat]);
    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error("[payments] GET by id:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canModifyFinancePayments(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden", message: "Only Finance and Supervisor can edit payments." }, { status: 403 });
    }
    const { companyId } = apiUser;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id, order_id, invoice_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.amount !== undefined) updateData.amount = Number(body.amount);
    if (body.method !== undefined) updateData.method = body.method;
    if (body.paid_at !== undefined) updateData.paid_at = body.paid_at;
    if (body.payer_name !== undefined) updateData.payer_name = body.payer_name || null;
    if (body.note !== undefined) updateData.note = body.note || null;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.account_id !== undefined) updateData.account_id = body.account_id || null;
    if ("invoice_id" in body) updateData.invoice_id = body.invoice_id || null;
    if (body.payer_party_id !== undefined) updateData.payer_party_id = body.payer_party_id || null;
    if (body.processor !== undefined) updateData.processor = body.processor || null;
    if (body.processing_fee !== undefined) updateData.processing_fee = Number(body.processing_fee) || 0;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error } = await supabaseAdmin
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      console.error("[payments] PATCH error:", error);
      return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
    }

    // Recalculate order totals (exclude cancelled payments)
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("amount, status")
      .eq("order_id", existing.order_id);

    const totalPaid = (allPayments ?? []).reduce(
      (sum: number, p: { amount: number; status?: string }) =>
        (p.status === "cancelled" ? sum : sum + Number(p.amount)),
      0
    );

    const { data: orderData } = await supabaseAdmin
      .from("orders")
      .select("amount_total")
      .eq("id", existing.order_id)
      .single();

    const amountTotal = Number(orderData?.amount_total ?? 0);

    await supabaseAdmin
      .from("orders")
      .update({ amount_paid: totalPaid, amount_debt: amountTotal - totalPaid })
      .eq("id", existing.order_id);

    // When cancelling, revert linked invoice status if needed
    if (body.status === "cancelled" && existing.invoice_id) {
      const { data: invoicePayments } = await supabaseAdmin
        .from("payments")
        .select("amount, status")
        .eq("invoice_id", existing.invoice_id);

      const invoicePaid = (invoicePayments ?? []).reduce(
        (sum: number, p: { amount: number; status?: string }) =>
          (p.status === "cancelled" ? sum : sum + Number(p.amount)),
        0
      );

      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("total, status")
        .eq("id", existing.invoice_id)
        .single();

      if (invoice && invoice.status === "paid") {
        const invoiceTotal = Number(invoice.total) || 0;
        if (invoicePaid < invoiceTotal - 0.01) {
          await supabaseAdmin
            .from("invoices")
            .update({ status: "issued", updated_at: new Date().toISOString() })
            .eq("id", existing.invoice_id);
        }
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[payments] PATCH:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canModifyFinancePayments(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden", message: "Only Finance and Supervisor can delete payments." }, { status: 403 });
    }
    const { companyId } = apiUser;

    const { id } = await params;

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("order_id, invoice_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("payments")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      console.error("[payments] DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
    }

    // Recalculate order totals (exclude cancelled payments)
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("amount, status")
      .eq("order_id", payment.order_id);

    const totalPaid = (allPayments ?? []).reduce(
      (sum: number, p: { amount: number; status?: string }) =>
        p.status === "cancelled" ? sum : sum + Number(p.amount),
      0
    );

    const { data: orderData } = await supabaseAdmin
      .from("orders")
      .select("amount_total")
      .eq("id", payment.order_id)
      .single();

    const amountTotal = Number(orderData?.amount_total ?? 0);

    await supabaseAdmin
      .from("orders")
      .update({
        amount_paid: totalPaid,
        amount_debt: amountTotal - totalPaid,
      })
      .eq("id", payment.order_id);

    // Auto-revert invoice status if payment was linked to an invoice
    const deletedInvoiceId = payment.invoice_id;
    if (deletedInvoiceId) {
      const { data: invoicePayments } = await supabaseAdmin
        .from("payments")
        .select("amount")
        .eq("invoice_id", deletedInvoiceId);

      const invoicePaid = (invoicePayments ?? []).reduce(
        (sum: number, p: { amount: number }) => sum + Number(p.amount), 0
      );

      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("total, status")
        .eq("id", deletedInvoiceId)
        .single();

      if (invoice && invoice.status !== "cancelled" && invoice.status !== "replaced") {
        const invoiceTotal = Number(invoice.total) || 0;
        if (invoice.status === "paid" && invoicePaid < invoiceTotal - 0.01) {
          await supabaseAdmin
            .from("invoices")
            .update({ status: "issued", updated_at: new Date().toISOString() })
            .eq("id", deletedInvoiceId);
        }
      }
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("[payments] DELETE:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
