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

    // Get company_id from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
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
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    // Map invoices with order_code (orders is an array, get first)
    const mappedInvoices = (invoices || []).map((inv: any) => ({
      ...inv,
      order_code: (inv.orders && Array.isArray(inv.orders) && inv.orders[0]?.order_code) || 
                  (inv.orders?.order_code) || null,
      orders: undefined, // Remove nested orders object
    }));

    return NextResponse.json({ invoices: mappedInvoices });
  } catch (error: any) {
    console.error("Error in GET /api/finances/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
