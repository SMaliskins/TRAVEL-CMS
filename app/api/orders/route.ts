import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSearchPatterns, matchesSearch } from "@/lib/directory/searchNormalize";
import { getApiUser } from "@/lib/auth/getApiUser";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";

// Edge runtime — lower cold start
export const runtime = "edge";

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
      .select("id, order_code, order_number, client_display_name, countries_cities, date_from, date_to, amount_total, amount_paid, profit_estimated, status, order_type, owner_user_id, manager_user_id, created_at, updated_at, client_payment_due_date, referral_party_id", { count: "exact" })
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

    // In-memory search: order code, lead client (client_display_name), and any service line client_name
    let orders = allOrders || [];
    if (search) {
      const patterns = getSearchPatterns(search);
      const preOrders = allOrders || [];
      const allOrderIds = preOrders.map((o: any) => o.id as string);
      const serviceClientNamesByOrder = new Map<string, string[]>();
      const nameChunk = 400;
      for (let i = 0; i < allOrderIds.length; i += nameChunk) {
        const chunk = allOrderIds.slice(i, i + nameChunk);
        const { data: nameRows } = await supabaseAdmin
          .from("order_services")
          .select("order_id, client_name")
          .eq("company_id", companyId)
          .in("order_id", chunk);
        for (const row of nameRows || []) {
          const r = row as { order_id: string; client_name?: string | null };
          const name = String(r.client_name || "").trim();
          if (!name) continue;
          const arr = serviceClientNamesByOrder.get(r.order_id) || [];
          if (!arr.includes(name)) arr.push(name);
          serviceClientNamesByOrder.set(r.order_id, arr);
        }
      }
      orders = preOrders.filter(
        (o: any) =>
          matchesSearch(o.order_code, patterns) ||
          matchesSearch(o.client_display_name, patterns) ||
          (serviceClientNamesByOrder.get(o.id) || []).some((c) => matchesSearch(c, patterns))
      );
    }

    // Get invoice statistics for all orders
    const orderIds = orders.map((o: any) => o.id);
    
    // Run all sub-queries in parallel
    const ownerIds = [...new Set((orders || []).map((o: any) => o.owner_user_id || o.manager_user_id).filter(Boolean))];

    const [servicesResult, ownerProfilesResult, invoicesResult] = await Promise.all([
      supabaseAdmin
        .from("order_services")
        .select("order_id, invoice_id, res_status, service_type, client_price, service_price, category, commission_amount, agent_discount_value, vat_rate, service_date_from, service_date_to, payer_name, referral_include_in_commission, referral_commission_percent_override, referral_commission_fixed_amount")
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

      const activeServices = services.filter((s: any) => s.res_status !== "cancelled");
      const totalServices = activeServices.length;
      const invoicedServices = activeServices.filter((s: any) => s.invoice_id).length;
      const hasInvoice = invoices.length > 0;
      const allServicesInvoiced = totalServices > 0 && invoicedServices === totalServices;

      // Amount & profit: include ALL services (incl. cancelled); cancellation = negative
      const signed = (s: any, field: "client_price" | "service_price") => {
        const v = Number(s[field]) || 0;
        return s.service_type === "cancellation" ? -Math.abs(v) : v;
      };
      const amount = services.reduce((sum: number, s: any) => sum + signed(s, "client_price"), 0);
      let profit = 0;
      let vat = 0;
      services.forEach((s: any) => {
        const econ = computeServiceLineEconomics({
          client_price: s.client_price,
          service_price: s.service_price,
          service_type: s.service_type,
          category: s.category,
          commission_amount: s.commission_amount,
          vat_rate: s.vat_rate,
        });
        profit += econ.profitNetOfVat;
        vat += econ.vatOnMargin;
      });

      serviceStats.set(orderId, { amount, profit, vat });

      const allInvoicesPaid =
        invoices.length > 0 && invoices.every((inv: any) => inv.status === "paid");

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

    const referralCommissionByOrder = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: refRows } = await supabaseAdmin
        .from("referral_accrual_line")
        .select("order_id, commission_amount")
        .eq("company_id", companyId)
        .in("order_id", orderIds)
        .in("status", ["planned", "accrued"]);
      for (const r of refRows || []) {
        const row = r as { order_id: string; commission_amount?: number | string | null };
        const amt = Number(row.commission_amount) || 0;
        referralCommissionByOrder.set(
          row.order_id,
          (referralCommissionByOrder.get(row.order_id) || 0) + amt
        );
      }
    }

    // Processing fees from card payments
    const processingFeesByOrder = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: feeRows } = await supabaseAdmin
        .from("payments")
        .select("order_id, processing_fee")
        .eq("company_id", companyId)
        .in("order_id", orderIds)
        .neq("status", "cancelled")
        .gt("processing_fee", 0);
      for (const r of (feeRows || []) as { order_id: string; processing_fee: number | string }[]) {
        const fee = Number(r.processing_fee) || 0;
        if (fee > 0) {
          processingFeesByOrder.set(
            r.order_id,
            (processingFeesByOrder.get(r.order_id) || 0) + fee
          );
        }
      }
    }

    // Aggregate payer names per order for search
    const payerNamesMap = new Map<string, string[]>();
    servicesData.forEach((s: any) => {
      if (!s.payer_name || s.res_status === "cancelled") return;
      const names = payerNamesMap.get(s.order_id) || [];
      if (!names.includes(s.payer_name)) names.push(s.payer_name);
      payerNamesMap.set(s.order_id, names);
    });

    // Service-line client names (all lines, incl. cancelled) — Orders list search / filters
    const serviceClientNamesMap = new Map<string, string[]>();
    servicesData.forEach((s: any) => {
      const name = String(s.client_name || "").trim();
      if (!name) return;
      const list = serviceClientNamesMap.get(s.order_id) || [];
      if (!list.includes(name)) list.push(name);
      serviceClientNamesMap.set(s.order_id, list);
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
      let profitFromServices = svcStats?.profit ?? Number(order.profit_estimated) ?? 0;
      let vatFromServices = svcStats?.vat ?? 0;

      // Processing fees reduce gross margin → proportionally reduce both VAT and profit
      const totalProcessingFees = processingFeesByOrder.get(orderId) || 0;
      if (totalProcessingFees > 0) {
        const grossMargin = profitFromServices + vatFromServices;
        if (grossMargin > 0) {
          const adjustedMargin = grossMargin - totalProcessingFees;
          const ratio = adjustedMargin / grossMargin;
          vatFromServices = Math.round(vatFromServices * ratio * 100) / 100;
          profitFromServices = Math.round((adjustedMargin - vatFromServices) * 100) / 100;
        }
      }

      // Referral commission (percent-based calculated on profit AFTER processing fees)
      const hasReferral = Boolean(order.referral_party_id);
      let referralCommissionTotal = 0;
      if (hasReferral) {
        referralCommissionTotal = referralCommissionByOrder.get(orderId) || 0;
        if (referralCommissionTotal === 0) {
          const svcLines = servicesByOrder.get(orderId) || [];
          const origProfitByLine: { svc: any; origProfit: number }[] = [];
          let totalOrigProfit = 0;
          for (const svc of svcLines) {
            if (svc.res_status === "cancelled" || !svc.referral_include_in_commission) continue;
            const lineProfit = computeServiceLineEconomics(svc).profitNetOfVat;
            origProfitByLine.push({ svc, origProfit: lineProfit });
            totalOrigProfit += lineProfit;
          }
          for (const { svc, origProfit } of origProfitByLine) {
            if (svc.referral_commission_fixed_amount != null && Number(svc.referral_commission_fixed_amount) > 0) {
              referralCommissionTotal += Number(svc.referral_commission_fixed_amount);
            } else if (svc.referral_commission_percent_override != null && Number(svc.referral_commission_percent_override) > 0) {
              const adjustedLineProfit = totalOrigProfit > 0
                ? Math.round(profitFromServices * (origProfit / totalOrigProfit) * 100) / 100
                : 0;
              referralCommissionTotal += Math.round(adjustedLineProfit * Number(svc.referral_commission_percent_override) / 100 * 100) / 100;
            }
          }
        }
      }
      const profit = hasReferral ? profitFromServices - referralCommissionTotal : profitFromServices;
      const vat = vatFromServices;
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
        serviceClients: serviceClientNamesMap.get(orderId) || [],
        dueDate: invStats?.dueDate || (order.client_payment_due_date as string) || undefined,
        hasReferral,
        referralCommissionTotal: hasReferral ? referralCommissionTotal : 0,
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
