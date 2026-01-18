import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partyId = params.id;

    if (!partyId) {
      return NextResponse.json({ error: "Party ID is required" }, { status: 400 });
    }

    // 1. Orders count (distinct orders where party is client)
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from("order_services")
      .select("order_id")
      .eq("client_party_id", partyId);

    if (ordersError) {
      console.error("Orders count error:", ordersError);
      return NextResponse.json(
        { error: "Failed to fetch orders count" },
        { status: 500 }
      );
    }

    const uniqueOrderIds = [...new Set(ordersData?.map((s) => s.order_id) || [])];
    const ordersCount = uniqueOrderIds.length;

    // 2. Total Spent (sum of client_price where party is payer)
    const { data: totalSpentData, error: totalSpentError } = await supabaseAdmin
      .from("order_services")
      .select("client_price")
      .eq("payer_party_id", partyId);

    if (totalSpentError) {
      console.error("Total spent error:", totalSpentError);
      return NextResponse.json(
        { error: "Failed to fetch total spent" },
        { status: 500 }
      );
    }

    const totalSpent = totalSpentData?.reduce(
      (sum, s) => sum + (s.client_price || 0),
      0
    ) || 0;

    // 3. Debt (sum of amount_debt from orders where party is payer in at least one service)
    const { data: payerOrdersData, error: payerOrdersError } = await supabaseAdmin
      .from("order_services")
      .select("order_id")
      .eq("payer_party_id", partyId);

    if (payerOrdersError) {
      console.error("Payer orders error:", payerOrdersError);
      return NextResponse.json(
        { error: "Failed to fetch payer orders" },
        { status: 500 }
      );
    }

    const payerOrderIds = [...new Set(payerOrdersData?.map((s) => s.order_id) || [])];

    let debt = 0;
    if (payerOrderIds.length > 0) {
      const { data: debtData, error: debtError } = await supabaseAdmin
        .from("orders")
        .select("amount_debt")
        .in("id", payerOrderIds);

      if (debtError) {
        console.error("Debt error:", debtError);
      } else {
        debt = debtData?.reduce((sum, o) => sum + (o.amount_debt || 0), 0) || 0;
      }
    }

    // 4. Last Trip (most recent past date_to where party is client)
    const { data: lastTripData, error: lastTripError } = await supabaseAdmin
      .from("orders")
      .select("date_to")
      .in("id", uniqueOrderIds)
      .not("date_to", "is", null)
      .lte("date_to", new Date().toISOString().split("T")[0])
      .order("date_to", { ascending: false })
      .limit(1);

    if (lastTripError) {
      console.error("Last trip error:", lastTripError);
    }

    const lastTrip = lastTripData && lastTripData.length > 0 
      ? lastTripData[0].date_to 
      : null;

    // 5. Next Trip (nearest future date_from where party is client)
    const { data: nextTripData, error: nextTripError } = await supabaseAdmin
      .from("orders")
      .select("date_from")
      .in("id", uniqueOrderIds)
      .not("date_from", "is", null)
      .gte("date_from", new Date().toISOString().split("T")[0])
      .order("date_from", { ascending: true })
      .limit(1);

    if (nextTripError) {
      console.error("Next trip error:", nextTripError);
    }

    const nextTrip = nextTripData && nextTripData.length > 0 
      ? nextTripData[0].date_from 
      : null;

    // Return statistics
    return NextResponse.json({
      ordersCount,
      totalSpent,
      debt,
      lastTrip,
      nextTrip,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Stats API error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
