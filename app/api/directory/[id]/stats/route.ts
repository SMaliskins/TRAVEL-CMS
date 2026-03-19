import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EMPTY_STATS = {
  ordersCount: 0,
  totalSpent: 0,
  totalSpentBreakdown: [] as Array<{ orderCode: string; amount: number }>,
  debt: 0,
  lastTrip: null as string | null,
  nextTrip: null as string | null,
  invoicesCount: 0,
  invoicesTotal: 0,
  paymentsTotal: 0,
  paymentStatus: "unpaid" as const,
  balance: 0,
  overdueInvoices: [] as Array<{ invoice_number: string | null; due_date: string; total: number }>,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partyId } = await params;

    if (!partyId) {
      return NextResponse.json({ error: "Party ID is required" }, { status: 400 });
    }

    // 1. Orders count (distinct orders where party is client)
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from("order_services")
      .select("order_id")
      .eq("client_party_id", partyId);

    if (ordersError) {
      console.error("[Stats API] Orders count error:", ordersError);
      return NextResponse.json(EMPTY_STATS);
    }

    const uniqueOrderIds = [...new Set(ordersData?.map((s) => s.order_id) || [])];
    const ordersCount = uniqueOrderIds.length;

    // 2. Total Spent (sum of client_price where party is payer, excluding cancelled)
    const { data: totalSpentData, error: totalSpentError } = await supabaseAdmin
      .from("order_services")
      .select("client_price, order_id, res_status")
      .eq("payer_party_id", partyId)
      .neq("res_status", "cancelled");

    if (totalSpentError) {
      console.error("[Stats API] Total spent error:", totalSpentError);
      return NextResponse.json(EMPTY_STATS);
    }

    // Calculate total spent and breakdown by order (excluding cancelled)
    const spentByOrder = new Map<string, number>();
    totalSpentData?.forEach((s) => {
      const current = spentByOrder.get(s.order_id) || 0;
      spentByOrder.set(s.order_id, current + (s.client_price || 0));
    });

    const totalSpent = Array.from(spentByOrder.values()).reduce((sum, val) => sum + val, 0);
    
    // Get order codes for the orders
    const orderIdsForSpent = Array.from(spentByOrder.keys());
    let orderBreakdown: Array<{ orderCode: string; amount: number }> = [];
    
    if (orderIdsForSpent.length > 0) {
      const { data: ordersForSpent } = await supabaseAdmin
        .from("orders")
        .select("id, order_code")
        .in("id", orderIdsForSpent);
      
      orderBreakdown = ordersForSpent?.map((o) => ({
        orderCode: o.order_code,
        amount: spentByOrder.get(o.id) || 0
      })) || [];
    }
    

    // 3. Debt (calculated as Turnover - Amount Paid)
    // Get amount_paid for orders where party is payer
    const { data: payerOrdersData, error: payerOrdersError } = await supabaseAdmin
      .from("order_services")
      .select("order_id")
      .eq("payer_party_id", partyId);

    if (payerOrdersError) {
      console.error("[Stats API] Payer orders error:", payerOrdersError);
      return NextResponse.json(EMPTY_STATS);
    }

    const payerOrderIds = [...new Set(payerOrdersData?.map((s) => s.order_id) || [])];

    let amountPaid = 0;
    if (payerOrderIds.length > 0) {
      const { data: paidData, error: paidError } = await supabaseAdmin
        .from("orders")
        .select("amount_paid")
        .in("id", payerOrderIds);

      if (paidError) {
        console.error("[Stats API] Amount paid error:", paidError);
      } else {
        amountPaid = paidData?.reduce((sum, o) => sum + (o.amount_paid || 0), 0) || 0;
      }
    }
    
    // Calculate debt as Turnover minus what has been paid
    const debt = totalSpent - amountPaid;

    // 4. Last Trip (most recent past date_to where party is client)
    let lastTrip = null;
    if (uniqueOrderIds.length > 0) {
      const { data: lastTripData, error: lastTripError } = await supabaseAdmin
        .from("orders")
        .select("date_to")
        .in("id", uniqueOrderIds)
        .not("date_to", "is", null)
        .lte("date_to", new Date().toISOString().split("T")[0])
        .order("date_to", { ascending: false })
        .limit(1);

      if (lastTripError) {
        console.error("[Stats API] Last trip error:", lastTripError);
      } else {
        lastTrip = lastTripData && lastTripData.length > 0 
          ? lastTripData[0].date_to 
          : null;
      }
    }

    // 5. Next Trip (nearest future date_from where party is client)
    let nextTrip = null;
    if (uniqueOrderIds.length > 0) {
      const { data: nextTripData, error: nextTripError } = await supabaseAdmin
        .from("orders")
        .select("date_from")
        .in("id", uniqueOrderIds)
        .not("date_from", "is", null)
        .gte("date_from", new Date().toISOString().split("T")[0])
        .order("date_from", { ascending: true })
        .limit(1);

      if (nextTripError) {
        console.error("[Stats API] Next trip error:", nextTripError);
      } else {
        nextTrip = nextTripData && nextTripData.length > 0 
          ? nextTripData[0].date_from 
          : null;
      }
    }

    // 6. Invoices (where party is payer): count, total, overdue
    const { data: invoicesRaw, error: invoicesError } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, total, due_date, status")
      .eq("payer_party_id", partyId);

    if (invoicesError) {
      console.error("[Stats API] Invoices error:", invoicesError);
    }

    const invoicesList = (invoicesRaw ?? []).filter(
      (inv) => !["cancelled", "replaced"].includes(String(inv.status))
    );
    const invoicesCount = invoicesList.length;
    const invoicesTotal = invoicesList.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const today = new Date().toISOString().split("T")[0];
    const overdueInvoices = invoicesList.filter(
      (inv) => inv.due_date && inv.due_date < today && !["paid", "cancelled", "replaced"].includes(String(inv.status))
    );

    // 7. Payments (where party is payer)
    const { data: paymentsData, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("payer_party_id", partyId)
      .eq("status", "active");

    if (paymentsError) {
      console.error("[Stats API] Payments error:", paymentsError);
    }

    const paymentsTotal = (paymentsData ?? []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = invoicesTotal - paymentsTotal;
    // partial = partially paid (some received, some still owed); unpaid = nothing paid
    const paymentStatus =
      balance < -0.01
        ? "overpaid"
        : overdueInvoices.length > 0
          ? "overdue"
          : balance > 0.01
            ? paymentsTotal > 0
              ? "partial"
              : "unpaid"
            : "paid";

    // 8. Linked companies (for person parties via company_contacts)
    let linkedCompanies: Array<{
      companyPartyId: string;
      companyName: string;
      role: string;
      isPrimary: boolean;
      ordersCount?: number;
      debt?: number;
    }> = [];

    try {
      const { data: links } = await supabaseAdmin
        .from("company_contacts")
        .select(`
          company_party_id,
          role,
          is_primary,
          company:party!company_party_id (
            id,
            display_name
          )
        `)
        .eq("contact_party_id", partyId);

      if (links && links.length > 0) {
        for (const link of links) {
          const company = link.company as unknown as Record<string, unknown> | null;
          const entry: (typeof linkedCompanies)[number] = {
            companyPartyId: link.company_party_id,
            companyName: (company?.display_name as string) || "",
            role: link.role,
            isPrimary: link.is_primary,
          };

          if (link.role === "financial") {
            const { data: compOrders } = await supabaseAdmin
              .from("order_services")
              .select("order_id")
              .eq("payer_party_id", link.company_party_id);
            const compOrderIds = [...new Set(compOrders?.map((s: Record<string, unknown>) => s.order_id) || [])];
            entry.ordersCount = compOrderIds.length;

            const { data: compSpent } = await supabaseAdmin
              .from("order_services")
              .select("client_price, order_id")
              .eq("payer_party_id", link.company_party_id)
              .neq("res_status", "cancelled");
            const compTotal = (compSpent || []).reduce((s: number, r: Record<string, unknown>) => s + (Number(r.client_price) || 0), 0);

            let compPaid = 0;
            if (compOrderIds.length > 0) {
              const { data: paidRows } = await supabaseAdmin
                .from("orders")
                .select("amount_paid")
                .in("id", compOrderIds);
              compPaid = (paidRows || []).reduce((s: number, o: Record<string, unknown>) => s + (Number(o.amount_paid) || 0), 0);
            }
            entry.debt = compTotal - compPaid;
          }

          linkedCompanies.push(entry);
        }
      }
    } catch (e) {
      console.error("[Stats API] Linked companies error:", e);
    }

    const stats = {
      ordersCount,
      totalSpent,
      totalSpentBreakdown: orderBreakdown,
      debt,
      lastTrip,
      nextTrip,
      invoicesCount,
      invoicesTotal,
      paymentsTotal,
      paymentStatus,
      balance,
      overdueInvoices: overdueInvoices.map((inv) => ({
        invoice_number: inv.invoice_number,
        due_date: inv.due_date,
        total: Number(inv.total) || 0,
      })),
      linkedCompanies,
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stats API] Error:", errorMsg);
    return NextResponse.json(EMPTY_STATS);
  }
}
