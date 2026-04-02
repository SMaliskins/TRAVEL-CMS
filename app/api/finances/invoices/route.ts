import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

// GET /api/finances/invoices - Get all invoices for company (for Finances section)
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId, userId, scope } = apiUser;
    const isOwnScope = scope === "own";

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let query = supabaseAdmin
      .from("invoices")
      .select(`
        *,
        orders!inner(order_code, owner_user_id, manager_user_id),
        invoice_items (
          id,
          service_name,
          service_client,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (isOwnScope) {
      query = query.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`, { referencedTable: "orders" });
    }

    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    query = query.limit(500);

    const [invoicesResult, commsResult, paymentsResult] = await Promise.all([
      query,
      supabaseAdmin
        .from("order_communications")
        .select("invoice_id, delivery_status, delivered_at, opened_at, open_count, sent_at, email_kind")
        .eq("company_id", companyId)
        .not("invoice_id", "is", null)
        .order("sent_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("payments")
        .select("invoice_id, amount, status")
        .eq("company_id", companyId)
        .not("invoice_id", "is", null)
        .limit(500),
    ]);

    const { data: invoices, error: invoicesError } = invoicesResult;

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    const commsMap = new Map<string, { delivery_status: string; delivered_at: string | null; opened_at: string | null; open_count: number; sent_at: string }>();
    for (const c of commsResult.data || []) {
      if (!c.invoice_id || commsMap.has(c.invoice_id)) continue;
      const kind = (c as { email_kind?: string | null }).email_kind;
      if (kind === "payment_reminder") continue;
      commsMap.set(c.invoice_id, c);
    }

    const paidMap = new Map<string, number>();
    for (const p of paymentsResult.data || []) {
      if (p.invoice_id && p.status !== "cancelled") {
        paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) || 0) + Number(p.amount || 0));
      }
    }

    const isCreditInv = (inv: { is_credit?: boolean; invoice_number?: string }) =>
      !!inv.is_credit || String(inv.invoice_number || "").endsWith("-C");

    const mappedInvoices = (invoices || []).map((inv: any) => {
      const comm = commsMap.get(inv.id);
      const paid = paidMap.get(inv.id) || 0;
      const total = Number(inv.total || 0);
      const signedTotal = isCreditInv(inv) ? -Math.abs(total) : total;
      const remaining = Math.round(Math.max(0, signedTotal - paid) * 100) / 100;
      return {
        ...inv,
        order_code: (inv.orders && Array.isArray(inv.orders) && inv.orders[0]?.order_code) || 
                    (inv.orders?.order_code) || null,
        orders: undefined,
        paid_amount: Math.round(paid * 100) / 100,
        remaining,
        email_status: comm ? {
          delivery_status: comm.delivery_status,
          delivered_at: comm.delivered_at,
          opened_at: comm.opened_at,
          open_count: comm.open_count,
          sent_at: comm.sent_at,
        } : null,
      };
    });

    return NextResponse.json({ invoices: mappedInvoices });
  } catch (error: any) {
    console.error("Error in GET /api/finances/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
