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
      .select("order_id")
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

    // Recalculate order totals
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("order_id", payment.order_id);

    const totalPaid = (allPayments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
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

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("[payments] DELETE:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
