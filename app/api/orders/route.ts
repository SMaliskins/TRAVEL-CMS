import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Placeholder URLs for build-time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Get company_id from user's profile
async function getCompanyId(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();

  if (error || !data?.company_id) {
    return null;
  }
  return data.company_id;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get authenticated user
    let user = null;
    
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      const cookieHeader = request.headers.get("cookie") || "";
      if (cookieHeader) {
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
          global: { headers: { Cookie: cookieHeader } },
        });
        const { data, error } = await authClient.auth.getUser();
        if (!error && data?.user) {
          user = data.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company_id
    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json(
        { error: "User has no company assigned" },
        { status: 400 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("order_type");

    // Build query - only select columns that definitely exist
    // client_display_name and countries_cities may not exist in all deployments
    let query = supabaseAdmin
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (orderType) {
      query = query.eq("order_type", orderType);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json(
        { error: `Failed to fetch orders: ${error.message}` },
        { status: 500 }
      );
    }

    
    // Get invoice statistics for all orders
    const orderIds = (orders || []).map((o: any) => o.id);
    
    // Get all services for these orders with their invoice status
    const { data: servicesData } = await supabaseAdmin
      .from("order_services")
      .select("order_id, invoice_id")
      .in("order_id", orderIds);
    
    // Get all invoices for these orders with their payment status
    const { data: invoicesData } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, status, amount_total, amount_paid")
      .in("order_id", orderIds);
    
    // Build invoice statistics per order
    const invoiceStats = new Map<string, {
      totalServices: number;
      invoicedServices: number;
      hasInvoice: boolean;
      allServicesInvoiced: boolean;
      totalInvoices: number;
      allInvoicesPaid: boolean;
    }>();
    
    orderIds.forEach((orderId: string) => {
      const services = (servicesData || []).filter((s: any) => s.order_id === orderId);
      const invoices = (invoicesData || []).filter((i: any) => i.order_id === orderId);
      
      const totalServices = services.length;
      const invoicedServices = services.filter((s: any) => s.invoice_id).length;
      const hasInvoice = invoices.length > 0;
      const allServicesInvoiced = totalServices > 0 && invoicedServices === totalServices;
      
      // Check if all invoices are fully paid
      const allInvoicesPaid = invoices.length > 0 && invoices.every((inv: any) => 
        inv.status === 'paid' || (inv.amount_paid >= inv.amount_total && inv.amount_total > 0)
      );
      
      invoiceStats.set(orderId, {
        totalServices,
        invoicedServices,
        hasInvoice,
        allServicesInvoiced,
        totalInvoices: invoices.length,
        allInvoicesPaid,
      });
    });

    // Transform to frontend format
    // Handle both old schema (without client_display_name) and new schema
    const transformedOrders = (orders || []).map((order: Record<string, unknown>) => ({
      orderId: order.order_code || order.order_number || `#${order.id}`,
      client: (order.client_display_name as string) || "—",
      countriesCities: (order.countries_cities as string) || "",
      datesFrom: (order.date_from as string) || "",
      datesTo: (order.date_to as string) || "",
      amount: Number(order.amount_total) || 0,
      paid: Number(order.amount_paid) || 0,
      debt: Number(order.amount_debt) || 0,
      profit: Number(order.profit_estimated) || 0,
      status: order.status || "Draft",
      type: order.order_type || "TA",
      owner: "",
      access: "Owner",
      updated: ((order.updated_at as string) || "").split("T")[0] || "",
      createdAt: ((order.created_at as string) || "").split("T")[0] || "",
      // Invoice statistics
      ...(() => {
        const stats = invoiceStats.get(order.id as string);
        return {
          totalServices: stats?.totalServices || 0,
          invoicedServices: stats?.invoicedServices || 0,
          hasInvoice: stats?.hasInvoice || false,
          allServicesInvoiced: stats?.allServicesInvoiced || false,
          totalInvoices: stats?.totalInvoices || 0,
          allInvoicesPaid: stats?.allInvoicesPaid || false,
        };
      })(),
    }));

    return NextResponse.json({ orders: transformedOrders });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Orders GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
