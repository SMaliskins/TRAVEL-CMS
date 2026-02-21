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
    const search = searchParams.get("search");

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
    if (search) {
      const s = search.trim();
      query = query.or(
        `order_code.ilike.%${s}%,client_display_name.ilike.%${s}%`
      );
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
    
    // Get all services for these orders with their invoice status and pricing
    const { data: servicesData } = await supabaseAdmin
      .from("order_services")
      .select("order_id, invoice_id, res_status, client_price, service_price, category, commission_amount, agent_discount_value")
      .eq("company_id", companyId)
      .in("order_id", orderIds);
    
    // Get owner profiles for owner names
    // Note: DB uses owner_user_id, not manager_user_id
    const ownerIds = [...new Set((orders || []).map((o: any) => o.owner_user_id).filter(Boolean))];
    
    const { data: ownerProfiles } = ownerIds.length > 0
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", ownerIds)
      : { data: [] };
    
    // Build owner name lookup
    const ownerNames = new Map<string, string>();
    (ownerProfiles || []).forEach((p: any) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
      ownerNames.set(p.user_id, name);
    });
    
    
    // Get all invoices for these orders with their payment status
    const invoicesQuery = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, status, total")
      .eq("company_id", companyId)
      .in("order_id", orderIds);
    
    const invoicesData = invoicesQuery.data;
    const invoicesError = invoicesQuery.error;
    
    if (invoicesError) {
    } else {
    }
    
    // Build invoice statistics per order
    const invoiceStats = new Map<string, {
      totalServices: number;
      invoicedServices: number;
      hasInvoice: boolean;
      allServicesInvoiced: boolean;
      totalInvoices: number;
      allInvoicesPaid: boolean;
    }>();
    
    
    console.log('Total orders:', orderIds.length);
    console.log('Services data:', servicesData?.length || 0, 'rows');
    console.log('Invoices data:', invoicesData?.length || 0, 'rows');
    if (invoicesData && invoicesData.length > 0) {
      console.log('Sample invoice:', invoicesData[0]);
    }
    
    // Build service stats (amount, profit) and invoice stats per order
    const serviceStats = new Map<string, { amount: number; profit: number }>();
    
    orderIds.forEach((orderId: string) => {
      const services = (servicesData || []).filter((s: any) => s.order_id === orderId);
      const invoices = (invoicesData || []).filter((i: any) => i.order_id === orderId);
      
      // Only count non-cancelled services
      const activeServices = services.filter((s: any) => s.res_status !== 'cancelled');
      const totalServices = activeServices.length;
      const invoicedServices = activeServices.filter((s: any) => s.invoice_id).length;
      const hasInvoice = invoices.length > 0;
      const allServicesInvoiced = totalServices > 0 && invoicedServices === totalServices;
      
      const amount = activeServices.reduce((sum: number, s: any) => sum + (Number(s.client_price) || 0), 0);
      const profit = activeServices.reduce((sum: number, s: any) => {
        const clientPrice = Number(s.client_price) || 0;
        const servicePrice = Number(s.service_price) || 0;
        const cat = (s.category || "").toLowerCase();
        const isTour = cat.includes("tour") || cat.includes("package");
        if (isTour && s.commission_amount != null) {
          const commission = Number(s.commission_amount) || 0;
          return sum + (clientPrice - (servicePrice - commission));
        }
        return sum + (clientPrice - servicePrice);
      }, 0);
      
      serviceStats.set(orderId, { amount, profit });
      
      // Check if all invoices are fully paid (status = 'paid')
      const allInvoicesPaid = invoices.length > 0 && invoices.every((inv: any) => 
        inv.status === 'paid'
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
    const transformedOrders = (orders || []).map((order: Record<string, unknown>) => {
      const orderId = order.id as string;
      const svcStats = serviceStats.get(orderId);
      const invStats = invoiceStats.get(orderId);
      
      // Amount and profit from services, fallback to order fields if no services
      const amount = svcStats?.amount || Number(order.amount_total) || 0;
      const profit = svcStats?.profit || Number(order.profit_estimated) || 0;
      const paid = Number(order.amount_paid) || 0;
      const debt = amount - paid; // Calculate debt as amount - paid
      
      // Owner from user profiles
      const ownerId = order.owner_user_id as string;
      const owner = ownerId ? (ownerNames.get(ownerId) || "") : "";
      
      return {
        id: orderId,
        orderId: order.order_code || order.order_number || `#${orderId}`,
        client: (order.client_display_name as string) || "—",
        countriesCities: (order.countries_cities as string) || "",
        datesFrom: (order.date_from as string) || "",
        datesTo: (order.date_to as string) || "",
        amount,
        paid,
        debt,
        profit,
        status: order.status || "Draft",
        type: order.order_type || "TA",
        owner,
        access: "Owner",
        updated: ((order.updated_at as string) || "").split("T")[0] || "",
        createdAt: ((order.created_at as string) || "").split("T")[0] || "",
        // Invoice statistics
        totalServices: invStats?.totalServices || 0,
        invoicedServices: invStats?.invoicedServices || 0,
        hasInvoice: invStats?.hasInvoice || false,
        allServicesInvoiced: invStats?.allServicesInvoiced || false,
        totalInvoices: invStats?.totalInvoices || 0,
        allInvoicesPaid: invStats?.allInvoicesPaid || false,
      };
    });

    return NextResponse.json({ orders: transformedOrders });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Orders GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
