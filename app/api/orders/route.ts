import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSearchPatterns, matchesSearch } from "@/lib/directory/searchNormalize";
import { getApiUser } from "@/lib/auth/getApiUser";

// Placeholder URLs for build-time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, companyId, role } = apiUser;
    const isSubagent = role === "subagent";

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("order_type");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1") || 1;
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "200") || 200, 500);

    // Build query - only select columns that definitely exist
    let query = supabaseAdmin
      .from("orders")
      .select("id, order_code, order_number, client_display_name, countries_cities, date_from, date_to, amount_total, amount_paid, profit_estimated, status, order_type, owner_user_id, manager_user_id, created_at, updated_at, client_payment_due_date", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (isSubagent) {
      query = query.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`);
    }

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (orderType) {
      query = query.eq("order_type", orderType);
    }

    // Apply pagination unless searching (search needs all records for in-memory filter)
    if (!search) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    }

    const { data: allOrders, error, count: totalCount } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json(
        { error: `Failed to fetch orders: ${error.message}` },
        { status: 500 }
      );
    }

    // In-memory search with diacritics/layout/typo normalization
    let orders = allOrders || [];
    if (search) {
      const patterns = getSearchPatterns(search);
      orders = orders.filter((o: any) =>
        matchesSearch(o.order_code, patterns) ||
        matchesSearch(o.client_display_name, patterns)
      );
    }

    // Get invoice statistics for all orders
    const orderIds = orders.map((o: any) => o.id);
    
    // Run all sub-queries in parallel
    const ownerIds = [...new Set((orders || []).map((o: any) => o.owner_user_id || o.manager_user_id).filter(Boolean))];

    const [servicesResult, ownerProfilesResult, invoicesResult] = await Promise.all([
      supabaseAdmin
        .from("order_services")
        .select("order_id, invoice_id, res_status, client_price, service_price, category, commission_amount, agent_discount_value, vat_rate, service_date_from, service_date_to, payer_name")
        .eq("company_id", companyId)
        .in("order_id", orderIds),
      ownerIds.length > 0
        ? supabaseAdmin
            .from("user_profiles")
            .select("id, first_name, last_name")
            .in("id", ownerIds)
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("invoices")
        .select("id, order_id, status, total, due_date, final_payment_date")
        .eq("company_id", companyId)
        .in("order_id", orderIds)
        .neq("status", "cancelled"),
    ]);

    const servicesData = servicesResult.data || [];
    const invoicesData = invoicesResult.data || [];
    
    // Build owner name lookup
    const ownerNames = new Map<string, string>();
    ((ownerProfilesResult.data || []) as any[]).forEach((p: any) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
      ownerNames.set(p.id, name);
    });

    // Pre-build lookup maps (O(n) instead of O(n²) per-order filtering)
    const servicesByOrder = new Map<string, any[]>();
    servicesData.forEach((s: any) => {
      const arr = servicesByOrder.get(s.order_id);
      if (arr) { arr.push(s); } else { servicesByOrder.set(s.order_id, [s]); }
    });
    const invoicesByOrder = new Map<string, any[]>();
    invoicesData.forEach((i: any) => {
      const arr = invoicesByOrder.get(i.order_id);
      if (arr) { arr.push(i); } else { invoicesByOrder.set(i.order_id, [i]); }
    });
    const orderMap = new Map<string, Record<string, unknown>>();
    (orders || []).forEach((o: any) => orderMap.set(o.id, o));
    
    // Build invoice statistics and due dates per order
    const invoiceStats = new Map<string, {
      totalServices: number;
      invoicedServices: number;
      hasInvoice: boolean;
      allServicesInvoiced: boolean;
      totalInvoices: number;
      allInvoicesPaid: boolean;
      dueDate: string | null;
    }>();
    
    // Build service stats (amount, profit, vat) — profit за вычетом VAT
    const serviceStats = new Map<string, { amount: number; profit: number; vat: number }>();
    
    orderIds.forEach((orderId: string) => {
      const services = servicesByOrder.get(orderId) || [];
      const invoices = invoicesByOrder.get(orderId) || [];
      
      const activeServices = services.filter((s: any) => s.res_status !== 'cancelled');
      const totalServices = activeServices.length;
      const invoicedServices = activeServices.filter((s: any) => s.invoice_id).length;
      const hasInvoice = invoices.length > 0;
      const allServicesInvoiced = totalServices > 0 && invoicedServices === totalServices;
      
      const amount = activeServices.reduce((sum: number, s: any) => sum + (Number(s.client_price) || 0), 0);
      let profit = 0;
      let vat = 0;
      activeServices.forEach((s: any) => {
        const clientPrice = Number(s.client_price) || 0;
        const servicePrice = Number(s.service_price) || 0;
        const cat = (s.category || "").toLowerCase();
        const isTour = cat.includes("tour") || cat.includes("package");
        // vat_rate=0 в БД — fallback по категории (flight=0, остальные=21)
        const dbRate = Number(s.vat_rate);
        const vatRate = (dbRate > 0) ? dbRate : (cat.includes("flight") ? 0 : 21);
        let margin = 0;
        if (isTour && s.commission_amount != null) {
          const commission = Number(s.commission_amount) || 0;
          margin = clientPrice - (servicePrice - commission);
        } else {
          margin = clientPrice - servicePrice;
        }
        const vatAmount = vatRate > 0 && margin >= 0 ? Math.round(margin * vatRate / (100 + vatRate) * 100) / 100 : 0;
        profit += margin - vatAmount;
        vat += vatAmount;
      });
      
      serviceStats.set(orderId, { amount, profit, vat });
      
      // Check if all invoices are fully paid (status = 'paid')
      const allInvoicesPaid = invoices.length > 0 && invoices.every((inv: any) => 
        inv.status === 'paid'
      );

      // Due date: from order.client_payment_due_date or latest invoice final_payment_date / due_date
      const orderRec = orderMap.get(orderId);
      let dueDate: string | null = (orderRec?.client_payment_due_date as string) || null;
      if (!dueDate && invoices.length > 0) {
        const dates = invoices
          .map((inv: any) => inv.final_payment_date || inv.due_date)
          .filter(Boolean) as string[];
        dueDate = dates.length > 0 ? dates.sort().pop()! : null;
      }
      
      invoiceStats.set(orderId, {
        totalServices,
        invoicedServices,
        hasInvoice,
        allServicesInvoiced,
        totalInvoices: invoices.length,
        allInvoicesPaid,
        dueDate,
      });
    });

    // Aggregate payer names per order for search
    const payerNamesMap = new Map<string, string[]>();
    servicesData.forEach((s: any) => {
      if (!s.payer_name || s.res_status === "cancelled") return;
      const names = payerNamesMap.get(s.order_id) || [];
      if (!names.includes(s.payer_name)) names.push(s.payer_name);
      payerNamesMap.set(s.order_id, names);
    });

    // Derive order dates from services when missing: date_from = min(service_date_from), date_to = max(service_date_to)
    const derivedDates = new Map<string, { dateFrom: string; dateTo: string }>();
    (orders || []).forEach((order: Record<string, unknown>) => {
      const orderId = order.id as string;
      if (order.date_from && order.date_to) return;
      const activeServices = (servicesByOrder.get(orderId) || []).filter(
        (s: any) => s.res_status !== "cancelled"
      );
      const froms = activeServices.map((s: any) => s.service_date_from).filter(Boolean).sort();
      const tos = activeServices.map((s: any) => s.service_date_to).filter(Boolean).sort();
      if (froms.length > 0 || tos.length > 0) {
        derivedDates.set(orderId, {
          dateFrom: (order.date_from as string) || (froms[0] ?? ""),
          dateTo: (order.date_to as string) || (tos[tos.length - 1] ?? ""),
        });
      }
    });

    // Transform to frontend format
    // Handle both old schema (without client_display_name) and new schema
    const transformedOrders = (orders || []).map((order: Record<string, unknown>) => {
      const orderId = order.id as string;
      const svcStats = serviceStats.get(orderId);
      const invStats = invoiceStats.get(orderId);
      const derived = derivedDates.get(orderId);
      const datesFrom = (order.date_from as string) || derived?.dateFrom || "";
      const datesTo = (order.date_to as string) || derived?.dateTo || "";

      // Amount, profit (за вычетом VAT), vat from services
      const amount = svcStats?.amount || Number(order.amount_total) || 0;
      const profit = svcStats?.profit ?? Number(order.profit_estimated) ?? 0;
      const vat = svcStats?.vat ?? 0;
      const paid = Number(order.amount_paid) || 0;
      const debt = amount - paid; // Calculate debt as amount - paid

      // Owner from user profiles (fallback to manager_user_id)
      const ownerId = (order.owner_user_id || order.manager_user_id) as string;
      const owner = ownerId ? (ownerNames.get(ownerId) || "") : "";

      return {
        id: orderId,
        orderId: order.order_code || order.order_number || `#${orderId}`,
        client: (order.client_display_name as string) || "—",
        countriesCities: (order.countries_cities as string) || "",
        datesFrom,
        datesTo,
        amount,
        paid,
        debt,
        vat,
        profit,
        status: order.status || "Draft",
        type: order.order_type || "TA",
        owner,
        ownerId: ownerId || "",
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
        payers: payerNamesMap.get(orderId) || [],
        dueDate: invStats?.dueDate || (order.client_payment_due_date as string) || undefined,
      };
    });

    const agents = Array.from(ownerNames.entries()).map(([id, name]) => ({
      id,
      name,
      initials: name.split(" ").map(w => w[0]).join("").toUpperCase(),
    }));

    return NextResponse.json({
      orders: transformedOrders,
      agents,
      pagination: {
        page,
        pageSize,
        total: totalCount ?? transformedOrders.length,
        totalPages: Math.ceil((totalCount ?? transformedOrders.length) / pageSize),
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Orders GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
