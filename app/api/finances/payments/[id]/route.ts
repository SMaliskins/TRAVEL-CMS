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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ data });
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
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
