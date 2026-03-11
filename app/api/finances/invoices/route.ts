import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/finances/invoices - Get all invoices for company (for Finances section)
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company_id from profile (try profiles first, then user_profiles as fallback)
    let companyId: string | null = null;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.company_id) {
      companyId = profile.company_id as string;
    }
    if (!companyId) {
      const { data: userProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      companyId = userProfile?.company_id as string | null;
    }
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let query = supabaseAdmin
      .from("invoices")
      .select(`
        *,
        orders(order_code),
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

    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);

    const [invoicesResult, commsResult, paymentsResult] = await Promise.all([
      query,
      supabaseAdmin
        .from("order_communications")
        .select("invoice_id, delivery_status, delivered_at, opened_at, open_count, sent_at")
        .eq("company_id", companyId)
        .not("invoice_id", "is", null)
        .order("sent_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("invoice_id, amount, status")
        .eq("company_id", companyId)
        .not("invoice_id", "is", null),
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
      if (c.invoice_id && !commsMap.has(c.invoice_id)) {
        commsMap.set(c.invoice_id, c);
      }
    }

    const paidMap = new Map<string, number>();
    for (const p of paymentsResult.data || []) {
      if (p.invoice_id && p.status !== "cancelled") {
        paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) || 0) + Number(p.amount || 0));
      }
    }

    const mappedInvoices = (invoices || []).map((inv: any) => {
      const comm = commsMap.get(inv.id);
      const paid = paidMap.get(inv.id) || 0;
      return {
        ...inv,
        order_code: (inv.orders && Array.isArray(inv.orders) && inv.orders[0]?.order_code) || 
                    (inv.orders?.order_code) || null,
        orders: undefined,
        paid_amount: Math.round(paid * 100) / 100,
        remaining: Math.round((Number(inv.total || 0) - paid) * 100) / 100,
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
