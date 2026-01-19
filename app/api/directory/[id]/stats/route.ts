import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partyId } = await params;

    if (!partyId) {
      return NextResponse.json({ error: "Party ID is required" }, { status: 400 });
    }

    console.log(`[Stats API] Fetching stats for party: ${partyId}`);

    // 1. Orders count (distinct orders where party is client)
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from("order_services")
      .select("order_id")
      .eq("client_party_id", partyId);

    if (ordersError) {
      console.error("[Stats API] Orders count error:", ordersError);
      return NextResponse.json(
        { error: "Failed to fetch orders count" },
        { status: 500 }
      );
    }

    const uniqueOrderIds = [...new Set(ordersData?.map((s) => s.order_id) || [])];
    const ordersCount = uniqueOrderIds.length;
    console.log(`[Stats API] Found ${ordersCount} orders for client`);

    // 2. Total Spent (sum of client_price where party is payer, excluding cancelled)
    const { data: totalSpentData, error: totalSpentError } = await supabaseAdmin
      .from("order_services")
      .select("client_price, order_id, res_status")
      .eq("payer_party_id", partyId)
      .neq("res_status", "cancelled");

    if (totalSpentError) {
      console.error("[Stats API] Total spent error:", totalSpentError);
      return NextResponse.json(
        { error: "Failed to fetch total spent" },
        { status: 500 }
      );
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
    
    console.log(`[Stats API] Total spent: ${totalSpent}`, orderBreakdown);

    // 3. Debt (calculated as Turnover - Amount Paid)
    // Get amount_paid for orders where party is payer
    const { data: payerOrdersData, error: payerOrdersError } = await supabaseAdmin
      .from("order_services")
      .select("order_id")
      .eq("payer_party_id", partyId);

    if (payerOrdersError) {
      console.error("[Stats API] Payer orders error:", payerOrdersError);
      return NextResponse.json(
        { error: "Failed to fetch payer orders" },
        { status: 500 }
      );
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
    console.log(`[Stats API] Debt: ${debt} (Turnover: ${totalSpent} - Paid: ${amountPaid})`);

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
    console.log(`[Stats API] Last trip: ${lastTrip}`);

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
    console.log(`[Stats API] Next trip: ${nextTrip}`);

    const stats = {
      ordersCount,
      totalSpent,
      totalSpentBreakdown: orderBreakdown,
      debt,
      lastTrip,
      nextTrip,
    };
    
    console.log(`[Stats API] Returning stats:`, stats);

    // Return statistics
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stats API] Error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
