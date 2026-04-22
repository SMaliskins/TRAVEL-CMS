import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getApiUser } from "@/lib/auth/getApiUser";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";
import {
  hasRussianJcukenChar,
  russianJcukenToLatinQwerty,
} from "@/lib/search/russianJcukenToLatinQwerty";

// Edge runtime — lower cold start
export const runtime = "edge";

// Placeholder URLs for build-time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

type PartySearchShape = {
  display_name?: string | null;
  status?: string | null;
  party_person?:
    | { first_name?: string | null; last_name?: string | null }
    | { first_name?: string | null; last_name?: string | null }[]
    | null;
};

function buildPartySearchLabel(party: PartySearchShape | null | undefined): string {
  if (!party) return "";
  const dn = String(party.display_name || "").trim();
  if (dn) return dn;
  const pr = party.party_person;
  const person = Array.isArray(pr) ? pr[0] : pr;
  const parts = [person?.first_name, person?.last_name].filter(Boolean) as string[];
  return parts.join(" ").trim();
}

function pushUniqueOrderName(map: Map<string, string[]>, orderId: string, name: string) {
  const n = name.trim();
  if (!n) return;
  const arr = map.get(orderId) || [];
  if (!arr.includes(n)) arr.push(n);
  map.set(orderId, arr);
}

function mergeOrderNameMaps(target: Map<string, string[]>, source: Map<string, string[]>) {
  for (const [orderId, names] of source) {
    for (const n of names) {
      pushUniqueOrderName(target, orderId, n);
    }
  }
}

const TRAVELLER_LABEL_CHUNK = 400;

function chunkIds<T>(ids: T[], chunkSize: number): T[][] {
  if (ids.length === 0) return [];
  if (ids.length <= chunkSize) return [ids];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(ids.slice(i, i + chunkSize));
  }
  return out;
}

/**
 * Diacritic-insensitive normalization mirroring Postgres `unaccent()`.
 * NFD-decomposes characters and strips combining marks, plus a small map for
 * letters that don't decompose (ł, ø, đ, ß, æ, œ, þ, ð, ı). Result is lowercased.
 */
function normalizeForSearch(input: string): string {
  let s = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, string> = {
    "ł": "l", "Ł": "L",
    "ø": "o", "Ø": "O",
    "đ": "d", "Đ": "D",
    "ß": "ss",
    "æ": "ae", "Æ": "AE",
    "œ": "oe", "Œ": "OE",
    "þ": "th", "Þ": "TH",
    "ð": "d", "Ð": "D",
    "ı": "i", "İ": "I",
  };
  s = s.replace(/[łŁøØđĐßæÆœŒþÞðÐıİ]/g, (c) => map[c] ?? c);
  return s.toLowerCase();
}

/**
 * PostgREST `.or()` fragment matched against `search_text` (lower+unaccent blob
 * containing order_code, client_display_name, traveller/payer/service-client labels).
 * Input is normalized the same way (lower+unaccent) so "Ulja" finds "Uļjanova"
 * and "Gilch" finds "Gilchenko". Requires migration
 * `migrations/add_unaccent_to_orders_search_text.sql` on the database.
 *
 * If the user typed with Russian layout but meant Latin (e.g. "ифдедштук" for
 * "baltliner"), we also OR-match the JCUKEN→QWERTY conversion so the DB
 * (Latin) still matches.
 */
function buildSearchTextIlikeClause(core: string): string {
  const esc = core
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `search_text.ilike.%${esc}%`;
}

function ordersListTextSearchOrClause(raw: string): string | null {
  const normalizeCore = (s: string) =>
    normalizeForSearch(s)
      .trim()
      .replace(/[%,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const core = normalizeCore(raw);
  if (!core) return null;

  const fragments: string[] = [buildSearchTextIlikeClause(core)];

  if (hasRussianJcukenChar(raw)) {
    const altCore = normalizeCore(russianJcukenToLatinQwerty(raw));
    if (altCore && altCore !== core) {
      fragments.push(buildSearchTextIlikeClause(altCore));
    }
  }

  return [...new Set(fragments)].join(",");
}

const ORDER_TRAVELLERS_LABEL_SELECT = `order_id,
         party:party_id (
           display_name,
           status,
           party_person ( first_name, last_name )
         )`;

/**
 * Display names for order_travellers + parties linked via order_service_travellers (service users).
 * Used for Orders list text / surname search.
 * Chunks run in parallel (Promise.all); order_travellers and order_services mini-fetch run in parallel when both needed.
 */
async function collectTravellerSearchLabelsByOrder(
  supabase: SupabaseClient,
  companyId: string,
  orderIds: string[],
  serviceRows: { id: string; order_id: string }[] | null
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (orderIds.length === 0) return out;

  const orderChunks = chunkIds(orderIds, TRAVELLER_LABEL_CHUNK);
  const needSvcMini = !serviceRows || serviceRows.length === 0;

  const [otChunkResults, svcMiniChunkResults] = await Promise.all([
    Promise.all(
      orderChunks.map((chunk) =>
        supabase
          .from("order_travellers")
          .select(ORDER_TRAVELLERS_LABEL_SELECT)
          .eq("company_id", companyId)
          .in("order_id", chunk)
      )
    ),
    needSvcMini
      ? Promise.all(
          orderChunks.map((chunk) =>
            supabase
              .from("order_services")
              .select("id, order_id")
              .eq("company_id", companyId)
              .in("order_id", chunk)
          )
        )
      : Promise.resolve([] as { data: unknown; error: unknown }[]),
  ]);

  for (const res of otChunkResults) {
    for (const row of res.data || []) {
      const rec = row as { order_id: string; party: unknown };
      const partyRaw = rec.party;
      const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw;
      const p = party as PartySearchShape | null;
      if (!p || (p.status && p.status !== "active")) continue;
      const label = buildPartySearchLabel(p);
      if (!label) continue;
      pushUniqueOrderName(out, rec.order_id, label);
    }
  }

  let svcRows = serviceRows;
  if (!svcRows || svcRows.length === 0) {
    svcRows = [];
    for (const res of svcMiniChunkResults) {
      svcRows.push(...((res.data || []) as { id: string; order_id: string }[]));
    }
  }

  const serviceIdToOrderId = new Map<string, string>();
  for (const r of svcRows) {
    if (r.id) serviceIdToOrderId.set(r.id, r.order_id);
  }
  const serviceIds = [...serviceIdToOrderId.keys()];
  const serviceIdChunks = chunkIds(serviceIds, TRAVELLER_LABEL_CHUNK);

  const ostChunkResults = await Promise.all(
    serviceIdChunks.map((chunk) =>
      supabase
        .from("order_service_travellers")
        .select("traveller_id, service_id")
        .eq("company_id", companyId)
        .in("service_id", chunk)
    )
  );

  const allOst: { traveller_id: string; service_id: string }[] = [];
  for (const res of ostChunkResults) {
    allOst.push(...((res.data || []) as { traveller_id: string; service_id: string }[]));
  }

  const partyIds = [...new Set(allOst.map((r) => r.traveller_id).filter(Boolean))];
  const partyChunks = chunkIds(partyIds, TRAVELLER_LABEL_CHUNK);

  const partyChunkResults = await Promise.all(
    partyChunks.map((chunk) =>
      supabase
        .from("party")
        .select("id, display_name, status, party_person(first_name, last_name)")
        .in("id", chunk)
    )
  );

  const partyLabelById = new Map<string, string>();
  for (const res of partyChunkResults) {
    for (const p of res.data || []) {
      const row = p as { id: string; status?: string | null } & PartySearchShape;
      if (row.status && row.status !== "active") continue;
      const label = buildPartySearchLabel(row);
      if (label) partyLabelById.set(row.id, label);
    }
  }

  for (const row of allOst) {
    const orderId = serviceIdToOrderId.get(row.service_id);
    if (!orderId) continue;
    const label = partyLabelById.get(row.traveller_id);
    if (!label) continue;
    pushUniqueOrderName(out, orderId, label);
  }

  return out;
}

/** Fallback when DB RPC `orders_list_service_economics` is missing or errors (must match SQL). */
function computeServiceStatsFromServices(services: any[]): {
  amount: number;
  profit: number;
  vat: number;
} {
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
      pricing_per_client: s.pricing_per_client,
    });
    profit += econ.profitNetOfVat;
    vat += econ.vatOnMargin;
  });
  return { amount, profit, vat };
}

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
    const searchRaw = searchParams.get("search");
    const searchTrim = (searchRaw || "").trim();
    const lastNameRaw = searchParams.get("lastName");
    const lastNameTrim = (lastNameRaw || "").trim();
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

    // Text search: server-side ilike on order_code + client_display_name + search_text (paginated)
    // Multiple `.or()` groups are ANDed — so search + lastName both narrow the set.
    const textSearchOr = searchTrim ? ordersListTextSearchOrClause(searchTrim) : null;
    if (textSearchOr) {
      query = query.or(textSearchOr);
    }
    const lastNameSearchOr = lastNameTrim ? ordersListTextSearchOrClause(lastNameTrim) : null;
    if (lastNameSearchOr) {
      query = query.or(lastNameSearchOr);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data: allOrders, error, count: totalCount } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json(
        { error: `Failed to fetch orders: ${error.message}` },
        { status: 500 }
      );
    }

    const orders = allOrders || [];

    // Get invoice statistics for all orders
    const orderIds = orders.map((o: any) => o.id);
    
    // Run all sub-queries in parallel
    const ownerIds = [...new Set((orders || []).map((o: any) => o.owner_user_id || o.manager_user_id).filter(Boolean))];

    const [
      servicesResult,
      ownerProfilesResult,
      invoicesResult,
      referralResult,
      paymentsResult,
      econRpcResult,
    ] = await Promise.all([
      orderIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : supabaseAdmin
            .from("order_services")
            .select(
              "id, order_id, invoice_id, res_status, service_type, client_name, client_price, service_price, category, commission_amount, agent_discount_value, vat_rate, service_date_from, service_date_to, payer_name, referral_include_in_commission, referral_commission_percent_override, referral_commission_fixed_amount"
            )
            .eq("company_id", companyId)
            .in("order_id", orderIds),
      ownerIds.length > 0
        ? supabaseAdmin
            .from("user_profiles")
            .select("id, first_name, last_name")
            .in("id", ownerIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
      orderIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : supabaseAdmin
            .from("invoices")
            .select("id, order_id, status, total, due_date, final_payment_date")
            .eq("company_id", companyId)
            .in("order_id", orderIds)
            .neq("status", "cancelled"),
      orderIds.length > 0
        ? supabaseAdmin
            .from("referral_accrual_line")
            .select("order_id, commission_amount")
            .eq("company_id", companyId)
            .in("order_id", orderIds)
            .in("status", ["planned", "accrued"])
        : Promise.resolve({ data: [] as { order_id: string; commission_amount?: number | string | null }[] }),
      orderIds.length > 0
        ? supabaseAdmin
            .from("payments")
            .select("order_id, processing_fee")
            .eq("company_id", companyId)
            .in("order_id", orderIds)
            .neq("status", "cancelled")
            .gt("processing_fee", 0)
        : Promise.resolve({ data: [] as { order_id: string; processing_fee: number | string }[] }),
      orderIds.length > 0
        ? supabaseAdmin.rpc("orders_list_service_economics", {
            p_company_id: companyId,
            p_order_ids: orderIds,
          })
        : Promise.resolve({ data: [] as unknown[], error: null }),
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
    
    // Service stats (amount, profit net of VAT, VAT on margin) — A2: Postgres RPC when available
    const serviceStats = new Map<string, { amount: number; profit: number; vat: number }>();
    if (orderIds.length > 0) {
      const econErr = (econRpcResult as { error?: { message?: string } | null }).error;
      const econRows = (econRpcResult as { data?: unknown }).data;
      if (!econErr && Array.isArray(econRows)) {
        for (const row of econRows as {
          order_id: string;
          amount_sum?: unknown;
          profit_sum?: unknown;
          vat_sum?: unknown;
        }[]) {
          serviceStats.set(row.order_id, {
            amount: Number(row.amount_sum) || 0,
            profit: Number(row.profit_sum) || 0,
            vat: Number(row.vat_sum) || 0,
          });
        }
        for (const oid of orderIds) {
          if (!serviceStats.has(oid)) {
            serviceStats.set(oid, { amount: 0, profit: 0, vat: 0 });
          }
        }
      } else {
        if (econErr?.message) {
          console.warn("[Orders] orders_list_service_economics RPC failed, using JS:", econErr.message);
        }
        for (const oid of orderIds) {
          serviceStats.set(oid, computeServiceStatsFromServices(servicesByOrder.get(oid) || []));
        }
      }
    }

    orderIds.forEach((orderId: string) => {
      const services = servicesByOrder.get(orderId) || [];
      const invoices = invoicesByOrder.get(orderId) || [];

      const activeServices = services.filter((s: any) => s.res_status !== "cancelled");
      const totalServices = activeServices.length;
      const invoicedServices = activeServices.filter((s: any) => s.invoice_id).length;
      const hasInvoice = invoices.length > 0;
      const allServicesInvoiced = totalServices > 0 && invoicedServices === totalServices;

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
    for (const r of referralResult.data || []) {
      const row = r as { order_id: string; commission_amount?: number | string | null };
      const amt = Number(row.commission_amount) || 0;
      referralCommissionByOrder.set(
        row.order_id,
        (referralCommissionByOrder.get(row.order_id) || 0) + amt
      );
    }

    const processingFeesByOrder = new Map<string, number>();
    for (const r of (paymentsResult.data || []) as { order_id: string; processing_fee: number | string }[]) {
      const fee = Number(r.processing_fee) || 0;
      if (fee > 0) {
        processingFeesByOrder.set(r.order_id, (processingFeesByOrder.get(r.order_id) || 0) + fee);
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

    const travellerLabelsForList = await collectTravellerSearchLabelsByOrder(
      supabaseAdmin,
      companyId,
      orderIds,
      servicesData.length > 0
        ? (servicesData as { id: string; order_id: string }[])
            .map((s) => ({ id: s.id, order_id: s.order_id }))
            .filter((r) => r.id)
        : null
    );
    mergeOrderNameMaps(serviceClientNamesMap, travellerLabelsForList);

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

    const total = totalCount ?? transformedOrders.length;
    return NextResponse.json({
      orders: transformedOrders,
      agents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Orders GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
